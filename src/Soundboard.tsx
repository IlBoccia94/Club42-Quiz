import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Soundboard del Club42: solo campioni reali CC BY-SA.
 * Licenze, autori e link alle schede originali in SOUND_SOURCES.md.
 * Gli audio vengono riprodotti soltanto nel browser del Master.
 */
const oga = 'https://opengameart.org/sites/default/files/'
const commons = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/'
const urls = {
  ding: oga+'ding_01.ogg',
  doubleDing: oga+'ding_double_01.ogg',
  reveal: oga+'ding_03.ogg',
  victory: oga+'VICTORY_0.ogg',
  lose: oga+'LOSE_0.ogg',
  champion: oga+'WIN_AGAINST_CHAMPION_0.ogg',
  intro: oga+'09._round_1_0.wav',
  final: oga+'13._final_round.wav',
  winner: oga+'22._winner.wav',
  failure: oga+'20._failure.wav',
  gameOver: oga+'31._game_over.wav',
  countdownVoice: oga+'26._countdown_-_5_4_3_2_1.wav',
  timeUp: oga+'27._time.wav',
  suspense: oga+'suspense.mp3',
  piano: oga+'MS_Realization.wav',
  waiting: oga+'Dream.mp3',
  applause: commons+'Applause.ogg',
} as const

type Cue = {
  id: string
  label: string
  icon: string
  detail: string
  group: 'Risposte' | 'Tempo' | 'Atmosfera' | 'Meme'
  file?: string
  loop?: boolean
  seconds?: number
  maxSeconds?: number
}
const cues: Cue[] = [
  {id:'correct',label:'Risposta giusta',icon:'✅',detail:'Doppia campanella',group:'Risposte',file:urls.doubleDing},
  {id:'wrong',label:'Risposta sbagliata',icon:'❌',detail:'Fanfara della sconfitta',group:'Risposte',file:urls.lose},
  {id:'bell',label:'Campanella',icon:'🔔',detail:'Ding nitido',group:'Risposte',file:urls.ding},
  {id:'reveal',label:'Rivelazione',icon:'✨',detail:'Effetto sorpresa',group:'Risposte',file:urls.reveal},
  {id:'win',label:'Grande vittoria',icon:'🏆',detail:'Fanfara celebrativa',group:'Risposte',file:urls.victory},
  {id:'ten',label:'Countdown 10 s',icon:'🔟',detail:'Suspense + ultimi 5 secondi',group:'Tempo',seconds:10},
  {id:'thirty',label:'Countdown 30 s',icon:'⏱️',detail:'Suspense + ultimi 5 secondi',group:'Tempo',seconds:30},
  {id:'lastFive',label:'5, 4, 3, 2, 1…',icon:'🗣️',detail:'Countdown con annunciatore',group:'Tempo',file:urls.countdownVoice},
  {id:'timeUp',label:'Tempo scaduto!',icon:'🚨',detail:'Annunciatore: Time!',group:'Tempo',file:urls.timeUp},
  {id:'waiting',label:'Musica d’attesa',icon:'🎶',detail:'Brano in loop',group:'Atmosfera',file:urls.waiting,loop:true},
  {id:'suspense',label:'Tensione',icon:'🥁',detail:'Sottofondo inquietante in loop',group:'Atmosfera',file:urls.suspense,loop:true},
  {id:'intro',label:'Inizio round',icon:'🎬',detail:'Voce da game show',group:'Atmosfera',file:urls.intro},
  {id:'final',label:'Round finale',icon:'🔥',detail:'Annuncio della finale',group:'Atmosfera',file:urls.final},
  {id:'applause',label:'Applausi',icon:'👏',detail:'Pubblico vero · 8 secondi',group:'Atmosfera',file:urls.applause,maxSeconds:8},
  {id:'piano',label:'Colpo di scena',icon:'😱',detail:'Stacco di pianoforte drammatico',group:'Meme',file:urls.piano},
  {id:'fail',label:'Fallimento',icon:'🤦',detail:'Annunciatore: Failure!',group:'Meme',file:urls.failure},
  {id:'gameOver',label:'Game Over',icon:'💀',detail:'Voce cinematografica',group:'Meme',file:urls.gameOver},
  {id:'champion',label:'Campioni!',icon:'👑',detail:'Fanfara trionfale',group:'Meme',file:urls.champion},
  {id:'winner',label:'And the winner is…',icon:'🎙️',detail:'Voce da presentatore',group:'Meme',file:urls.winner},
]
const groups: Cue['group'][] = ['Risposte','Tempo','Atmosfera','Meme']

