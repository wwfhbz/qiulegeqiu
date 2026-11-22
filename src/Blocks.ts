import { C } from './GameConfig';
import type { ObstacleConfig,LevelConfig } from './Levels';
import { reservedByObstacle } from './ObstacleGeometry';
import { Cell, CELL_HP } from './campaign/Patterns';
export class Blocks {
  cols = Math.ceil(C.arena.radius * 2 / C.grid.step);
  rows = this.cols;
  readonly left = C.arena.x - C.arena.radius;
  readonly top = C.arena.y - C.arena.radius;
  readonly alive = new Uint8Array(this.cols * this.rows);
  readonly powerKinds = new Uint8Array(this.alive.length);
  /** Campaign 1.11 brick kinds (Cell) and hits left; legacy levels and endless are all Normal with 1 hit. */
  readonly kinds = new Uint8Array(this.alive.length);
  readonly hp = new Uint8Array(this.alive.length);
  /** Hits that only cracked a hard brick (the renderer redraws these cells). */
  readonly damaged: number[] = [];
  /** Fire: every hit breaks the brick outright, whatever its hits left. */
  crush = false;
  /** The last break was a fire hit on a brick that still had more than one hit left (journaled as crush). */
  lastCrushed = false;
  /** Cells the final boss can grow back (empty unless the level has a refill band). */
  refillCells: number[] = [];
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
    this.destroyed.length = 0; this.damaged.length = 0; this.generation++;
    this.alive.fill(0); this.powerKinds.fill(0); this.kinds.fill(0); this.hp.fill(0); this.total = 0; this.crush = false; this.refillCells = [];
    const pattern = level?.pattern;
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
      if (!inside) continue;
      const i = row * this.cols + col, kind = pattern ? pattern.cell((x + this.size / 2 - cx) / r, (y + this.size / 2 - cy) / r) : Cell.Normal;
      if (kind === Cell.Empty) continue;
      // Steel is solid (alive) but never counts toward clearing the level and cannot be damaged.
      this.alive[i] = 1; this.kinds[i] = kind; this.hp[i] = kind === Cell.Steel ? 0 : CELL_HP[kind as Cell];
      if (kind !== Cell.Steel) this.total++;
      if (pattern?.refill?.((x + this.size / 2 - cx) / r, (y + this.size / 2 - cy) / r)) this.refillCells.push(i);
    }
    if(level?.brickCount!==undefined){
      if(this.total<level.brickCount)throw Error('当前网格不足以生成指定数量');
      const centerY=this.top+2*r*(1-C.grid.emptyFraction)/2;
      const cells=Array.from(this.alive.entries()).filter(([,v])=>v).map(([i])=>i);
      const distance=(i:number)=>{const x=this.left+i%this.cols*this.step+this.size/2-cx,y=this.top+Math.floor(i/this.cols)*this.step+this.size/2-centerY;return x*x+y*y;};
      cells.sort((a,b)=>distance(a)-distance(b)||a-b);
      for(let n=level.brickCount;n<cells.length;n++){const i=cells[n];this.alive[i]=0;this.hp[i]=0;this.kinds[i]=0;this.refillCells=this.refillCells.filter(j=>j!==i);}
      this.total=level.brickCount;
    }
    this.remaining = this.total; this.revision++;
  }
  onHit?: (index: number) => void;
  /** Hits that crack without breaking (hard bricks). */
  onDamage?: (index: number) => void;
  /** Steel and boss rings: solid, never damaged. */
  isSteel(index: number) { return this.kinds[index] === Cell.Steel; }
  hit(index: number) {
    if (!this.alive[index] || this.kinds[index] === Cell.Steel) return false;
    this.lastCrushed = this.crush && this.hp[index] > 1;
    if (!this.crush && this.hp[index] > 1) { this.hp[index]--; this.damaged.push(index); this.revision++; this.onDamage?.(index); return true; }
    this.hp[index] = 0; this.alive[index] = 0; this.remaining--; this.destroyed.push(index); this.revision++; this.onHit?.(index); return true;
  }
  /** Final boss: bring empty cells of its refill band back as 2-hit bricks; returns the revived indices. */
  refill(indices: readonly number[]) {
    const revived: number[] = [];
    for (const i of indices) if (!this.alive[i]) { this.alive[i] = 1; this.kinds[i] = Cell.Hard2; this.hp[i] = 2; this.remaining++; this.total++; revived.push(i); }
    if (revived.length) { this.generation++; this.destroyed.length = 0; this.damaged.length = 0; this.revision++; }
    return revived;
  }
}
