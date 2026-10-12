-- Applied to Supabase as 20261012231710_quiz_server_clock_sync.
CREATE OR REPLACE FUNCTION public.quiz_server_time()
RETURNS timestamptz
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT clock_timestamp();
$$;

REVOKE ALL ON FUNCTION public.quiz_server_time() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quiz_server_time() TO anon, authenticated;
