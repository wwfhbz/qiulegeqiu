import { C } from './GameConfig';
import { Physics } from './Physics';
import { Renderer } from './Renderer';
import { AudioSystem } from './Audio';
import { ARCADE } from './ArcadeRules';
import { LevelManager } from './LevelManager';
import { ScoreSystem, type LevelScore } from './ScoreSystem';
import type { GameState, ReadyReason } from './GameState';

/** Coordinates the arcade session; physics and rendering remain independent. */
export class Game {
  readonly physics = new Physics();
  readonly audio = new AudioSystem();
  readonly score = new ScoreSystem(this.physics.blocks.alive.length);
  private remainingLives: number = ARCADE.initialLives;
  get lives() { return this.remainingLives; }
  state: GameState = 'ready';
  readyReason: ReadyReason = 'initial';
  result?: Readonly<LevelScore>;
  private renderer?: Renderer;
  private previous = 0;
  private roundActive = false;

  // Without a canvas this is the same coordinator, driven deterministically by tests.
  constructor(canvas?: HTMLCanvasElement, private onChange: (game: Game) => void = () => {}, readonly levels = new LevelManager()) {
    this.configureLevel();
    this.physics.onSound = this.audio.play;
    this.physics.onStep = dt => { if (this.state === 'running') this.score.update(dt); };
    this.physics.onBlockDestroyed = index => { if (this.state === 'running') this.score.hit(index); };
    if (!canvas) return;
    this.renderer = new Renderer(canvas);
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && !canvas.hasPointerCapture(e.pointerId)) return;
      const rect = canvas.getBoundingClientRect();
      this.physics.setTarget((e.clientX - rect.left) / rect.width * C.width);
    };
    canvas.addEventListener('pointerdown', e => { this.audio.unlock(); canvas.setPointerCapture(e.pointerId); move(e); });
    canvas.addEventListener('pointermove', move);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'running') this.pause(); });
    requestAnimationFrame(this.frame);
  }

  start() {
    if (this.lives <= 0 || (this.state !== 'ready' && this.state !== 'paused')) return;
    if (this.state === 'ready') { this.roundActive = true; for (const b of this.physics.balls) this.physics.aimLaunch(b); }
    this.audio.unlock(); this.physics.paused = false; this.physics.accumulator = 0;
    this.state = 'running'; this.onChange(this);
  }
  pause() {
    if (this.state !== 'running') return;
    this.physics.paused = true; this.state = 'paused'; this.onChange(this);
  }
  reset() {
    this.roundActive = false;
    this.levels.reset(); this.remainingLives = ARCADE.initialLives; this.score.reset(); this.result = undefined;
    this.configureLevel();
    this.physics.reset(); this.state = 'ready'; this.readyReason = 'initial'; this.onChange(this);
  }
  nextLevel() {
    if (this.state !== 'levelComplete' || !this.levels.next()) return;
    this.roundActive = false;
    this.score.beginLevel(); this.result = undefined;
    this.configureLevel();
    this.physics.reset(); this.state = 'ready'; this.readyReason = 'levelStart'; this.onChange(this);
  }
  stress() {
    this.reset();
    for (let i = 1; i < C.maxBalls; i++) {
      const b = this.physics.newBall(); b.x += (i % 20 - 10) * 10; b.y += Math.floor(i / 20) * 2;
      this.physics.balls.push(b);
    }
    this.start();
  }
  update(dt: number) {
    if (this.state === 'running') {
      this.physics.advance(dt);
      // Clear is checked first, including when the final ball leaves on the same tick.
      if (this.physics.blocks.remaining === 0) {
        this.roundActive = false;
        this.result = this.score.complete(this.lives);
        this.state = this.levels.isFinal ? 'victory' : 'levelComplete';
        this.physics.paused = true; this.physics.accumulator = 0; this.audio.play('win');
      } else if (this.roundActive && !this.physics.balls.some(b => b.alive)) {
        this.roundActive = false;
        this.remainingLives = Math.max(0, this.remainingLives - 1);
        this.score.resetCombo(); this.physics.resetRound(this.lives > 0);
        this.state = this.lives > 0 ? 'ready' : 'gameOver';
        this.readyReason = 'lifeLost';
        this.physics.paused = this.lives === 0;
      }
    } else if (this.state === 'ready') {
      const maxMove = C.paddle.speed * Math.min(C.maxFrame, Math.max(0, dt));
      this.physics.paddleX += Math.max(-maxMove, Math.min(maxMove, this.physics.targetX - this.physics.paddleX));
      const ball = this.physics.balls[0];
      if (ball) ball.x = this.physics.paddleX;
    }
    // Publish after the complete transition, including headless/manual updates.
    this.onChange(this);
  }
  private configureLevel() {
    this.physics.speedScale = this.levels.current.speedScale;
    this.physics.powerUpDropMultiplier = this.levels.powerUpDropMultiplier;
  }
  private frame = (now: number) => {
    const dt = this.previous ? (now - this.previous) / 1000 : 0; this.previous = now;
    this.update(dt);
    this.renderer?.draw(this.physics, this.state === 'ready');
    requestAnimationFrame(this.frame);
  };
}
