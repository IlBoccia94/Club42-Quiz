import { useCallback, useEffect, useRef, useState } from 'react'

/** Campioni CC0: Kenney e qubodup. Fonti in SOUND_SOURCES.md. */
const ROOT = 'https://raw.githubusercontent.com/blancmathis/Super_Bash_Folds/main/public/assets/audio/open/'
type Cue = { id:string; name:string; emoji:string; info:string; group:string; file?:string; loop?:boolean; seconds?:number }
const cues: Cue[] = [
  {id:'right',name:'Risposta esatta',emoji:'✅',info:'Jingle vittoria',group:'Risposte',file:'sfx/game-set.ogg'},
  {id:'wrong',name:'Sbagliato!',emoji:'❌',info:'Buzzer',group:'Risposte'},
  {id:'bell',name:'Campanella',emoji:'🔔',info:'Ding del quiz',group:'Risposte'},
  {id:'reveal',name:'Rivelazione',emoji:'✨',info:'Scopri la risposta',group:'Risposte',file:'sfx/item-pickup.ogg'},
  {id:'ten',name:'Countdown 10 s',emoji:'🔟',info:'Segnale finale',group:'Tempo',seconds:10},
  {id:'thirty',name:'Countdown 30 s',emoji:'⏱️',info:'Segnale finale',group:'Tempo',seconds:30},
  {id:'alarm',name:'Sveglia',emoji:'🚨',info:'Tempo scaduto',group:'Tempo'},
  {id:'tick',name:'Tic tac',emoji:'🕰️',info:'Orologio',group:'Tempo'},
  {id:'waiting',name:'Musica d’attesa',emoji:'🎶',info:'In loop',group:'Atmosfera',file:'music/menu-loop.ogg',loop:true},
  {id:'intro',name:'Inizio round',emoji:'🎬',info:'Segnale di avvio',group:'Atmosfera',file:'sfx/ready.ogg'},
  {id:'drum',name:'Suspense',emoji:'🥁',info:'Rullo di tamburi',group:'Atmosfera'},
  {id:'applause',name:'Applausi',emoji:'👏',info:'Effetto stilizzato',group:'Atmosfera'},
  {id:'trombone',name:'Triste trombone',emoji:'🎺',info:'Wah-wah!',group:'Meme'},
  {id:'boing',name:'Boing!',emoji:'🤪',info:'Molla comica',group:'Meme'},
  {id:'drama',name:'Colpo di scena',emoji:'😱',info:'Stacco drammatico',group:'Meme',file:'sfx/hit-heavy.ogg'},
  {id:'fail',name:'Game over',emoji:'💀',info:'Hai perso!',group:'Meme',file:'sfx/ko.ogg'},
]
const groups = ['Risposte','Tempo','Atmosfera','Meme']

