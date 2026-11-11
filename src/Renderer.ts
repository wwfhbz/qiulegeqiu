import { POWER_LABELS,POWER_COLORS } from './PowerRules';
import { C } from './GameConfig';
import { Physics } from './Physics';
import { FRAME } from './WorldGeometry';
import type {CanvasSurface,RendererHost} from './platform/Contracts';
export type {RendererHost} from './platform/Contracts';
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private cache:CanvasSurface;
  private stopObserver?:()=>void;
  private cachedRevision = -1;
  private ratio = 1;
  private generation = -1; private cleared = 0;
  constructor(private canvas:CanvasSurface, private host:RendererHost) {
    this.cache=host.cache;
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
    this.cache.width = this.canvas.width; this.cache.height = this.canvas.height; this.cachedRevision = -1;
  }
  draw(p: Physics, _ready: boolean) {
    if (this.cachedRevision !== p.blocks.revision) {
      const c = this.cache.getContext('2d')!;
      c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      const b = p.blocks;
      if (this.cachedRevision === -1 || this.generation !== b.generation) {
      c.clearRect(0, 0, C.width, C.height);
      for (let row = 0; row < b.rows; row++) {
        c.fillStyle = `hsl(${15 + row * .12},93%,${59 - row * .13}%)`;
        for (let col = 0; col < b.cols; col++) if (b.alive[row * b.cols + col])
          c.fillRect(b.left + col * b.step, b.top + row * b.step, b.size, b.size);
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
    if(p.effects.explosionRemaining>0)c.translate(Math.sin(p.effects.explosionRemaining*110)*3,Math.cos(p.effects.explosionRemaining*140)*2);
    c.beginPath(); c.arc(a.x, a.y, a.radius, 0, Math.PI * 2); c.fillStyle = '#0b1525'; c.fill();
    c.drawImage(this.cache as CanvasImageSource, 0, 0, C.width, C.height);
    for(const obstacle of p.obstacles.items){if(obstacle.destroyed)continue;const o=obstacle.config,half=(o.length-o.thickness)/2;c.save();c.translate(obstacle.x,obstacle.y);c.rotate(obstacle.angle);c.beginPath();c.moveTo(-half,0);c.lineTo(half,0);c.lineWidth=o.thickness;c.lineCap='round';c.strokeStyle=o.kind==='rotating'?'#a7a8c3':o.kind==='moving'?'#849aaf':'#7a899b';c.stroke();c.beginPath();c.moveTo(-half+3,0);c.lineTo(half-3,0);c.lineWidth=1;c.strokeStyle='#d6e6ef66';c.stroke();c.restore();}
    if(p.effects.explosionRemaining>0){c.beginPath();c.arc(p.effects.explosionX,p.effects.explosionY,(.24-p.effects.explosionRemaining)*240,0,Math.PI*2);c.lineWidth=2;c.strokeStyle='#ffb46e';c.stroke();}
    c.beginPath(); c.arc(a.x, a.y, a.radius, wall.startAngle, wall.endAngle);
    c.strokeStyle = '#7e94ac'; c.lineWidth = wall.width; c.lineCap = 'round'; c.stroke(); c.lineCap = 'butt';
    c.beginPath(); c.moveTo(FRAME.left, FRAME.deathY); c.lineTo(FRAME.left, FRAME.top);
    c.lineTo(FRAME.right, FRAME.top); c.lineTo(FRAME.right, FRAME.deathY);
    c.lineWidth = FRAME.width; c.lineCap = 'round'; c.lineJoin = 'miter'; c.stroke(); c.lineCap = 'butt';
    // An amber dashed marker, not a collider or a bottom wall.
    c.beginPath(); c.setLineDash([6, 8]); c.moveTo(FRAME.left, FRAME.deathY); c.lineTo(FRAME.right, FRAME.deathY);
    c.strokeStyle = '#ad6e6555'; c.lineWidth = 1; c.stroke(); c.setLineDash([]);

    c.fillStyle = '#d7f7ff'; c.shadowColor = '#68d9ef'; c.shadowBlur = 15;
    c.beginPath(); c.roundRect(p.paddleX - p.paddleWidth / 2, C.paddle.y - C.paddle.height / 2, p.paddleWidth, C.paddle.height, 6); c.fill();
    c.shadowBlur = 0; c.lineWidth = 3; c.strokeStyle = '#ffffff35';
    for (const b of p.balls) if (b.alive) { const speed=Math.hypot(b.vx,b.vy)||1; c.beginPath(); c.moveTo(b.x,b.y); c.lineTo(b.x-b.vx/speed*17,b.y-b.vy/speed*17); c.stroke(); }
    c.shadowBlur = 0; c.shadowColor = '#ffffff'; c.fillStyle = '#ffffff';
    for (const b of p.balls) if (b.alive) { c.beginPath(); c.arc(b.x, b.y, b.radius, 0, Math.PI * 2); c.fill(); }
    c.shadowBlur = 0;
    for(const f of p.effects.flashes) if(f.life>0){c.globalAlpha=f.life/.12;c.fillStyle='#ffe3be';c.fillRect(f.x-6,f.y-6,12,12);}
    for(const q of p.effects.particles)if(q.life>0){c.globalAlpha=q.life/.35;c.fillStyle='#ffaf6d';c.fillRect(q.x-1,q.y-1,2,2);}
    c.globalAlpha=1;
    if(p.effects.powerRemaining>0&&p.effects.powerKind){c.fillStyle=POWER_COLORS[p.effects.powerKind];c.textAlign='center';c.font='bold 24px sans-serif';c.fillText(POWER_LABELS[p.effects.powerKind],a.x,a.y+a.radius+65);}
    c.textAlign='center';c.font='bold 15px sans-serif';
    for(const item of p.powers.items)if(item.alive){c.fillStyle=POWER_COLORS[item.kind];c.beginPath();c.roundRect(item.x-23,item.y-14,46,28,7);c.fill();c.fillStyle='#0b1525';c.fillText(item.kind==='life'?'生命':item.kind==='bomb'?'炸弹':POWER_LABELS[item.kind],item.x,item.y+5);}
  }
}
