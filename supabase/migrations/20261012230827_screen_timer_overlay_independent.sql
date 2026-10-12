-- Applied to live Supabase as 20261012230827_screen_timer_overlay_independent.
-- Source for reproducible environment setup.
ALTER TABLE public.screen_state
  ADD COLUMN IF NOT EXISTS timer_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS timer_duration_seconds integer;

ALTER TABLE public.screen_state
  ADD CONSTRAINT screen_timer_valid
  CHECK (
    (timer_started_at IS NULL AND timer_duration_seconds IS NULL)
    OR (timer_started_at IS NOT NULL AND timer_duration_seconds BETWEEN 1 AND 3600)
  );

CREATE OR REPLACE FUNCTION private.master_set_timer(p_session_token text, p_seconds integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF NOT private.is_master_session(p_session_token) THEN
    RAISE EXCEPTION 'MASTER_NON_AUTORIZZATO' USING errcode = '28000';
  END IF;
  IF p_seconds IS NULL OR p_seconds < 0 OR p_seconds > 3600 THEN
    RAISE EXCEPTION 'DURATA_TIMER_NON_VALIDA' USING errcode = '22023';
  END IF;
  UPDATE public.screen_state
     SET timer_started_at = CASE WHEN p_seconds = 0 THEN NULL ELSE clock_timestamp() END,
         timer_duration_seconds = NULLIF(p_seconds, 0),
         updated_at = clock_timestamp()
   WHERE event_id = '00000000-0000-0000-0000-000000000042';
END;
$$;

CREATE OR REPLACE FUNCTION public.master_set_timer(p_session_token text, p_seconds integer)
RETURNS void LANGUAGE sql SET search_path TO ''
AS $$ SELECT private.master_set_timer(p_session_token, p_seconds) $$;

REVOKE ALL ON FUNCTION private.master_set_timer(text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.master_set_timer(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.master_set_timer(text,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.master_set_timer(text,integer) TO anon, authenticated;
