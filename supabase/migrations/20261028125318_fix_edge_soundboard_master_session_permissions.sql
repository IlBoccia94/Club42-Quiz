-- Applied on Supabase as 20261028125318_fix_edge_soundboard_master_session_permissions
-- The privileged Edge Function invokes public.master_soundboard_get(),
-- which must call the private SECURITY DEFINER validator internally.
-- Limit the grant to the backend service-role only; never expose raw files.
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.master_soundboard_get(text) TO service_role;
