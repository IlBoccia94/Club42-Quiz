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

## Sincronizzazione del clock del countdown (13 ottobre 2026)

Migrazione live `20261012231710_quiz_server_clock_sync`:
- `public.quiz_server_time()` restituisce il tempo del database in UTC; la funzione è di sola lettura, con privilegi di invocazione anon/auth.
- La regia e lo schermo consultano l'orario server all'avvio e ogni 30 s, calcolando lo scarto usando il punto medio di invio/ricezione per compensare la latenza.
- `useScreenCountdown` sottrae l'ora sincronizzata (`Date.now() + clockOffsetMs`) alla scadenza persistente: la durata non dipende dalla regolazione manuale dell'orologio del PC.
- Se il clock non è ancora disponibile, l'overlay aspetta la sincronizzazione anziché mostrare un tempo residuo potenzialmente errato.
- I preset 5/10/20/30/60 secondi selezionano il valore; solo `Avvia timer` chiama `master_set_timer`. Il tasto Ferma è disabilitato fuori dal countdown.


## Soundboard condivisa (ottobre 2026)

Migrazione `soundboard_shared_custom_favorites`: tabella `private.soundboard_items` con `slug`, `title`, `is_custom`, `is_favorite`; RLS abilitato e nessun accesso diretto da `anon`/`authenticated`. I 114 suoni del catalogo fisso restano nel codice frontend.

RPC pubbliche `master_soundboard_get`, `master_soundboard_change`, `master_soundboard_import` inoltrano a funzioni `private` che verificano **sempre** il token Master con `private.is_master_session`. Il database è condiviso tra dispositivi Master; i client aggiornano la vista all'apertura, al ritorno in primo piano e ogni 20 secondi.

La versione precedente salvava i suoni su `localStorage`. Alla prima visita della nuova versione, la copia precedente viene accodata per l'importazione una sola volta. La coda persistente `club42_myinstants_pending_v1` conserva le operazioni fatte offline e le applica, nell'ordine, al ritorno della connessione. Il messaggio di stato indica se i dati sono sincronizzati oppure solo in copia locale. Una connessione effettiva è necessaria affinché un nuovo dispositivo veda le modifiche.


## Recap alla chiusura delle risposte multiple (ottobre 2026)

Migrazione `20261014001258_choice_recap_screen_and_reveal`:
- `private.master_close_buzzer` pubblica `CHOICE_RECAP` per finestre CHOICE relative a domande MULTIPLE_CHOICE o TRUE_FALSE. Le squadre attive, inclusa l'assenza di risposta, vengono serializzate nello `screen_state.payload.responses`, sincronizzato con la proiezione via Realtime.
- La risposta corretta **non è inclusa nel payload prima della rivelazione**.
- `private.master_publish_question` mantiene il recap se il regista rivela proprio quella domanda: aggiunge la risposta, la spiegazione e la lettera corretta, ottenuta dalla funzione privata `private.choice_recap_correct_key`. Se si rivela una domanda senza recap resta il precedente screen ANSWER.
- Le lettere A/B/C/D, il testo letterale dell'opzione e Vero/Falso vengono interpretati; soluzioni ambigue mostrano il testo senza assegnare a caso il risultato alle squadre.
- Lo schermo evidenzia la risposta giusta e le squadre vincitrici con una transizione verde/oro. Timer e altre modalità sono invariati.


## Indizi progressivi Clue Ladder (14 ottobre 2026)

- In regia, ogni pulsante indizio pubblica una schermata `QUESTION` con `p_payload.question_type='CLUE_LADDER'`, `question_id`, `clue` e la lista cumulativa `clues` fino all'indizio selezionato. Per esempio, il pulsante 3 mostra gli indizi 1, 2 e 3, senza dipendere da click precedenti.
- La visualizzazione pubblica mostra gli indizi progressivi in card leggibili con numerazione, senza punteggi e senza caratteri in corsivo. Soltanto la card nuova riceve una breve animazione; le precedenti mantengono le proprie chiavi React e restano ferme.
- I punti continuano a essere mostrati soltanto nella regia Master per l'organizzatore. `Mostra risposta` continua a usare `master_publish_question` e mantiene invariata la schermata ANSWER.
- Non serve alcuna migrazione di database: le informazioni viaggiano nel payload già supportato da `master_publish_screen` e dallo stato proiettato via Realtime.


## Importazione domande dell'evento 28 ottobre 2026

- Inseriti 276 quesiti con identificativi stabili derivati da tipo e posizione, preservando i round e le categorie già presenti. Ripetere l'import non duplica i quesiti e non altera le risposte delle squadre.
- La categoria aggiuntiva `SPEZZINO` (Asonbelindespezin) contiene 20 domande nella modalità STANDARD.
- Per Clue Ladder il prompt pubblico è generico: il nome da indovinare si trova solo in `question_answers` ed è quindi nascosto fino alla rivelazione.
- Le risposte A/B/C/D delle multiple e finale sono conservate solo nella tabella delle risposte, non nel metadata pubblico.
- I testi delle 10 canzoni in spezzino sono salvati in `questions.metadata.lyrics` e ora sono visualizzati sullo schermo quando la domanda viene pubblicata. I titoli sono conservati in `question_answers`; gli interpreti non sono indicati nel documento e non sono stati inventati.
- Il documento non fornisce quesiti nuovi per DON’T PANIC e Parla come Marvin; queste sezioni restano inalterate.
