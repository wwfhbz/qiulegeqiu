import {OCEAN} from '../shared/VisualTheme';
import type {FxEvent} from './Effects';
import type {Ball} from './Physics';
import type {CanvasSurface} from './platform/Contracts';

type Ctx=CanvasRenderingContext2D;
type Glow=(color:string)=>CanvasSurface|undefined;
interface Point{x:number;y:number;t:number}
interface Blob{x:number;y:number;r:number;start:number;seed:number}
interface Spark{x:number;y:number;vx:number;vy:number;start:number;life:number;color:string;size:number;kind:'ember'|'shard'|'slash';angle:number}
interface Poof{x:number;y:number;start:number}

const BLOBS=40,SPARKS=220,POOFS=24,TRAIL_BALLS=40;
const PIERCE_TRAIL_MS=800,FIRE_TRAIL_MS=320,BLOB_MS=900,POOF_MS=650;
const FIRE=OCEAN.powers.fire.color,FIRE_CORE='#FFD166',PIERCE=OCEAN.powers.pierce.color,HALVE=OCEAN.powers.halve.color;

/**
 * Wall-clock visuals for the endless powers: comet trails for piercing balls, burning patches and
 * flaming balls for fire, and implosions for ÷2. Fed by Effects events and ball positions; it never
 * touches the simulation. Everything is pooled so a long fire combo cannot allocate per frame.
 */
export class PowerFx {
  private trails=new Map<Ball,Point[]>();
  private blobs:Blob[]=Array.from({length:BLOBS},()=>({x:0,y:0,r:0,start:-1e9,seed:0}));private blobCursor=0;
  private sparks:Spark[]=Array.from({length:SPARKS},()=>({x:0,y:0,vx:0,vy:0,start:-1e9,life:0,color:'#fff',size:1,kind:'ember' as const,angle:0}));private sparkCursor=0;
  private poofs:Poof[]=Array.from({length:POOFS},()=>({x:0,y:0,start:-1e9}));private poofCursor=0;
  private lastEmber=0;private haloUntil=0;

