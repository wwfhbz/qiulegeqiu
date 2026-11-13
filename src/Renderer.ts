import {OCEAN,brickColorIndex,visualBudget} from '../shared/VisualTheme';
import {StartHint,START_HINT} from './PlayfieldStart';
import { POWER_LABELS,type PowerKind } from './PowerRules';
import { ARCADE } from './ArcadeRules';
import { C } from './GameConfig';
import { Physics } from './Physics';
import type { FxEvent } from './Effects';
import { FRAME } from './WorldGeometry';
import type {CanvasSurface,RendererHost} from './platform/Contracts';
export type {RendererHost} from './platform/Contracts';

type Ctx=CanvasRenderingContext2D;
type Ring={x:number;y:number;start:number;duration:number;from:number;to:number;color:string;width:number};
type Popup={text:string;sub:string;x:number;y:number;start:number;duration:number;color:string;size:number};

/** '#RRGGBB' mixed toward white (amount>0) or black (amount<0). Presentation only. */
export function shade(hex:string,amount:number){
  const n=parseInt(hex.slice(1),16),t=amount<0?0:255,k=Math.abs(amount);
  const ch=(v:number)=>Math.round(v+(t-v)*k).toString(16).padStart(2,'0');
  return '#'+ch(n>>16&255)+ch(n>>8&255)+ch(n&255);
}
export function rgba(hex:string,alpha:number){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${alpha})`;}

const RING_SLOTS=24,BUBBLES=14;
/** One popup per channel: a newer combo/power message replaces the old one instead of stacking. */
const POPUP_CHANNELS={combo:0,power:1,clear:2} as const;

/**
 * Shared Canvas renderer for Web and WeChat. It only reads Physics; every animation clock here is
 * the wall clock passed to draw(), so presentation can never alter simulation, scoring or replays.
 */
export class Renderer {
  private ctx: Ctx;
  private startHint=new StartHint();
  private cache:CanvasSurface;
  private badges?:CanvasSurface;private badgeKinds:PowerKind[]=['triple','wide','halve','life','bomb'];
  private backdrop?:CanvasSurface;private backdropKey='';
  private bricks:CanvasSurface[]=[];private brickKey='';
  private glows=new Map<string,CanvasSurface|null>();
  private stopObserver?:()=>void;
  private cachedRevision = -1;
  private ratio = 1;
  private arenaFill?:CanvasGradient|string;private paddleFill?:CanvasGradient|string;
  private lowDevice=false;private sampleCount=0;private sampleTime=0;private previousDraw=0;
  private generation = -1; private cleared = 0;
  // Wall-clock juice owned by the renderer, never by Physics.
  private seenSeq=-1;
  private rings:Ring[]=Array.from({length:RING_SLOTS},()=>({x:0,y:0,start:-1e9,duration:0,from:0,to:0,color:'#fff',width:1}));private ringCursor=0;
  private popups:Popup[]=Array.from({length:3},()=>({text:'',sub:'',x:0,y:0,start:-1e9,duration:0,color:'#fff',size:20}));
  private shakeUntil=0;private shakePower=0;
  private flashUntil=0;private flashStart=0;private flashColor='#fff';private flashAlpha=0;
  private dangerUntil=0;private paddlePulse=-1e9;
  private bubbles=Array.from({length:BUBBLES},(_,i)=>({x:FRAME.left+((i*137)%(FRAME.right-FRAME.left)),y:(i*263)%C.height,r:1+(i%4)*.8,speed:8+(i%5)*5,phase:i}));
  private lastBricks:number[]=[];private lastBricksRevision=-1;
  private lastTime=0;private roundOver=false;
  constructor(private canvas:CanvasSurface, private host:RendererHost) {
    this.cache=host.cache;this.badges=host.createSurface?.();
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('当前设备不支持二维画布');this.ctx=ctx;
    this.resize();
    const stop=host.observe?.(()=>this.resize());if(typeof stop==='function')this.stopObserver=stop;
  }
  dispose(){this.stopObserver?.();this.stopObserver=undefined;}
  resize() {
    const rect = this.host.viewport();
    // Hidden/transitional layouts can report zero size. Keep the last valid buffer.
    if (rect.width <= 0 || rect.height <= 0) return;
    this.ratio = Math.min(this.host.pixelRatio() || 1, 3) * rect.width / C.width;
    this.canvas.width = Math.max(1, Math.round(C.width * this.ratio)); this.canvas.height = Math.max(1, Math.round(C.height * this.ratio));
    this.arenaFill=this.paddleFill=undefined;this.backdropKey=this.brickKey='';
    this.cache.width = this.canvas.width; this.cache.height = this.canvas.height; this.cachedRevision = -1;
    if(this.badges){const a=OCEAN.powerBadge;this.badges.width=a.cellWidth*5*a.pixelRatio;this.badges.height=a.cellHeight*a.pixelRatio;const c=this.badges.getContext('2d')!;c.setTransform(a.pixelRatio,0,0,a.pixelRatio,0,0);c.clearRect(0,0,a.cellWidth*5,a.cellHeight);this.badgeKinds.forEach((kind,i)=>this.badge(c,i*a.cellWidth+a.cellWidth/2,a.cellHeight/2,kind));}
  }

  /** Orb-style power capsule: harmful ÷2 gets a warning ring so players learn to dodge it. */
  private badge(c:Ctx,x:number,y:number,kind:PowerKind){
    const a=OCEAN.powerBadge,style=OCEAN.powers[kind],r=a.radius;
    const g=c.createRadialGradient?.(x-r*.35,y-r*.4,r*.1,x,y,r);
    if(g){g.addColorStop(0,shade(style.color,.55));g.addColorStop(.55,style.color);g.addColorStop(1,shade(style.color,-.35));}
    c.fillStyle=g||style.color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
    c.lineWidth=style.good?1.5:2.5;c.strokeStyle=style.good?'rgba(255,255,255,.75)':'#FFE3E7';
    if(!style.good)c.setLineDash?.([4,3]);c.beginPath();c.arc(x,y,r-.8,0,Math.PI*2);c.stroke();c.setLineDash?.([]);
    c.fillStyle='rgba(255,255,255,.45)';c.beginPath();c.ellipse?.(x-r*.3,y-r*.45,r*.38,r*.2,-.5,0,Math.PI*2);c.fill();
    c.fillStyle='#FFFFFF';c.textAlign='center';c.textBaseline='middle';c.font='800 15px '+OCEAN.fonts.numbers;c.fillText(style.label,x,y+1);c.textBaseline='alphabetic';
  }

  /** One soft radial sprite per colour, reused for ball, paddle, power and danger glows. */
  private glow(color:string){
    const known=this.glows.get(color);if(known!==undefined)return known??undefined;
    this.glows.set(color,null);// Remember failures too, so unsupported hosts never allocate per frame.
    const s=this.host.createSurface?.();if(!s)return undefined;
    s.width=s.height=64;const c=s.getContext('2d');if(!c)return undefined;
    const g=c.createRadialGradient?.(32,32,0,32,32,32);if(!g)return undefined;
    g.addColorStop(0,rgba(color,.9));g.addColorStop(.35,rgba(color,.35));g.addColorStop(1,rgba(color,0));
    c.fillStyle=g;c.fillRect(0,0,64,64);this.glows.set(color,s);return s;
  }

  /** Bevelled brick tiles, built once per size/colour and then stamped into the static cache. */
  private brickSprites(size:number){
    const key=size+':'+this.ratio;if(key===this.brickKey)return this.bricks;
    const previous=this.bricks;this.bricks=[];this.brickKey=key;
    const px=Math.max(1,Math.ceil(size*this.ratio));
    for(const [i,color] of OCEAN.bricks.entries()){
      // Reuse surfaces across levels/resizes; WeChat offscreen canvases are a limited resource.
      const s=previous[i]??this.host.createSurface?.();if(!s){this.bricks=[];return this.bricks;}
      s.width=s.height=px;const c=s.getContext('2d');if(!c){this.bricks=[];return this.bricks;}
      c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,px,px);c.setTransform(px/size,0,0,px/size,0,0);this.paintBrick(c,0,0,size,color);this.bricks.push(s);
    }
    return this.bricks;
  }
  private paintBrick(c:Ctx,x:number,y:number,size:number,color:string,gradient=true){
    const r=Math.min(2.4,size*.2),inset=Math.max(.6,size*.08);
    c.fillStyle=shade(color,-.38);c.beginPath();c.roundRect(x,y,size,size,r);c.fill();
    const g=gradient?c.createLinearGradient?.(0,y,0,y+size):undefined;
    if(g){g.addColorStop(0,shade(color,.32));g.addColorStop(.5,color);g.addColorStop(1,shade(color,-.12));}
    c.fillStyle=g||color;c.beginPath();c.roundRect(x+inset*.5,y+inset*.3,size-inset,size-inset*1.3,Math.max(.5,r-.6));c.fill();
    c.fillStyle='rgba(255,255,255,.42)';c.fillRect(x+inset+.4,y+inset*.6,Math.max(.5,size-inset*2-.8),Math.max(.6,size*.09));
    if(size>=12){c.fillStyle='rgba(255,255,255,.55)';c.beginPath();c.arc(x+size*.27,y+size*.3,size*.07,0,Math.PI*2);c.fill();}
  }

  /** Background, arena bowl, glowing rim, frame and danger zone: redrawn only on resize or level change. */
  private drawBackdrop(c:Ctx,wall:Physics['wall']){
    const a=C.arena;
    const bg=c.createLinearGradient?.(0,0,0,C.height);
    if(bg){bg.addColorStop(0,'#08111F');bg.addColorStop(.55,OCEAN.colors.background);bg.addColorStop(1,'#0E2036');}
    c.fillStyle=bg||OCEAN.colors.background;c.fillRect(0,0,C.width,C.height);
    // Soft light shafts from the surface.
    const shaft=c.createLinearGradient?.(0,0,0,C.height*.8);if(shaft){shaft.addColorStop(0,'rgba(159,233,255,.07)');shaft.addColorStop(1,'rgba(159,233,255,0)');}
    c.save();c.fillStyle=shaft||'rgba(159,233,255,.03)';
    for(const [x,w,skew] of [[150,70,90],[330,40,60],[520,90,-70],[680,50,-40]] as const){c.beginPath();c.moveTo(x,0);c.lineTo(x+w,0);c.lineTo(x+w+skew,C.height*.85);c.lineTo(x+skew-w*.4,C.height*.85);c.closePath();c.fill();}
    c.restore();
    // Arena bowl with depth.
    const bowl=c.createRadialGradient?.(a.x,a.y-a.radius*.35,a.radius*.1,a.x,a.y,a.radius);
    if(bowl){bowl.addColorStop(0,'#1E4670');bowl.addColorStop(.7,OCEAN.colors.arena);bowl.addColorStop(1,'#0B1A2E');}
    c.beginPath();c.arc(a.x,a.y,a.radius,0,Math.PI*2);c.fillStyle=bowl||OCEAN.colors.arena;c.fill();
    // Fine concentric guide rings give the bowl a "sonar" texture.
    c.strokeStyle='rgba(120,200,255,.05)';c.lineWidth=1;for(let r=60;r<a.radius;r+=60){c.beginPath();c.arc(a.x,a.y,r,0,Math.PI*2);c.stroke();}
    // Neon rim: wide faint strokes underneath a crisp core line.
    c.lineCap='round';
    for(const [width,alpha] of [[14,.06],[8,.12],[4,.25]] as const){c.beginPath();c.arc(a.x,a.y,a.radius,wall.startAngle,wall.endAngle);c.strokeStyle=rgba(OCEAN.colors.accent,alpha);c.lineWidth=width;c.stroke();}
    c.beginPath();c.arc(a.x,a.y,a.radius,wall.startAngle,wall.endAngle);c.strokeStyle='#BFF4FF';c.lineWidth=Math.max(1.6,wall.width);c.stroke();
    // Exit posts glow warm so the gap reads as "the goal".
    for(const x of [wall.leftX,wall.rightX]){c.beginPath();c.arc(x,wall.endpointY,5,0,Math.PI*2);c.fillStyle=OCEAN.colors.warning;c.fill();c.beginPath();c.arc(x,wall.endpointY,10,0,Math.PI*2);c.fillStyle=rgba(OCEAN.colors.warning,.18);c.fill();}
    // U-frame.
    c.beginPath();c.moveTo(FRAME.left,FRAME.deathY);c.lineTo(FRAME.left,FRAME.top);c.lineTo(FRAME.right,FRAME.top);c.lineTo(FRAME.right,FRAME.deathY);
    c.lineJoin='round';c.strokeStyle=rgba(OCEAN.colors.accent,.12);c.lineWidth=6;c.stroke();c.strokeStyle=OCEAN.colors.border;c.lineWidth=Math.max(1.4,FRAME.width);c.stroke();c.lineCap='butt';
    // Danger zone: a red haze below the paddle line, not a collider.
    const danger=c.createLinearGradient?.(0,FRAME.deathY-28,0,C.height);
    if(danger){danger.addColorStop(0,rgba(OCEAN.colors.danger,0));danger.addColorStop(.4,rgba(OCEAN.colors.danger,.10));danger.addColorStop(1,rgba(OCEAN.colors.danger,.22));c.fillStyle=danger;c.fillRect(FRAME.left,FRAME.deathY-28,FRAME.right-FRAME.left,C.height-FRAME.deathY+28);}
    c.beginPath();c.setLineDash?.([6,8]);c.moveTo(FRAME.left,FRAME.deathY);c.lineTo(FRAME.right,FRAME.deathY);c.strokeStyle=rgba(OCEAN.colors.danger,.45);c.lineWidth=1;c.stroke();c.setLineDash?.([]);
  }

  private ring(x:number,y:number,now:number,duration:number,from:number,to:number,color:string,width=2){const r=this.rings[this.ringCursor++%RING_SLOTS];r.x=x;r.y=y;r.start=now;r.duration=duration;r.from=from;r.to=to;r.color=color;r.width=width;}
  private popup(channel:keyof typeof POPUP_CHANNELS,text:string,sub:string,x:number,y:number,now:number,color:string,size:number,duration:number=OCEAN.motion.popupSeconds*1000){const p=this.popups[POPUP_CHANNELS[channel]];p.text=text;p.sub=sub;p.x=x;p.y=y;p.start=now;p.duration=duration;p.color=color;p.size=size;}
  private shake(power:number,now:number){if(power>=this.shakePower||now>this.shakeUntil){this.shakePower=power;this.shakeUntil=now+OCEAN.motion.shakeSeconds*1000;}}
  private flash(color:string,alpha:number,now:number,ms:number){this.flashColor=color;this.flashAlpha=alpha;this.flashStart=now;this.flashUntil=now+ms;}

  /** Consume new presentation events by sequence number without mutating Physics. */
  private consume(events:readonly FxEvent[],seq:number,now:number){
    if(this.seenSeq<0||seq<this.seenSeq){this.seenSeq=seq;return;}
    const first=Math.max(this.seenSeq+1,seq-events.length+1);
    for(let s=first;s<=seq;s++){const e=events[s%events.length];if(e.seq!==s)continue;this.react(e,now);}
    this.seenSeq=seq;
  }
  private react(e:FxEvent,now:number){
    const a=C.arena;
    switch(e.kind){
      case 'paddle':this.paddlePulse=now;this.ring(e.x,e.y,now,260,4,26,OCEAN.colors.accent,2);break;
      case 'lost':this.ring(e.x,e.y,now,420,6,46,OCEAN.colors.danger,3);if(this.roundOver){this.dangerUntil=now+520;this.shake(6,now);}break;
      case 'power':{const kind=e.power??'triple',style=OCEAN.powers[kind];this.ring(e.x,e.y,now,420,10,90,style.color,3);
        this.popup('power',POWER_LABELS[kind],style.good?'':'小心！球数减半',a.x,a.y+a.radius+70,now,style.color,30);
        if(!style.good){this.shake(6,now);this.flash(OCEAN.colors.danger,.18,now,260);}else this.flash(style.color,.10,now,200);break;}
      case 'bomb':this.shake(12,now);this.ring(e.x,e.y,now,520,10,220,OCEAN.colors.warning,5);this.flash('#FFFFFF',.22,now,180);break;
      case 'combo':{const mult=ARCADE.multipliers.find(t=>e.value>=t.combo)?.value??1,color=e.value>=20?OCEAN.colors.heart:e.value>=10?OCEAN.colors.warning:OCEAN.colors.accent;
        this.popup('combo',`${e.value} 连击`,mult>1?`得分 ×${mult}`:'',a.x,a.y+70,now,color,e.value>=20?48:40,1100);this.ring(a.x,a.y+80,now,500,20,140,color,3);if(e.value>=20)this.shake(4,now);break;}
      case 'clear':this.flash('#FFFFFF',.35,now,420);this.shake(10,now);this.ring(e.x,e.y,now,700,10,420,OCEAN.colors.positive,6);this.ring(a.x,a.y,now,900,a.radius*.2,a.radius*1.2,OCEAN.colors.accent,4);this.popup('clear','清台！','',a.x,a.y-170,now,OCEAN.colors.positive,58,1300);break;
      case 'hit':break;
    }
  }

  draw(p: Physics, ready: boolean, now=0) {
    if(this.previousDraw&&now>this.previousDraw&&now-this.previousDraw<100){this.sampleTime+=now-this.previousDraw;if(++this.sampleCount===30){if(this.sampleTime/30>24)this.lowDevice=true;this.sampleCount=this.sampleTime=0;}}this.previousDraw=now;
    const dt=Math.min(.1,Math.max(0,(now-this.lastTime)/1000));this.lastTime=now;
    const low=this.lowDevice||this.host.lowPerformance?.()===true;
    const budget=visualBudget(p.balls.length,low);
    const b = p.blocks;
    if (this.cachedRevision !== b.revision) {
      const c = this.cache.getContext('2d')!;
      c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      if (this.cachedRevision === -1 || this.generation !== b.generation) {
        c.clearRect(0, 0, C.width, C.height);
        const sprites=this.brickSprites(b.size);
        for (let row = 0; row < b.rows; row++) for (let col = 0; col < b.cols; col++) if(b.alive[row*b.cols+col]){
          const x=b.left+col*b.step,y=b.top+row*b.step,color=brickColorIndex(row,col);
          if(sprites.length)c.drawImage(sprites[color] as CanvasImageSource,x,y,b.size,b.size);else this.paintBrick(c,x,y,b.size,OCEAN.bricks[color],false);
        }
        this.generation = b.generation; this.cleared = b.destroyed.length;
      } else {
        // Clear only changed cells, using integral device pixels to avoid fringes.
        for (; this.cleared < b.destroyed.length; this.cleared++) {
          const i = b.destroyed[this.cleared], x = b.left + i % b.cols * b.step, y = b.top + Math.floor(i / b.cols) * b.step;
          c.clearRect(Math.floor(x*this.ratio)/this.ratio, Math.floor(y*this.ratio)/this.ratio, (Math.ceil((x+b.size)*this.ratio)-Math.floor(x*this.ratio))/this.ratio, (Math.ceil((y+b.size)*this.ratio)-Math.floor(y*this.ratio))/this.ratio);
        }
      }
      this.cachedRevision = b.revision;
    }
    // A lost final ball resets the round before this frame, so 'ready' marks the round as over.
    this.roundOver=ready||!p.balls.some(ball=>ball.alive);
    this.consume(p.effects.events,p.effects.eventSeq,now);
    const c = this.ctx, a = C.arena, wall=p.wall;
    // Screen shake decays quickly; reduced on weak devices.
    let sx=0,sy=0;if(now<this.shakeUntil){const k=(this.shakeUntil-now)/(OCEAN.motion.shakeSeconds*1000),amp=this.shakePower*k*k*(low?.5:1);sx=(Math.random()*2-1)*amp;sy=(Math.random()*2-1)*amp;}
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0); c.clearRect(0, 0, C.width, C.height);
    c.setTransform(this.ratio,0,0,this.ratio,sx*this.ratio,sy*this.ratio);

    const backdropKey=wall.exitHalfWidth+':'+this.canvas.width;
    if(!this.backdrop&&this.host.createSurface)this.backdrop=this.host.createSurface();
    if(this.backdrop){
      if(this.backdropKey!==backdropKey){this.backdrop.width=this.canvas.width;this.backdrop.height=this.canvas.height;const bc=this.backdrop.getContext('2d');if(bc){bc.setTransform(this.ratio,0,0,this.ratio,0,0);this.drawBackdrop(bc,wall);}this.backdropKey=backdropKey;}
      if(sx||sy){c.fillStyle=OCEAN.colors.background;c.fillRect(-20,-20,C.width+40,C.height+40);}
      c.drawImage(this.backdrop as CanvasImageSource,0,0,C.width,C.height);
    } else {
      if(!this.arenaFill){const g=c.createLinearGradient(0,a.y-a.radius,0,a.y+a.radius);g?.addColorStop(0,OCEAN.colors.arena);g?.addColorStop(1,OCEAN.colors.gradientEnd);this.arenaFill=g||OCEAN.colors.arena;}
      c.beginPath(); c.arc(a.x, a.y, a.radius, 0, Math.PI * 2); c.fillStyle = this.arenaFill; c.fill();
      c.beginPath(); c.arc(a.x, a.y, a.radius, wall.startAngle, wall.endAngle);c.strokeStyle = OCEAN.colors.border; c.lineWidth = wall.width; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
    }
    // Drifting bubbles: a handful of tiny circles, skipped on weak devices.
    if(!low){c.fillStyle='rgba(160,230,255,.10)';for(const q of this.bubbles){q.y-=q.speed*dt;if(q.y<-6){q.y=C.height+6;}const x=q.x+Math.sin(now/1300+q.phase)*6;c.beginPath();c.arc(x,q.y,q.r,0,Math.PI*2);c.fill();}}

    c.drawImage(this.cache as CanvasImageSource, 0, 0, C.width, C.height);
    // Hunting the last few bricks is tedious: pulse a beacon around each survivor.
    if(b.remaining>0&&b.remaining<=OCEAN.motion.lastBricks&&b.removed>0){
      if(this.lastBricksRevision!==b.revision){this.lastBricks.length=0;for(let i=0;i<b.alive.length&&this.lastBricks.length<b.remaining;i++)if(b.alive[i])this.lastBricks.push(i);this.lastBricksRevision=b.revision;}
      const pulse=.5+.5*Math.sin(now/180);c.lineWidth=2;c.strokeStyle=rgba(OCEAN.colors.warning,.35+.45*pulse);
      for(const i of this.lastBricks){const x=b.left+i%b.cols*b.step+b.size/2,y=b.top+Math.floor(i/b.cols)*b.step+b.size/2;c.beginPath();c.arc(x,y,b.size*.9+6+pulse*6,0,Math.PI*2);c.stroke();}
    }
    for(const obstacle of p.obstacles.items){if(obstacle.destroyed)continue;const o=obstacle.config,half=(o.length-o.thickness)/2,color=o.kind==='rotating'?OCEAN.bricks[4]:o.kind==='moving'?OCEAN.bricks[1]:OCEAN.colors.secondary;c.save();c.translate(obstacle.x,obstacle.y);c.rotate(obstacle.angle);c.lineCap='round';c.beginPath();c.moveTo(-half,0);c.lineTo(half,0);c.lineWidth=o.thickness+6;c.strokeStyle=rgba(color,.18);c.stroke();c.lineWidth=o.thickness;c.strokeStyle=color;c.stroke();c.beginPath();c.moveTo(-half+3,0);c.lineTo(half-3,0);c.lineWidth=1.2;c.strokeStyle='rgba(255,255,255,.5)';c.stroke();c.restore();}
    if(p.effects.explosionRemaining>0){c.beginPath();c.arc(p.effects.explosionX,p.effects.explosionY,(.24-p.effects.explosionRemaining)*240,0,Math.PI*2);c.lineWidth=3;c.strokeStyle=OCEAN.colors.warning;c.stroke();}
    if(now<this.dangerUntil){const k=(this.dangerUntil-now)/520,g=this.glow(OCEAN.colors.danger);if(g){c.globalAlpha=.55*k;c.drawImage(g as CanvasImageSource,FRAME.left-80,FRAME.deathY-120,FRAME.right-FRAME.left+160,240);c.globalAlpha=1;}}

    // Paddle: glow, body, neon top edge, and a draining bar while "wide" lasts.
    const py=C.paddle.y-C.paddle.height/2,pw=p.paddleWidth,wide=p.wideRemaining>0,accent=wide?OCEAN.paddle.wide:OCEAN.paddle.accent;
    const pulse=Math.max(0,1-(now-this.paddlePulse)/220);
    const pg=this.glow(accent);if(pg){c.globalAlpha=.28+.4*pulse;c.drawImage(pg as CanvasImageSource,p.paddleX-pw*.75,py-26,pw*1.5,C.paddle.height+52);c.globalAlpha=1;}
    if(!this.paddleFill){const g=c.createLinearGradient(0,py,0,py+C.paddle.height);g?.addColorStop(0,OCEAN.paddle.body);g?.addColorStop(1,OCEAN.paddle.edge);this.paddleFill=g||OCEAN.paddle.body;}
    c.fillStyle=OCEAN.paddle.shadow;c.beginPath();c.roundRect(p.paddleX-pw/2,py+3,pw,C.paddle.height,6);c.fill();
    c.fillStyle=this.paddleFill;c.beginPath();c.roundRect(p.paddleX-pw/2,py-pulse*1.5,pw,C.paddle.height,6);c.fill();
    c.fillStyle=accent;c.fillRect(p.paddleX-pw/2+6,py-pulse*1.5,pw-12,2);
    c.fillStyle='rgba(255,255,255,.7)';c.fillRect(p.paddleX-pw/2+10,py+3-pulse*1.5,pw-20,1);
    for(const side of [-1,1]){c.fillStyle=accent;c.beginPath();c.arc(p.paddleX+side*(pw/2-6),py+C.paddle.height/2-pulse*1.5,2.2,0,Math.PI*2);c.fill();}
    if(wide){const k=p.wideRemaining/C.power.duration;c.fillStyle='rgba(255,255,255,.12)';c.fillRect(p.paddleX-pw/2,py+C.paddle.height+7,pw,3);c.fillStyle=k<.3&&Math.sin(now/70)>0?OCEAN.colors.warning:OCEAN.paddle.wide;c.fillRect(p.paddleX-pw/2,py+C.paddle.height+7,pw*k,3);}

    // Ready: dotted launch guide from the waiting ball.
    if(ready){const ball=p.balls[0];if(ball){const tx=a.x-ball.x,ty=a.y+a.radius-12-ball.y,len=Math.hypot(tx,ty)||1,ux=tx/len,uy=ty/len,off=(now/40)%14;c.fillStyle=rgba(OCEAN.colors.accent,.7);for(let d=14+off;d<130;d+=14){c.globalAlpha=.75*(1-d/130);c.beginPath();c.arc(ball.x+ux*d,ball.y+uy*d,2,0,Math.PI*2);c.fill();}c.globalAlpha=1;}}

    // Balls: comet trail, additive glow (budgeted), solid core.
    if(budget.trailLength){c.lineCap='round';for(const ball of p.balls)if(ball.alive){const speed=Math.hypot(ball.vx,ball.vy)||1,ux=ball.vx/speed,uy=ball.vy/speed;for(let k=0;k<3;k++){const s0=k*budget.trailLength/3,s1=(k+1)*budget.trailLength/3;c.globalAlpha=budget.trailAlpha*(1.6-k*.5);c.lineWidth=ball.radius*(1.5-k*.4);c.strokeStyle=OCEAN.ball.trail;c.beginPath();c.moveTo(ball.x-ux*s0,ball.y-uy*s0);c.lineTo(ball.x-ux*s1,ball.y-uy*s1);c.stroke();}}c.lineCap='butt';c.globalAlpha=1;}
    const bg=budget.highlights?this.glow(OCEAN.ball.glow):undefined;
    if(bg){c.globalAlpha=.55;for(const ball of p.balls)if(ball.alive){const r=ball.radius*4.2;c.drawImage(bg as CanvasImageSource,ball.x-r,ball.y-r,r*2,r*2);}c.globalAlpha=1;}
    for(const ball of p.balls)if(ball.alive){c.fillStyle=OCEAN.ball.body;c.beginPath();c.arc(ball.x,ball.y,ball.radius+.4,0,Math.PI*2);c.fill();if(budget.highlights){c.strokeStyle=OCEAN.ball.edge;c.lineWidth=.8;c.beginPath();c.arc(ball.x,ball.y,ball.radius,0,Math.PI*2);c.stroke();}}

    // Brick break: bright flash plus coloured shards that inherit the brick's band colour.
    const shardColor=(tag:number)=>tag<0?OCEAN.colors.warning:OCEAN.bricks[brickColorIndex(tag)];
    for(const f of p.effects.flashes)if(f.life>0){const k=f.life/OCEAN.motion.flashSeconds;c.globalAlpha=Math.min(.8,k*.8);c.fillStyle='#FFFFFF';const s=b.size*(1+.6*(1-k));c.fillRect(f.x-s/2,f.y-s/2,s,s);}
    let rendered=0;
    for(const q of p.effects.particles){if(q.life>0&&rendered++<budget.particles){const k=q.life/OCEAN.motion.sourceParticleSeconds,s=1.2+2.2*k;c.globalAlpha=Math.min(1,k*1.3);c.fillStyle=shardColor(q.tag);c.fillRect(q.x-s/2,q.y-s/2,s,s);}}
    c.globalAlpha=1;

    // Falling power orbs with a soft halo (skipped when the tutorial floods the field) and gentle bob.
    let orbs=0;for(const item of p.powers.items)if(item.alive)orbs++;const halos=budget.highlights&&orbs<=40;
    for(const item of p.powers.items)if(item.alive){
      const bob=Math.sin(now/220+item.dropId)*2,style=OCEAN.powers[item.kind];
      if(halos){const hg=this.glow(style.color);if(hg){c.globalAlpha=.45;c.drawImage(hg as CanvasImageSource,item.x-26,item.y-26+bob,52,52);c.globalAlpha=1;}}
      if(this.badges){const ab=OCEAN.powerBadge;c.drawImage(this.badges as CanvasImageSource,this.badgeKinds.indexOf(item.kind)*ab.cellWidth*ab.pixelRatio,0,ab.cellWidth*ab.pixelRatio,ab.cellHeight*ab.pixelRatio,item.x-ab.cellWidth/2,item.y-ab.cellHeight/2+bob,ab.cellWidth,ab.cellHeight);}else this.badge(c,item.x,item.y+bob,item.kind);
    }

    // Live combo meter in the clear band under the bricks.
    const combo=p.effects.combo;
    if(combo>=3){const mult=ARCADE.multipliers.find(t=>combo>=t.combo)?.value??1,next=ARCADE.multipliers.slice().reverse().find(t=>t.combo>combo),color=mult>=3?OCEAN.colors.heart:mult>=2?OCEAN.colors.warning:mult>1?OCEAN.colors.accent:OCEAN.colors.secondary;
      const y=a.y+a.radius-48,k=p.effects.comboRemaining/C.effects.comboWindow;
      c.textAlign='center';c.textBaseline='middle';c.globalAlpha=.9;c.font=`800 ${mult>1?30:24}px ${OCEAN.fonts.numbers}`;c.fillStyle=color;c.fillText(`${combo}`,a.x-28,y);
      c.font=`700 15px ${OCEAN.fonts.body}`;c.fillStyle=OCEAN.colors.text;c.textAlign='left';c.fillText(mult>1?`连击 ×${mult}`:'连击',a.x-6,y-6);
      c.font=`12px ${OCEAN.fonts.body}`;c.fillStyle=OCEAN.colors.muted;if(next)c.fillText(`${next.combo} 连 ×${next.value}`,a.x-6,y+11);
      c.fillStyle='rgba(255,255,255,.12)';c.fillRect(a.x-60,y+24,120,3);c.fillStyle=color;c.fillRect(a.x-60,y+24,120*k,3);
      c.textAlign='center';c.textBaseline='alphabetic';c.globalAlpha=1;
    }

    // Rings and popups.
    for(const r of this.rings){const t=(now-r.start)/r.duration;if(t<0||t>=1)continue;const e=1-(1-t)*(1-t);c.globalAlpha=(1-t)*.9;c.strokeStyle=r.color;c.lineWidth=r.width*(1-t*.6);c.beginPath();c.arc(r.x,r.y,r.from+(r.to-r.from)*e,0,Math.PI*2);c.stroke();}
    c.globalAlpha=1;c.textAlign='center';c.textBaseline='middle';
    for(const q of this.popups){const t=(now-q.start)/q.duration;if(t<0||t>=1)continue;const pop=t<.15?.6+.4*(t/.15)*1.15:t<.25?1.15-.15*((t-.15)/.1):1,rise=t*26;
      c.globalAlpha=t>.7?(1-t)/.3:1;c.font=`900 ${Math.round(q.size*pop)}px ${OCEAN.fonts.body}`;c.lineWidth=5;c.strokeStyle='rgba(6,16,29,.85)';c.strokeText(q.text,q.x,q.y-rise);c.fillStyle=q.color;c.fillText(q.text,q.x,q.y-rise);
      if(q.sub){c.font=`700 ${Math.round(q.size*.45)}px ${OCEAN.fonts.body}`;c.lineWidth=4;c.strokeText(q.sub,q.x,q.y-rise+q.size*.72);c.fillStyle=OCEAN.colors.text;c.fillText(q.sub,q.x,q.y-rise+q.size*.72);}}
    c.globalAlpha=1;c.textBaseline='alphabetic';
    if(now<this.flashUntil){c.globalAlpha=this.flashAlpha*(this.flashUntil-now)/Math.max(1,this.flashUntil-this.flashStart);c.fillStyle=this.flashColor;c.beginPath();c.arc(a.x,a.y,a.radius,0,Math.PI*2);c.fill();c.globalAlpha=1;}

    // Ready card: level title above the tap hint.
    const hintAlpha=this.startHint.alpha(ready,now);
    if(hintAlpha>0){
      c.save();c.globalAlpha=Math.min(1,hintAlpha/.7);c.textAlign='center';c.textBaseline='middle';
      const fontSize=Math.max(30,Math.min(46,16*C.width/Math.max(1,this.host.viewport().width)));
      c.font=`700 ${fontSize}px ${OCEAN.fonts.body}`;
      const width=Math.min(C.width-80,c.measureText(START_HINT).width+56),fresh=b.removed===0,cardH=fresh?fontSize*3.9:fontSize*1.7,top=a.y-cardH/2+(fresh?fontSize*.4:0);
      c.fillStyle='rgba(6,16,29,.78)';c.beginPath();c.roundRect(a.x-width/2,top,width,cardH,18);c.fill();
      c.strokeStyle=rgba(OCEAN.colors.accent,.55);c.lineWidth=1.5;c.stroke();
      if(fresh){c.font=`800 ${Math.round(fontSize*.62)}px ${OCEAN.fonts.body}`;c.fillStyle=OCEAN.colors.warning;c.fillText(`第 ${p.level.number} 关`,a.x,top+fontSize*.75);c.font=`900 ${Math.round(fontSize*1.35)}px ${OCEAN.fonts.body}`;c.fillStyle=OCEAN.colors.text;c.fillText(p.level.name,a.x,top+fontSize*1.85);}
      const blink=.75+.25*Math.sin(now/260);c.globalAlpha*=blink;c.font=`700 ${Math.round(fontSize*.72)}px ${OCEAN.fonts.body}`;c.fillStyle=OCEAN.colors.accent;c.fillText(START_HINT,a.x,top+cardH-fontSize*.78,width-24);c.restore();
    }
    c.setTransform(this.ratio,0,0,this.ratio,0,0);
  }
}
