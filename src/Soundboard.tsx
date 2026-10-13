import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSoundboardLibrary } from './useSoundboardLibrary'

type Group = 'Quiz' | 'Timer' | 'Buzzer' | 'Corrette' | 'Sbagliate' | 'Applausi' | 'Suspense' | 'Aggiunti'
type Instant = { title: string; slug: string; group: Group; featured: boolean }
type Filter = 'all' | 'featured' | 'favorites' | Group

// Riferimenti a pagine Myinstants effettivamente individuate. Solo embed ufficiali.
// Nessun MP3 viene copiato o ridistribuito nel repository Club42.
const SOUND_CATALOG: Instant[] = [
  { title: "Family Fortunes Ding", slug: "family-fortunes-ding-83918", group: "Quiz", featured: true },
  { title: "Quiz Sting", slug: "quiz-sting-60084", group: "Quiz", featured: true },
  { title: "Pub Quiz 2023", slug: "pub-quiz-2023-80830", group: "Quiz", featured: true },
  { title: "Quizizz", slug: "quizizz-85140", group: "Quiz", featured: true },
  { title: "Welcome To The Quiz", slug: "welcome-to-the-quiz-42196", group: "Quiz", featured: true },
  { title: "bdh quiz", slug: "bdh-quiz-39147", group: "Quiz", featured: false },
  { title: "Quizlet Correct", slug: "quizlet-correct-72993", group: "Quiz", featured: true },
  { title: "The Price is Right Ding-Ding", slug: "the-price-is-right-ding-ding-67508", group: "Quiz", featured: true },
  { title: "QUIZ .BENAR", slug: "quiz-benar-79879", group: "Quiz", featured: false },
  { title: "QUIZ .SALAH", slug: "quiz-salah-45334", group: "Quiz", featured: false },
  { title: "Homestuck Quiz Show Yes Or Right Answer", slug: "homestuck-quiz-show-yes-or-right-answer-19344", group: "Quiz", featured: true },
  { title: "pop quiz hot shot", slug: "pop-quiz-hot-shot-46875", group: "Quiz", featured: false },
  { title: "Banjo e Kazooie Acerto Quiz", slug: "banjo-e-kazooie-acerto-quiz-46709", group: "Quiz", featured: true },
  { title: "Quiz - Football Ladder", slug: "quiz-football-ladder-20160", group: "Quiz", featured: false },
  { title: "quizas quizas quizas", slug: "quizas-quizas-quizas-2019", group: "Quiz", featured: false },
  { title: "Quizz Kappaa 4", slug: "quizz-kappaa-4", group: "Quiz", featured: false },
  { title: "Quizz Kappa 1", slug: "quizz-kappa-1", group: "Quiz", featured: false },
  { title: "Quizz Kappa 5", slug: "quizz-kappa-5", group: "Quiz", featured: false },
  { title: "My brain in a multiple cation quiz", slug: "my-brain-in-a-multiple-cation-quiz-6614", group: "Quiz", featured: false },
  { title: "billy quiz boy", slug: "billy-quiz-boy", group: "Quiz", featured: false },
  { title: "Quizz Kappaa 2", slug: "quizz-kappaa-2", group: "Quiz", featured: false },
  { title: "QUIZ WRONG", slug: "quiz-wrong-1004", group: "Quiz", featured: true },
  { title: "Quizo pasar en un 60 entre 90", slug: "quizo-pasar-en-un-60-entre-90", group: "Quiz", featured: false },
  { title: "Quizz Kapppa 3", slug: "quizz-kapppa-3", group: "Quiz", featured: false },
  { title: "Quizzy_Quizzy Rindo", slug: "quizzy_quizzy-rindo", group: "Quiz", featured: false },
  { title: "Quizzy Rindo", slug: "quizzy-rindo", group: "Quiz", featured: false },
  { title: "The Chase (TV Show Quiz)", slug: "the-chase-tv-show-quiz-83440", group: "Quiz", featured: true },
  { title: "Goku World Quiz Jingle", slug: "goku-world-quiz-jingle-37267", group: "Quiz", featured: true },
  { title: "QUIZ DING", slug: "quiz-ding-86242", group: "Quiz", featured: true },
  { title: "Banjo e Kazooie Erro Quiz", slug: "banjo-e-kazooie-erro-quiz-37848", group: "Quiz", featured: true },
  { title: "pop quiz", slug: "pop-quiz-43146", group: "Quiz", featured: false },
  { title: "quizbowl mfs be like", slug: "quizbowl-mfs-be-like-45407", group: "Quiz", featured: false },
  { title: "GC PM TTYD Thwomp Quiz", slug: "gc-pm-ttyd-thwomp-quiz-94311", group: "Quiz", featured: false },
  { title: "JAMÓN QUIZU", slug: "jamon-quizu-6311", group: "Quiz", featured: false },
  { title: "The experiment I was working on", slug: "the-experiment-i-was-working-on-93482", group: "Quiz", featured: false },
  { title: "Luke's Quiz", slug: "lukes-quiz-83773", group: "Quiz", featured: false },
  { title: "5 Second Countdown", slug: "5-second-countdown-5302", group: "Timer", featured: false },
  { title: "COUNTDOWN CLOCK", slug: "countdown-clock-91271", group: "Timer", featured: false },
  { title: "10 second countdown", slug: "10-second-countdown-7002", group: "Timer", featured: false },
  { title: "FinalCountdown Timer", slug: "finalcountdown-timer-80874", group: "Timer", featured: false },
  { title: "Mario Kart Countdown", slug: "mario-kart-countdown-20733", group: "Timer", featured: false },
  { title: "3 2 1 countdown", slug: "3-2-1-countdown-52892", group: "Timer", featured: false },
  { title: "Gran Turismo Countdown", slug: "gran-turismo-countdown", group: "Timer", featured: false },
  { title: "Mario Kart 8 - Countdown", slug: "mario-kart-8-countdown-85825", group: "Timer", featured: false },
  { title: "Rocket league countdown", slug: "rocket-league-countdown-84661", group: "Timer", featured: false },
  { title: "Countdown Scary", slug: "countdown-scary-34566", group: "Timer", featured: false },
  { title: "jeopardy countdown", slug: "jeopardy-countdown-75711", group: "Timer", featured: false },
  { title: "countdown 5 seconds", slug: "countdown-5-seconds-65266", group: "Timer", featured: false },
  { title: "Countdown 15 seconds", slug: "countdown-15-seconds-91712", group: "Timer", featured: false },
  { title: "Countdown 3,2,1 GO.", slug: "countdown-3-2-1-go-47819", group: "Timer", featured: false },
  { title: "30sec Countdown Timer", slug: "30sec-countdown-timer-79808", group: "Timer", featured: false },
  { title: "timer tick", slug: "timer-tick-92419", group: "Timer", featured: false },
  { title: "Lost Timer Beep (long)", slug: "lost-timer-beep-long", group: "Timer", featured: false },
  { title: "10 second timer", slug: "10-second-timer-55686", group: "Timer", featured: false },
  { title: "Question Timer", slug: "question-timer-5539", group: "Timer", featured: false },
  { title: "Timer End", slug: "timer-end-53209", group: "Timer", featured: false },
  { title: "Buzzer", slug: "buzzer-89244", group: "Buzzer", featured: false },
  { title: "Wrong Answer Buzzer", slug: "wrong-answer-buzzer-6983", group: "Buzzer", featured: false },
  { title: "Extremely loud incorrect buzzer", slug: "extremely-loud-incorrect-buzzer-43033", group: "Buzzer", featured: false },
  { title: "The Voice Buzzer", slug: "the-voice-buzzer-81458", group: "Buzzer", featured: false },
  { title: "family fortunes Wrong Buzzer", slug: "family-fortunes-wrong-buzzer", group: "Buzzer", featured: false },
  { title: "Wrong lie incorrect buzzer", slug: "wrong-lie-incorrect-buzzer-4726", group: "Buzzer", featured: false },
  { title: "Buzzer error", slug: "buzzer-error-36194", group: "Buzzer", featured: false },
  { title: "extremely loud correct buzzer", slug: "extremely-loud-correct-buzzer-71900", group: "Buzzer", featured: false },
  { title: "Family Feud NO Buzzer", slug: "family-feud-no-buzzer-64324", group: "Buzzer", featured: false },
  { title: "Among us Alert Buzzer", slug: "among-us-alert-buzzer-68883", group: "Buzzer", featured: false },
  { title: "No - Wrong Buzzer", slug: "no-wrong-buzzer-43757", group: "Buzzer", featured: false },
  { title: "family feud buzzer", slug: "family-feud-buzzer-40595", group: "Buzzer", featured: false },
  { title: "Family Feud incorrect buzzer", slug: "family-feud-incorrect-buzzer-73901", group: "Buzzer", featured: false },
  { title: "Wrong (Price is Right)", slug: "wrong-price-is-right-55647", group: "Buzzer", featured: false },
  { title: "correct buzzer", slug: "correct-buzzer-53306", group: "Buzzer", featured: false },
  { title: "Golden Buzzer", slug: "golden-buzzer-23829", group: "Buzzer", featured: false },
  { title: "Buzzer Wrong Answer", slug: "buzzer-wrong-answer-91148", group: "Buzzer", featured: false },
  { title: "Buzzer question pour un champion", slug: "buzzer-question-pour-un-champion-58934", group: "Buzzer", featured: false },
  { title: "Correct Answer GameShow", slug: "correct-answer-gameshow", group: "Corrette", featured: false },
  { title: "correct (ding)", slug: "correct-ding", group: "Corrette", featured: false },
  { title: "Correct Ping", slug: "correct-ping-9950", group: "Corrette", featured: false },
  { title: "Correct sound effect", slug: "correct-sound-effect-93659", group: "Corrette", featured: false },
  { title: "Duolingo Correct", slug: "duolingo-correct-95922", group: "Corrette", featured: false },
  { title: "Correct answer", slug: "correct-answer", group: "Corrette", featured: false },
  { title: "Correct bell", slug: "correct-bell", group: "Corrette", featured: false },
  { title: "Jeopardy Correct Answer", slug: "jeopardy-correct-answer-52735", group: "Corrette", featured: false },
  { title: "Game Show Correct", slug: "game-show-correct-33552", group: "Corrette", featured: false },
  { title: "Correct Ding Gameshow", slug: "correct-ding-gameshow", group: "Corrette", featured: false },
  { title: "Correct - Millionaire", slug: "correct-millionaire-82475", group: "Corrette", featured: false },
  { title: "Correct Answer Bell", slug: "correct-answer-bell-19924", group: "Corrette", featured: false },
  { title: "Wrong!", slug: "wrong", group: "Sbagliate", featured: false },
  { title: "Wrong Answer GameShow", slug: "wrong-answer-gameshow", group: "Sbagliate", featured: false },
  { title: "Sike! That's The Wrong Number!", slug: "sike-thats-the-wrong-number", group: "Sbagliate", featured: false },
  { title: "Wrong Answer", slug: "wrong-answer", group: "Sbagliate", featured: false },
  { title: "Duolingo Wrong", slug: "duolingo-wrong-12298", group: "Sbagliate", featured: false },
  { title: "QI Klaxon", slug: "qi-klaxon-41125", group: "Sbagliate", featured: false },
  { title: "Game Show Wrong", slug: "game-show-wrong-43568", group: "Sbagliate", featured: false },
  { title: "Applause", slug: "applause", group: "Applausi", featured: false },
  { title: "Applause 2", slug: "applause-2", group: "Applausi", featured: false },
  { title: "Sitcom Laughing and Applause", slug: "sitcom-laughing-and-applause-97775", group: "Applausi", featured: false },
  { title: "Audience Applause", slug: "audience-applause", group: "Applausi", featured: false },
  { title: "Small Crowd Applause", slug: "small-crowd-applause", group: "Applausi", featured: false },
  { title: "Crowd Applause w/ Shouting", slug: "crowd-applause-w-shouting-12141", group: "Applausi", featured: false },
  { title: "Crowd Cheer + Applause", slug: "crowd-cheer-applause-73083", group: "Applausi", featured: false },
  { title: "Applause & Cheering", slug: "applause-cheering-25896", group: "Applausi", featured: false },
  { title: "Drum Roll Sound Effect", slug: "drum-roll-sound-effect-92004", group: "Suspense", featured: false },
  { title: "Drum roll", slug: "drum-roll", group: "Suspense", featured: false },
  { title: "Japanese Drum Roll", slug: "japanese-drum-roll-58233", group: "Suspense", featured: false },
  { title: "[5] slow suspense drum roll", slug: "5-slow-suspense-drum-roll-42495", group: "Suspense", featured: false },
  { title: "Drum roll with cymbal crash", slug: "drum-roll-with-cymbal-crash-78811", group: "Suspense", featured: false },
  { title: "sudden suspense", slug: "sudden-suspense-64030", group: "Suspense", featured: false },
  { title: "CINEMATIC SUSPENSE RISER", slug: "cinematic-suspense-riser-10260", group: "Suspense", featured: false },
  { title: "suspense rising", slug: "suspense-rising-68465", group: "Suspense", featured: false },
  { title: "Suspense strike", slug: "suspense-strike-83093", group: "Suspense", featured: false },
  { title: "Dun dun duuun", slug: "dun-dun-duuun", group: "Suspense", featured: false },
  { title: "Millionaire Suspense", slug: "millionaire-suspense-29485", group: "Suspense", featured: false },
  { title: "suspense build up", slug: "suspense-build-up-90807", group: "Suspense", featured: false },
  { title: "Sudden Suspense Boom", slug: "sudden-suspense-boom-7083", group: "Suspense", featured: false },
]
const GROUPS: Group[] = ['Quiz', 'Timer', 'Buzzer', 'Corrette', 'Sbagliate', 'Applausi', 'Suspense', 'Aggiunti']
const ROOT = 'https://www.myinstants.com/instant/'
const SEARCH_URL = 'https://www.myinstants.com/en/search/?name=quiz'
const PAGE_SIZE = 18

