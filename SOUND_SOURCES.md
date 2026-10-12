# Myinstants — Soundboard Club42

## Raccolta ampliata

La regia incorpora **114 pulsanti distinti** ricavati da pagine Myinstants effettivamente individuate nelle ricerche:

- [Quiz](https://www.myinstants.com/en/search/?name=quiz) — 36 pulsanti originali
- [Countdown](https://www.myinstants.com/en/search/?name=countdown)
- [Timer](https://www.myinstants.com/en/search/?name=timer)
- [Buzzer](https://www.myinstants.com/en/search/?name=buzzer)
- [Correct](https://www.myinstants.com/en/search/?name=correct)
- [Wrong](https://www.myinstants.com/en/search/?name=wrong)
- [Applause](https://www.myinstants.com/en/search/?name=applause)
- [Drum roll](https://www.myinstants.com/en/search/?name=drum+roll)
- [Suspense](https://www.myinstants.com/en/search/?name=suspense)

I titoli e gli slug sono nel file `src/Soundboard.tsx`. Tutti gli iframe utilizzano il percorso Myinstants `https://www.myinstants.com/instant/<slug>/embed/`, secondo la funzione Embed pubblicata nelle pagine originali.

Non è praticabile incorporare letteralmente tutto il catalogo globale di Myinstants, che contiene migliaia di suoni e cambia continuamente. In compenso è disponibile il modulo **Aggiungi pulsante**: supporta un URL Myinstants della pagina singola, l'URL di un embed o un codice iframe ufficiale; la pagina convalida il dominio e lo slug e memorizza fino a 500 inserimenti in `localStorage` sul dispositivo corrente.

## Arresto immediato del suono

Myinstants carica i player in iframe **cross-origin**, pertanto il JavaScript della regia non può accedere agli elementi `audio` interni degli iframe. La soluzione attuale ferma i suoni rimuovendo gli iframe dal documento e ricreandoli dopo 400 ms.

- **STOP AUDIO**: pulsante rosso prominente e sticky, ferma tutti i player attualmente renderizzati.
- **■ Ferma**: interrompe il singolo iframe senza toccare gli altri.
- **Esc**: attiva STOP AUDIO quando il focus tastiera è sulla pagina della regia. Il browser non inoltra necessariamente gli eventi da dentro iframe di un dominio diverso.
- Cambiare un filtro o una ricerca interrompe i player prima di mostrare l'elenco aggiornato.

La pagina carica 18 pulsanti per volta, con "Mostra altri", così da non scaricare decine di iframe contemporaneamente. I preferiti originali continuano a essere memorizzati sul browser tramite `club42_quiz_myinstants_favorites`.

## Diritti e utilizzo

Il sito Myinstants fornisce un codice iframe ufficiale per incorporare il pulsante. Ciò **non certifica** che tutti i file caricati dagli utenti siano privi di diritti di terzi o utilizzabili pubblicamente durante un evento. Per determinati suoni estratti da programmi televisivi o musica possono occorrere autorizzazioni specifiche. Si devono rispettare i [termini di Myinstants](https://www.myinstants.com/en/terms_of_use.html) e gli eventuali diritti dei creatori dei singoli audio.

Gli iframe richiedono una connessione Internet. La riproduzione avviene sul dispositivo della regia; l'audio non viene inviato automaticamente alla vista pubblica `#/screen`.
