import {OCEAN,brickColorIndex,visualBudget} from '../shared/VisualTheme';
import {StartHint,START_HINT} from './PlayfieldStart';
import { POWER_LABELS,type PowerKind } from './PowerRules';
import { C } from './GameConfig';
import { Physics } from './Physics';
import { FRAME } from './WorldGeometry';
import type {CanvasSurface,RendererHost} from './platform/Contracts';
export type {RendererHost} from './platform/Contracts';
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private startHint=new StartHint();
  private cache:CanvasSurface;
  private badges?:CanvasSurface;private badgeKinds:PowerKind[]=['triple','wide','halve','life','bomb'];
  private stopObserver?:()=>void;
  private cachedRevision = -1;
  private ratio = 1;
  private arenaFill?:CanvasGradient|string;private paddleFill?:CanvasGradient|string;
  private lowDevice=false;private sampleCount=0;private sampleTime=0;private previousDraw=0;
  private generation = -1; private cleared = 0;
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
    this.arenaFill=this.paddleFill=undefined;
    this.cache.width = this.canvas.width; this.cache.height = this.canvas.height; this.cachedRevision = -1;
    if(this.badges){const a=OCEAN.powerBadge;this.badges.width=a.cellWidth*5*a.pixelRatio;this.badges.height=a.cellHeight*a.pixelRatio;const c=this.badges.getContext('2d')!;c.setTransform(a.pixelRatio,0,0,a.pixelRatio,0,0);this.badgeKinds.forEach((kind,i)=>this.badge(c,i*a.cellWidth+a.cellWidth/2,a.cellHeight/2,kind));}
  }
  private badge(c:CanvasRenderingContext2D,x:number,y:number,kind:PowerKind){const a=OCEAN.powerBadge,style=OCEAN.powers[kind];c.fillStyle=style.color;c.beginPath();c.roundRect(x-a.width/2,y-a.height/2,a.width,a.height,a.radius);c.fill();c.strokeStyle=OCEAN.alpha.badgeEdge;c.lineWidth=1;c.stroke();c.fillStyle=OCEAN.colors.text;c.textAlign='center';c.font='600 15px '+OCEAN.fonts.body;c.fillText(style.label,x,y+5);}

  draw(p: Physics, ready: boolean, now=0) {
    if(this.previousDraw&&now>this.previousDraw&&now-this.previousDraw<100){this.sampleTime+=now-this.previousDraw;if(++this.sampleCount===30){if(this.sampleTime/30>24)this.lowDevice=true;this.sampleCount=this.sampleTime=0;}}this.previousDraw=now;
    const budget=visualBudget(p.balls.length,this.lowDevice||this.host.lowPerformance?.()===true);
    if (this.cachedRevision !== p.blocks.revision) {
      const c = this.cache.getContext('2d')!;
      c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      const b = p.blocks;
      if (this.cachedRevision === -1 || this.generation !== b.generation) {
      c.clearRect(0, 0, C.width, C.height);
      for (let row = 0; row < b.rows; row++) for (let col = 0; col < b.cols; col++) if(b.alive[row*b.cols+col]){
        const x=b.left+col*b.step,y=b.top+row*b.step,size=b.size;
        c.fillStyle=OCEAN.bricks[brickColorIndex(row,col)];c.beginPath();c.roundRect(x,y,size,size,Math.min(2,size*.16));c.fill();
        c.fillStyle=OCEAN.alpha.brickHighlight;c.fillRect(x+1,y+1,size-2,Math.max(.6,size*.065));
        c.fillStyle=OCEAN.alpha.brickShadow;c.fillRect(x+1,y+size-1.2,size-2,.8);
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
    const c = this.ctx, a = C.arena, wall=p.wall;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0); c.clearRect(0, 0, C.width, C.height);

    if(!this.arenaFill){const g=c.createLinearGradient(0,a.y-a.radius,0,a.y+a.radius);g?.addColorStop(0,OCEAN.colors.arena);g?.addColorStop(1,OCEAN.colors.gradientEnd);this.arenaFill=g||OCEAN.colors.arena;}
    c.beginPath(); c.arc(a.x, a.y, a.radius, 0, Math.PI * 2); c.fillStyle = this.arenaFill; c.fill();
    c.drawImage(this.cache as CanvasImageSource, 0, 0, C.width, C.height);
    for(const obstacle of p.obstacles.items){if(obstacle.destroyed)continue;const o=obstacle.config,half=(o.length-o.thickness)/2;c.save();c.translate(obstacle.x,obstacle.y);c.rotate(obstacle.angle);c.beginPath();c.moveTo(-half,0);c.lineTo(half,0);c.lineWidth=o.thickness;c.lineCap='round';c.strokeStyle=o.kind==='rotating'?OCEAN.bricks[4]:o.kind==='moving'?OCEAN.bricks[1]:OCEAN.colors.secondary;c.stroke();c.beginPath();c.moveTo(-half+3,0);c.lineTo(half-3,0);c.lineWidth=1;c.strokeStyle=OCEAN.alpha.lineHighlight;c.stroke();c.restore();}
    if(p.effects.explosionRemaining>0){c.beginPath();c.arc(p.effects.explosionX,p.effects.explosionY,(.24-p.effects.explosionRemaining)*240,0,Math.PI*2);c.lineWidth=2;c.strokeStyle=OCEAN.colors.warning;c.stroke();}
    c.beginPath(); c.arc(a.x, a.y, a.radius, wall.startAngle, wall.endAngle);
    c.strokeStyle = OCEAN.colors.border; c.lineWidth = wall.width; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
    c.beginPath(); c.moveTo(FRAME.left, FRAME.deathY); c.lineTo(FRAME.left, FRAME.top);
    c.lineTo(FRAME.right, FRAME.top); c.lineTo(FRAME.right, FRAME.deathY);
    c.lineWidth = FRAME.width; c.lineCap = 'round'; c.lineJoin = 'miter'; c.stroke(); c.lineCap = 'butt';
    // A subdued dashed marker, not a collider or a bottom wall.
    c.beginPath(); c.setLineDash([6, 8]); c.moveTo(FRAME.left, FRAME.deathY); c.lineTo(FRAME.right, FRAME.deathY);
    c.strokeStyle = OCEAN.alpha.death; c.lineWidth = 1; c.stroke(); c.setLineDash([]);

    const py=C.paddle.y-C.paddle.height/2,pw=p.paddleWidth;
    if(!this.paddleFill){const g=c.createLinearGradient(0,py,0,py+C.paddle.height);g?.addColorStop(0,OCEAN.paddle.body);g?.addColorStop(1,OCEAN.paddle.edge);this.paddleFill=g||OCEAN.paddle.body;}
    c.fillStyle=OCEAN.paddle.shadow;c.beginPath();c.roundRect(p.paddleX-pw/2,py+2,pw,C.paddle.height,6);c.fill();
    c.fillStyle=this.paddleFill;c.beginPath();c.roundRect(p.paddleX-pw/2,py,pw,C.paddle.height,6);c.fill();
    c.fillStyle=OCEAN.ball.highlight;c.globalAlpha=.5;c.fillRect(p.paddleX-pw/2+7,py+1,pw-14,1);c.globalAlpha=1;
    c.fillStyle=OCEAN.paddle.accent;c.fillRect(p.paddleX-13,py+C.paddle.height/2-1,26,2);
    c.lineWidth=2;c.strokeStyle=OCEAN.ball.trail;c.globalAlpha=budget.trailAlpha;
    if(budget.trailLength)for(const b of p.balls)if(b.alive){const speed=Math.hypot(b.vx,b.vy)||1;c.beginPath();c.moveTo(b.x,b.y);c.lineTo(b.x-b.vx/speed*budget.trailLength,b.y-b.vy/speed*budget.trailLength);c.stroke();}
    c.globalAlpha=1;
    for(const b of p.balls)if(b.alive){c.fillStyle=OCEAN.ball.body;c.beginPath();c.arc(b.x,b.y,b.radius,0,Math.PI*2);c.fill();if(budget.highlights){c.strokeStyle=OCEAN.ball.edge;c.lineWidth=.6;c.beginPath();c.arc(b.x,b.y,b.radius-.3,0,Math.PI*2);c.stroke();c.fillStyle=OCEAN.ball.highlight;c.beginPath();c.arc(b.x-b.radius*.25,b.y-b.radius*.3,b.radius*.3,0,Math.PI*2);c.fill();}}
    const colorAt=(x:number,y:number)=>OCEAN.bricks[brickColorIndex(Math.max(0,Math.round((y-p.blocks.top-p.blocks.size/2)/p.blocks.step)),Math.max(0,Math.round((x-p.blocks.left-p.blocks.size/2)/p.blocks.step)))];
    for(const f of p.effects.flashes)if(f.life>0){c.globalAlpha=Math.min(.55,f.life/OCEAN.motion.flashSeconds*.55);c.fillStyle=colorAt(f.x,f.y);c.fillRect(f.x-4,f.y-4,8,8);}
    let rendered=0;
    // Rewind the short visual trail to the source cell, without mutating pooled effects.
    for(const q of p.effects.particles){const age=OCEAN.motion.sourceParticleSeconds-q.life;if(q.life>0&&age<OCEAN.motion.particleSeconds&&rendered++<budget.particles){c.globalAlpha=(1-age/OCEAN.motion.particleSeconds)*.7;c.fillStyle=colorAt(q.x-q.vx*age,q.y-q.vy*age);c.fillRect(q.x-1.2,q.y-1.2,2.4,2.4);}}
    c.globalAlpha=1;
    if(p.effects.powerRemaining>0&&p.effects.powerKind){c.fillStyle=OCEAN.powers[p.effects.powerKind].color;c.textAlign='center';c.font='600 22px '+OCEAN.fonts.body;c.fillText(POWER_LABELS[p.effects.powerKind],a.x,a.y+a.radius+65);}
    c.textAlign='center';c.font='600 15px '+OCEAN.fonts.body;
    for(const item of p.powers.items)if(item.alive){if(this.badges){const a=OCEAN.powerBadge;c.drawImage(this.badges as CanvasImageSource,this.badgeKinds.indexOf(item.kind)*a.cellWidth*a.pixelRatio,0,a.cellWidth*a.pixelRatio,a.cellHeight*a.pixelRatio,item.x-a.cellWidth/2,item.y-a.cellHeight/2,a.cellWidth,a.cellHeight);}else this.badge(c,item.x,item.y,item.kind);}
    const hintAlpha=this.startHint.alpha(ready,now);
    if(hintAlpha>0){
      c.save();c.globalAlpha=hintAlpha;c.textAlign='center';c.textBaseline='middle';
      const fontSize=Math.max(28,Math.min(46,14*C.width/Math.max(1,this.host.viewport().width)));
      c.font=`${fontSize}px ${OCEAN.fonts.body}`;
      const width=Math.min(C.width-40,c.measureText(START_HINT).width+40);
      c.fillStyle=OCEAN.colors.background;c.beginPath();c.roundRect(a.x-width/2,a.y-30,width,60,12);c.fill();
      c.fillStyle=OCEAN.colors.text;c.shadowBlur=0;c.fillText(START_HINT,a.x,a.y,width-24);c.restore();
    }

  }
}
