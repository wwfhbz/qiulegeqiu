import { ChallengeJournal } from './ChallengeJournal';
import { C } from './GameConfig';
import { Physics } from './Physics';
import type {GameHost} from './platform/Contracts';
import { AudioSystem } from './Audio';
import { ARCADE } from './ArcadeRules';
import { LevelManager } from './LevelManager';
import { ScoreSystem, type LevelScore } from './ScoreSystem';
import type { GameState, ReadyReason } from './GameState';

/** Coordinates the arcade session; physics and rendering remain independent. */
export class Game {
  readonly physics = new Physics();
  readonly journal = new ChallengeJournal();
  readonly audio:AudioSystem;
  readonly score = new ScoreSystem(this.physics.blocks.alive.length);
  private remainingLives: number = ARCADE.initialLives;
  get lives() { return this.remainingLives; }
  state: GameState = 'ready';
  readyReason: ReadyReason = 'initial';
  result?: Readonly<LevelScore>;
  private stopHost?:()=>void;
  private roundActive = false;

  // The same coordinator runs headlessly or under either platform host.
  constructor(private readonly host?:GameHost, private onChange: (game: Game) => void = () => {}, readonly levels = new LevelManager(), audio = new AudioSystem()) {
    this.audio=audio;
    this.configureLevel();this.physics.setSeed(this.journal.seed);this.physics.reset();
    this.physics.onSound = this.audio.play;
    this.physics.onStep = dt => { if (this.state === 'running') { this.score.update(dt); this.journal.tick++; } };
    this.physics.onBlockDestroyed = index => { if (this.state === 'running' && this.score.hit(index)>0) this.journal.record({type:'hit',level:this.levels.current.number,index}); };
    this.physics.onBallLost = () => { if(this.state==='running')this.journal.record({type:'ballLost',level:this.levels.current.number}); };
    this.physics.onPowerCollected = (kind,dropId) => { if(this.state==='running'&&this.roundActive&&this.physics.balls.some(ball=>ball.alive)){if(kind==='life')this.remainingLives=Math.min(ARCADE.maxLives,this.remainingLives+1);this.journal.record({type:'power',level:this.levels.current.number,kind,...(dropId===undefined?{}:{dropId})});} };
    this.physics.onBomb = target => { if(this.state==='running'){if(target===null)this.score.addBombCompensation();this.journal.record({type:'bomb',level:this.levels.current.number,target});} };
    if(host)this.stopHost=host.mount(this);
  }
  // Keep the old developer performance hook without importing a browser renderer.
  get renderer(){return this.host?.renderer;}
  dispose(){this.stopHost?.();this.stopHost=undefined;this.audio.dispose();}

  start() {
    if (this.lives <= 0 || (this.state !== 'ready' && this.state !== 'paused')) return;
    if (this.state === 'ready') { this.journal.record({type:'launch',level:this.levels.current.number,...(this.journal.events.length===0?{...(this.physics.tripleRuleVersion===2?{tripleRuleVersion:2 as const}:{}),...(this.physics.brickPowerVersion===2&&this.levels.current.brickPowers?{brickPowerVersion:2 as const}:{})}:{})}); this.roundActive = true; for (const b of this.physics.balls) this.physics.aimLaunch(b); }
    this.audio.unlock(); this.physics.paused = false; this.physics.accumulator = 0;
    this.state = 'running'; this.onChange(this);
  }
  pause() {
    if (this.state !== 'running') return;
    this.physics.paused = true; this.state = 'paused'; this.onChange(this);
  }
  reset() {
    this.roundActive = false;
    this.journal.reset();this.physics.setSeed(this.journal.seed);
    this.levels.reset(); this.remainingLives = ARCADE.initialLives; this.score.reset(); this.result = undefined;
    this.configureLevel();
    this.physics.reset(); this.state = 'ready'; this.readyReason = 'initial'; this.onChange(this);
  }
  nextLevel() {
    const previousLevel=this.levels.current.number;
    if (this.state !== 'levelComplete' || !this.levels.next()) return;
    this.roundActive = false;
    this.journal.record({type:'next',level:previousLevel});
    this.score.beginLevel(); this.result = undefined;
    this.configureLevel();
    this.physics.reset(); this.state = 'ready'; this.readyReason = 'levelStart'; this.onChange(this);
  }
  stress() {
    this.reset(); this.journal.unranked=true;
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
        this.journal.record({type:'clear',level:this.levels.current.number});
        if(this.levels.isFinal)this.journal.record({type:'finish',level:this.levels.current.number});
        this.state = this.levels.isFinal ? 'victory' : 'levelComplete';
        this.physics.paused = true; this.physics.accumulator = 0; this.audio.play('win');
        if(this.levels.current.autoAdvance&&!this.levels.isFinal)this.nextLevel();
      } else if (this.roundActive && !this.physics.balls.some(b => b.alive)) {
        this.roundActive = false;
        this.journal.record({type:'lost',level:this.levels.current.number});
        this.remainingLives = Math.max(0, this.remainingLives - 1);
        this.score.resetCombo(); this.physics.resetRound(this.lives > 0);
        this.state = this.lives > 0 ? 'ready' : 'gameOver';
        this.readyReason = 'lifeLost';
        this.physics.paused = this.lives === 0;
        if(this.lives===0)this.journal.record({type:'finish',level:this.levels.current.number});
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
    this.physics.level=this.levels.current;
    this.physics.speedScale = this.levels.current.speedScale;
    this.physics.powerUpDropMultiplier = this.levels.powerUpDropMultiplier;
  }
}
