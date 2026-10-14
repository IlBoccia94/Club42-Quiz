-- Applied to Supabase Club42-Quiz as 20261014001258_choice_recap_screen_and_reveal.
-- Choice recap is public only after closing interactions; correct answer remains private until reveal.

CREATE OR REPLACE FUNCTION private.choice_recap_correct_key(p_question_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE
  v_type text;
  v_options jsonb;
  v_answer text;
  v_key text;
BEGIN
  SELECT q.question_type, q.options, upper(btrim(a.answer_text))
    INTO v_type, v_options, v_answer
  FROM public.questions q
  LEFT JOIN public.question_answers a ON a.question_id=q.id
  WHERE q.id=p_question_id;

  IF v_answer IS NULL OR v_answer='' THEN RETURN NULL; END IF;

  IF v_type='TRUE_FALSE' THEN
    IF v_answer IN ('V','VERO','TRUE') THEN RETURN 'V'; END IF;
    IF v_answer IN ('F','FALSO','FALSE') THEN RETURN 'F'; END IF;
    RETURN NULL;
  END IF;

  IF v_type='MULTIPLE_CHOICE' AND jsonb_typeof(v_options)='array' THEN
    IF v_answer IN ('A','B','C','D')
      AND jsonb_array_length(v_options) >= ascii(v_answer)-ascii('A')+1 THEN
      RETURN v_answer;
    END IF;
    SELECT chr(ascii('A')+opt.ord::integer-1)
      INTO v_key
    FROM jsonb_array_elements_text(v_options) WITH ORDINALITY opt(value,ord)
    WHERE upper(btrim(opt.value))=v_answer AND opt.ord<=4
    ORDER BY opt.ord
    LIMIT 1;
    RETURN v_key;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION private.master_close_buzzer(p_session_token text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_window public.buzzer_windows%rowtype;
  v_question public.questions%rowtype;
  v_round_name text;
  v_responses jsonb;
BEGIN
  IF NOT private.is_master_session(p_session_token) THEN
    RAISE EXCEPTION 'MASTER_NON_AUTORIZZATO' USING errcode='28000';
  END IF;

  UPDATE public.buzzer_windows
  SET status='CLOSED', closed_at=coalesce(closed_at,clock_timestamp())
  WHERE event_id='00000000-0000-0000-0000-000000000042'
    AND status='OPEN'
  RETURNING * INTO v_window;

  IF v_window.id IS NULL OR v_window.interaction_mode<>'CHOICE'
    OR v_window.question_id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_question FROM public.questions
  WHERE id=v_window.question_id;

  IF v_question.id IS NULL OR v_question.question_type NOT IN ('MULTIPLE_CHOICE','TRUE_FALSE')
    THEN RETURN; END IF;

  SELECT name INTO v_round_name FROM public.rounds WHERE id=v_question.round_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'team_id',t.id,'team_name',t.name,'choice',tr.choice
  ) ORDER BY lower(t.name)), '[]'::jsonb)
  INTO v_responses
  FROM public.teams t
  LEFT JOIN public.team_responses tr
    ON tr.team_id=t.id AND tr.window_id=v_window.id
  WHERE t.event_id=v_window.event_id AND t.active=true;

  UPDATE public.screen_state
  SET mode='CHOICE_RECAP',
      title=v_question.prompt,
      body=NULL,
      options=CASE WHEN v_question.question_type='TRUE_FALSE'
        AND jsonb_array_length(v_question.options)=0
        THEN '["VERO","FALSO"]'::jsonb ELSE v_question.options END,
      footer=NULL,
      round_name=v_round_name,
      source_question_id=v_question.id,
      payload=jsonb_build_object(
        'recap',true,
        'question_type',v_question.question_type,
        'revealed',false,
        'responses',v_responses
      ),
      updated_at=clock_timestamp()
  WHERE event_id=v_window.event_id;
END;
$function$
;

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
          footer=v_answer.explanation,
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
          footer=v_answer.explanation,
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
REVOKE ALL ON FUNCTION private.choice_recap_correct_key(uuid) FROM PUBLIC,anon,authenticated;
