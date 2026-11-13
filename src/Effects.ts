import type { PowerKind } from './PowerRules';
import { C } from './GameConfig';
/**
 * Presentation-side event kinds. Effects never feeds back into physics, scoring or the journal;
 * the renderer only reads `events` by sequence number and never mutates this object.
 */
export type FxKind = 'paddle'|'lost'|'power'|'bomb'|'clear'|'combo'|'hit'|'descend'|'zap';
/** `sx`/`sy`: source point for 'zap' (lightning) bolts. */
export interface FxEvent { seq:number; kind:FxKind; x:number; y:number; value:number; power?:PowerKind; sx?:number; sy?:number }
const EVENT_SLOTS = 64;
export class Effects {
  readonly particles = Array.from({ length: C.effects.particles }, () => ({ x:0,y:0,vx:0,vy:0,life:0,tag:0 }));
  readonly flashes = Array.from({ length: C.effects.flashes }, () => ({ x:0,y:0,life:0 }));
  /** Fixed ring of recent events; `eventSeq` grows monotonically across resets. */
  readonly events:FxEvent[] = Array.from({length:EVENT_SLOTS},()=>({seq:0,kind:'hit' as FxKind,x:0,y:0,value:0}));
  eventSeq = 0;
  powerKind:PowerKind|null=null;powerRemaining=0;explosionRemaining=0;explosionX=0;explosionY=0;
  power(kind:PowerKind){this.powerKind=kind;this.powerRemaining=.8;}
  explode(x:number,y:number){this.explosionX=x;this.explosionY=y;this.explosionRemaining=.24;for(let i=0;i<40;i++){const p=this.particles[this.cursor++%this.particles.length],angle=i*Math.PI*2/40;p.x=x;p.y=y;p.vx=Math.cos(angle)*190;p.vy=Math.sin(angle)*190;p.life=.35;p.tag=-1;}this.emit('bomb',x,y);}
  combo = 0; comboRemaining = 0;
  private cursor = 0; private flashCursor = 0;
  emit(kind:FxKind,x:number,y:number,value=0,power?:PowerKind,sx?:number,sy?:number){const e=this.events[++this.eventSeq%EVENT_SLOTS];e.seq=this.eventSeq;e.kind=kind;e.x=x;e.y=y;e.value=value;if(power)e.power=power;else delete e.power;if(sx===undefined){delete e.sx;delete e.sy;}else{e.sx=sx;e.sy=sy;}}
  reset() { this.powerKind=null;this.powerRemaining=0;this.explosionRemaining=0; for (const p of this.particles) p.life=0; for(const f of this.flashes) f.life=0; this.combo=0;this.comboRemaining=0;this.cursor=this.flashCursor=0; }
  /** `tag` is the brick row, used by the renderer to colour shards like the brick they came from. */
  burst(x: number, y: number, tag=0) {
    this.combo = this.comboRemaining > 0 ? this.combo + 1 : 1; this.comboRemaining = C.effects.comboWindow;
    const flash=this.flashes[this.flashCursor++ % this.flashes.length]; flash.x=x;flash.y=y;flash.life=.12;
    for(let i=0;i<4;i++) { const p=this.particles[this.cursor++ % this.particles.length]; const angle=i*Math.PI/2+this.cursor*.7;
      p.x=x;p.y=y;p.vx=Math.cos(angle)*65;p.vy=Math.sin(angle)*65;p.life=.35;p.tag=tag;
    }
    if(this.combo===5||this.combo===10||this.combo===20||(this.combo>20&&this.combo%25===0))this.emit('combo',x,y,this.combo);
  }
  update(dt:number) {
    this.powerRemaining=Math.max(0,this.powerRemaining-dt);this.explosionRemaining=Math.max(0,this.explosionRemaining-dt);
    this.comboRemaining=Math.max(0,this.comboRemaining-dt);if(!this.comboRemaining)this.combo=0;
    for(const f of this.flashes)if(f.life>0)f.life=Math.max(0,f.life-dt);
    for(const p of this.particles)if(p.life>0){p.life=Math.max(0,p.life-dt);p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=90*dt;}
  }
}
