import {allocateBrickPowers,brickPowerCounts,brickPowerKind,BRICK_POWER_VERSION,type BrickPowerVersion} from './BrickPowerRules';
import {LEGACY_LEVELS} from './LegacyLevels';
import {powerProfile, type LevelConfig } from './Levels';
import { Obstacles } from './Obstacles';
import { seededRandom,weightedPower,tripleTarget,TRIPLE_RULE_VERSION,type TripleRuleVersion } from './PowerRules';
import type { SoundKind } from './Audio';
import { C } from './GameConfig';
import { Blocks } from './Blocks';
import { ARENA_WALL, inExitSector,wallForLevel } from './ArenaGeometry';
import { FRAME, isBallInDeathZone } from './WorldGeometry';
import { Effects } from './Effects';
import { PowerUps, type PowerKind } from './PowerUps';
import { EndlessField } from './endless/EndlessField';
import { ENDLESS,ENDLESS_CURRENT,endlessPower,dropEvery,endlessSpeed } from './endless/EndlessRules';
export interface Ball { x: number; y: number; vx: number; vy: number; radius: number; alive: boolean; previousX?: number; previousY?: number; outsideArena?: boolean }
export function reflect(b: Ball, nx: number, ny: number) {
  const dot = b.vx * nx + b.vy * ny;
  if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
}
export function boundary(b: Ball, wall=ARENA_WALL) {
  const a = C.arena;
  let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
  const contact = b.radius + wall.halfWidth;
  // Below the entire circle is unambiguously exterior, even with stale region metadata.
  if (dy > a.radius + contact) b.outsideArena = true;
  if (inExitSector(dx, dy,wall)) {
    // Inside the open sector, the nearest solid is the nearest rounded arc endpoint.
    const endpointX = dx < 0 ? wall.leftX : wall.rightX;
    let nx = b.x - endpointX, ny = b.y - wall.endpointY;
    const distance = Math.hypot(nx, ny);
    if (distance < contact) {
      if (distance > 1e-8) { nx /= distance; ny /= distance; }
      else { nx = dx < 0 ? 1 : -1; ny = 0; }
      b.x = endpointX + nx * (contact + .01); b.y = wall.endpointY + ny * (contact + .01);
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
  const s = blocks.step, size = blocks.size;
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
  blocks:Blocks = new Blocks(); balls: Ball[] = [];
  /** Endless mode swaps in a descending field; everything else reads it through the Blocks interface. */
  get endless(){return this.blocks instanceof EndlessField?this.blocks:undefined;}
  useField(field:Blocks){this.blocks=field;field.onHit=this.destroyed;}
  // Endless-only timed powers and drop schedule (own seeded stream, mirrored by the server verifier).
  pierceRemaining=0;fireRemaining=0;
  private endlessDrops=seededRandom(1);private nextDropAt:number=ENDLESS_CURRENT.drops.start;

  paddleX: number = C.arena.x; targetX: number = C.arena.x;
  accumulator = 0; ticks = 0; paused = false;
  wideRemaining = 0;
  level:LevelConfig=LEGACY_LEVELS[0];
  readonly obstacles=new Obstacles();
  private random=seededRandom(1);
  private seed=1;
  brickPowerVersion:BrickPowerVersion=BRICK_POWER_VERSION;
  private allocatePowers(){this.blocks.powerKinds.set(allocateBrickPowers(this.blocks.alive,this.brickPowerVersion===2?this.level.brickPowers:undefined,this.seed,this.level.number));}
  setSeed(seed:number){this.seed=seed;this.random=seededRandom(seed);if(this.blocks.removed===0)this.allocatePowers();}
  onBomb?: (target:string|null) => void;
  speedScale = 1;
  powerUpDropMultiplier = 1;
  get powerDropEvery() { return Math.max(1, Math.round(C.power.dropEvery / this.powerUpDropMultiplier)); }
  onBallLost?: () => void;
  onPowerCollected?: (kind: PowerKind, dropId?:number) => void;
  onBlockDestroyed?: (index: number) => void;
  onStep?: (dt: number) => void;
  get launchSpeed() { return Math.max(Math.min(C.ball.maxSpeed,C.ball.minSpeed*this.speedScale), Math.min(C.ball.maxSpeed, C.ball.speed * this.speedScale)); }
  readonly effects = new Effects();
  readonly powers = new PowerUps();
  private pool: Ball[] = [];
  onSound?: (kind: SoundKind, combo?: number) => void;
  get wall(){return wallForLevel(this.level);}
  get paddleWidth() { return C.paddle.width * (this.level.paddleScale??1) * (this.wideRemaining > 0 ? C.power.wideScale : 1); }
  private destroyed = (index: number) => {
    const b = this.blocks;
    const x = b.left + index % b.cols * b.step + b.size / 2;
    const y = b.top + Math.floor(index / b.cols) * b.step + b.size / 2;
    this.effects.burst(x, y, Math.floor(index / b.cols));
    if (b.remaining === 0) this.effects.emit('clear', x, y);
    this.onBlockDestroyed?.(index);
    this.onSound?.(this.effects.combo > 1 ? 'combo' : 'break', this.effects.combo);
    const field=this.endless;
    if(field){
      // Endless: one random drop each time the destroyed count reaches the next threshold.
      if(field.destroyedTotal>=this.nextDropAt){this.nextDropAt+=dropEvery(field.destroyedTotal,field.variant);this.powers.spawn(x,y,endlessPower(this.endlessDrops));}
      return;
    }
    const interval = this.powerDropEvery;
    // Preserve the original random stream for unchanged later levels.
    const legacyKind=b.removed%interval===0?weightedPower(powerProfile(this.level),this.random):undefined;
    const kind=this.brickPowerVersion===2&&this.level.brickPowers?brickPowerKind(b.powerKinds[index]):legacyKind;
    if(kind)this.powers.spawn(x,y,kind);
  };
  private pickup = (kind: PowerKind, dropId:number) => this.collect(kind,dropId);
  collect(kind: PowerKind, dropId?:number) {
    // No pickup is valid after the final effective ball dies, even before Game settles the round.
    if (!this.balls.some(ball => ball.alive)) return;
    let bombTarget:string|null=null;
    if (kind === 'wide') { this.wideRemaining = C.power.duration; this.clampPaddle(); }
    else if(kind==='triple')this.triple();
    else if(kind==='plus3')this.addBalls(ENDLESS.plusBalls);
    else if(kind==='pierce')this.pierceRemaining=ENDLESS.pierceSeconds;
    else if(kind==='fire')this.fireRemaining=ENDLESS.fireSeconds;
    // Lightning strikes after the pickup is journaled, so its brick hits follow the power event.
    else if(kind==='halve')this.halve();
    else if(kind==='bomb'){const target=this.obstacles.destroyNearest(C.arena.x,C.arena.y);this.effects.explode(target?.x??C.arena.x,target?.y??C.arena.y);bombTarget=target?.config.id??null;}
    this.effects.power(kind);this.effects.emit('power',this.paddleX,C.paddle.y,0,kind);
    this.onPowerCollected?.(kind,dropId);
    if(kind==='bomb')this.onBomb?.(bombTarget);
    if(kind==='lightning')this.lightning();
    this.onSound?.(kind==='bomb'?'bomb':kind==='halve'?'halve':kind==='life'?'life':'power');
  }
  private clampPaddle() { this.setTarget(this.targetX); const target = this.targetX; this.setTarget(this.paddleX); this.paddleX = this.targetX; this.targetX = target; }
  recycleDead() {
    let write = 0;
    for (const b of this.balls) { if (b.alive) this.balls[write++] = b; else if (this.pool.length < C.maxBalls) this.pool.push(b); }
    this.balls.length = write;
  }
  halve() {
    this.recycleDead();const keep=Math.max(1,Math.ceil(this.balls.length/2));
    // Visual only: show where each removed ball was before it disappears.
    for(let i=keep;i<this.balls.length;i++){const b=this.balls[i];this.effects.emit('poof',b.x,b.y);b.alive=false;}
    this.recycleDead(); // Administrative removal deliberately emits no death event.
  }
  tripleRuleVersion:TripleRuleVersion=TRIPLE_RULE_VERSION;
  /** +3: three extra balls fanned out from the first live ball (capped at the 100-ball limit). */
  addBalls(count:number){
    this.recycleDead();const source=this.balls[0];if(!source)return;
    const angles=[-.32,.32,.12];
    for(let i=0;i<count&&this.balls.length<C.maxBalls;i++)this.balls.push(this.child(source,angles[i%angles.length],i%2?1:-1));
  }
  /** Lightning: instantly break the bricks nearest the first live ball (or arena centre). */
  lightning(){
    const g=this.blocks,ball=this.balls.find(b=>b.alive),fx=ball?.x??C.arena.x,fy=ball?.y??C.arena.y,picked:{index:number;d:number}[]=[];
    for(let i=0;i<g.cols*g.rows;i++)if(g.alive[i]){const x=g.left+i%g.cols*g.step+g.size/2,y=g.top+Math.floor(i/g.cols)*g.step+g.size/2;picked.push({index:i,d:(x-fx)**2+(y-fy)**2});}
    picked.sort((a,b)=>a.d-b.d||a.index-b.index);const targets=picked.slice(0,ENDLESS.lightningBricks).map(p=>p.index);
    for(const index of targets){this.effects.emit('zap',g.left+index%g.cols*g.step+g.size/2,g.top+Math.floor(index/g.cols)*g.step+g.size/2,0,undefined,fx,fy);g.hit(index);}
  }
  /** Fire: a brick hit by a burning ball also burns its eight neighbours (no chain reaction). */
  private burn(index:number){
    const g=this.blocks,row=Math.floor(index/g.cols),col=index%g.cols;
    this.effects.emit('burn',g.left+col*g.step+g.size/2,g.top+row*g.step+g.size/2,g.step);
    for(let r=row-1;r<=row+1;r++)for(let c=col-1;c<=col+1;c++)if(r>=0&&c>=0&&r<g.rows&&c<g.cols&&(r!==row||c!==col))g.hit(r*g.cols+c);
  }
  /** Pierce: break every brick the ball overlaps without bouncing. */
  private pierce(b:Ball){
    const g=this.blocks,s=g.step;
    for(let r=Math.max(0,Math.floor((b.y-b.radius-g.top)/s));r<=Math.min(g.rows-1,Math.floor((b.y+b.radius-g.top)/s));r++)
      for(let c=Math.max(0,Math.floor((b.x-b.radius-g.left)/s));c<=Math.min(g.cols-1,Math.floor((b.x+b.radius-g.left)/s));c++){
        const i=r*g.cols+c;if(!g.alive[i])continue;const x=g.left+c*s,y=g.top+r*s;
        if(Math.hypot(b.x-Math.max(x,Math.min(x+g.size,b.x)),b.y-Math.max(y,Math.min(y+g.size,b.y)))<b.radius){this.effects.emit('slash',x+g.size/2,y+g.size/2,0,undefined,b.vx,b.vy);g.hit(i);if(this.fireRemaining>0)this.burn(i);}
      }
  }
  private child(source:Ball,angle:number,sign:number){
    const b = this.newBall();
    b.vx = source.vx * Math.cos(angle) - source.vy * Math.sin(angle);
    b.vy = source.vx * Math.sin(angle) + source.vy * Math.cos(angle);
    b.x = source.x + sign * (source.radius * 2 + 1); b.y = source.y;
    const dx = b.x - C.arena.x, dy = b.y - C.arena.y, d = Math.hypot(dx, dy), limit = C.arena.radius - b.radius - .05;
    if (!source.outsideArena && d > limit) { b.x = C.arena.x + dx / d * limit; b.y = C.arena.y + dy / d * limit; }
    if (this.overlapsBlocks(b)) { b.x = source.x; b.y = source.y + sign * .1; }
    if(this.obstacles.overlaps(b)){b.x=source.x;b.y=source.y;}
    b.outsideArena = source.outsideArena; boundary(b,this.wall); frameCollision(b); b.previousX = b.x; b.previousY = b.y;
    return b;
  }
  triple() {
    this.recycleDead(); const count = this.balls.length,target=tripleTarget(count,this.tripleRuleVersion);
    for (let i = 0; i < count && this.balls.length < target; i++) {
      const source = this.balls[i];
      for (const sign of [-1, 1]) {
        if (this.balls.length >= target) break;
        const b = this.newBall(), angle = sign * .19;
        b.vx = source.vx * Math.cos(angle) - source.vy * Math.sin(angle);
        b.vy = source.vx * Math.sin(angle) + source.vy * Math.cos(angle);
        // Spawn along the cleared side of the parent, then clamp to the circle.
        b.x = source.x + sign * (source.radius * 2 + 1); b.y = source.y;
        const dx = b.x - C.arena.x, dy = b.y - C.arena.y, d = Math.hypot(dx, dy), limit = C.arena.radius - b.radius - .05;
        if (!source.outsideArena && d > limit) { b.x = C.arena.x + dx / d * limit; b.y = C.arena.y + dy / d * limit; }
        // Nearby solids: keep the child at the safe parent position with a small directional separation.
        if (this.overlapsBlocks(b)) { b.x = source.x; b.y = source.y + sign * .1; }
        if(this.obstacles.overlaps(b)){b.x=source.x;b.y=source.y;}
        b.outsideArena = source.outsideArena; boundary(b,this.wall); frameCollision(b); b.previousX = b.x; b.previousY = b.y;
        this.balls.push(b);
      }
    }
  }
  private overlapsBlocks(b: Ball) {
    const g = this.blocks, s = g.step;
    for (let r = Math.max(0, Math.floor((b.y-b.radius-g.top)/s)); r <= Math.min(g.rows-1,Math.floor((b.y+b.radius-g.top)/s)); r++)
      for (let c = Math.max(0,Math.floor((b.x-b.radius-g.left)/s)); c <= Math.min(g.cols-1,Math.floor((b.x+b.radius-g.left)/s)); c++) {
        if (!g.alive[r*g.cols+c]) continue;
        const x=g.left+c*s,y=g.top+r*s;
        if (Math.hypot(b.x-Math.max(x,Math.min(x+g.size,b.x)),b.y-Math.max(y,Math.min(y+g.size,b.y)))<b.radius) return true;
      }
    return false;
  }
  constructor() { this.blocks.onHit = this.destroyed; this.reset(); }
  reset() {
    const field=this.endless;
    if(field){
      this.obstacles.load([]);field.start(this.seed,field.variant);this.powers.setCapacity(C.power.maxDrops);
      // Separate stream from the field's row patterns; the verifier derives both from the run seed.
      this.endlessDrops=seededRandom((this.seed^0x5bd1e995)>>>0);this.nextDropAt=dropEvery(0,field.variant);this.speedScale=endlessSpeed(0);
      this.resetRound();return;
    }
    this.obstacles.load(this.level.obstacles??[]);this.blocks.reset(this.level.obstacles??[],this.level);this.allocatePowers();
    this.powers.setCapacity(this.brickPowerVersion===2&&this.level.brickPowers?brickPowerCounts(this.blocks.total,this.level.brickPowers).drops:C.power.maxDrops);this.resetRound();
  }
  /** A lost round clears transient objects while retaining the current block grid. */
  resetRound(spawn = true) {
    // Administrative disposal for restart/level/life reset; never a gameplay death.
    for (const b of this.balls) b.alive = false;
    this.recycleDead();
    this.paddleX = this.targetX = C.arena.x;
    this.wideRemaining = 0; this.pierceRemaining = 0; this.fireRemaining = 0; this.effects.reset(); this.powers.reset();
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
    const obstacleStart=this.obstacles.time;
    // Endless wall moves first in each tick, before any ball contact (the verifier uses the same order).
    const field=this.endless;if(field&&field.tick()){this.speedScale=endlessSpeed(field.descents);this.effects.emit('descend',C.arena.x,field.top,field.descents);}
    this.pierceRemaining=Math.max(0,this.pierceRemaining-dt);if(this.pierceRemaining<1e-9)this.pierceRemaining=0;
    this.fireRemaining=Math.max(0,this.fireRemaining-dt);if(this.fireRemaining<1e-9)this.fireRemaining=0;
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
      const steps = Math.ceil(C.ball.maxSpeed * dt / C.maxTravel), h = dt / steps;
      for (let i = 0; i < steps && b.alive; i++) {
        b.x += b.vx * h; b.y += b.vy * h;
        boundary(b,this.wall); frameCollision(b);
        if (paddleCollision(b, this.paddleX, this.paddleWidth)) { this.effects.emit('paddle', b.x, C.paddle.y); this.onSound?.('paddle'); }
        // Resolve a bounded number of simultaneous contacts before the next movement.
        if(this.pierceRemaining>0)this.pierce(b);
        else for (let contact = 0; contact < 3; contact++) {const before=this.blocks.destroyed.length;if (!blockCollision(b, this.blocks)) break;if(this.fireRemaining>0&&this.blocks.destroyed.length>before)this.burn(this.blocks.destroyed[before]);}
        for(let contact=0;contact<3;contact++)if(!this.obstacles.collide(b,obstacleStart+(i+1)*h))break;
        boundary(b,this.wall); frameCollision(b);
        // The only gameplay removal condition, evaluated after all contact corrections.
        if (isBallInDeathZone(b)) { b.alive = false; this.effects.emit('lost', b.x, FRAME.deathY); this.onBallLost?.(); }
      }
    }
    this.obstacles.time=obstacleStart+dt;this.obstacles.sync();
    this.recycleDead();
    if (this.balls.length) this.powers.update(dt, this.paddleX, this.paddleWidth, this.pickup);
  }
}