// Accetta URL di pagina, URL di embed o un iframe originale copiato da Myinstants.
// La whitelist impedisce di inserire iframe arbitrari da altri domini.
function readInstantSlug(text: string): string | null {
  const input = text.trim().match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? text.trim()
  try {
    const url = new URL(input)
    if (url.protocol !== 'https:' || !['myinstants.com', 'www.myinstants.com'].includes(url.hostname)) return null
    const match = url.pathname.match(/^\/(?:(?:en|it|es|fr|de|pt|nl|ja|ko|hi)\/)?instant\/([a-z0-9][a-z0-9_-]{0,149})(?:\/embed)?\/?$/i)
    return match ? match[1].toLowerCase() : null
  } catch { return null }
}

export default function Soundboard({ token }: { token: string }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const { custom: savedCustom, favorites, syncStatus, addCustom: persistCustom,
    removeCustom: deleteCustom, setFavorite, retrySync } = useSoundboardLibrary(token)
  const custom = useMemo<Instant[]>(() =>
    savedCustom.map(item => ({ ...item, group: 'Aggiunti', featured: false })),
    [savedCustom])
  const [newLink, setNewLink] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [message, setMessage] = useState('')
  const [playersVisible, setPlayersVisible] = useState(true)
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const stopTimer = useRef<number | null>(null)
  const individualTimers = useRef<Map<string, number>>(new Map())

  const stopAll = useCallback(() => {
    // Smontare fisicamente tutti gli iframe interrompe i loro media cross-origin.
    // Un semplice cambio di chiave/src può lasciare audio attivo su alcuni browser.
    if (stopTimer.current !== null) window.clearTimeout(stopTimer.current)
    individualTimers.current.forEach(id => window.clearTimeout(id))
    individualTimers.current.clear()
    setPlayersVisible(false)
    setHidden({})
    stopTimer.current = window.setTimeout(() => {
      setPlayersVisible(true)
      stopTimer.current = null
    }, 400)
  }, [])

  const stopOne = useCallback((slug: string) => {
    const existing = individualTimers.current.get(slug)
    if (existing !== undefined) window.clearTimeout(existing)
    setHidden(old => ({ ...old, [slug]: true }))
    const timer = window.setTimeout(() => {
      setHidden(old => {
        const next = { ...old }
        delete next[slug]
        return next
      })
      individualTimers.current.delete(slug)
    }, 400)
    individualTimers.current.set(slug, timer)
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // Funziona quando il focus è nella pagina Master (non dentro l'iframe cross-origin).
      if (event.key === 'Escape') {
        event.preventDefault()
        stopAll()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [stopAll])

  useEffect(() => () => {
    if (stopTimer.current !== null) window.clearTimeout(stopTimer.current)
    individualTimers.current.forEach(id => window.clearTimeout(id))
    individualTimers.current.clear()
  }, [])

  const sounds = useMemo(() => {
    const seen = new Set<string>()
    return [...custom, ...SOUND_CATALOG].filter(item => {
      if (seen.has(item.slug)) return false
      seen.add(item.slug)
      return true
    })
  }, [custom])

  const filtered = useMemo(() => sounds.filter(item => {
    if (filter === 'featured' && !item.featured && !favorites.includes(item.slug)) return false
    if (filter === 'favorites' && !favorites.includes(item.slug)) return false
    if (GROUPS.includes(filter as Group) && item.group !== filter) return false
    return item.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  }), [sounds, filter, search, favorites])

  const visible = filtered.slice(0, limit)

  function changeFilter(next: Filter) {
    stopAll()
    setFilter(next)
    setLimit(PAGE_SIZE)
  }

  function changeSearch(next: string) {
    stopAll()
    setSearch(next)
    setLimit(PAGE_SIZE)
  }

  function toggleFavorite(slug: string) {
    setFavorite(slug, !favorites.includes(slug))
  }

  function addCustom() {
    const slug = readInstantSlug(newLink)
    if (!slug) {
      setMessage('Inserisci il link a un suono Myinstants o il codice iframe originale.')
      return
    }
    const exists = sounds.find(sound => sound.slug === slug)
    if (exists) {
      setMessage('Questo suono è già nella raccolta: ' + exists.title)
      changeFilter('all')
      setSearch(exists.title)
      setNewLink('')
      return
    }
    const title = newTitle.trim().slice(0, 90) || slug.replace(/-\d+$/, '').replace(/-/g, ' ')
    if (custom.length >= 500) {
      setMessage('Limite di 500 suoni personalizzati raggiunto.')
      return
    }
    persistCustom({ title, slug })
    setMessage('Pulsante aggiunto. Sincronizzazione con Supabase in corso.')
    setNewLink('')
    setNewTitle('')
    setSearch('')
    changeFilter('Aggiunti')
  }

  function removeCustom(slug: string) {
    stopOne(slug)
    deleteCustom(slug)
  }

  return <main className="panel soundboard myinstants-board">
    <div className="section-head">
      <div><p className="eyebrow">QUIZ · TIMER · MEME</p><h2>Myinstants</h2></div>
      <span className="myinstants-count">{sounds.length} suoni</span>
    </div>
    <p className="sound-help">Premi i pulsanti rossi originali di Myinstants. Per interrompere subito musica e suoni lunghi, usa il comando qui sotto.</p>
    <div className={`myinstants-sync-status status-${syncStatus}`} role="status">
      <span>{syncStatus === 'synced' ? '☁ Pulsanti e preferiti salvati su Supabase'
        : syncStatus === 'connecting' ? '↻ Sincronizzazione soundboard…'
        : syncStatus === 'pending' ? '↻ Modifiche locali in attesa di sincronizzazione'
        : '⚠ Modifiche salvate sul dispositivo; sincronizzazione non disponibile'}</span>
      {syncStatus === 'offline' && <button type="button" onClick={retrySync}>Riprova</button>}
    </div>

    <div className="myinstants-stopbar">
      <button type="button" className="myinstants-stop myinstants-stop-prominent" onClick={stopAll} aria-label="STOP AUDIO: interrompi tutti i suoni Myinstants">
        <span aria-hidden="true">■</span> STOP AUDIO
      </button>
      <small>Ferma tutti · Esc*</small>
    </div>

    <label className="myinstants-search-label" htmlFor="myinstants-search">Cerca un suono</label>
    <input id="myinstants-search" type="search" placeholder="Quiz, timer, buzzer, meme…" autoComplete="off"
      value={search} onChange={e => changeSearch(e.target.value)} />

    <div className="myinstants-filters" role="group" aria-label="Filtra pulsanti">
      <button className={filter === 'featured' ? 'selected' : ''} onClick={() => changeFilter('featured')}>★ In evidenza</button>
      <button className={filter === 'favorites' ? 'selected' : ''} onClick={() => changeFilter('favorites')}>Preferiti ({favorites.length})</button>
      <button className={filter === 'all' ? 'selected' : ''} onClick={() => changeFilter('all')}>Tutti ({sounds.length})</button>
      {GROUPS.map(group => <button key={group} className={filter === group ? 'selected' : ''}
        onClick={() => changeFilter(group)}>{group}</button>)}
    </div>

    <div className="myinstants-actions">
      <span>{filtered.length} trovati · {visible.length} mostrati</span>
      <a href={SEARCH_URL} target="_blank" rel="noopener noreferrer">Cerca su Myinstants ↗</a>
    </div>

    {!filtered.length ? <div className="empty">Nessun pulsante trovato. Prova un altro filtro o aggiungine uno tramite link.</div> :
      <div className="myinstants-grid">
        {visible.map(item => <article className="myinstants-tile" key={item.slug}>
          <div className="myinstants-tile-tools">
            <button type="button" className={favorites.includes(item.slug) ? 'myinstants-favorite selected' : 'myinstants-favorite'}
              title={favorites.includes(item.slug) ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}
              aria-label={(favorites.includes(item.slug) ? 'Togli ' : 'Aggiungi ') + item.title + ' ai preferiti'}
              aria-pressed={favorites.includes(item.slug)} onClick={() => toggleFavorite(item.slug)}>
              {favorites.includes(item.slug) ? '★' : '☆'}
            </button>
            <a href={ROOT + item.slug + '/'} target="_blank" rel="noopener noreferrer"
              aria-label={'Apri ' + item.title + ' su Myinstants'} title="Apri su Myinstants">↗</a>
          </div>
          {playersVisible && !hidden[item.slug] ? <iframe
            title={'Pulsante Myinstants: ' + item.title}
            width="110" height="200" src={ROOT + item.slug + '/embed/'}
            loading="lazy" allow="autoplay" scrolling="no"
          /> : <div className="myinstants-blank"><span>Audio interrotto</span></div>}
          <button type="button" className="myinstants-stop-one"
            onClick={() => stopOne(item.slug)}
            aria-label={'Ferma il suono ' + item.title}>■ Ferma</button>
          {item.group === 'Aggiunti' && <button className="myinstants-remove" onClick={() => removeCustom(item.slug)}>Rimuovi dalla raccolta</button>}
        </article>)}
      </div>}

    {visible.length < filtered.length && <button className="myinstants-load-more" onClick={() => setLimit(value => value + PAGE_SIZE)}>
      Mostra altri suoni ({filtered.length - visible.length} rimanenti)
    </button>}

    <div className="myinstants-add">
      <h3>Aggiungi qualsiasi altro suono Myinstants</h3>
      <p>Incolla il link del pulsante oppure il suo codice iframe. Pulsanti e preferiti vengono salvati su Supabase e condivisi tra le regie. In caso di assenza di rete resta una copia locale.</p>
      <form onSubmit={e => { e.preventDefault(); addCustom() }}>
        <input value={newLink} onChange={e => setNewLink(e.target.value)}
          placeholder="https://www.myinstants.com/en/instant/..." aria-label="Link Myinstants o codice iframe"/>
        <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
          placeholder="Nome personalizzato (facoltativo)" aria-label="Nome personalizzato"/>
        <button type="submit" className="primary">+ Aggiungi pulsante</button>
      </form>
      {message && <div className="myinstants-message" role="status">{message}</div>}
    </div>

    <p className="myinstants-disclaimer">*Esc interrompe i suoni quando il focus è sulla regia, non all’interno di un iframe. Il tasto STOP AUDIO rimane utilizzabile in entrambi i casi. Gli embed richiedono Internet e l’eventuale riproduzione pubblica deve rispettare i diritti relativi a ciascun audio.</p>
  </main>
}
