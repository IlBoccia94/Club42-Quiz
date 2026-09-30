import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { EVENT_ID, supabase } from './lib/supabase'
import type { BuzzerWindow, Category, QuizEvent, QuizQuestion, QuizRound, RoundTemplate, ScreenMode, ScreenState, Team, TeamAccess, TeamSession } from './types'

const MASTER_STORAGE = 'club42_master_session'
const TEAM_STORAGE = 'club42_team_session'
const SCORE_DELTAS = [-20, -15, -10, -5, 5, 10, 15, 20]
const LETTERS = ['A', 'B', 'C', 'D']
const LOGO_URL = `${import.meta.env.BASE_URL}images/IMG-20260914-WA0013.jpg`
const SCREEN_BG_URL = `${import.meta.env.BASE_URL}images/IMG-20260914-WA0075.jpg`
type Route = 'home' | 'master' | 'player' | 'screen'
type PublicState = ReturnType<typeof usePublicState>
type LiveInteractionResponse = { team_id: string; team_name: string; choice: string | null; answered_at: string | null }
type LiveInteraction = {
  window_id: string | null
  mode: 'BUZZER' | 'CHOICE' | null
  status: 'OPEN' | 'CLOSED' | null
  winner_team_id: string | null
  opened_at?: string | null
  closed_at?: string | null
  responses: LiveInteractionResponse[]
}
function questionInteractionMode(question?: QuizQuestion | null): 'BUZZER' | 'CHOICE' {
  return question?.question_type === 'MULTIPLE_CHOICE' || question?.question_type === 'TRUE_FALSE' ? 'CHOICE' : 'BUZZER'
}