export default function Soundboard() {
  const [active,setActive]=useState<string|null>(null)
  const [volume,setVolume]=useState(70)
  const [remaining,setRemaining]=useState<number|null>(null)
  const [error,setError]=useState('')
  const audio=useRef<HTMLAudioElement|null>(null)
  const ctx=useRef<AudioContext|null>(null)
  const bus=useRef<GainNode|null>(null)
  const ticker=useRef<number|null>(null)
  const ending=useRef<number|null>(null)

  const clearAudio=useCallback(()=>{
    if(audio.current){audio.current.pause();audio.current.removeAttribute('src');audio.current.load();audio.current=null}
    if(bus.current){
      bus.current.gain.setValueAtTime(0,ctx.current?.currentTime??0)
      bus.current.disconnect()
      bus.current=null
    }
    if(ticker.current!==null)window.clearInterval(ticker.current)
    if(ending.current!==null)window.clearTimeout(ending.current)
    ticker.current=null
    ending.current=null
  },[])
  const stop=useCallback(()=>{clearAudio();setActive(null);setRemaining(null)},[clearAudio])
  useEffect(()=>()=>{clearAudio();if(ctx.current)void ctx.current.close()},[clearAudio])
  useEffect(()=>{
    if(audio.current)audio.current.volume=volume/100
    if(bus.current&&ctx.current)bus.current.gain.setTargetAtTime(volume/100,ctx.current.currentTime,.02)
  },[volume])

  function beep(c:AudioContext,b:GainNode,start:number,freq:number,seconds:number,wave:OscillatorType='sine',endFreq?:number,gain=.25){
    const o=c.createOscillator(),g=c.createGain()
    o.type=wave
    o.frequency.setValueAtTime(freq,start)
    if(endFreq)o.frequency.exponentialRampToValueAtTime(Math.max(endFreq,25),start+seconds)
    g.gain.setValueAtTime(.0001,start)
    g.gain.exponentialRampToValueAtTime(gain,start+Math.min(.02,seconds/5))
    g.gain.exponentialRampToValueAtTime(.0001,start+seconds)
    o.connect(g);g.connect(b);o.start(start);o.stop(start+seconds+.02)
  }
  function hiss(c:AudioContext,b:GainNode,start:number,seconds:number,gain=.1){
    const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*seconds),c.sampleRate)
    const arr=buffer.getChannelData(0)
    for(let i=0;i<arr.length;i++)arr[i]=Math.random()*2-1
    const s=c.createBufferSource(),g=c.createGain()
    s.buffer=buffer
    g.gain.setValueAtTime(.0001,start)
    g.gain.exponentialRampToValueAtTime(gain,start+Math.min(.01,seconds/4))
    g.gain.exponentialRampToValueAtTime(.0001,start+seconds)
    s.connect(g);g.connect(b);s.start(start)
  }
  function generate(cue:Cue){
    const c=ctx.current??new AudioContext()
    ctx.current=c
    void c.resume()
    const b=c.createGain();b.gain.value=volume/100;b.connect(c.destination);bus.current=b
    const t=c.currentTime+.035
    let length=1
    if(cue.seconds){
      const secs=cue.seconds,endAt=Date.now()+secs*1000
      setRemaining(secs)
      for(let i=0;i<secs;i++){
        const last=i===secs-1
        beep(c,b,t+i,last?1000:710,last?.5:.075,'sine',undefined,last?.4:.23)
        if(last)beep(c,b,t+i,1310,.5,'sine',undefined,.18)
      }
      ticker.current=window.setInterval(()=>setRemaining(Math.max(0,Math.ceil((endAt-Date.now())/1000))),100)
      length=secs+.65
    }else if(cue.id==='wrong'){
      beep(c,b,t,200,.7,'sawtooth',135,.22);beep(c,b,t,104,.7,'square',85,.09);length=.8
    }else if(cue.id==='bell'){
      beep(c,b,t,880,1.3);beep(c,b,t,1320,1.1,'sine',undefined,.13);beep(c,b,t,1760,.7,'sine',undefined,.07);length=1.35
    }else if(cue.id==='alarm'){
      for(let i=0;i<6;i++)beep(c,b,t+i*.29,i%2?660:920,.24,'square',undefined,.14)
      length=1.85
    }else if(cue.id==='tick'){
      for(let i=0;i<8;i++){hiss(c,b,t+i*.5,.024,.21);beep(c,b,t+i*.5,i%2?730:980,.028,'square',undefined,.12)}
      length=4.1
    }else if(cue.id==='drum'){
      for(let i=0;i<25;i++)hiss(c,b,t+i*.105,.079,.08+i*.005)
      beep(c,b,t+2.62,82,.75,'sawtooth',55,.24);length=3.6
    }else if(cue.id==='applause'){
      for(let i=0;i<82;i++)hiss(c,b,t+i*.038,.05,.065+Math.random()*.12)
      length=3.3
    }else if(cue.id==='trombone'){
      ;[392,370,349,294].forEach((n,i)=>{
        beep(c,b,t+i*.31,n,i===3?.87:.29,'sawtooth',n*.88,.18)
        beep(c,b,t+i*.31,n/2,i===3?.87:.29,'triangle',n*.44,.14)
      });length=2
    }else if(cue.id==='boing'){
      beep(c,b,t,730,.62,'sine',105,.36);beep(c,b,t+.18,190,.4,'triangle',360,.13);length=.8
    }
    ending.current=window.setTimeout(()=>stop(),length*1000)
  }
  function play(cue:Cue){
    if(active===cue.id){stop();return}
    stop()
    setError('')
    setActive(cue.id)
    if(!cue.file){
      try{generate(cue)}catch{stop();setError('Il browser non supporta questa riproduzione audio.')}
      return
    }
    const element=new Audio(ROOT+cue.file)
    audio.current=element
    element.volume=volume/100
    element.loop=Boolean(cue.loop)
    element.onended=()=>{if(audio.current===element){audio.current=null;setActive(null)}}
    element.onerror=()=>{if(audio.current===element){stop();setError('File audio non raggiungibile: verifica la connessione.')}}
    void element.play().catch(()=>{if(audio.current===element){stop();setError('Impossibile riprodurre il suono sul browser.')}})
  }

  return <main className="panel soundboard">
    <div className="section-head"><div><p className="eyebrow">EFFETTI LIVE</p><h2>Soundboard</h2></div><span className={active?'sound-status active':'sound-status'}>{active?'● IN RIPRODUZIONE':'PRONTA'}</span></div>
    <p className="sound-help">Un clic riproduce il suono, un secondo clic lo ferma. L’audio esce dal PC della regia.</p>
    <div className="sound-volume"><label htmlFor="sound-volume">Volume</label><input id="sound-volume" type="range" min="0" max="100" value={volume} onChange={e=>setVolume(Number(e.target.value))}/><b>{volume}%</b></div>
    {remaining!==null&&<div className="sound-timer" role="timer"><span>Tempo rimanente</span><strong>{remaining} s</strong></div>}
    <button className="sound-stop" disabled={!active} onClick={stop}>■ Ferma suono</button>
    {groups.map(group=><section className="sound-group" key={group}><h3>{group}</h3><div className="sound-grid">
      {cues.filter(cue=>cue.group===group).map(cue=><button key={cue.id} className={active===cue.id?'sound-cue playing':'sound-cue'} aria-pressed={active===cue.id} title={cue.info} onClick={()=>play(cue)}>
        <span className="sound-emoji" aria-hidden="true">{cue.emoji}</span>
        <span className="sound-copy"><b>{cue.name}</b><small>{cue.info}</small></span>
        <span className="sound-play" aria-hidden="true">{active===cue.id?'■':'▶'}</span>
      </button>)}
    </div></section>)}
    {error&&<div className="alert sound-error" role="alert">{error}</div>}
    <p className="sound-credit">Campioni CC0: Kenney e qubodup · altri effetti generati localmente.</p>
  </main>
}
