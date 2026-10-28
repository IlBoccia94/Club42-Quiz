import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from './lib/supabase'

type Clip = { id: string; title: string; size_bytes: number; signed_url: string | null }
type Reply = { items?: Clip[]; error?: string }
async function request(body: Record<string, unknown> | FormData): Promise<Reply> {
  const { data, error } = await supabase.functions.invoke<Reply>('quiz-soundboard-audio', { body })
  if (error) {
    const context = (error as { context?: Response }).context
    if (context && typeof context.json === 'function') {
      try {
        const json = await context.json() as Reply
        if (json.error) throw new Error(json.error)
      } catch (cause) {
        if (cause instanceof Error && !(cause instanceof SyntaxError)) throw cause
      }
    }
    throw new Error(error.message || 'Connessione Supabase non disponibile.')
  }
  if (!data || data.error) throw new Error(data?.error || 'Risposta non valida da Supabase.')
  return data
}

export default function UploadedAudioPanel({ token, stopSignal }: { token: string; stopSignal: number }) {
  const [clips, setClips] = useState<Clip[]>([])
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const playerRef = useRef<HTMLAudioElement | null>(null)
  const activeRef = useRef(true)

  const stop = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.pause()
      playerRef.current.removeAttribute('src')
      playerRef.current.load()
      playerRef.current = null
    }
    setPlayingId(null)
  }, [])

  const reload = useCallback(async () => {
    try {
      const res = await request({ action: 'list', session_token: token })
      if (activeRef.current) {
        setClips(Array.isArray(res.items) ? res.items : [])
        setLoading(false)
      }
    } catch (cause) {
      if (activeRef.current) {
        setMessage(cause instanceof Error ? cause.message : 'Impossibile caricare gli audio.')
        setLoading(false)
      }
    }
  }, [token])

  useEffect(() => {
    activeRef.current = true
    void reload()
    const interval = window.setInterval(() => void reload(), 90000)
    const onVisible = () => { if (!document.hidden) void reload() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      activeRef.current = false
      stop()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [reload, stop])

  const previousStop = useRef(stopSignal)
  useEffect(() => {
    if (previousStop.current !== stopSignal) {
      previousStop.current = stopSignal
      stop()
    }
  }, [stopSignal, stop])

  function play(clip: Clip) {
    if (!clip.signed_url) {
      setMessage('URL audio non disponibile. Premi Aggiorna per riprovare.')
      void reload()
      return
    }
    stop()
    const audio = new Audio(clip.signed_url)
    playerRef.current = audio
    setPlayingId(clip.id)
    audio.onended = () => {
      if (playerRef.current === audio) {
        playerRef.current = null
        setPlayingId(null)
      }
    }
    void audio.play().catch(() => {
      if (playerRef.current === audio) {
        stop()
        setMessage('Questo browser non riesce a riprodurre il file.')
      }
    })
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) {
      setMessage('Seleziona un file audio prima di creare il pulsante.')
      return
    }
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
      setMessage('File audio troppo grande: massimo 10 MB.')
      return
    }
    const form = new FormData()
    form.append('action', 'upload')
    form.append('session_token', token)
    form.append('title', title.trim())
    form.append('file', file)
    setBusy(true)
    setMessage('⏳ Sto caricando il file audio su Supabase…')
    try {
      await request(form)
      setFile(null)
      setTitle('')
      if (inputRef.current) inputRef.current.value = ''
      setMessage('✓ Audio salvato su Supabase e disponibile nelle altre regie.')
      await reload()
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : 'Caricamento fallito.'
      setMessage('⚠ Non è stato possibile salvare il pulsante: ' + detail)
    } finally {
      setBusy(false)
    }
  }

  async function remove(clip: Clip) {
    if (!window.confirm('Eliminare definitivamente "' + clip.title + '"? Anche il file su Supabase sarà cancellato.')) return
    if (playingId === clip.id) stop()
    setBusy(true)
    setMessage('')
    try {
      await request({ action: 'delete', session_token: token, id: clip.id })
      setClips(previous => previous.filter(item => item.id !== clip.id))
      setMessage('Audio eliminato definitivamente.')
      await reload()
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Eliminazione fallita.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="uploaded-audio-section">
    <div className="uploaded-audio-editor">
      <h3>+ Aggiungi un audio personalizzato</h3>
      <p>Carica un file dal dispositivo e crea un pulsante indipendente da Myinstants, salvato su Supabase.</p>
      <form onSubmit={e => { void add(e) }}>
        <label>File audio (max 10 MB)
          <input type="file" ref={inputRef} accept=".mp3,.wav,.ogg,.m4a,.aac,.webm,.flac,audio/*"
            onChange={e => {
              const chosen = e.target.files?.[0] || null
              setFile(chosen)
              setMessage(chosen ? 'File selezionato: ' + chosen.name : '')
            }}/>
        </label>
        <label>Nome del pulsante (facoltativo)
          <input type="text" maxLength={90} placeholder="Es. Jingle Club42" value={title}
            onChange={e => setTitle(e.target.value)}/>
        </label>
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Salvataggio…' : '+ Crea pulsante'}
        </button>
      </form>
      <p className="uploaded-audio-note">Formati: MP3, WAV, OGG, M4A, AAC, WebM e FLAC. Carica soltanto audio che puoi utilizzare.</p>
      <p className="myinstants-message" role="status" aria-live="polite">{message}</p>
    </div>
    <div className="uploaded-audio-heading">
      <h3>Audio del Club42</h3>
      <span>{clips.length} pulsanti</span>
      <button type="button" disabled={busy} onClick={() => void reload()}>↻ Aggiorna</button>
    </div>
    {loading ? <div className="empty">Caricamento audio…</div> :
      clips.length === 0 ? <div className="empty">Nessun pulsante audio personalizzato. Carica il primo file.</div> :
      <div className="myinstants-grid">
        {clips.map(clip => <article className="myinstants-tile uploaded-audio-tile" key={clip.id}>
          <button type="button" className={playingId === clip.id ? 'uploaded-audio-play playing' : 'uploaded-audio-play'}
            aria-label={'Riproduci ' + clip.title} onClick={() => play(clip)}>
            <span aria-hidden="true">{playingId === clip.id ? '♫' : '▶'}</span>
          </button>
          <strong title={clip.title}>{clip.title}</strong>
          <small>{(clip.size_bytes / 1024 / 1024).toFixed(2)} MB</small>
          <button type="button" className="myinstants-stop-one" onClick={stop}
            disabled={playingId !== clip.id}>■ Ferma</button>
          <button type="button" className="myinstants-remove" disabled={busy}
            onClick={() => { void remove(clip) }}>Elimina audio</button>
        </article>)}
      </div>}
  </section>
}