  private spark(x:number,y:number,vx:number,vy:number,now:number,life:number,color:string,size:number,kind:Spark['kind'],angle=0){
    const s=this.sparks[this.sparkCursor++%SPARKS];s.x=x;s.y=y;s.vx=vx;s.vy=vy;s.start=now;s.life=life;s.color=color;s.size=size;s.kind=kind;s.angle=angle;
  }
  react(e:FxEvent,now:number){
    if(e.kind==='burn'){
      const b=this.blobs[this.blobCursor++%BLOBS];b.x=e.x;b.y=e.y;b.r=(e.value||16)*2.5;b.start=now;b.seed=e.seq;
      for(let i=0;i<8;i++){const a=(e.seq*37+i*47)%360*Math.PI/180;this.spark(e.x+Math.cos(a)*14,e.y+Math.sin(a)*14,Math.cos(a)*40,-50-((e.seq+i*13)%60),now,900,i%3===0?'#FFFFFF':i%2?FIRE:FIRE_CORE,3,'ember');}
    }else if(e.kind==='slash'){
      const angle=Math.atan2(e.sy??-1,e.sx??0);this.spark(e.x,e.y,0,0,now,300,PIERCE,16,'slash',angle);
      for(let i=0;i<3;i++){const a=angle+Math.PI+(i-1)*.6;this.spark(e.x,e.y,Math.cos(a)*90,Math.sin(a)*90,now,320,i===1?'#FFFFFF':PIERCE,2,'shard');}
    }else if(e.kind==='poof'){
      const p=this.poofs[this.poofCursor++%POOFS];p.x=e.x;p.y=e.y;p.start=now;this.haloUntil=now+450;
      for(let i=0;i<10;i++){const a=i/10*Math.PI*2+(e.seq%7)*.3;this.spark(e.x,e.y,Math.cos(a)*170,Math.sin(a)*170,now,600,i%2?HALVE:'#FFD0D6',4,'shard',a);}
    }
  }
  /** Record the path of every powered ball; called once per frame before drawing. */
  track(balls:readonly Ball[],pierce:boolean,fire:boolean,now:number,low:boolean){
    const keep=pierce?PIERCE_TRAIL_MS:fire?FIRE_TRAIL_MS:0;let tracked=0;
    for(const ball of balls){
      if(!ball.alive||!keep||tracked>=(low?12:TRAIL_BALLS))continue;tracked++;
      let points=this.trails.get(ball);if(!points){points=[];this.trails.set(ball,points);}
      const last=points[points.length-1];
      // A pooled ball reused elsewhere jumps: start a fresh trail instead of drawing a line across the field.
      if(last&&Math.hypot(ball.x-last.x,ball.y-last.y)>60)points.length=0;
      if(!last||points.length===0||Math.hypot(ball.x-last.x,ball.y-last.y)>2.5)points.push({x:ball.x,y:ball.y,t:now});
      if(fire&&!low&&now-this.lastEmber>16){const speed=Math.hypot(ball.vx,ball.vy)||1;this.spark(ball.x,ball.y,-ball.vx/speed*40+((now|0)%7-3)*6,-ball.vy/speed*40-30,now,420,(now|0)%2?FIRE:FIRE_CORE,2.4,'ember');}
    }
    if(fire)this.lastEmber=now;
    for(const [ball,points] of this.trails){
      let drop=0;while(drop<points.length&&now-points[drop].t>Math.max(keep,PIERCE_TRAIL_MS))drop++;if(drop)points.splice(0,drop);
      if(!points.length||(!ball.alive&&now-points[points.length-1].t>PIERCE_TRAIL_MS))this.trails.delete(ball);
    }
  }
  /** Burning patches and trails sit under the balls; sparks and implosions on top. */
  drawUnder(c:Ctx,glow:Glow,pierce:boolean,fire:boolean,now:number){
    c.save();c.globalCompositeOperation='lighter';
    // Fire: each contact leaves a flickering patch of flame covering the 3×3 cells it burned.
    const outer=glow(FIRE),inner=glow(FIRE_CORE);
    for(const b of this.blobs){const t=(now-b.start)/BLOB_MS;if(t<0||t>=1)continue;
      const grow=t<.18?t/.18:1,fade=t<.5?1:1-(t-.5)/.5,flicker=1+.12*Math.sin(now/45+b.seed);
      if(outer){const r=b.r*1.5*grow*flicker;c.globalAlpha=.95*fade;c.drawImage(outer as CanvasImageSource,b.x-r,b.y-r,r*2,r*2);
        for(let k=0;k<4;k++){const a=(b.seed*53+k*90)*Math.PI/180+now/350,rr=b.r*.85*grow,ox=Math.cos(a)*b.r*.55,oy=Math.sin(a)*b.r*.55-t*16;c.globalAlpha=.8*fade;c.drawImage(outer as CanvasImageSource,b.x+ox-rr,b.y+oy-rr,rr*2,rr*2);}}
      if(inner){const r=b.r*grow*flicker;c.globalAlpha=fade;c.drawImage(inner as CanvasImageSource,b.x-r,b.y-r-t*8,r*2,r*2);}
      if(!outer){c.globalAlpha=.5*fade;c.fillStyle=FIRE;c.beginPath();c.arc(b.x,b.y,b.r*grow,0,Math.PI*2);c.fill();}
    }
    // Trails: a long comet through everything the piercing ball cut, or a short flame tail.
    c.lineCap='round';c.lineJoin='round';
    for(const points of this.trails.values()){
      const n=points.length;if(n<2)continue;const span=pierce?PIERCE_TRAIL_MS:FIRE_TRAIL_MS;
      for(let i=1;i<n;i++){const p=points[i-1],q=points[i],age=Math.min(1,(now-q.t)/span),k=1-age;if(k<=0)continue;
        if(pierce){c.globalAlpha=.55*k;c.strokeStyle=PIERCE;c.lineWidth=2+9*k;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();
          c.globalAlpha=.9*k;c.strokeStyle='#E8FCFF';c.lineWidth=1+2.5*k;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();}
        else if(fire){c.globalAlpha=.8*k;c.strokeStyle=k>.5?FIRE_CORE:FIRE;c.lineWidth=2+8*k;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();}
      }
    }
    c.restore();c.globalAlpha=1;
  }
  /** Powered ball heads: a flaming corona or a bright comet head, drawn over the normal ball. */
  drawHeads(c:Ctx,glow:Glow,balls:readonly Ball[],pierce:boolean,fire:boolean,now:number){
    if(!pierce&&!fire)return;
    c.save();c.globalCompositeOperation='lighter';const sprite=glow(fire?FIRE:PIERCE),core=glow(fire?FIRE_CORE:'#FFFFFF');let drawn=0;
    for(const ball of balls){if(!ball.alive||drawn++>=TRAIL_BALLS)continue;
      const flicker=fire?1+.25*Math.sin(now/40+ball.x):1+.1*Math.sin(now/90),r=ball.radius*(fire?6.5:5.5)*flicker;
      if(sprite){c.globalAlpha=.85;c.drawImage(sprite as CanvasImageSource,ball.x-r,ball.y-r,r*2,r*2);}
      if(core){const rc=ball.radius*2.6;c.globalAlpha=.9;c.drawImage(core as CanvasImageSource,ball.x-rc,ball.y-rc,rc*2,rc*2);}
      if(pierce){const speed=Math.hypot(ball.vx,ball.vy)||1,ux=ball.vx/speed,uy=ball.vy/speed;c.globalAlpha=.9;c.strokeStyle='#FFFFFF';c.lineWidth=2;c.beginPath();c.moveTo(ball.x+ux*ball.radius*2.2,ball.y+uy*ball.radius*2.2);c.lineTo(ball.x-ux*ball.radius*5,ball.y-uy*ball.radius*5);c.stroke();}
    }
    c.restore();c.globalAlpha=1;
  }
  drawOver(c:Ctx,arena:{x:number;y:number;radius:number},now:number){
    let any=false;
    for(const s of this.sparks){const t=(now-s.start)/s.life;if(t<0||t>=1)continue;any=true;const age=(now-s.start)/1000,x=s.x+s.vx*age,y=s.y+s.vy*age+(s.kind==='shard'?120*age*age:0);
      c.globalAlpha=1-t;
      if(s.kind==='slash'){c.strokeStyle=s.color;c.lineWidth=3*(1-t)+1;c.lineCap='round';const len=s.size*(1+t);c.beginPath();c.moveTo(x-Math.cos(s.angle)*len,y-Math.sin(s.angle)*len);c.lineTo(x+Math.cos(s.angle)*len,y+Math.sin(s.angle)*len);c.stroke();}
      else{c.fillStyle=s.color;const size=s.size*(1-t*.6);if(s.kind==='shard'){c.save();c.translate(x,y);c.rotate(s.angle+t*6);c.fillRect(-size,-size*.45,size*2,size*.9);c.restore();}else{c.beginPath();c.arc(x,y,size,0,Math.PI*2);c.fill();}}
    }
    // ÷2: each removed ball implodes in a red ring with a fading ÷2 mark.
    for(const p of this.poofs){const t=(now-p.start)/POOF_MS;if(t<0||t>=1)continue;any=true;
      c.globalAlpha=1-t;c.strokeStyle=HALVE;c.lineWidth=4;c.beginPath();c.arc(p.x,p.y,5+42*(1-t)*(1-t),0,Math.PI*2);c.stroke();
      c.lineWidth=2;c.strokeStyle='#FFD0D6';c.beginPath();c.arc(p.x,p.y,5+64*t,0,Math.PI*2);c.stroke();
      c.fillStyle=HALVE;c.font=`900 ${Math.round(18+12*t)}px ${OCEAN.fonts.numbers}`;c.textAlign='center';c.textBaseline='middle';c.fillText('÷2',p.x,p.y-12-18*t);c.textBaseline='alphabetic';}
    // A red pulse around the arena rim when balls are halved.
    if(now<this.haloUntil){const k=(this.haloUntil-now)/450;c.globalAlpha=.75*k;c.strokeStyle=HALVE;c.lineWidth=10*k+2;c.beginPath();c.arc(arena.x,arena.y,arena.radius-4,0,Math.PI*2);c.stroke();any=true;}
    c.globalAlpha=1;return any;
  }
}