function currentRoute(): Route {
  const route = location.hash.replace(/^#\/?/, '').split('?')[0]
  return route === 'master' || route === 'player' || route === 'screen' ? route : 'home'
}
function go(route: Route) { location.hash = route === 'home' ? '#/' : `#/${route}` }
function msg(error: unknown) {
  const raw = String((error as { message?: string })?.message || error || '')
  const known: Record<string, string> = {
    PASSWORD_NON_VALIDA: 'Password Master non valida.',
    MASTER_NON_AUTORIZZATO: 'Sessione Master scaduta. Accedi di nuovo.',
    ISCRIZIONI_CHIUSE: 'Le iscrizioni sono chiuse.',
    NOME_SQUADRA_GIA_USATO: 'Questo nome squadra è già utilizzato.',
    NOME_SQUADRA_NON_VALIDO: 'Inserisci un nome squadra valido.',
    SESSIONE_SQUADRA_NON_VALIDA: 'Sessione squadra non valida.',
    SQUADRA_NON_ATTIVA: 'Questa squadra non è più attiva.',
    DOMANDA_NON_TROVATA: 'Domanda non trovata.',
    CODICE_RIENTRO_NON_VALIDO: 'Nome squadra o codice di rientro non corretti.',
    RISPOSTE_CHIUSE: 'Le risposte sono chiuse.',
    RISPOSTA_NON_VALIDA: 'Risposta non valida.',
  }
  const key = Object.keys(known).find(k => raw.includes(k))
  return key ? known[key] : raw
}
async function rpc<T = unknown>(name: string, params: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw error
  return data as T
}
function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? 'compact' : ''}`}>
    <img className="brand-logo" src={LOGO_URL} alt="Club42" />
    {!compact && <span className="brand-subtitle">Quiz a squadre</span>}
  </div>
}

function usePublicState() {
  const [event, setEvent] = useState<QuizEvent | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [screen, setScreen] = useState<ScreenState | null>(null)
  const [buzzer, setBuzzer] = useState<BuzzerWindow | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [templates, setTemplates] = useState<RoundTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const [e, t, s, b, c, rt] = await Promise.all([
      supabase.from('events').select('*').eq('id', EVENT_ID).single(),
      supabase.from('teams').select('*').eq('event_id', EVENT_ID).eq('active', true).order('score', { ascending: false }),
      supabase.from('screen_state').select('*').eq('event_id', EVENT_ID).single(),
      supabase.from('buzzer_windows').select('*').eq('event_id', EVENT_ID).order('opened_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('categories').select('id,name,sort_order').order('sort_order'),
      supabase.from('round_templates').select('id,name,description,default_config,sort_order').order('sort_order'),
    ])
    const first = e.error || t.error || s.error || b.error || c.error || rt.error
    if (first) setError(msg(first))
    else {
      setEvent(e.data as QuizEvent); setTeams((t.data || []) as Team[]); setScreen(s.data as ScreenState)
      setBuzzer((b.data || null) as BuzzerWindow | null); setCategories((c.data || []) as Category[])
      setTemplates((rt.data || []) as RoundTemplate[]); setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void reload()
    const channel = supabase.channel('club42-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `id=eq.${EVENT_ID}` }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `event_id=eq.${EVENT_ID}` }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'screen_state', filter: `event_id=eq.${EVENT_ID}` }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buzzer_windows', filter: `event_id=eq.${EVENT_ID}` }, () => void reload())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [reload])

  return { event, teams, screen, buzzer, categories, templates, loading, error, reload }
}

export default function App() {
  const [route, setRoute] = useState<Route>(currentRoute())
  useEffect(() => {
    const h = () => setRoute(currentRoute())
    addEventListener('hashchange', h); return () => removeEventListener('hashchange', h)
  }, [])
  if (route === 'master') return <MasterPage />
  if (route === 'player') return <PlayerPage />
  if (route === 'screen') return <ScreenPage />
  return <HomePage />
}

function HomePage() {
  const state = usePublicState()
  return <main className="home">
    <section className="home-card glass">
      <Logo />
      <p className="eyebrow">REGIA DIGITALE DEL QUIZ</p>
      <h1>Una sola app.<br/><em>Tre punti di vista.</em></h1>
      <p className="lead">Master, squadre e proiettore sincronizzati in tempo reale.</p>
      <div className="mode-grid">
        <button className="mode master" onClick={() => go('master')}><span>⌘</span><b>Master</b><small>Regia completa del quiz</small></button>
        <button className="mode player" onClick={() => go('player')}><span>⚡</span><b>Squadra</b><small>Iscrizione e buzzer</small></button>
      </div>
      <button className="link-btn" onClick={() => go('screen')}>Apri modalità Schermo →</button>
      <div className="status"><i className={state.error ? 'red' : 'green'} />{state.loading ? 'Connessione…' : state.error || 'Sistema online'}{state.event && <> · Iscrizioni {state.event.registration_open ? 'aperte' : 'chiuse'}</>}</div>
    </section>
  </main>
}

function MasterPage() {
  const state = usePublicState()
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(MASTER_STORAGE))
  const [password, setPassword] = useState('')
  const [toast, setToast] = useState('')
  const [tab, setTab] = useState<'live' | 'teams' | 'questions'>('live')
  const [quiz, setQuiz] = useState<QuizRound[]>([])

  const loadQuiz = useCallback(async (session = token) => {
    if (!session) return
    try { setQuiz(await rpc<QuizRound[]>('master_get_quiz', { p_session_token: session }) || []) }
    catch (e) {
      const text = msg(e); setToast(text)
      if (text.includes('scaduta')) { localStorage.removeItem(MASTER_STORAGE); setToken(null) }
    }
  }, [token])

  useEffect(() => { if (token) void loadQuiz(token) }, [token, loadQuiz])

  async function login(e: FormEvent) {
    e.preventDefault()
    try {
      const result = await rpc<{ session_token: string }>('master_login', { p_password: password })
      localStorage.setItem(MASTER_STORAGE, result.session_token); setToken(result.session_token); setPassword('')
    } catch (e) { setToast(msg(e)) }
  }
  async function logout() {
    if (token) try { await rpc('master_logout', { p_session_token: token }) } catch { /* noop */ }
    localStorage.removeItem(MASTER_STORAGE); setToken(null)
  }

  if (!token) return <main className="auth-page">
    <button className="back" onClick={() => go('home')}>←</button>
    <form className="auth-card glass" onSubmit={login}>
      <Logo/><p className="eyebrow">ACCESSO MASTER</p><h1>Regia del quiz</h1>
      <label>Password Master</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoFocus placeholder="••••••••••"/>
      {toast && <div className="alert">{toast}</div>}
      <button className="primary" disabled={!password}>Entra nella regia</button>
      <small>La password non viene salvata nel browser.</small>
    </form>
  </main>

  return <div className="master-page">
    <header className="master-header">
      <button className="brand-btn" onClick={() => go('home')}><Logo compact/></button>
      <nav>{(['live','teams','questions'] as const).map(x => <button key={x} className={tab===x?'active':''} onClick={() => setTab(x)}>{x==='live'?'Regia Live':x==='teams'?'Squadre':'Domande'}</button>)}</nav>
      <button className="ghost" onClick={logout}>Esci</button>
    </header>
    {toast && <button className="toast" onClick={() => setToast('')}>{toast} ×</button>}
    {state.error && <div className="toast error">{state.error}</div>}
    {tab === 'live' && <LivePanel token={token} state={state} quiz={quiz} notice={setToast}/>}
    {tab === 'teams' && <TeamsPanel token={token} state={state} notice={setToast}/>}
    {tab === 'questions' && <QuestionsPanel token={token} state={state} quiz={quiz} reloadQuiz={loadQuiz} notice={setToast}/>}
  </div>
}

function LivePanel({ token, state, quiz, notice }: { token: string; state: PublicState; quiz: QuizRound[]; notice: (s:string)=>void }) {
  const [roundId, setRoundId] = useState('')
  const [questionId, setQuestionId] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [customBody, setCustomBody] = useState('')
  const round = quiz.find(r => r.id === roundId) || quiz[0] || null
  const question = round?.questions.find(q => q.id === questionId) || null

  useEffect(() => { if (!roundId && quiz[0]) setRoundId(quiz[0].id) }, [quiz, roundId])
  async function run(name: string, args: Record<string, unknown>, ok: string) {
    try { await rpc(name, { p_session_token: token, ...args }); await state.reload(); notice(ok) } catch (e) { notice(msg(e)) }
  }
  const publish = (mode: ScreenMode, title?: string, body?: string) => run('master_publish_screen', {
    p_mode: mode, p_title: title || null, p_body: body || null, p_options: [], p_footer: null,
    p_round_name: round?.name || null, p_payload: {}
  }, 'Schermo aggiornato.')

  const winner = state.teams.find(t => t.id === state.buzzer?.winner_team_id)
  const interactionMode = questionInteractionMode(question)
  const interactionOpen = state.buzzer?.status === 'OPEN'
  const activeInteractionMode = state.buzzer?.interaction_mode || interactionMode
  const clueScores = Array.isArray(round?.config?.scores) ? round?.config?.scores as number[] : [20,15,10,5,5]

  return <main className="master-content live-layout">
    <section className="panel question-browser">
      <div className="section-head"><div><p className="eyebrow">PREPARA</p><h2>Domanda</h2></div></div>
      <label>Round</label>
      <select value={round?.id || ''} onChange={e => { setRoundId(e.target.value); setQuestionId('') }}>
        {quiz.filter(r=>r.active).map(r => <option value={r.id} key={r.id}>{r.order_index}. {r.name}</option>)}
      </select>
      <div className="question-list">
        {(round?.questions || []).map((q,i) => <button className={questionId===q.id?'selected':''} onClick={()=>setQuestionId(q.id)} key={q.id}><span>{i+1}</span><b>{q.prompt}</b><small>{q.category_id || q.question_type}</small></button>)}
        {!round?.questions.length && <div className="empty">Nessuna domanda in questo round. Creala dalla sezione Domande.</div>}
      </div>
      {question && <div className="selected-question">
        <p className="eyebrow">PRONTA</p><h3>{question.prompt}</h3>
        {question.options?.length > 0 && <div className="mini-options">{question.options.map((o,i)=><span key={i}>{LETTERS[i]} · {o}</span>)}</div>}
        <div className="button-row">
          <button className="primary" onClick={()=>run('master_publish_question',{p_question_id:question.id,p_reveal_answer:false},'Domanda mandata a schermo.')}>Manda a schermo</button>
          <button className="secondary" onClick={()=>run('master_publish_question',{p_question_id:question.id,p_reveal_answer:true},'Risposta mostrata.')}>Mostra risposta</button>
        </div>
        {question.question_type === 'CLUE_LADDER' && question.clue_steps?.length > 0 && <div className="clues">
          <p className="eyebrow">INDIZI</p>
          {question.clue_steps.map((clue,i)=><button key={i} onClick={()=>run('master_publish_screen',{
            p_mode:'QUESTION',p_title:question.prompt,p_body:clue,p_options:[],p_footer:`${clueScores[i] ?? 5} PUNTI`,p_round_name:round?.name,p_payload:{clue:i+1}
          },`Indizio ${i+1} mostrato.`)}><span>#{i+1}</span><b>{clue}</b><strong>{clueScores[i] ?? 5} pt</strong></button>)}
        </div>}
      </div>}
    </section>

    <section className="panel preview-panel">
      <div className="section-head"><div><p className="eyebrow">ANTEPRIMA</p><h2>Schermo pubblico</h2></div><span className="live-pill">● LIVE</span></div>
      <div className="preview-frame"><ScreenCanvas screen={state.screen} teams={state.teams} preview/></div>
      <div className="quick-screen">
        <button onClick={()=>publish('LOGO','CLUB42','Quiz a squadre')}>Logo</button>
        <button onClick={()=>publish('ROUND',round?.name || 'Prossimo round')}>Round</button>
        <button onClick={()=>publish('LEADERBOARD','CLASSIFICA')}>Classifica</button>
        <button onClick={()=>publish('PAUSE','PAUSA','Riprendiamo tra poco')}>Pausa</button>
      </div>
      <div className="custom-box">
        <input placeholder="Titolo libero" value={customTitle} onChange={e=>setCustomTitle(e.target.value)}/>
        <textarea placeholder="Testo da proiettare" value={customBody} onChange={e=>setCustomBody(e.target.value)}/>
        <button className="secondary" onClick={()=>publish('CUSTOM',customTitle,customBody)}>Pubblica testo</button>
      </div>
    </section>

    <aside className="panel control-panel">
      <p className="eyebrow">REGIA</p><h2>Controlli live</h2>
      <div className="control-block">
        <span>Schermo</span>
        <button className={state.screen?.blackout?'danger big':'secondary big'} onClick={()=>run('master_set_blackout',{p_blackout:!state.screen?.blackout},state.screen?.blackout?'Schermo riattivato.':'Schermo oscurato.')}>{state.screen?.blackout?'Riattiva schermo':'Oscura schermo'}</button>
      </div>
      <div className="control-block">
        <span>Iscrizioni</span>
        <button className={state.event?.registration_open?'success big':'secondary big'} onClick={()=>run('master_set_registration',{p_open:!state.event?.registration_open},state.event?.registration_open?'Iscrizioni chiuse.':'Iscrizioni aperte.')}>{state.event?.registration_open?'APERTE · Chiudi':'CHIUSE · Apri'}</button>
      </div>
      <div className="control-block buzzer-control">
        <span>{interactionMode === 'CHOICE' ? 'Risposte squadre' : 'Prenotazione risposta'}</span>
        {interactionOpen
          ? <button className="danger big pulse" onClick={()=>run('master_close_buzzer',{},activeInteractionMode === 'CHOICE' ? 'Risposte chiuse.' : 'Buzzer chiuso.')}>{activeInteractionMode === 'CHOICE' ? 'RISPOSTE APERTE · Chiudi' : 'BUZZER APERTO · Blocca'}</button>
          : <button className="primary big" onClick={()=>run('master_open_interaction',{p_question_id:question?.id || null,p_mode:interactionMode},interactionMode === 'CHOICE' ? 'Risposte aperte.' : 'Buzzer aperto.')}>{interactionMode === 'CHOICE' ? 'Apri risposte' : 'Apri buzzer'}</button>}
        {activeInteractionMode === 'BUZZER' && winner && <div className="winner"><small>PRIMA PRENOTATA</small><b>⚡ {winner.name}</b></div>}
        {interactionMode === 'CHOICE' && <div className="interaction-hint">{question?.question_type === 'TRUE_FALSE' ? 'Tutte le squadre rispondono Vero/Falso contemporaneamente.' : 'Tutte le squadre possono selezionare A, B, C o D contemporaneamente.'}</div>}
      </div>
      <div className="mini-board">
        <div className="section-head"><b>Classifica</b><button onClick={()=>publish('LEADERBOARD','CLASSIFICA')}>Proietta</button></div>
        {state.teams.slice().sort((a,b)=>b.score-a.score).slice(0,8).map((t,i)=><div key={t.id}><span>{i+1}</span><b>{t.name}</b><strong>{t.score}</strong></div>)}
      </div>
    </aside>
  </main>
}

function TeamsPanel({ token, state, notice }: { token:string; state:PublicState; notice:(s:string)=>void }) {
  const [newName,setNewName]=useState('')
  const [access,setAccess]=useState<TeamAccess[]>([])
  const [liveInteraction,setLiveInteraction]=useState<LiveInteraction>({window_id:null,mode:null,status:null,winner_team_id:null,responses:[]})

  const loadAccess = useCallback(async () => {
    try { setAccess(await rpc<TeamAccess[]>('master_get_team_access',{p_session_token:token}) || []) }
    catch(e) { notice(msg(e)) }
  },[token,notice])

  const loadLiveInteraction = useCallback(async () => {
    try {
      const data = await rpc<LiveInteraction>('master_get_live_interaction',{p_session_token:token})
      setLiveInteraction({...data,responses:data?.responses || []})
    } catch(e) { notice(msg(e)) }
  },[token,notice])

  useEffect(()=>{ void loadAccess(); void loadLiveInteraction() },[loadAccess,loadLiveInteraction])
  useEffect(()=>{
    const id = window.setInterval(()=>void loadLiveInteraction(),900)
    return ()=>window.clearInterval(id)
  },[loadLiveInteraction])

  async function call(name:string,args:Record<string,unknown>,ok:string) {
    try {
      const data=await rpc<any>(name,{p_session_token:token,...args})
      await Promise.all([state.reload(),loadLiveInteraction()])
      notice(ok)
      return data
    } catch(e){notice(msg(e))}
  }
  async function add() {
    if(newName.trim().length<2)return
    const data=await call('master_add_team',{p_name:newName.trim()},'Squadra aggiunta.')
    if(data?.team_id && data?.team_token) {
      await loadAccess()
      const url=`${location.origin}${location.pathname}#/player?team=${encodeURIComponent(data.team_id)}&token=${encodeURIComponent(data.team_token)}`
      try {
        await navigator.clipboard.writeText(url)
        notice(`Squadra aggiunta · codice rientro ${data.recovery_code}. Link copiato.`)
      } catch { notice(`Squadra aggiunta · codice rientro ${data.recovery_code}.`) }
    }
    setNewName('')
  }

  const codeByTeam = useMemo(()=>new Map(access.map(a=>[a.team_id,a.recovery_code])),[access])
  const responseByTeam = useMemo(()=>new Map((liveInteraction.responses||[]).map(r=>[r.team_id,r])),[liveInteraction.responses])
  const answeredCount = liveInteraction.responses.filter(r=>r.choice).length

  return <main className="master-content one-column">
    <section className="panel">
      <div className="section-head"><div><p className="eyebrow">GESTIONE</p><h2>Squadre · {state.teams.length}</h2></div><button className="secondary" onClick={()=>call('master_undo_last_score',{},'Ultima modifica punteggio annullata.')}>↶ Annulla ultimo punteggio</button></div>
      <div className="team-help">Ogni squadra ha un <b>codice di rientro</b>. Durante una domanda, questa lista mostra anche in tempo reale chi ha prenotato per primo oppure la risposta scelta da ciascuna squadra.</div>
      {liveInteraction.mode && <div className={`interaction-summary mode-${liveInteraction.mode.toLowerCase()} ${liveInteraction.status?.toLowerCase()}`}>
        <div><span>{liveInteraction.mode === 'BUZZER' ? 'BUZZER' : 'RISPOSTE'}</span><b>{liveInteraction.status === 'OPEN' ? 'APERTO' : 'CHIUSO'}</b></div>
        {liveInteraction.mode === 'BUZZER'
          ? <strong>{liveInteraction.winner_team_id ? 'Prima squadra identificata' : 'In attesa della prima squadra'}</strong>
          : <strong>{answeredCount} / {state.teams.length} squadre hanno risposto</strong>}
      </div>}
      <div className="add-team"><input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Nome nuova squadra" onKeyDown={e=>{if(e.key==='Enter')void add()}}/><button className="primary" onClick={add}>+ Aggiungi</button></div>
      <div className="team-table">
        {state.teams.slice().sort((a,b)=>b.score-a.score).map((team,index)=><TeamRow
          key={team.id}
          team={team}
          rank={index+1}
          recoveryCode={codeByTeam.get(team.id)}
          interactionMode={liveInteraction.mode}
          interactionStatus={liveInteraction.status}
          isBuzzWinner={liveInteraction.mode==='BUZZER' && liveInteraction.winner_team_id===team.id}
          response={responseByTeam.get(team.id)}
          act={call}
        />)}
        {!state.teams.length && <div className="empty">Nessuna squadra iscritta.</div>}
      </div>
    </section>
  </main>
}
function TeamRow({
  team,rank,recoveryCode,interactionMode,interactionStatus,isBuzzWinner,response,act
}:{
  team:Team
  rank:number
  recoveryCode?:string
  interactionMode:LiveInteraction['mode']
  interactionStatus:LiveInteraction['status']
  isBuzzWinner:boolean
  response?:LiveInteractionResponse
  act:(name:string,args:Record<string,unknown>,ok:string)=>Promise<any>
}) {
  const [name,setName]=useState(team.name)
  const [manual,setManual]=useState(String(team.score))
  useEffect(()=>{setName(team.name);setManual(String(team.score))},[team.name,team.score])
  async function copyCode(){ if(recoveryCode) try{await navigator.clipboard.writeText(recoveryCode)}catch{/* noop */} }

  const interactionLabel = interactionMode === 'BUZZER'
    ? (isBuzzWinner ? '1° BUZZ' : interactionStatus === 'OPEN' ? 'ATTESA' : '—')
    : interactionMode === 'CHOICE'
      ? (response?.choice || (interactionStatus === 'OPEN' ? '…' : '—'))
      : '—'

  return <div className={`team-row ${isBuzzWinner?'buzz-winner':''} ${response?.choice?'has-response':''}`}>
    <span className="rank">{rank}</span>
    <div className="team-name"><input value={name} onChange={e=>setName(e.target.value)} onBlur={()=>{if(name.trim()&&name.trim()!==team.name)void act('master_update_team',{p_team_id:team.id,p_name:name.trim(),p_active:true},'Nome aggiornato.')}}/><small>ID · {team.id.slice(0,8)}</small></div>
    <button className="code-pill" title="Copia codice di rientro" onClick={copyCode}><small>RIENTRO</small><b>{recoveryCode || '····'}</b></button>
    <div className={`interaction-cell ${isBuzzWinner?'winner-cell':''} ${response?.choice?'answered':''}`}>
      <small>{interactionMode === 'CHOICE' ? 'RISPOSTA' : 'LIVE'}</small>
      <b>{interactionLabel}</b>
    </div>
    <div className="score-quick">{SCORE_DELTAS.map(d=><button className={d<0?'minus':'plus'} key={d} onClick={()=>act('master_adjust_score',{p_team_id:team.id,p_delta:d,p_question_id:null,p_reason:'Correzione rapida'},`${d>0?'+':''}${d} a ${team.name}`)}>{d>0?'+':''}{d}</button>)}</div>
    <div className="score-value"><b>{team.score}</b><span>pt</span></div>
    <form className="manual-score" onSubmit={e=>{e.preventDefault();void act('master_set_score',{p_team_id:team.id,p_score:Number(manual),p_reason:'Impostazione manuale'},'Punteggio impostato.')}}><input type="number" value={manual} onChange={e=>setManual(e.target.value)}/><button>OK</button></form>
    <button className="trash" onClick={()=>{if(confirm(`Rimuovere ${team.name}?`))void act('master_update_team',{p_team_id:team.id,p_name:team.name,p_active:false},'Squadra rimossa.')}}>×</button>
  </div>
}

