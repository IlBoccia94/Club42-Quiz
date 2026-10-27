-- Already applied to Supabase project Club42-Quiz as 20261027170216_normalize_optional_question_text_and_screen_fields.
-- Normalize optional explanations and screen text; require an authorized Master token
-- for all writes via existing SECURITY DEFINER RPCs.
CREATE OR REPLACE FUNCTION private.master_publish_question(p_session_token text, p_question_id uuid, p_reveal_answer boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_q public.questions%rowtype;
  v_round public.rounds%rowtype;
  v_answer public.question_answers%rowtype;
  v_screen public.screen_state%rowtype;
  v_correct_choice text;
BEGIN
  IF NOT private.is_master_session(p_session_token) THEN
    RAISE EXCEPTION 'MASTER_NON_AUTORIZZATO' USING errcode='28000';
  END IF;

  SELECT * INTO v_q FROM public.questions WHERE id=p_question_id;
  IF v_q.id IS NULL THEN
    RAISE EXCEPTION 'DOMANDA_NON_TROVATA' USING errcode='P0001';
  END IF;

  SELECT * INTO v_round FROM public.rounds WHERE id=v_q.round_id;

  UPDATE public.events
  SET current_round_id=v_round.id,
      current_question_id=v_q.id,
      updated_at=now()
  WHERE id=v_round.event_id;

  IF p_reveal_answer THEN
    SELECT * INTO v_answer FROM public.question_answers WHERE question_id=v_q.id;
    SELECT * INTO v_screen FROM public.screen_state
    WHERE event_id=v_round.event_id FOR UPDATE;

    IF v_screen.mode='CHOICE_RECAP' AND v_screen.source_question_id=v_q.id
       AND v_q.question_type IN ('MULTIPLE_CHOICE','TRUE_FALSE') THEN
      v_correct_choice := private.choice_recap_correct_key(v_q.id);
      UPDATE public.screen_state
      SET mode='CHOICE_RECAP',
          body=coalesce(v_answer.answer_text,'Risposta non impostata'),
          footer=private.quiz_clean_optional_text(v_answer.explanation),
          payload=v_screen.payload || jsonb_build_object(
            'revealed',true,
            'correct_choice',v_correct_choice,
            'answer_text',coalesce(v_answer.answer_text,'Risposta non impostata')
          ),
          updated_at=clock_timestamp()
      WHERE event_id=v_round.event_id;
    ELSE
      UPDATE public.screen_state
      SET mode='ANSWER',
          title='RISPOSTA',
          body=coalesce(v_answer.answer_text,'Risposta non impostata'),
          options='[]'::jsonb,
          footer=private.quiz_clean_optional_text(v_answer.explanation),
          round_name=v_round.name,
          source_question_id=v_q.id,
          payload=jsonb_build_object('question',v_q.prompt),
          updated_at=clock_timestamp()
      WHERE event_id=v_round.event_id;
    END IF;
  ELSE
    UPDATE public.screen_state
    SET mode='QUESTION',
        title=v_q.prompt,
        body=NULL,
        options=v_q.options,
        footer=NULL,
        round_name=v_round.name,
        source_question_id=v_q.id,
        payload=jsonb_build_object(
          'question_type',v_q.question_type,
          'clue_steps',v_q.clue_steps,
          'media_url',v_q.media_url,
          'metadata',v_q.metadata
        ),
        updated_at=now()
    WHERE event_id=v_round.event_id;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION private.master_publish_screen(p_session_token text, p_mode text, p_title text DEFAULT NULL::text, p_body text DEFAULT NULL::text, p_options jsonb DEFAULT '[]'::jsonb, p_footer text DEFAULT NULL::text, p_round_name text DEFAULT NULL::text, p_payload jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_master_session(p_session_token) then
    raise exception 'MASTER_NON_AUTORIZZATO' using errcode = '28000';
  end if;

  if p_mode not in ('LOGO','ROUND','QUESTION','ANSWER','LEADERBOARD','CUSTOM','PAUSE') then
    raise exception 'MODALITA_SCHERMO_NON_VALIDA' using errcode = 'P0001';
  end if;

  update public.screen_state
  set mode = p_mode,
      title = private.quiz_clean_optional_text(p_title),
      body = private.quiz_clean_optional_text(p_body),
      options = coalesce(p_options, '[]'::jsonb),
      footer = private.quiz_clean_optional_text(p_footer),
      round_name = private.quiz_clean_optional_text(p_round_name),
      source_question_id = null,
      payload = coalesce(p_payload, '{}'::jsonb),
      updated_at = now()
  where event_id = '00000000-0000-0000-0000-000000000042';
end;
$function$
;

CREATE OR REPLACE FUNCTION private.master_save_question(p_session_token text, p_question jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_round_id uuid;
  v_prompt text;
  v_category text;
  v_type text;
  v_options jsonb;
  v_clues jsonb;
  v_media text;
  v_metadata jsonb;
  v_order integer;
  v_answer text;
  v_answer_payload jsonb;
  v_explanation text;
begin
  if not private.is_master_session(p_session_token) then
    raise exception 'MASTER_NON_AUTORIZZATO' using errcode = '28000';
  end if;

  v_round_id := (p_question->>'round_id')::uuid;
  v_prompt := trim(coalesce(p_question->>'prompt',''));
  v_category := nullif(p_question->>'category_id','');
  v_type := coalesce(nullif(p_question->>'question_type',''), 'STANDARD');
  v_options := coalesce(p_question->'options', '[]'::jsonb);
  v_clues := coalesce(p_question->'clue_steps', '[]'::jsonb);
  v_media := nullif(p_question->>'media_url','');
  v_metadata := coalesce(p_question->'metadata', '{}'::jsonb);
  v_order := coalesce((p_question->>'order_index')::integer, 0);
  v_answer := trim(coalesce(p_question->>'answer_text',''));
  v_answer_payload := coalesce(p_question->'answer_payload', '{}'::jsonb);
  v_explanation := private.quiz_clean_optional_text(p_question->>'explanation');

  if length(v_prompt) < 2 then
    raise exception 'DOMANDA_NON_VALIDA' using errcode = 'P0001';
  end if;

  if nullif(p_question->>'id','') is null then
    insert into public.questions(round_id, category_id, question_type, prompt, options, clue_steps, media_url, metadata, order_index)
    values (v_round_id, v_category, v_type, v_prompt, v_options, v_clues, v_media, v_metadata, v_order)
    returning id into v_id;
  else
    v_id := (p_question->>'id')::uuid;
    update public.questions
    set round_id = v_round_id, category_id = v_category, question_type = v_type, prompt = v_prompt,
        options = v_options, clue_steps = v_clues, media_url = v_media, metadata = v_metadata,
        order_index = v_order, updated_at = now()
    where id = v_id;
  end if;

  insert into public.question_answers(question_id, answer_text, answer_payload, explanation)
  values (v_id, coalesce(v_answer,''), v_answer_payload, v_explanation)
  on conflict (question_id) do update
  set answer_text = excluded.answer_text,
      answer_payload = excluded.answer_payload,
      explanation = excluded.explanation,
      updated_at = now();

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.quiz_clean_answer_explanation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  NEW.explanation := private.quiz_clean_optional_text(NEW.explanation);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION private.quiz_clean_optional_text(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN p_value IS NULL OR lower(btrim(p_value)) IN ('','null','undefined')
    THEN NULL::text
    ELSE p_value
  END
$function$
;
REVOKE ALL ON FUNCTION private.quiz_clean_optional_text(text), private.quiz_clean_answer_explanation() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_quiz_clean_answer_explanation ON public.question_answers;
CREATE TRIGGER trg_quiz_clean_answer_explanation
 BEFORE INSERT OR UPDATE OF explanation ON public.question_answers
 FOR EACH ROW EXECUTE FUNCTION private.quiz_clean_answer_explanation();
-- Manually edited import entry lost its import marker; normalize only when still malformed.
UPDATE public.question_answers SET explanation=NULL, answer_text=answer_text::jsonb #>> '{}', updated_at=now()
WHERE question_id='1c227106-cf15-cf42-0c68-54fbd3a1be18'::uuid
AND lower(btrim(explanation))='null' AND left(btrim(answer_text),1)='"' AND right(btrim(answer_text),1)='"';
