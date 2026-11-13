import type {Effects} from './Effects';
export type HapticStrength='heavy'|'medium';
/**
 * Shared vibration policy for Web and WeChat: decisive moments only, never per brick.
 * Reads Effects events by sequence number and never mutates them.
 */
export class HapticTracker {
  private seq=-1;private last=-1e9;
  /** `roundOver`: the last ball was lost this frame (the game is no longer running). */
  next(fx:Pick<Effects,'events'|'eventSeq'>,roundOver:boolean,now:number):HapticStrength|undefined{
    const seq=fx.eventSeq;if(this.seq<0||seq<this.seq){this.seq=seq;return undefined;}
    let type:HapticStrength|undefined;
    for(let s=Math.max(this.seq+1,seq-fx.events.length+1);s<=seq;s++){const e=fx.events[s%fx.events.length];if(e.seq!==s)continue;
      if(e.kind==='bomb'||e.kind==='clear')type='heavy';
      else if(e.kind==='power'&&e.power==='halve'&&type!=='heavy')type='medium';
      else if(e.kind==='lost'&&roundOver&&!type)type='medium';}
    this.seq=seq;if(!type||now-this.last<120)return undefined;this.last=now;return type;
  }
}
