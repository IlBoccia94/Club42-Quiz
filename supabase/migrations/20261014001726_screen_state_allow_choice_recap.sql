-- Already applied to Club42 Quiz on Supabase as 20261014001726_screen_state_allow_choice_recap.
-- Permit choice recap as a first-class public screen mode.
ALTER TABLE public.screen_state
  DROP CONSTRAINT screen_state_mode_check;
ALTER TABLE public.screen_state
  ADD CONSTRAINT screen_state_mode_check
  CHECK (mode IN ('LOGO','ROUND','QUESTION','ANSWER','CHOICE_RECAP','LEADERBOARD','CUSTOM','PAUSE'));
