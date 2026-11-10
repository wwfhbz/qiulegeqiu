import { C } from './GameConfig';
import { Blocks } from './Blocks';
import { ARENA_WALL, inExitSector } from './ArenaGeometry';
import { FRAME, isBallInDeathZone } from './WorldGeometry';
import { Effects } from './Effects';
import { PowerUps, type PowerKind } from './PowerUps';
export interface Ball { x: number; y: number; vx: number; vy: number; radius: number; alive: boolean; previousX?: number; previousY?: number; outsideArena?: boolean }
export function reflect(b: Ball, nx: number, ny: number) {
  const dot = b.vx * nx + b.vy * ny;
  if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
}
export function boundary(b: Ball) {
  const a = C.arena;
  let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  const contact = b.radius + ARENA_WALL.halfWidth;
  // Below the entire circle is unambiguously exterior, even with stale region metadata.
  if (dy > a.radius + contact) b.outsideArena = true;
  if (inExitSector(dx, dy)) {
    // Inside the open sector, the nearest solid is the nearest rounded arc endpoint.
    const endpointX = dx < 0 ? ARENA_WALL.leftX : ARENA_WALL.rightX;
    let nx = b.x - endpointX, ny = b.y - ARENA_WALL.endpointY;
    const distance = Math.hypot(nx, ny);
    if (distance < contact) {
      if (distance > 1e-8) { nx /= distance; ny /= distance; }
      else { nx = dx < 0 ? 1 : -1; ny = 0; }
      b.x = endpointX + nx * (contact + .01); b.y = ARENA_WALL.endpointY + ny * (contact + .01);
      reflect(b, nx, ny);
      dx = b.x - a.x; dy = b.y - a.y; d = Math.hypot(dx, dy);
    }
    // Hysteresis preserves which wall face to use until the whole disk clears it.
    if (d > a.radius + contact) b.outsideArena = true;
    else if (d < a.radius - contact) b.outsideArena = false;
    return;
  }
  const limit = a.radius + (b.outsideArena ? contact : -contact);
  if ((b.outsideArena && d < limit) || (!b.outsideArena && d > limit)) {
    const sign = b.outsideArena ? 1 : -1;
    const nx = d > 0 ? sign * dx / d : 0, ny = d > 0 ? sign * dy / d : sign;
    b.x = a.x + (d > 0 ? dx / d : 0) * (limit + sign * .01);
    b.y = a.y + (d > 0 ? dy / d : 1) * (limit + sign * .01);
    reflect(b, nx, ny);
  }
}
/** Three solid sides; no segment is ever drawn or simulated across the bottom. */
export function frameCollision(b: Ball) {
  const contact = b.radius + FRAME.halfWidth;
  if (b.y <= FRAME.deathY) {
    if (b.x < FRAME.left + contact) { b.x = FRAME.left + contact + .01; reflect(b, 1, 0); }
    else if (b.x > FRAME.right - contact) { b.x = FRAME.right - contact - .01; reflect(b, -1, 0); }
    if (b.y < FRAME.top + contact) { b.y = FRAME.top + contact + .01; reflect(b, 0, 1); }
  } else {
    // The finite side segments have the same rounded lower tips as the renderer.
    const endpoint = b.x < C.arena.x ? FRAME.left : FRAME.right;
    let nx = b.x - endpoint, ny = b.y - FRAME.deathY;
    const distance = Math.hypot(nx, ny);
    if (distance < contact) {
      nx /= distance; ny /= distance;
      b.x = endpoint + nx * (contact + .01); b.y = FRAME.deathY + ny * (contact + .01);
      reflect(b, nx, ny);
    }
  }
}
export function paddleCollision(b: Ball, x: number, width: number = C.paddle.width) {
  const p = C.paddle;
  if (b.vy <= 0 || b.x + b.radius < x - width / 2 || b.x - b.radius > x + width / 2 || b.y + b.radius < p.y - p.height / 2 || b.y - b.radius > p.y + p.height / 2) return false;
  b.y = p.y - p.height / 2 - b.radius - .01;
  const aim = Math.atan2(C.arena.x - b.x, p.y - (C.arena.y + C.arena.radius - 12));
  const offset = Math.max(-1, Math.min(1, (b.x - x) / (width / 2)));
  const angle = Math.max(-1.48, Math.min(1.48, aim + offset * 1.05));
  const speed = Math.hypot(b.vx, b.vy);
  b.vx = Math.sin(angle) * speed; b.vy = -Math.cos(angle) * speed; return true;
}
export function blockCollision(b: Ball, blocks: Blocks) {
  const s = C.grid.step, size = C.grid.size;
  const minC = Math.max(0, Math.floor((b.x - b.radius - blocks.left) / s));
  const maxC = Math.min(blocks.cols - 1, Math.floor((b.x + b.radius - blocks.left) / s));
  const minR = Math.max(0, Math.floor((b.y - b.radius - blocks.top) / s));
  const maxR = Math.min(blocks.rows - 1, Math.floor((b.y + b.radius - blocks.top) / s));
  for (let row = minR; row <= maxR; row++) for (let col = minC; col <= maxC; col++) {
    const i = row * blocks.cols + col; if (!blocks.alive[i]) continue;
    const x = blocks.left + col * s, y = blocks.top + row * s;
    const qx = Math.max(x, Math.min(x + size, b.x)), qy = Math.max(y, Math.min(y + size, b.y));
    let nx = b.x - qx, ny = b.y - qy, d = Math.hypot(nx, ny);
    if (d >= b.radius) continue;
    if (d < 1e-8) {
      let distance = b.x - x; nx = -1; ny = 0;
      if (x + size - b.x < distance) { distance = x + size - b.x; nx = 1; ny = 0; }
      if (b.y - y < distance) { distance = b.y - y; nx = 0; ny = -1; }
      if (y + size - b.y < distance) { distance = y + size - b.y; nx = 0; ny = 1; }
      d = -distance;
    } else { nx /= d; ny /= d; }
    b.x += nx * (b.radius - d + .01); b.y += ny * (b.radius - d + .01);
    reflect(b, nx, ny); blocks.hit(i); return true;
  }
  return false;
}
export class Physics {
  blocks = new Blocks(); balls: Ball[] = [];
  paddleX: number = C.arena.x; targetX: number = C.arena.x;
  accumulator = 0; ticks = 0; paused = false;
  wideRemaining = 0;
  speedScale = 1;
  onBlockDestroyed?: (index: number) => void;
  onStep?: (dt: number) => void;
  get launchSpeed() { return Math.max(C.ball.minSpeed, Math.min(C.ball.maxSpeed, C.ball.speed * this.speedScale)); }
  readonly effects = new Effects();
  readonly powers = new PowerUps();
  private pool: Ball[] = [];
  onSound?: (kind: 'break' | 'combo' | 'paddle' | 'power' | 'win', combo?: number) => void;
  get paddleWidth() { return C.paddle.width * (this.wideRemaining > 0 ? C.power.wideScale : 1); }
  private destroyed = (index: number) => {
    const b = this.blocks;
    const x = b.left + index % b.cols * C.grid.step + C.grid.size / 2;
    const y = b.top + Math.floor(index / b.cols) * C.grid.step + C.grid.size / 2;
    this.effects.burst(x, y);
    this.onBlockDestroyed?.(index);
    this.onSound?.(this.effects.combo > 1 ? 'combo' : 'break', this.effects.combo);
    if (b.removed % C.power.dropEvery === 0) this.powers.spawn(x, y, Math.floor(b.removed / C.power.dropEvery) % 2 ? 'triple' : 'wide');
  };
  private pickup = (kind: PowerKind) => this.collect(kind);
  collect(kind: PowerKind) {
    if (kind === 'wide') { this.wideRemaining = C.power.duration; this.clampPaddle(); }
    else this.triple();
    this.onSound?.('power');
  }
  private clampPaddle() { this.setTarget(this.targetX); const target = this.targetX; this.setTarget(this.paddleX); this.paddleX = this.targetX; this.targetX = target; }
  recycleDead() {
    let write = 0;
    for (const b of this.balls) { if (b.alive) this.balls[write++] = b; else if (this.pool.length < C.maxBalls) this.pool.push(b); }
    this.balls.length = write;
  }
  triple() {
    this.recycleDead(); const count = this.balls.length;
    for (let i = 0; i < count && this.balls.length < C.maxBalls; i++) {
      const source = this.balls[i];
      for (const sign of [-1, 1]) {
        if (this.balls.length >= C.maxBalls) break;
        const b = this.newBall(), angle = sign * .19;
        b.vx = source.vx * Math.cos(angle) - source.vy * Math.sin(angle);
        b.vy = source.vx * Math.sin(angle) + source.vy * Math.cos(angle);
        // Spawn along the cleared side of the parent, then clamp to the circle.
        b.x = source.x + sign * (source.radius * 2 + 1); b.y = source.y;
        const dx = b.x - C.arena.x, dy = b.y - C.arena.y, d = Math.hypot(dx, dy), limit = C.arena.radius - b.radius - .05;
        if (!source.outsideArena && d > limit) { b.x = C.arena.x + dx / d * limit; b.y = C.arena.y + dy / d * limit; }
        // Nearby solids: keep the child at the safe parent position with a small directional separation.
        if (this.overlapsBlocks(b)) { b.x = source.x; b.y = source.y + sign * .1; }
        b.outsideArena = source.outsideArena; boundary(b); frameCollision(b); b.previousX = b.x; b.previousY = b.y;
        this.balls.push(b);
      }
    }
  }
  private overlapsBlocks(b: Ball) {
    const g = this.blocks, s = C.grid.step;
    for (let r = Math.max(0, Math.floor((b.y-b.radius-g.top)/s)); r <= Math.min(g.rows-1,Math.floor((b.y+b.radius-g.top)/s)); r++)
      for (let c = Math.max(0,Math.floor((b.x-b.radius-g.left)/s)); c <= Math.min(g.cols-1,Math.floor((b.x+b.radius-g.left)/s)); c++) {
        if (!g.alive[r*g.cols+c]) continue;
        const x=g.left+c*s,y=g.top+r*s;
        if (Math.hypot(b.x-Math.max(x,Math.min(x+C.grid.size,b.x)),b.y-Math.max(y,Math.min(y+C.grid.size,b.y)))<b.radius) return true;
      }
    return false;
  }
  constructor() { this.blocks.onHit = this.destroyed; this.reset(); }
  reset() {
    this.blocks.reset(); this.resetRound();
  }
  /** A lost round clears transient objects while retaining the current block grid. */
  resetRound(spawn = true) {
    // Administrative disposal for restart/level/life reset; never a gameplay death.
    for (const b of this.balls) b.alive = false;
    this.recycleDead();
    this.paddleX = this.targetX = C.arena.x;
    this.wideRemaining = 0; this.effects.reset(); this.powers.reset();
    if (spawn) this.balls.push(this.newBall());
    this.accumulator = 0; this.ticks = 0; this.paused = false;
  }
  newBall(): Ball {
    const b = this.pool.pop() ?? {x:0,y:0,vx:0,vy:0,radius:C.ball.radius,alive:true};
    b.x = this.paddleX; b.y = C.paddle.y - 20;
    this.aimLaunch(b); b.radius = C.ball.radius; b.alive = true;
    b.previousX = b.x; b.previousY = b.y; return b;
  }
  aimLaunch(b: Ball) {
    const dx = C.arena.x - b.x, dy = C.arena.y + C.arena.radius - 12 - b.y;
    const length = Math.hypot(dx, dy);
    b.vx = dx / length * this.launchSpeed; b.vy = dy / length * this.launchSpeed; b.outsideArena = true;
  }
  setTarget(x: number) {
    const extent = Math.min(C.arena.radius, C.width / 2 - C.paddle.margin) - this.paddleWidth / 2;
    this.targetX = Math.max(C.arena.x - extent, Math.min(C.arena.x + extent, x));
  }
  advance(seconds: number) {
    if (this.paused) return;
    this.accumulator += Math.min(C.maxFrame, Math.max(0, seconds));
    while (this.accumulator + 1e-10 >= C.step) { this.update(C.step); this.accumulator -= C.step; this.ticks++; }
  }
  update(dt: number) {
    if (this.paused) return;
    this.onStep?.(dt);
    this.wideRemaining = Math.max(0, this.wideRemaining - dt);
    if (this.wideRemaining < 1e-9) this.wideRemaining = 0;
    this.clampPaddle();
    this.effects.update(dt);
    this.paddleX += Math.max(-C.paddle.speed * dt, Math.min(C.paddle.speed * dt, this.targetX - this.paddleX));
    for (const b of this.balls) {
      if (!b.alive) continue;
      b.previousX = b.x; b.previousY = b.y;
      let speed = Math.hypot(b.vx, b.vy);
      if (speed < .001) { b.vy = -this.launchSpeed; speed = this.launchSpeed; }
      const bounded = Math.max(Math.min(C.ball.maxSpeed, C.ball.minSpeed * this.speedScale), Math.min(C.ball.maxSpeed, speed));
      b.vx *= bounded / speed; b.vy *= bounded / speed;
      const steps = Math.ceil(bounded * dt / C.maxTravel), h = dt / steps;
      for (let i = 0; i < steps && b.alive; i++) {
        b.x += b.vx * h; b.y += b.vy * h;
        boundary(b); frameCollision(b);
        if (paddleCollision(b, this.paddleX, this.paddleWidth)) this.onSound?.('paddle');
        // Resolve a bounded number of simultaneous contacts before the next movement.
        for (let contact = 0; contact < 3; contact++) if (!blockCollision(b, this.blocks)) break;
        boundary(b); frameCollision(b);
        // The only gameplay removal condition, evaluated after all contact corrections.
        if (isBallInDeathZone(b)) b.alive = false;
      }
    }
    this.recycleDead();
    this.powers.update(dt, this.paddleX, this.paddleWidth, this.pickup);
  }
}
