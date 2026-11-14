import { C } from './GameConfig';
import type { ObstacleConfig,LevelConfig } from './Levels';
import { reservedByObstacle } from './ObstacleGeometry';
export class Blocks {
  cols = Math.ceil(C.arena.radius * 2 / C.grid.step);
  rows = this.cols;
  readonly left = C.arena.x - C.arena.radius;
  readonly top = C.arena.y - C.arena.radius;
  readonly alive = new Uint8Array(this.cols * this.rows);
  readonly powerKinds = new Uint8Array(this.alive.length);
  step:number=C.grid.step;size:number=C.grid.size;
  readonly destroyed: number[] = [];
  generation = 0;
  total = 0; remaining = 0; revision = 0;
  constructor() { this.reset(); }
  get removed() { return this.total - this.remaining; }
  reset(obstacles:readonly ObstacleConfig[] = [], level?:LevelConfig) {
    this.step=level?.gridStep??C.grid.step;this.size=level?.gridSize??C.grid.size;
    this.cols=this.rows=Math.ceil(C.arena.radius*2/this.step);
    if(this.cols*this.rows>this.alive.length)throw Error('方块网格超过固定存储容量');
    this.destroyed.length = 0; this.generation++;
    this.alive.fill(0); this.powerKinds.fill(0); this.total = 0;
    const { x: cx, y: cy, radius: r } = C.arena;
    // Lowest allowed brick edge: the top 80% of the bowl, or (V1.9+) the whole bowl down to a fixed floor.
    const floorY = level?.fullFloorGap !== undefined ? cy + r - level.fullFloorGap : this.top + 2 * r * (1 - C.grid.emptyFraction);
    for (let row = 0; row < this.rows; row++) for (let col = 0; col < this.cols; col++) {
      const x = this.left + col * this.step, y = this.top + row * this.step;
      if (y + this.size > floorY) continue;
      let inside = true;
      for (const dx of [0, this.size]) for (const dy of [0, this.size])
        if ((x + dx - cx) ** 2 + (y + dy - cy) ** 2 > r * r) inside = false;
      if (inside && reservedByObstacle(x,y,this.size,obstacles,C.ball.radius*2+2))inside=false;
      if (inside) { this.alive[row * this.cols + col] = 1; this.total++; }
    }
    if(level?.brickCount!==undefined){
      if(this.total<level.brickCount)throw Error('当前网格不足以生成指定数量');
      const centerY=this.top+2*r*(1-C.grid.emptyFraction)/2;
      const cells=Array.from(this.alive.entries()).filter(([,v])=>v).map(([i])=>i);
      const distance=(i:number)=>{const x=this.left+i%this.cols*this.step+this.size/2-cx,y=this.top+Math.floor(i/this.cols)*this.step+this.size/2-centerY;return x*x+y*y;};
      cells.sort((a,b)=>distance(a)-distance(b)||a-b);
      for(let n=level.brickCount;n<cells.length;n++)this.alive[cells[n]]=0;
      this.total=level.brickCount;
    }
    this.remaining = this.total; this.revision++;
  }
  onHit?: (index: number) => void;
  hit(index: number) {
    if (!this.alive[index]) return false;
    this.alive[index] = 0; this.remaining--; this.destroyed.push(index); this.revision++; this.onHit?.(index); return true;
  }
}
