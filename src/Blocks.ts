import { C } from './GameConfig';
import type { ObstacleConfig } from './Levels';
import { reservedByObstacle } from './ObstacleGeometry';
export class Blocks {
  readonly cols = Math.ceil(C.arena.radius * 2 / C.grid.step);
  readonly rows = this.cols;
  readonly left = C.arena.x - C.arena.radius;
  readonly top = C.arena.y - C.arena.radius;
  readonly alive = new Uint8Array(this.cols * this.rows);
  readonly destroyed: number[] = [];
  generation = 0;
  total = 0; remaining = 0; revision = 0;
  constructor() { this.reset(); }
  get removed() { return this.total - this.remaining; }
  reset(obstacles:readonly ObstacleConfig[] = []) {
    this.destroyed.length = 0; this.generation++;
    this.alive.fill(0); this.total = 0;
    const { x: cx, y: cy, radius: r } = C.arena;
    for (let row = 0; row < this.rows; row++) for (let col = 0; col < this.cols; col++) {
      const x = this.left + col * C.grid.step, y = this.top + row * C.grid.step;
      if (y + C.grid.size > this.top + 2 * r * (1 - C.grid.emptyFraction)) continue;
      let inside = true;
      for (const dx of [0, C.grid.size]) for (const dy of [0, C.grid.size])
        if ((x + dx - cx) ** 2 + (y + dy - cy) ** 2 > r * r) inside = false;
      if (inside && reservedByObstacle(x,y,C.grid.size,obstacles,C.ball.radius*2+2))inside=false;
      if (inside) { this.alive[row * this.cols + col] = 1; this.total++; }
    }
    this.remaining = this.total; this.revision++;
  }
  onHit?: (index: number) => void;
  hit(index: number) {
    if (!this.alive[index]) return false;
    this.alive[index] = 0; this.remaining--; this.destroyed.push(index); this.revision++; this.onHit?.(index); return true;
  }
}