function QuestionsPanel({ token,state,quiz,reloadQuiz,notice }:{token:string;state:PublicState;quiz:QuizRound[];reloadQuiz:(s?:string|null)=>Promise<void>;notice:(s:string)=>void}) {
  const [roundId,setRoundId]=useState('')
  const [editing,setEditing]=useState<QuizQuestion|null>(null)
  const [creating,setCreating]=useState(false)
  const round=quiz.find(r=>r.id===roundId)||quiz[0]||null
  useEffect(()=>{if(!roundId&&quiz[0])setRoundId(quiz[0].id)},[quiz,roundId])

  async function addRound() {
    const name=prompt('Nome del nuovo round?'); if(!name)return
    const template=prompt(`Template (es. STANDARD, TRUE_FALSE, MULTIPLE_CHOICE):`, 'STANDARD') || 'STANDARD'
    const tpl=state.templates.find(t=>t.id===template)
    try { await rpc('master_save_round',{p_session_token:token,p_round:{name,template_id:template,order_index:quiz.length+1,config:tpl?.default_config||{},active:true}}); await reloadQuiz(); notice('Round creato.') } catch(e){notice(msg(e))}
  }
  async function removeRound() {
    if(!round||!confirm(`Eliminare il round "${round.name}" e tutte le sue domande?`))return
    try {await rpc('master_delete_round',{p_session_token:token,p_round_id:round.id});setRoundId('');await reloadQuiz();notice('Round eliminato.')}catch(e){notice(msg(e))}
  }
  return <main className="master-content questions-layout">
    <aside className="panel round-sidebar">
      <div className="section-head"><div><p className="eyebrow">STRUTTURA</p><h2>Round</h2></div><button onClick={addRound}>+</button></div>
      {quiz.map(r=><button className={round?.id===r.id?'selected':''} key={r.id} onClick={()=>setRoundId(r.id)}><span>{r.order_index}</span><div><b>{r.name}</b><small>{r.questions.length} domande · {r.active?'attivo':'sostituibile'}</small></div></button>)}
      {round&&<button className="danger-text" onClick={removeRound}>Elimina round selezionato</button>}
    </aside>
    <section className="panel question-editor-list">
      <div className="section-head"><div><p className="eyebrow">{round?.template_id||'ROUND'}</p><h2>{round?.name||'Seleziona un round'}</h2></div>{round&&<button className="primary" onClick={()=>{setEditing(null);setCreating(true)}}>+ Nuova domanda</button>}</div>
      <div className="question-cards">{(round?.questions||[]).map((q,i)=><button key={q.id} onClick={()=>{setEditing(q);setCreating(true)}}><span className="q-number">{i+1}</span><div><b>{q.prompt}</b><small>{q.category_id||'Senza categoria'} · {q.question_type}</small></div><span>›</span></button>)}</div>
      {round&&!round.questions.length&&<div className="empty large">Questo round non ha ancora domande.</div>}
    </section>
    {creating&&round&&<QuestionDrawer token={token} round={round} categories={state.categories} question={editing} close={()=>setCreating(false)} saved={async()=>{setCreating(false);await reloadQuiz()}} notice={notice}/>}
  </main>
}
function QuestionDrawer({token,round,categories,question,close,saved,notice}:{token:string;round:QuizRound;categories:Category[];question:QuizQuestion|null;close:()=>void;saved:()=>Promise<void>;notice:(s:string)=>void}) {
  const [promptText,setPromptText]=useState(question?.prompt||'')
  const [category,setCategory]=useState(question?.category_id||'')
  const [type,setType]=useState(question?.question_type||round.template_id||'STANDARD')
  const [answer,setAnswer]=useState(question?.answer_text||'')
  const [explanation,setExplanation]=useState(question?.explanation||'')
  const [order,setOrder]=useState(question?.order_index||round.questions.length+1)
  const [media,setMedia]=useState(question?.media_url||'')
  const [options,setOptions]=useState<string[]>(question?.options?.length?question.options:['','','',''])
  const [clues,setClues]=useState((question?.clue_steps||[]).join('\n'))
  const [busy,setBusy]=useState(false)
  async function save(e:FormEvent) {
    e.preventDefault();setBusy(true)
    const payload={id:question?.id||null,round_id:round.id,category_id:category||null,question_type:type,prompt:promptText,options:type==='MULTIPLE_CHOICE'?options.filter(x=>x.trim()):[],clue_steps:type==='CLUE_LADDER'?clues.split('\n').map(x=>x.trim()).filter(Boolean):[],media_url:media||null,metadata:{},order_index:order,answer_text:answer,answer_payload:{},explanation:explanation||null}
    try {await rpc('master_save_question',{p_session_token:token,p_question:payload});notice('Domanda salvata.');await saved()}catch(e){notice(msg(e))}finally{setBusy(false)}
  }
  async function remove(){if(!question||!confirm('Eliminare questa domanda?'))return;try{await rpc('master_delete_question',{p_session_token:token,p_question_id:question.id});notice('Domanda eliminata.');await saved()}catch(e){notice(msg(e))}}
  return <div className="drawer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
    <form className="drawer" onSubmit={save}><div className="drawer-head"><div><p className="eyebrow">{question?'MODIFICA':'NUOVA'} DOMANDA</p><h2>{round.name}</h2></div><button type="button" onClick={close}>×</button></div>
      <label>Domanda</label><textarea rows={3} value={promptText} onChange={e=>setPromptText(e.target.value)} required/>
      <div className="form-grid"><div><label>Categoria</label><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Nessuna</option>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></div><div><label>Tipo</label><select value={type} onChange={e=>setType(e.target.value)}><option>STANDARD</option><option>TRUE_FALSE</option><option>MULTIPLE_CHOICE</option><option>CLUE_LADDER</option><option>QUOTE</option><option>MUSIC</option><option>FINAL_BET</option><option>CATEGORY_BET</option><option>CHAIN</option></select></div><div><label>Ordine</label><input type="number" min="1" value={order} onChange={e=>setOrder(Number(e.target.value))}/></div><div><label>Media URL</label><input value={media} onChange={e=>setMedia(e.target.value)} placeholder="opzionale"/></div></div>
      {type==='MULTIPLE_CHOICE'&&<><label>Quattro risposte</label><div className="option-editor">{options.map((o,i)=><div key={i}><span>{LETTERS[i]}</span><input value={o} onChange={e=>{const next=[...options];next[i]=e.target.value;setOptions(next)}}/></div>)}</div></>}
      {type==='CLUE_LADDER'&&<><label>Indizi · uno per riga</label><textarea rows={6} value={clues} onChange={e=>setClues(e.target.value)}/></>}
      <label>Risposta corretta</label><input value={answer} onChange={e=>setAnswer(e.target.value)}/>
      <label>Spiegazione / curiosità</label><textarea rows={3} value={explanation} onChange={e=>setExplanation(e.target.value)}/>
      <div className="drawer-actions">{question&&<button type="button" className="danger" onClick={remove}>Elimina</button>}<span/><button type="button" className="secondary" onClick={close}>Annulla</button><button className="primary" disabled={busy||promptText.trim().length<2}>{busy?'Salvo…':'Salva'}</button></div>
    </form>
  </div>
}

