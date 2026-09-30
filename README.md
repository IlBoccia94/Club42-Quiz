# Club42 Quiz

Web app di regia live per il Quiz a Squadre del Club42.

## Viste

- `#/master` — regia completa: iscrizioni, buzzer, punteggi, domande e contenuto del proiettore.
- `#/player` — iscrizione squadra e buzzer.
- `#/screen` — vista fullscreen per proiettore/TV.

## Stack

- React + TypeScript + Vite
- Supabase PostgreSQL + Realtime
- GitHub Pages

Il frontend usa esclusivamente la **publishable key** Supabase, che è progettata per essere pubblica. La password del database e le chiavi `service_role`/secret **non vengono mai inserite nel repository**.

## Sicurezza applicativa

La app non richiede account personali. Master e squadre usano token applicativi ad alta entropia, conservati nel browser e verificati solo da funzioni PostgreSQL protette.

- sessione Master: token casuale con scadenza 12 ore;
- sessione squadra: token casuale separato dai dati pubblici della squadra;
- tutte le tabelle esposte hanno RLS attivo;
- le scritture non sono concesse direttamente ai ruoli frontend;
- domande e risposte non sono leggibili dal ruolo anonimo;
- il buzzer è serializzato lato database con lock della finestra aperta: una sola squadra può vincere.

> La credenziale Master dell'ambiente live viene provisionata separatamente e non è inclusa nelle migrazioni pubbliche del repository.

## Sviluppo locale

```bash
npm install
npm run dev
```

Per compilare:

```bash
npm run build
```

## Database

Le migrazioni sono in `supabase/migrations/`.

Lo schema include:

- eventi;
- categorie e template dei round;
- round, domande e risposte;
- squadre e storico punteggi;
- stato schermo;
- finestre buzzer;
- RPC per login Master, iscrizione squadra, buzzer atomico, regia, punteggi e CRUD quiz.

## Regole quiz preconfigurate

Sono inclusi i template:

- Ma tu lo conosci questo?
- Praticamente innocua
- DON'T PANIC!!!
- Chi l'ha detto?
- La vita, l'universo e quattro risposte
- Uomo Gatto
- Addio e grazie per tutti i punti
- Gotto esplosivo pangalattico
- Parla come Marvin

Le otto categorie Club42 sono precaricate nel database.
