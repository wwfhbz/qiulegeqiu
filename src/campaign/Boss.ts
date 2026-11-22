import { C } from '../GameConfig';
import type { BossConfig } from './Patterns';
type Ball = { x: number; y: number; vx: number; vy: number; radius: number };
/** Hit points left at which the shields speed up (and, on the final boss, a ring of hard bricks grows back). */
export function bossStages(config: BossConfig) { return config.hp >= 60 ? [Math.ceil(config.hp * 2 / 3), Math.ceil(config.hp / 3)] : [Math.ceil(config.hp / 2)]; }
/** Score for one hit on the core and for the kill. */
export const BOSS_HIT_POINTS = 20, BOSS_KILL_BONUS = 3000;
/** Shield speed multiplier per stage reached. */
const STAGE_SPEEDUP = [1, 1.6, 2.2];

/**
 * Campaign boss (levels 8 and 12): a round core with hit points inside rotating steel rings that each have
 * one or two openings. Deterministic: the rings turn by a fixed amount every physics tick.
 */
export class Boss {
  hp = 0; stage = 0; readonly angles: number[] = [];
  /** Wall-clock flash for the renderer (set by the caller). */
  flashAt = -1e9;
  readonly x: number; readonly y: number; readonly radius: number;
  constructor(readonly config: BossConfig) {
    this.x = C.arena.x + config.u * C.arena.radius; this.y = C.arena.y + config.v * C.arena.radius; this.radius = config.radius * C.arena.radius;
    this.reset();
  }
  get alive() { return this.hp > 0; }
  reset() { this.hp = this.config.hp; this.stage = 0; this.angles.length = 0; for (let i = 0; i < this.config.shields.length; i++) this.angles.push(i * .6); }
  /** Turn the shields; speeds grow with the stage. */
  update(dt: number) {
    const k = STAGE_SPEEDUP[this.stage] ?? STAGE_SPEEDUP[STAGE_SPEEDUP.length - 1];
    this.config.shields.forEach((s, i) => { this.angles[i] = (this.angles[i] + s.speed * k * dt) % (Math.PI * 2); });
  }
  /** One hit on the core; returns the stage reached if this hit crossed a stage threshold, else undefined. */
  damage() {
    if (this.hp <= 0) return undefined;
    this.hp--; const stages = bossStages(this.config);
    let crossed: number | undefined;
    while (this.stage < stages.length && this.hp <= stages[this.stage]) { this.stage++; crossed = this.stage; }
    return crossed;
  }
  /** Is the angle (radians, measured like Math.atan2) inside one of shield `i`'s openings? */
  inGap(i: number, angle: number) {
    const s = this.config.shields[i], span = Math.PI * 2 / s.gaps, half = s.gapDeg * Math.PI / 360;
    const a = ((angle - this.angles[i]) % span + span) % span;
    return a < half || a > span - half;
  }
  /**
   * Ball contact. The core reflects and takes one hit (returns 'core'); a solid part of a ring reflects
   * (returns 'shield'); ring ends are rounded caps.
   */
  collide(b: Ball): 'core' | 'shield' | undefined {
    let dx = b.x - this.x, dy = b.y - this.y, d = Math.hypot(dx, dy);
    if (this.hp > 0 && d < this.radius + b.radius) {
      const nx = d > 1e-8 ? dx / d : 0, ny = d > 1e-8 ? dy / d : -1;
      b.x = this.x + nx * (this.radius + b.radius + .01); b.y = this.y + ny * (this.radius + b.radius + .01);
      const dot = b.vx * nx + b.vy * ny; if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
      return 'core';
    }
    for (let i = 0; i < this.config.shields.length; i++) {
      const s = this.config.shields[i], r = s.radius * C.arena.radius, half = s.width * C.arena.radius / 2;
      if (Math.abs(d - r) >= half + b.radius) continue;
      const angle = Math.atan2(dy, dx);
      if (!this.inGap(i, angle)) {
        // Solid arc: push out radially to the side the ball is on.
        const out = d >= r ? 1 : -1, nx = out * dx / (d || 1), ny = out * dy / (d || 1), target = r + out * (half + b.radius + .01);
        b.x = this.x + dx / (d || 1) * target; b.y = this.y + dy / (d || 1) * target;
        const dot = b.vx * nx + b.vy * ny; if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
        return 'shield';
      }
      // Inside an opening: the rounded ends of the arc on either side.
      const span = Math.PI * 2 / s.gaps, gap = s.gapDeg * Math.PI / 180;
      for (let g = 0; g < s.gaps; g++) for (const edge of [this.angles[i] + g * span - gap / 2, this.angles[i] + g * span + gap / 2]) {
        const ex = this.x + Math.cos(edge) * r, ey = this.y + Math.sin(edge) * r; let nx = b.x - ex, ny = b.y - ey; const e = Math.hypot(nx, ny);
        if (e >= half + b.radius) continue;
        nx = e > 1e-8 ? nx / e : 0; ny = e > 1e-8 ? ny / e : -1;
        b.x = ex + nx * (half + b.radius + .01); b.y = ey + ny * (half + b.radius + .01);
        const dot = b.vx * nx + b.vy * ny; if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
        dx = b.x - this.x; dy = b.y - this.y; d = Math.hypot(dx, dy);
        return 'shield';
      }
    }
    return undefined;
  }
}
