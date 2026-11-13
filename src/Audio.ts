export type SoundKind = 'break'|'combo'|'paddle'|'power'|'win'|'bomb'|'halve'|'life'|'lost';
type Note={f:number;to?:number;at:number;len:number;type:OscillatorType;gain:number};
/** Major pentatonic steps: consecutive combo hits climb a pleasant scale instead of repeating one tone. */
const PENTATONIC=[0,2,4,7,9];
function scale(step:number,base=392){const octave=Math.floor(step/5),degree=PENTATONIC[step%5];return base*2**(octave+degree/12);}
const VOLUME=.32;
/** Short synthesized cues; voices and event frequency stay bounded for hundred-ball play. */
export class AudioSystem {
  constructor(private createContext:()=>AudioContext=()=>{throw Error('未提供音频适配器');}){}
  suspend(){try{if(this.context)void Promise.resolve(this.context.suspend()).catch(()=>{});}catch{/* Sound failure never blocks gameplay. */}}
  dispose(){try{if(this.context)void Promise.resolve(this.context.close()).catch(()=>{});}catch{}this.context=undefined;this.master=undefined;}
  muted = false;
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
  play = (kind:SoundKind,combo=1) => {
    const ctx=this.context;if(!ctx||!this.master||this.muted||ctx.state!=='running'||this.voices>=12)return;
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
