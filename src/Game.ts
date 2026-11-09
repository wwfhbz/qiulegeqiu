import { C } from './GameConfig';
import { Physics } from './Physics';
import { Renderer } from './Renderer';
import { AudioSystem } from './Audio';
export class Game {
  readonly physics = new Physics();
  readonly audio = new AudioSystem();
  state: 'ready' | 'running' | 'paused' | 'won' = 'ready';
  private renderer: Renderer; private previous = 0;
  constructor(private canvas: HTMLCanvasElement, private onChange: (game: Game) => void) {
    this.renderer = new Renderer(canvas);
    this.physics.onSound = this.audio.play;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && !canvas.hasPointerCapture(e.pointerId)) return;
      const rect = canvas.getBoundingClientRect(); this.physics.setTarget((e.clientX - rect.left) / rect.width * C.width);
    };
    canvas.addEventListener('pointerdown', e => { this.audio.unlock(); canvas.setPointerCapture(e.pointerId); move(e); });
    canvas.addEventListener('pointermove', move);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'running') this.pause(); });
    requestAnimationFrame(this.frame);
  }
  start() { if (this.state !== 'won') { if(this.state === 'ready') for(const b of this.physics.balls) this.physics.aimLaunch(b); this.audio.unlock(); this.physics.paused = false; this.state = 'running'; this.physics.accumulator = 0; this.onChange(this); } }
  pause() { if (this.state === 'running') { this.physics.paused = true; this.state = 'paused'; this.onChange(this); } }
  reset() { this.physics.reset(); this.state = 'ready'; this.onChange(this); }
  stress() {
    this.reset();
    for (let i = 1; i < C.maxBalls; i++) { const b = this.physics.newBall(); b.x += (i % 20 - 10) * 10; b.y += Math.floor(i / 20) * 2; const angle = -1.1 + i / C.maxBalls * 2.2; b.vx = Math.sin(angle) * C.ball.speed; b.vy = -Math.cos(angle) * C.ball.speed; this.physics.balls.push(b); }
    this.start();
  }
  private frame = (now: number) => {
    const dt = this.previous ? (now - this.previous) / 1000 : 0; this.previous = now;
    if (this.state === 'running') {
      this.physics.advance(dt);
      if (this.physics.blocks.remaining === 0) { this.state = 'won'; this.audio.play('win'); }
      else if (!this.physics.balls.some(b => b.alive)) { this.physics.balls.push(this.physics.newBall()); this.state = 'ready'; this.physics.accumulator = 0; }
    } else if (this.state === 'ready') {
      this.physics.paddleX += Math.max(-C.paddle.speed * dt, Math.min(C.paddle.speed * dt, this.physics.targetX - this.physics.paddleX));
      this.physics.balls[0].x = this.physics.paddleX;
    }
    this.renderer.draw(this.physics, this.state === 'ready'); this.onChange(this);
    requestAnimationFrame(this.frame);
  };
}
