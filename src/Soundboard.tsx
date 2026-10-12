import { useMemo, useState } from 'react'

type Instant = { title: string; slug: string; featured: boolean }

// I 36 risultati della ricerca Myinstants "quiz" (ottobre 2026).
// Utilizziamo solo gli iframe ufficiali offerti sulle pagine dei suoni.
// Nessun MP3 viene copiato, caricato o distribuito da Club42.
const INSTANTS: Instant[] = [
  { title: "Family Fortunes Ding", slug: "family-fortunes-ding-83918", featured: true },
  { title: "Quiz Sting", slug: "quiz-sting-60084", featured: true },
  { title: "Pub Quiz 2023", slug: "pub-quiz-2023-80830", featured: true },
  { title: "Quizizz", slug: "quizizz-85140", featured: true },
  { title: "Welcome To The Quiz", slug: "welcome-to-the-quiz-42196", featured: true },
  { title: "bdh quiz", slug: "bdh-quiz-39147", featured: false },
  { title: "Quizlet Correct", slug: "quizlet-correct-72993", featured: true },
  { title: "The Price is Right Ding-Ding", slug: "the-price-is-right-ding-ding-67508", featured: true },
  { title: "QUIZ .BENAR", slug: "quiz-benar-79879", featured: false },
  { title: "QUIZ .SALAH", slug: "quiz-salah-45334", featured: false },
  { title: "Homestuck Quiz Show Yes Or Right Answer", slug: "homestuck-quiz-show-yes-or-right-answer-19344", featured: true },
  { title: "pop quiz hot shot", slug: "pop-quiz-hot-shot-46875", featured: false },
  { title: "Banjo e Kazooie Acerto Quiz", slug: "banjo-e-kazooie-acerto-quiz-46709", featured: true },
  { title: "Quiz - Football Ladder", slug: "quiz-football-ladder-20160", featured: false },
  { title: "quizas quizas quizas", slug: "quizas-quizas-quizas-2019", featured: false },
  { title: "Quizz Kappaa 4", slug: "quizz-kappaa-4", featured: false },
  { title: "Quizz Kappa 1", slug: "quizz-kappa-1", featured: false },
  { title: "Quizz Kappa 5", slug: "quizz-kappa-5", featured: false },
  { title: "My brain in a multiple cation quiz", slug: "my-brain-in-a-multiple-cation-quiz-6614", featured: false },
  { title: "billy quiz boy", slug: "billy-quiz-boy", featured: false },
  { title: "Quizz Kappaa 2", slug: "quizz-kappaa-2", featured: false },
  { title: "QUIZ WRONG", slug: "quiz-wrong-1004", featured: true },
  { title: "Quizo pasar en un 60 entre 90", slug: "quizo-pasar-en-un-60-entre-90", featured: false },
  { title: "Quizz Kapppa 3", slug: "quizz-kapppa-3", featured: false },
  { title: "Quizzy_Quizzy Rindo", slug: "quizzy_quizzy-rindo", featured: false },
  { title: "Quizzy Rindo", slug: "quizzy-rindo", featured: false },
  { title: "The Chase (TV Show Quiz)", slug: "the-chase-tv-show-quiz-83440", featured: true },
  { title: "Goku World Quiz Jingle", slug: "goku-world-quiz-jingle-37267", featured: true },
  { title: "QUIZ DING", slug: "quiz-ding-86242", featured: true },
  { title: "Banjo e Kazooie Erro Quiz", slug: "banjo-e-kazooie-erro-quiz-37848", featured: true },
  { title: "pop quiz", slug: "pop-quiz-43146", featured: false },
  { title: "quizbowl mfs be like", slug: "quizbowl-mfs-be-like-45407", featured: false },
  { title: "GC PM TTYD Thwomp Quiz", slug: "gc-pm-ttyd-thwomp-quiz-94311", featured: false },
  { title: "JAMÓN QUIZU", slug: "jamon-quizu-6311", featured: false },
  { title: "The experiment I was working on", slug: "the-experiment-i-was-working-on-93482", featured: false },
  { title: "Luke's Quiz", slug: "lukes-quiz-83773", featured: false },
]

