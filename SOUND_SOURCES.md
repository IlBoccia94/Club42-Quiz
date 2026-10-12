# Fonti e licenze della Soundboard

La soundboard Club42 usa due tipologie di suoni:

1. **Effetti generati tramite Web Audio API:** countdown, sveglia, campanella, buzzer di errore, tic tac, suspense/rullo di tamburi, applausi stilizzati, trombone comico e boing. Non richiedono file audio né servizi esterni.
2. **Campioni audio CC0**, riprodotti da URL pubblici di un progetto open-source che li include con licenze e provenienza documentate:

   - **Kenney**, pacchetti [Music Jingles](https://kenney.nl/assets/music-jingles), [Interface Sounds](https://kenney.nl/assets/interface-sounds) e [Impact Sounds](https://kenney.nl/assets/impact-sounds). Licenza **Creative Commons Zero (CC0 1.0)**. Campioni: `sfx/game-set.ogg`, `sfx/item-pickup.ogg`, `sfx/ready.ogg`, `sfx/hit-heavy.ogg`, `sfx/ko.ogg`.
   - **qubodup**, [Two Simple Game Music Loops](https://opengameart.org/content/two-simple-game-music-loops). Licenza **CC0 1.0**. Campione: `music/menu-loop.ogg`.

La distribuzione dei campioni e il relativo riepilogo delle licenze sono su [Super Bash Folds / public/assets/audio/open](https://github.com/blancmathis/Super_Bash_Folds/tree/main/public/assets/audio/open) e [LICENSES.md](https://github.com/blancmathis/Super_Bash_Folds/blob/main/public/assets/audio/LICENSES.md). Gli URL nella soundboard sono una dipendenza esterna: se il sito o il file non è raggiungibile, l'app mostra un errore. Per operare offline, copiare in `public/sounds` i campioni CC0 e puntare la soundboard ai file locali.

La riproduzione parte **solo nel browser della regia**, a seguito di un clic. Non è sincronizzata con la vista `#/screen`: per amplificare in sala l'audio, collegare il PC di regia al mixer o agli altoparlanti.
