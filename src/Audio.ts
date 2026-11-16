export type SoundKind = 'break'|'combo'|'paddle'|'power'|'win'|'bomb'|'halve'|'life'|'lost';
type Note={f:number;to?:number;at:number;len:number;type:OscillatorType;gain:number};
/** Major pentatonic steps: consecutive combo hits climb a pleasant scale instead of repeating one tone. */
const PENTATONIC=[0,2,4,7,9];
function scale(step:number,base=392){const octave=Math.floor(step/5),degree=PENTATONIC[step%5];return base*2**(octave+degree/12);}
const VOLUME=.32;
/**
 * Background loop: bright and bouncy, in G major so the combo cues (G major pentatonic from 392 Hz) always sit in
 * key on top of it. I–V–vi–IV (G D Em C), ~125 BPM, one chord per bar: a soft thump on beats 1 and 3, an off-beat
 * shaker tick, a plucky bass and a pentatonic pluck melody in eighths. While a combo is running the loop adds a
 * sparkle layer, so a long chain of breaks feels like it lifts the song.
 */
const BAR=1.92,EIGHTH=BAR/8;
const CHORDS=[[196,246.94,293.66],[146.83,185,220],[164.81,196,246.94],[130.81,164.81,196]];
/** Melody per bar as indices: 0–2 = chord tones an octave up, 3 = root two octaves up, -1 = rest. */
const MELODY=[[0,1,2,3,2,1,2,-1],[2,1,0,1,2,3,2,1],[0,2,1,2,3,-1,2,1],[1,2,3,2,1,0,1,-1]];
const BASS=[0,0,2,0,0,0,2,1];
/** Short synthesized cues; voices and event frequency stay bounded for hundred-ball play. */
export class AudioSystem {
  constructor(private createContext:()=>AudioContext=()=>{throw Error('未提供音频适配器');}){}
  suspend(){try{if(this.context)void Promise.resolve(this.context.suspend()).catch(()=>{});}catch{/* Sound failure never blocks gameplay. */}}
  dispose(){try{if(this.context)void Promise.resolve(this.context.close()).catch(()=>{});}catch{}this.context=undefined;this.master=undefined;}
  /** Master mute (the top-bar speaker button): silences music and effects together. */
  muted = false;
  /** Settings: effects and background music can also be switched off separately. */
  sfxOn = true;
  musicOn = true;
  private music?: GainNode;
  private nextBar = 0;
  private bar = 0;
  private context?: AudioContext;
  private master?: GainNode;
  private voices = 0;
  private last: Partial<Record<SoundKind, number>> = {};
  private primed=false;
  /**
   * Call from user gestures. Mobile Safari only lets audio start on touchend/click (not pointerdown),
   * and can later move a running context to 'interrupted' (calls, backgrounding), so any non-running
   * state is resumed and repeated calls are cheap.
   */
  unlock() {
    try {
      if(!this.context){
        this.context=this.createContext();this.master=this.context.createGain();this.master.gain.value=this.muted?0:VOLUME;
        // Phone speakers are small: run louder, and let a compressor keep stacked combo notes from clipping.
        const limiter=typeof this.context.createDynamicsCompressor==='function'?this.context.createDynamicsCompressor():undefined;
        if(limiter){limiter.threshold.value=-14;limiter.ratio.value=6;this.master.connect(limiter);limiter.connect(this.context.destination);}else this.master.connect(this.context.destination);
        this.music=this.context.createGain();this.music.gain.value=this.musicOn?1:0;this.music.connect(this.master);
      }
      if(this.context.state!=='running')void Promise.resolve(this.context.resume()).catch(()=>{});
      // Older iOS only fully unlocks once a buffer actually starts inside the gesture.
      if(!this.primed&&typeof this.context.createBuffer==='function'){const source=this.context.createBufferSource();source.buffer=this.context.createBuffer(1,1,22050);source.connect(this.context.destination);source.start(0);this.primed=true;}
    } catch { /* Audio unavailable: gameplay remains usable. */ }
  }
  toggle(){this.muted=!this.muted;if(this.master&&this.context){this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.value=this.muted?0:VOLUME;}return this.muted;}
  /** The note sequence for each cue; exported shape kept internal so callers only name the event. */
  private notes(kind:SoundKind,combo:number):Note[]{
    const step=Math.min(Math.max(combo,1)-1,14);
    switch(kind){
      case 'break':return [{f:scale(0,330),to:scale(0,330)*.8,at:0,len:.07,type:'triangle',gain:.18}];
      case 'combo':return [{f:scale(step),to:scale(step)*1.02,at:0,len:.09,type:'triangle',gain:.2}];
      case 'paddle':return [{f:220,to:150,at:0,len:.09,type:'sine',gain:.28}];
      case 'power':return [523,659,784].map((f,i)=>({f,at:i*.06,len:.1,type:'triangle' as const,gain:.2}));
      case 'life':return [523,659,784,1047].map((f,i)=>({f,at:i*.07,len:.12,type:'sine' as const,gain:.22}));
      case 'halve':return [{f:392,to:330,at:0,len:.12,type:'square',gain:.08},{f:262,to:196,at:.1,len:.18,type:'square',gain:.08}];
      case 'bomb':return [{f:140,to:38,at:0,len:.35,type:'sine',gain:.4},{f:90,to:30,at:.02,len:.3,type:'triangle',gain:.25}];
      case 'lost':return [{f:330,to:250,at:0,len:.14,type:'triangle',gain:.2},{f:220,to:120,at:.12,len:.26,type:'triangle',gain:.2}];
      case 'win':return [523,659,784,1047].map((f,i)=>({f,at:i*.09,len:i===3?.35:.12,type:'triangle' as const,gain:.22}));
    }
  }
  setMusic(on:boolean){this.musicOn=on;if(this.music&&this.context){this.music.gain.cancelScheduledValues(this.context.currentTime);this.music.gain.setValueAtTime(on?1:0,this.context.currentTime);}if(on)this.nextBar=0;}
  setSfx(on:boolean){this.sfxOn=on;}
  /**
   * Background music, scheduled a little ahead from the frame loop (no timers): call every frame. Quiet by design,
   * well under the effects; nothing plays until a gesture has unlocked audio.
   */
  tickMusic(){
    const ctx=this.context;if(!ctx||!this.music||this.muted||!this.musicOn||ctx.state!=='running')return;
    if(this.nextBar<ctx.currentTime)this.nextBar=ctx.currentTime+.1;
    while(this.nextBar<ctx.currentTime+1.5){this.scheduleBar(this.nextBar,this.bar++);this.nextBar+=BAR;}
  }
  private scheduleBar(t:number,bar:number){
    const ctx=this.context!,bus=this.music!,chord=CHORDS[bar%CHORDS.length];
    const tone=(f:number,at:number,len:number,type:OscillatorType,gain:number,attack:number,to?:number)=>{const osc=ctx.createOscillator(),g=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(f,at);if(to)osc.frequency.exponentialRampToValueAtTime(to,at+len);g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(gain,at+attack);g.gain.exponentialRampToValueAtTime(.0005,at+len);osc.connect(g);g.connect(bus);osc.onended=()=>{osc.disconnect();g.disconnect();};osc.start(at);osc.stop(at+len+.05);};
    // Airy pad, very low: just enough to glue the chord.
    chord.forEach(f=>tone(f*2,t,BAR,'sine',.016,.25));
    // Soft thump on beats 1 and 3 (a falling sine, light, not a heavy kick).
    for(const beat of [0,4])tone(150,t+beat*EIGHTH,.12,'sine',.085,.004,55);
    // Off-beat shaker tick: a tiny high blip on every "and".
    for(let i=1;i<8;i+=2)tone(5200,t+i*EIGHTH,.03,'triangle',.008,.002);
    // Plucky bass in eighths: root, with the fifth for bounce.
    BASS.forEach((n,i)=>tone(chord[n]/2,t+i*EIGHTH,.16,'triangle',.065,.005));
    // Pentatonic pluck melody; the last bar of every eight drops the second half so the loop breathes.
    MELODY[bar%MELODY.length].forEach((n,i)=>{if(n<0||(bar%8===7&&i>=4))return;const f=n===3?chord[0]*4:chord[n]*2;tone(f,t+i*EIGHTH,.22,'triangle',.04,.004);});
    // Combo sparkle: while a chain of breaks is running, sixteenth-note bells an octave above the melody.
    const hot=ctx.currentTime-this.heatAt<1.2?this.heat:0;
    if(hot>=8){const steps=hot>=30?16:8;for(let i=0;i<steps;i++){const n=MELODY[(bar+1)%MELODY.length][i%8];if(n<0)continue;const f=(n===3?chord[0]*4:chord[n]*2)*2;tone(f,t+BAR-steps*EIGHTH/2+i*EIGHTH/2,.12,'sine',.028,.002);}}
  }
  /** Current combo, sampled from the combo cue, so the music can lift during a long chain. */
  private heat=0;private heatAt=-1e9;
  play = (kind:SoundKind,combo=1) => {
    if(kind==='combo'&&this.context){this.heat=combo;this.heatAt=this.context.currentTime;}
    const ctx=this.context;if(!ctx||!this.master||this.muted||!this.sfxOn||ctx.state!=='running'||this.voices>=12)return;
    const now=ctx.currentTime;if(now-(this.last[kind]??-1)<.045)return;this.last[kind]=now;
    for(const n of this.notes(kind,combo)){
      if(this.voices>=12)break;
      const osc=ctx.createOscillator(),gain=ctx.createGain(),t=now+n.at;
      osc.type=n.type;osc.frequency.setValueAtTime(n.f,t);if(n.to)osc.frequency.exponentialRampToValueAtTime(n.to,t+n.len);
      gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(n.gain,t+.006);gain.gain.exponentialRampToValueAtTime(.001,t+n.len);
      osc.connect(gain);gain.connect(this.master);this.voices++;
      osc.onended=()=>{osc.disconnect();gain.disconnect();this.voices--;};osc.start(t);osc.stop(t+n.len+.02);
    }
  };
}