export default function Soundboard() {
  const [active,setActive] = useState<string|null>(null)
  const [volume,setVolume] = useState(65)
  const [remaining,setRemaining] = useState<number|null>(null)
  const [error,setError] = useState('')
  const mainAudio = useRef<HTMLAudioElement|null>(null)
  const voiceAudio = useRef<HTMLAudioElement|null>(null)
  const interval = useRef<number|null>(null)
  const timeout = useRef<number|null>(null)
  const counted = useRef(false)

  const clear = useCallback(()=>{
    for(const element of [mainAudio.current,voiceAudio.current]){
      if(element){element.pause();element.onended=null;element.onerror=null;element.removeAttribute('src');element.load()}
    }
    mainAudio.current=null
    voiceAudio.current=null
    if(interval.current!==null)window.clearInterval(interval.current)
    if(timeout.current!==null)window.clearTimeout(timeout.current)
    interval.current=null
    timeout.current=null
    counted.current=false
  },[])
  const stop=useCallback(()=>{clear();setActive(null);setRemaining(null)},[clear])
  useEffect(()=>()=>clear(),[clear])
  useEffect(()=>{
    if(mainAudio.current)mainAudio.current.volume=volume/100
    if(voiceAudio.current)voiceAudio.current.volume=volume/100
  },[volume])

  function createAudio(src:string,loop=false) {
    const element=new Audio(src)
    element.volume=volume/100
    element.loop=loop
    element.preload='auto'
    return element
  }
  function start(cue:Cue){
    if(active===cue.id){stop();return}
    stop()
    setError('')
    setActive(cue.id)
    if(cue.seconds){
      const duration=cue.seconds
      const base=createAudio(urls.suspense,true)
      mainAudio.current=base
      base.onerror=()=>{setError('Sottofondo non disponibile. Il timer prosegue comunque.')}
      void base.play().catch(()=>setError('Sottofondo bloccato dal browser. Il timer prosegue.'))
      const end=Date.now()+duration*1000
      setRemaining(duration)
      interval.current=window.setInterval(()=>{
        const left=Math.max(0,Math.ceil((end-Date.now())/1000))
        setRemaining(left)
        if(left<=5&&left>0&&!counted.current){
          counted.current=true
          const countdown=createAudio(urls.countdownVoice)
          voiceAudio.current=countdown
          void countdown.play().catch(()=>undefined)
        }
        if(left===0){
          stop()
          const finale=createAudio(urls.timeUp)
          mainAudio.current=finale
          setActive('timeUp')
          finale.onended=()=>{if(mainAudio.current===finale){mainAudio.current=null;setActive(null)}}
          finale.onerror=()=>{if(mainAudio.current===finale){stop();setError('Il segnale finale non è disponibile.')}}
          void finale.play().catch(()=>{stop();setError('Il segnale finale è stato bloccato dal browser.')})
        }
      },100)
      return
    }
    if(!cue.file){stop();return}
    const element=createAudio(cue.file,Boolean(cue.loop))
    mainAudio.current=element
    element.onended=()=>{if(mainAudio.current===element){mainAudio.current=null;setActive(null)}}
    element.onerror=()=>{if(mainAudio.current===element){stop();setError('Suono non raggiungibile. Verifica la connessione a Internet.')}}
    void element.play().catch(()=>{if(mainAudio.current===element){stop();setError('La riproduzione è stata bloccata oppure il file non è disponibile.')}})
    if(cue.maxSeconds){
      timeout.current=window.setTimeout(()=>stop(),cue.maxSeconds*1000)
    }
  }
  return <main className="panel soundboard">
    <div className="section-head"><div><p className="eyebrow">SUONI COPYLEFT</p><h2>Soundboard</h2></div><span className={active?'sound-status active':'sound-status'}>{active?'● IN RIPRODUZIONE':'PRONTA'}</span></div>
    <p className="sound-help">Solo registrazioni e brani autentici, con licenze Creative Commons ShareAlike. Clicca un pulsante per partire; riclicca per interrompere.</p>
    <div className="sound-volume"><label htmlFor="sound-volume">Volume</label><input id="sound-volume" type="range" min="0" max="100" value={volume} onChange={e=>setVolume(Number(e.target.value))}/><b>{volume}%</b></div>
    {remaining!==null&&<div className="sound-timer" role="timer"><span>Tempo rimanente</span><strong>{remaining} s</strong></div>}
    <button className="sound-stop" disabled={!active} onClick={stop}>■ Ferma suono</button>
    {groups.map(group=><section className="sound-group" key={group}><h3>{group}</h3><div className="sound-grid">
      {cues.filter(cue=>cue.group===group).map(cue=><button key={cue.id} className={active===cue.id?'sound-cue playing':'sound-cue'} aria-pressed={active===cue.id} title={cue.detail} onClick={()=>start(cue)}>
        <span className="sound-emoji" aria-hidden="true">{cue.icon}</span>
        <span className="sound-copy"><b>{cue.label}</b><small>{cue.detail}</small></span>
        <span className="sound-play" aria-hidden="true">{active===cue.id?'■':'▶'}</span>
      </button>)}
    </div></section>)}
    {error&&<div className="alert sound-error" role="alert">{error}</div>}
    <p className="sound-credit">CC BY-SA 3.0 / 4.0 · <a href="https://github.com/IlBoccia94/Club42-Quiz/blob/main/SOUND_SOURCES.md" target="_blank" rel="noopener noreferrer">Crediti, licenze e sorgenti ↗</a></p>
  </main>
}
