# Supabase — Club42 Quiz

Il database live è già stato inizializzato nel progetto Supabase **Club42-Quiz**.

Migrazioni applicate all'ambiente live:

1. `20260930102843_initial_club42_quiz_schema`
2. `20260930103007_configure_master_login`
3. `20260930103157_harden_rpc_and_add_indexes`

## Modello dati

Tabelle pubbliche:

- `events`
- `categories`
- `round_templates`
- `rounds`
- `questions`
- `question_answers`
- `teams`
- `score_events`
- `screen_state`
- `buzzer_windows`

Le credenziali applicative e i token sono conservati nello schema non esposto `private`.

## Sicurezza

- RLS attivo sulle tabelle esposte.
- Il frontend usa soltanto la publishable key.
- Nessuna password del database, secret key o service-role key deve essere committata.
- Le risposte corrette non sono leggibili dal client squadra.
- Le operazioni Master passano da RPC autenticate da session token.
- Il buzzer viene assegnato nel database con lock transazionale; la prima richiesta valida chiude la finestra.
- Il valore della credenziale Master dell'ambiente live viene provisionato separatamente e non è versionato nel repository.

## Realtime

Sono pubblicate su `supabase_realtime` le tabelle necessarie alla serata:

- `events`
- `teams`
- `screen_state`
- `buzzer_windows`

## Test eseguiti

È stato verificato lato database che, nella stessa finestra buzzer, la prima squadra viene accettata e la seconda rifiutata. I Supabase Security Advisors non riportano vulnerabilità sullo schema corrente.

Per le prossime modifiche allo schema, aggiungere una nuova migrazione versionata invece di modificare manualmente le tabelle.


## Timer indipendente dalla schermata (13 ottobre 2026)

Migrazione live `20261012230827_screen_timer_overlay_independent`:
- `screen_state.timer_started_at` e `timer_duration_seconds`, mantenuti quando si cambia modalità.
- RPC `public.master_set_timer(p_session_token, p_seconds)` con verifica sessione Master nel wrapper privato; 0 interrompe, valori da 1 a 3600 avviano un nuovo countdown.
- Nessun polling per la sincronizzazione: si usa l'abbonamento Realtime già attivo sulla tabella `screen_state`.
- Il display calcola il tempo rimanente partendo dalla data di avvio salvata sul database, così il timer non riparte al cambio domanda o dopo un refresh.
