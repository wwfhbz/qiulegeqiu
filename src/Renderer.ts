import { C } from './GameConfig';
import { Physics } from './Physics';
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private cache = document.createElement('canvas');
  private cachedRevision = -1;
  private ratio = 1;
  private generation = -1; private cleared = 0;
  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.ratio = Math.min(window.devicePixelRatio || 1, 3) * rect.width / C.width;
    this.canvas.width = Math.round(C.width * this.ratio); this.canvas.height = Math.round(C.height * this.ratio);
    this.cache.width = this.canvas.width; this.cache.height = this.canvas.height; this.cachedRevision = -1;
  }
  draw(p: Physics, ready: boolean) {
    if (this.cachedRevision !== p.blocks.revision) {
      const c = this.cache.getContext('2d')!;
      c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
      const b = p.blocks;
      if (this.cachedRevision === -1 || this.generation !== b.generation) {
      c.clearRect(0, 0, C.width, C.height);
      for (let row = 0; row < b.rows; row++) {
        c.fillStyle = `hsl(${15 + row * .12} 93% ${59 - row * .13}%)`;
        for (let col = 0; col < b.cols; col++) if (b.alive[row * b.cols + col])
          c.fillRect(b.left + col * C.grid.step, b.top + row * C.grid.step, C.grid.size, C.grid.size);
      }
      this.generation = b.generation; this.cleared = b.destroyed.length;
      } else {
        // Clear only changed cells, using integral device pixels to avoid fringes.
        for (; this.cleared < b.destroyed.length; this.cleared++) {
          const i = b.destroyed[this.cleared], x = b.left + i % b.cols * C.grid.step, y = b.top + Math.floor(i / b.cols) * C.grid.step;
          c.clearRect(Math.floor(x*this.ratio)/this.ratio, Math.floor(y*this.ratio)/this.ratio, (Math.ceil((x+C.grid.size)*this.ratio)-Math.floor(x*this.ratio))/this.ratio, (Math.ceil((y+C.grid.size)*this.ratio)-Math.floor(y*this.ratio))/this.ratio);
        }
      }
      this.cachedRevision = b.revision;
    }
    const c = this.ctx, a = C.arena;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0); c.clearRect(0, 0, C.width, C.height);
    c.beginPath(); c.arc(a.x, a.y, a.radius, 0, Math.PI * 2); c.fillStyle = '#0b1525'; c.fill();
    c.drawImage(this.cache, 0, 0, C.width, C.height);
    const gap = Math.asin(a.exitHalfWidth / a.radius);
    c.beginPath(); c.arc(a.x, a.y, a.radius, Math.PI / 2 + gap, Math.PI * 2 + Math.PI / 2 - gap);
    c.strokeStyle = '#7e94ac'; c.lineWidth = 1.4; c.stroke();
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
    c.textAlign='center';c.font='bold 15px sans-serif';
    for(const item of p.powers.items)if(item.alive){c.fillStyle=item.kind==='wide'?'#91e9d4':'#ffc28b';c.beginPath();c.roundRect(item.x-23,item.y-14,46,28,7);c.fill();c.fillStyle='#0b1525';c.fillText(item.kind==='wide'?'加宽':'×3',item.x,item.y+5);}
    c.textAlign = 'center'; c.font = '17px sans-serif'; c.fillStyle = '#74869e';
    c.fillText('底部出口', a.x, a.y + a.radius + 22);
    if (ready) {
      c.fillStyle = '#b6c6da'; c.font = '18px sans-serif'; c.fillText('移动挡板，准备突破', a.x, C.paddle.y + 47);
      c.setLineDash([4, 8]); c.strokeStyle = '#36506b'; c.beginPath();
      c.moveTo(a.x, C.paddle.y - 35); c.lineTo(a.x + 12, C.paddle.y - 43); c.stroke(); c.setLineDash([]);
    }
  }
}