const ROOT = 'https://www.myinstants.com/instant/'
const SEARCH_URL = 'https://www.myinstants.com/en/search/?name=quiz'
const FAVORITES_STORAGE = 'club42_quiz_myinstants_favorites'

export default function Soundboard() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'all' | 'featured' | 'favorites'>('all')
  const [reloadKey, setReloadKey] = useState(0)
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(FAVORITES_STORAGE) || '[]')
      return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string') : []
    } catch { return [] }
  })

  const shown = useMemo(() => INSTANTS.filter(item => {
    if (category === 'featured' && !item.featured) return false
    if (category === 'favorites' && !favorites.includes(item.slug)) return false
    return item.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  }), [search, category, favorites])

  function toggleFavorite(slug: string) {
    const next = favorites.includes(slug)
      ? favorites.filter(item => item !== slug)
      : [...favorites, slug]
    setFavorites(next)
    try { localStorage.setItem(FAVORITES_STORAGE, JSON.stringify(next)) } catch { /* storage unavailable */ }
  }

  return <main className="panel soundboard myinstants-board">
    <div className="section-head">
      <div><p className="eyebrow">PULSANTI ORIGINALI</p><h2>Myinstants</h2></div>
      <span className="myinstants-count">{INSTANTS.length} suoni</span>
    </div>
    <p className="sound-help">Premi il pulsante rosso direttamente nel riquadro per riprodurre l’audio originale. I suoni escono dal computer della regia.</p>

    <label className="myinstants-search-label" htmlFor="myinstants-search">Cerca un effetto</label>
    <input id="myinstants-search" type="search" autoComplete="off" placeholder="Es. ding, quiz, wrong…" value={search} onChange={event => setSearch(event.target.value)} />

    <div className="myinstants-filters" role="group" aria-label="Filtra suoni">
      <button className={category === 'all' ? 'selected' : ''} onClick={() => setCategory('all')}>Tutti ({INSTANTS.length})</button>
      <button className={category === 'featured' ? 'selected' : ''} onClick={() => setCategory('featured')}>In evidenza</button>
      <button className={category === 'favorites' ? 'selected' : ''} onClick={() => setCategory('favorites')}>★ Preferiti ({favorites.length})</button>
    </div>

    <div className="myinstants-actions">
      <button className="myinstants-stop" onClick={() => setReloadKey(current => current + 1)} title="Ferma i suoni ricaricando i riquadri incorporati">■ Stop tutti</button>
      <a href={SEARCH_URL} target="_blank" rel="noopener noreferrer">Altri suoni su Myinstants ↗</a>
    </div>

    {shown.length === 0 ? <div className="empty">Nessun pulsante trovato. Prova un’altra ricerca o aggiungi un preferito con ☆.</div> :
      <div className="myinstants-grid">
        {shown.map(item => <article className="myinstants-tile" key={item.slug}>
          <div className="myinstants-tile-tools">
            <button
              type="button"
              className={favorites.includes(item.slug) ? 'myinstants-favorite selected' : 'myinstants-favorite'}
              onClick={() => toggleFavorite(item.slug)}
              title={favorites.includes(item.slug) ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}
              aria-label={favorites.includes(item.slug) ? 'Togli ' + item.title + ' dai preferiti' : 'Aggiungi ' + item.title + ' ai preferiti'}
              aria-pressed={favorites.includes(item.slug)}
            >{favorites.includes(item.slug) ? '★' : '☆'}</button>
            <a href={ROOT + item.slug + '/'} target="_blank" rel="noopener noreferrer" title={'Apri ' + item.title + ' su Myinstants'} aria-label={'Apri ' + item.title + ' su Myinstants'}>↗</a>
          </div>
          <iframe
            key={reloadKey}
            title={'Pulsante audio Myinstants: ' + item.title}
            width="110"
            height="200"
            src={ROOT + item.slug + '/embed/'}
            loading="lazy"
            allow="autoplay"
            scrolling="no"
          />
        </article>)}
      </div>}

    <p className="myinstants-disclaimer">
      Pulsanti incorporati da Myinstants: serve Internet. Volume e riproduzione sono gestiti dal sito nel riquadro; “Stop tutti” ricarica gli iframe. La possibilità di incorporare non certifica i diritti di esecuzione pubblica dei singoli audio.
    </p>
  </main>
}
