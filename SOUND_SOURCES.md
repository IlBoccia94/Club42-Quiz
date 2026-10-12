# Soundboard Club42 — Myinstants

## Integrazione

La Soundboard utilizza **36 iframe ufficiali** della ricerca [Quiz Soundboard su Myinstants](https://www.myinstants.com/en/search/?name=quiz) (consultata il 12 ottobre 2026).

Per ogni pulsante:
- la pagina del suono Myinstants offre una sezione **"Embed this button to your site!"** con iframe `110 × 200`;
- l'app usa l'URL `https://www.myinstants.com/instant/<slug>/embed/`, come nella sezione Embed originale;
- il browser carica e riproduce il contenuto direttamente da Myinstants. **Non scarichiamo, copiamo né pubblichiamo file MP3 nel repository Club42**;
- il pulsante ★ memorizza i preferiti solo nel `localStorage` del browser;
- il filtro "In evidenza" offre una selezione rapida, mentre "Tutti" include tutti i 36 suoni;
- "Stop tutti" forza il ricaricamento degli iframe (necessario perché i player sono cross-origin).

Esempio documentato da Myinstants:
- [Family Fortunes Ding](https://www.myinstants.com/en/instant/family-fortunes-ding-83918/) → `https://www.myinstants.com/instant/family-fortunes-ding-83918/embed/`

## Limiti tecnici

- **Serve Internet.** La disponibilità e il comportamento dei player dipendono da Myinstants e dalle impostazioni del browser.
- I pulsanti sono iframe di terze parti: l'app ospitante **non può regolare il volume interno** o gestire individualmente play/pause tramite DOM, a causa dell'isolamento cross-origin.
- Per fermare tutti i suoni contemporaneamente si ricaricano i pulsanti. Non è garantito che premere un altro iframe metta in pausa il precedente.
- L'audio esce dal PC della regia, non dalla scheda `#/screen`. Per la sala serve un collegamento dell'uscita audio del dispositivo al sistema di amplificazione.

## Diritti e utilizzo pubblico

L'esistenza del widget "Embed" indica che **Myinstants propone un metodo tecnico per incorporare i propri pulsanti**. Non dimostra però che tutti i suoni caricati dagli utenti siano liberi da diritti di terzi, né autorizza necessariamente l'esecuzione pubblica (per esempio di estratti di trasmissioni TV e brani musicali).

Termini di utilizzo: https://www.myinstants.com/en/terms_of_use.html . In particolare i termini descrivono l'accesso come limitato all'uso personale non commerciale, e il contenuto caricato può includere opere di terzi. Prima di usare determinati audio in eventi pubblici dell'associazione, è opportuno verificarne la situazione dei diritti, se necessario con titolari/licenzianti e con le autorizzazioni pertinenti.