function PlayerPage() {
  const state=usePublicState()
  const [session,setSession]=useState<TeamSession|null>(()=>{try{return JSON.parse(localStorage.getItem(TEAM_STORAGE)||'null')}catch{return null}})
  const [authMode,setAuthMode]=useState<'register'|'recover'>('register')
  const [name,setName]=useState('')
  const [recoverName,setRecoverName]=useState('')
  const [recoverCode,setRecoverCode]=useState('')
  const [welcomeCode,setWelcomeCode]=useState<string|null>(null)
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const [buzzed,setBuzzed]=useState(false)
  const [selectedChoice,setSelectedChoice]=useState<string|null>(null)

  const persistSession = useCallback((s:TeamSession) => {
    localStorage.setItem(TEAM_STORAGE,JSON.stringify(s))
    setSession(s)
  },[])

  useEffect(()=>{
    if(session)return
    const query=location.hash.split('?')[1];if(!query)return
    const p=new URLSearchParams(query),id=p.get('team'),token=p.get('token');if(!id||!token)return
    void rpc<any>('get_team_session',{p_team_id:id,p_team_token:token}).then(data=>{
      persistSession({team_id:data.team_id,team_name:data.team_name,team_token:token,recovery_code:data.recovery_code,event_id:data.event_id})
    }).catch(e=>setNotice(msg(e)))
  },[session,persistSession])

  useEffect(()=>{
    if(!session)return
    void rpc<any>('get_team_session',{p_team_id:session.team_id,p_team_token:session.team_token}).then(data=>{
      const refreshed={...session,team_name:data.team_name,recovery_code:data.recovery_code,event_id:data.event_id}
      if(JSON.stringify(refreshed)!==JSON.stringify(session))persistSession(refreshed)
    }).catch(e=>{
      const text=msg(e)
      if(text.includes('Sessione squadra')||text.includes('non è più attiva')){
        localStorage.removeItem(TEAM_STORAGE);setSession(null);setNotice(text)
      }
    })
  },[session?.team_id,session?.team_token,persistSession])

  useEffect(()=>{
    if(state.buzzer?.status==='OPEN'){
      setBuzzed(false)
      setSelectedChoice(null)
    }
  },[state.buzzer?.id])

  async function register(e:FormEvent){
    e.preventDefault();setBusy(true);setNotice('')
    try{
      const s=await rpc<TeamSession>('register_team',{p_name:name})
      persistSession(s);setWelcomeCode(s.recovery_code||null)
    }catch(e){setNotice(msg(e))}finally{setBusy(false)}
  }

  async function recover(e:FormEvent){
    e.preventDefault();setBusy(true);setNotice('')
    try{
      const s=await rpc<TeamSession>('recover_team',{p_name:recoverName,p_recovery_code:recoverCode})
      persistSession(s);setRecoverCode('');setNotice('')
    }catch(e){setNotice(msg(e))}finally{setBusy(false)}
  }

  async function buzz(){
    if(!session||state.buzzer?.status!=='OPEN'||state.buzzer?.interaction_mode!=='BUZZER'||buzzed)return
    setBusy(true)
    try{
      if('vibrate'in navigator)navigator.vibrate(35)
      const r=await rpc<{accepted:boolean;winner_team_name?:string}>('press_buzzer',{p_team_id:session.team_id,p_team_token:session.team_token})
      setBuzzed(true)
      if(r.accepted&&'vibrate'in navigator)navigator.vibrate([100,60,180])
      await state.reload()
    }catch(e){setNotice(msg(e))}finally{setBusy(false)}
  }

  async function choose(choice:string){
    if(!session||state.buzzer?.status!=='OPEN'||state.buzzer?.interaction_mode!=='CHOICE')return
    setBusy(true);setNotice('')
    try{
      await rpc('submit_choice',{p_team_id:session.team_id,p_team_token:session.team_token,p_choice:choice})
      setSelectedChoice(choice)
      if('vibrate'in navigator)navigator.vibrate(35)
    }catch(e){setNotice(msg(e))}finally{setBusy(false)}
  }

  function leave(){
    const code=session?.recovery_code ? ` Il vostro codice di rientro è ${session.recovery_code}.` : ''
    if(!confirm(`Vuoi cambiare squadra su questo dispositivo?${code} Per rientrare serviranno nome squadra e codice.`))return
    localStorage.removeItem(TEAM_STORAGE);setSession(null);setBuzzed(false);setSelectedChoice(null);setAuthMode('recover')
    setRecoverName(session?.team_name||'');setNotice('')
  }

  if(!session)return <main className="auth-page player-auth">
    <button className="back" onClick={()=>go('home')}>←</button>
    <section className="auth-card glass">
      <Logo/>
      <p className="eyebrow">MODALITÀ SQUADRA</p>
      <div className="auth-switch">
        <button className={authMode==='register'?'active':''} onClick={()=>{setAuthMode('register');setNotice('')}}>Nuova squadra</button>
        <button className={authMode==='recover'?'active':''} onClick={()=>{setAuthMode('recover');setNotice('')}}>Rientra</button>
      </div>
      {authMode==='register'
        ? <form onSubmit={register}>
            <h1>Come vi chiamate?</h1>
            <p className="auth-copy">Iscrivete la squadra una volta sola: questo telefono resterà collegato automaticamente.</p>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome della squadra" maxLength={60}/>
            {notice&&<div className="alert">{notice}</div>}
            {!state.event?.registration_open&&<div className="alert">🔒 Iscrizioni momentaneamente chiuse.</div>}
            <button className="primary giant" disabled={busy||!state.event?.registration_open||name.trim().length<2}>Iscriviti</button>
          </form>
        : <form onSubmit={recover}>
            <h1>Bentornati.</h1>
            <p className="auth-copy">Inserite il nome esatto della squadra e il codice di rientro ricevuto all'iscrizione.</p>
            <label>Nome squadra</label>
            <input value={recoverName} onChange={e=>setRecoverName(e.target.value)} placeholder="Es. Deep Thought" maxLength={60}/>
            <label>Codice di rientro</label>
            <input className="recovery-input" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={recoverCode} onChange={e=>setRecoverCode(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="0000"/>
            {notice&&<div className="alert">{notice}</div>}
            <button className="primary giant" disabled={busy||recoverName.trim().length<2||recoverCode.length!==4}>Rientra nella squadra</button>
          </form>}
    </section>
  </main>

  if(welcomeCode)return <main className="recovery-onboarding">
    <section className="recovery-card">
      <Logo/><p className="eyebrow">ISCRIZIONE COMPLETATA</p><h1>Tenete questo codice.</h1>
      <p>Serve solo se dovete rientrare nella squadra da un altro telefono o dopo aver cancellato la sessione.</p>
      <div className="recovery-code-big">{welcomeCode}</div>
      <small>Squadra · <b>{session.team_name}</b></small>
      <button className="primary giant" onClick={()=>setWelcomeCode(null)}>Ho salvato il codice</button>
    </section>
  </main>

  const team=state.teams.find(t=>t.id===session.team_id)
  const winner=state.teams.find(t=>t.id===state.buzzer?.winner_team_id)
  const open=state.buzzer?.status==='OPEN'
  const interactionMode=state.buzzer?.interaction_mode || 'BUZZER'
  const questionType=String(state.screen?.payload?.question_type || '')
  const isTrueFalse=questionType==='TRUE_FALSE'
  const optionLabels=isTrueFalse
    ? [{key:'V',text:'VERO'},{key:'F',text:'FALSO'}]
    : (Array.isArray(state.screen?.options)&&state.screen!.options.length
        ? state.screen!.options.slice(0,4).map((o,i)=>({key:LETTERS[i],text:String(o)}))
        : LETTERS.map(letter=>({key:letter,text:''})))

  return <main className={`player-live ${open?'open':''} mode-${interactionMode.toLowerCase()}`}>
    <header><Logo compact/><div><b>{team?.name||session.team_name}</b><span>{team?.score||0} pt{session.recovery_code ? ` · codice ${session.recovery_code}` : ''}</span></div></header>
    <section>
      {open && interactionMode==='CHOICE'
        ? <div className="choice-live">
            <div className="player-state">● RISPOSTE APERTE</div>
            <h1>{isTrueFalse ? 'Vero o falso?' : 'Scegli la risposta'}</h1>
            <div className={`choice-grid ${isTrueFalse?'two':''}`}>
              {optionLabels.map(opt=><button
                key={opt.key}
                className={selectedChoice===opt.key?'selected':''}
                onClick={()=>choose(opt.key)}
                disabled={busy}
              ><strong>{opt.key}</strong>{opt.text&&<span>{opt.text}</span>}</button>)}
            </div>
            <p>{selectedChoice ? <>Risposta selezionata: <b>{selectedChoice}</b>. Puoi cambiarla finché il Master non chiude le risposte.</> : 'Tutte le squadre possono rispondere contemporaneamente.'}</p>
          </div>
        : open && interactionMode==='BUZZER' && !buzzed
          ? <><div className="player-state">● PRENOTAZIONE APERTA</div><button className="buzzer" onClick={buzz} disabled={busy}><span className="buzzer-icon">⚡</span><b>PRENOTA</b><small>{busy?'INVIO…':'TOCCA PER RISPONDERE'}</small></button><p>Conta la prima pressione valida registrata dal server.</p></>
          : interactionMode==='BUZZER' && winner?.id===session.team_id
            ? <div className="result won"><span>⚡</span><small>PRENOTAZIONE RIUSCITA</small><h1>Siete i primi!</h1><p>Aspettate l'indicazione del Master.</p></div>
            : interactionMode==='BUZZER' && winner
              ? <div className="result"><span>⏱</span><small>PRENOTAZIONE CHIUSA</small><h1>{winner.name}</h1><p>si è prenotata per prima.</p></div>
              : interactionMode==='CHOICE' && !open && selectedChoice
                ? <div className="result choice-result"><span>✓</span><small>RISPOSTA REGISTRATA</small><h1>{selectedChoice}</h1><p>Le risposte sono state chiuse dal Master.</p></div>
                : <div className="result"><span>🔒</span><small>IN ATTESA</small><h1>Aspettate il Master</h1><p>Il controllo corretto si attiverà automaticamente in base alla domanda.</p></div>}
      {notice&&<div className="alert">{notice}</div>}
    </section>
    <footer><button className="ghost" onClick={leave}>Cambia squadra</button></footer>
  </main>
}

function ScreenPage(){
  const state=usePublicState()
  const fullscreen=()=>document.documentElement.requestFullscreen?.().catch(()=>undefined)
  return <main className="public-screen" onDoubleClick={fullscreen}><ScreenCanvas screen={state.screen} teams={state.teams}/><button className="fullscreen" onClick={fullscreen}>⛶</button></main>
}
function ScreenCanvas({screen,teams,preview=false}:{screen:ScreenState|null;teams:Team[];preview?:boolean}){
  if(!screen)return <div className="screen-canvas">Connessione…</div>
  if(screen.blackout)return <div className="screen-canvas blackout"><div className="big42">42</div><b>CLUB42</b></div>
  const board=teams.slice().sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'it'))
  const rawOptions=Array.isArray(screen.options)?screen.options.map(String):[]
  const trueFalse=String(screen.payload?.question_type || '') === 'TRUE_FALSE'
  const options=trueFalse && rawOptions.length===0 ? ['VERO','FALSO'] : rawOptions
  const optionLetters=trueFalse ? ['V','F'] : LETTERS
  return <div
    className={`screen-canvas ${preview?'preview':''} mode-${screen.mode.toLowerCase()}`}
    style={{ backgroundImage: `linear-gradient(rgba(247,244,235,.90), rgba(247,244,235,.90)), url("${SCREEN_BG_URL}")` }}
  >
    <div className="screen-top"><Logo compact/>{screen.round_name&&<b>{screen.round_name}</b>}</div>
    {screen.mode==='LOGO'&&<div className="screen-center logo-screen"><div className="big42">42</div><h1>{screen.title||'CLUB42'}</h1><p>{screen.body||'Quiz a squadre'}</p></div>}
    {screen.mode==='ROUND'&&<div className="screen-center"><small>PROSSIMO ROUND</small><h1>{screen.title}</h1><p>{screen.body}</p></div>}
    {screen.mode==='PAUSE'&&<div className="screen-center"><small>DON'T PANIC</small><h1>{screen.title||'PAUSA'}</h1><p>{screen.body}</p></div>}
    {screen.mode==='CUSTOM'&&<div className="screen-center"><h1>{screen.title}</h1><p>{screen.body}</p></div>}
    {screen.mode==='QUESTION'&&<div className="question-screen"><h1>{screen.title}</h1>{screen.body&&<p className="clue-on-screen">{screen.body}</p>}{options.length>0&&<div className={`answers ${trueFalse?'true-false':''}`}>{options.map((o,i)=><div key={i}><span>{optionLetters[i]||i+1}</span><b>{o}</b></div>)}</div>}{screen.footer&&<strong className="question-footer">{screen.footer}</strong>}</div>}
    {screen.mode==='ANSWER'&&<div className="screen-center answer"><small>RISPOSTA</small><h1>{screen.body}</h1>{typeof screen.payload?.question==='string'&&<p>{screen.payload.question}</p>}{screen.footer&&<div className="answer-note">{screen.footer}</div>}</div>}
    {screen.mode==='LEADERBOARD'&&<div className="board-screen"><h1>{screen.title||'CLASSIFICA'}</h1><div>{board.map((t,i)=><article key={t.id} className={`place-${i+1}`}><span>{i+1}</span><b>{t.name}</b><strong>{t.score}<small> pt</small></strong></article>)}</div></div>}
    <div className="screen-foot">club42 · la cultura passa anche attraverso il divertimento</div>
  </div>
}
