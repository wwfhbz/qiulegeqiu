export type SoundKind = 'break'|'combo'|'paddle'|'power'|'win'|'bomb'|'halve'|'life';
/** Quiet sine tones; voices and event frequency are bounded for hundred-ball play. */
export class AudioSystem {
  muted = false;
  private context?: AudioContext;
  private master?: GainNode;
  private voices = 0;
  private last: Partial<Record<SoundKind, number>> = {};
  unlock() {
    try {
      if(!this.context){this.context=new AudioContext();this.master=this.context.createGain();this.master.gain.value=this.muted?0:.14;this.master.connect(this.context.destination);}
      if(this.context.state==='suspended')void this.context.resume().catch(()=>{});
    } catch { /* Audio unavailable: gameplay remains usable. */ }
  }
  toggle(){this.muted=!this.muted;if(this.master&&this.context){this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.value=this.muted?0:.14;}return this.muted;}
  play = (kind:SoundKind,combo=1) => {
    const ctx=this.context;if(!ctx||!this.master||this.muted||ctx.state!=='running'||this.voices>=12)return;
    const now=ctx.currentTime;if(now-(this.last[kind]??-1)<.045)return;this.last[kind]=now;
    const frequencies={break:300,combo:330+Math.min(combo,12)*22,paddle:190,power:540,win:660,bomb:100,halve:160,life:600};
    const count=kind==='win'?3:kind==='power'?2:1;
    for(let i=0;i<count && this.voices<12;i++){
      const osc=ctx.createOscillator(),gain=ctx.createGain(),t=now+i*.085;
      osc.type='sine';osc.frequency.setValueAtTime(frequencies[kind]*(1+i*.25),t);osc.frequency.exponentialRampToValueAtTime(frequencies[kind]*.75,t+.12);
      gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.24,t+.006);gain.gain.exponentialRampToValueAtTime(.001,t+.16);
      osc.connect(gain);gain.connect(this.master);this.voices++;
      osc.onended=()=>{osc.disconnect();gain.disconnect();this.voices--;};osc.start(t);osc.stop(t+.18);
    }
  };
}
