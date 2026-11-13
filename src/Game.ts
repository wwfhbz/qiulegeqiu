import { ChallengeJournal } from './ChallengeJournal';
import { C } from './GameConfig';
import { Physics } from './Physics';
import type {GameHost} from './platform/Contracts';
import { AudioSystem } from './Audio';
import { ARCADE } from './ArcadeRules';
import { LevelManager } from './LevelManager';
import { ScoreSystem, type LevelScore } from './ScoreSystem';
import type { GameState, ReadyReason } from './GameState';
import { Blocks } from './Blocks';
import { EndlessField } from './endless/EndlessField';
import { ENDLESS, ENDLESS_LEVEL, endlessStage } from './endless/EndlessRules';
import { RULES_VERSION, ENDLESS_RULES_VERSION } from '../shared/Challenge';
export type GameMode = 'campaign' | 'endless';

/** Coordinates the arcade session; physics and rendering remain independent. */
export class Game {
  readonly physics = new Physics();
  readonly journal = new ChallengeJournal();
  readonly audio:AudioSystem;
  score = new ScoreSystem(this.physics.blocks.alive.length);
  mode: GameMode = 'campaign';
  private campaignLevels?: LevelManager;
  private remainingLives: number = ARCADE.initialLives;
  get lives() { return this.remainingLives; }
  state: GameState = 'ready';
  readyReason: ReadyReason = 'initial';
  result?: Readonly<LevelScore>;
  private stopHost?:()=>void;
  private roundActive = false;
  /** Endless: the last life was lost to wall pressure, so the next launch clears rows and grants a bonus. */
  pendingRelief = false;

  // The same coordinator runs headlessly or under either platform host.
  constructor(private readonly host?:GameHost, private onChange: (game: Game) => void = () => {}, public levels = new LevelManager(), audio = new AudioSystem()) {
    this.audio=audio;
    this.configureLevel();this.physics.setSeed(this.journal.seed);this.physics.reset();
    this.physics.onSound = this.audio.play;
    this.physics.onStep = dt => { if (this.state === 'running') { this.score.update(dt); this.journal.tick++; } };
    // Endless bricks move, so the journal stores their stable world id instead of the grid slot.
    this.physics.onBlockDestroyed = index => { const id=this.physics.endless?.worldId(index)??index; if (this.state === 'running' && this.score.hit(id)>0) this.journal.record({type:'hit',level:this.levels.current.number,index:id}); };
    this.physics.onBallLost = () => { if(this.state==='running')this.journal.record({type:'ballLost',level:this.levels.current.number}); };
    this.physics.onPowerCollected = (kind,dropId) => { if(this.state==='running'&&this.roundActive&&this.physics.balls.some(ball=>ball.alive)){if(kind==='life')this.remainingLives=Math.min(this.maxLives,this.remainingLives+1);if(this.powerPoints)this.score.addPowerPoints();this.journal.record({type:'power',level:this.levels.current.number,kind,...(dropId===undefined?{}:{dropId})});} };
    this.physics.onBomb = target => { if(this.state==='running'){if(target===null)this.score.addBombCompensation();this.journal.record({type:'bomb',level:this.levels.current.number,target});} };
    if(host)this.stopHost=host.mount(this);
  }
  /** +100 per caught power applies to the current campaign table and to endless variants that enable it. */
  /** Replays of seasons before +100-per-power turn this off, like the other per-season flags. */
  powerPointsEnabled = true;
  get powerPoints(){if(!this.powerPointsEnabled)return false;const field=this.physics.endless;return field?!!field.variant.powerPoints:this.levels.isStandard;}
  get rulesVersion(){return this.mode==='endless'?ENDLESS_RULES_VERSION:RULES_VERSION;}
  get maxLives():number{return this.mode==='endless'?ENDLESS.lives:ARCADE.maxLives;}
  /** Level for campaign; stage (+1 per 10 descended rows) for endless. Stored as the score's reached level. */
  get reachedLevel(){const field=this.physics.endless;return field?endlessStage(field.descents):this.levels.current.number;}
  /** Switch between the twelve-level campaign and endless mode; always starts a fresh run. */
  setMode(mode:GameMode){
    if(mode===this.mode)return;
    this.mode=mode;
    if(mode==='endless'){this.campaignLevels=this.levels;this.levels=new LevelManager([ENDLESS_LEVEL]);this.physics.useField(new EndlessField());this.score=new ScoreSystem('unbounded');}
    else{this.levels=this.campaignLevels??new LevelManager();this.physics.useField(new Blocks());this.score=new ScoreSystem(this.physics.blocks.alive.length);}
    this.reset();
  }
  // Keep the old developer performance hook without importing a browser renderer.
  get renderer(){return this.host?.renderer;}
  dispose(){this.stopHost?.();this.stopHost=undefined;this.audio.dispose();}

  start() {
    if (this.lives <= 0 || (this.state !== 'ready' && this.state !== 'paused')) return;
    if (this.state === 'ready') { this.journal.record({type:'launch',level:this.levels.current.number,...(this.journal.events.length===0&&this.mode==='campaign'?{...(this.physics.tripleRuleVersion===2?{tripleRuleVersion:2 as const}:{}),...(this.physics.brickPowerVersion===2&&this.levels.current.brickPowers?{brickPowerVersion:2 as const}:{})}:{})}); this.roundActive = true; for (const b of this.physics.balls) this.physics.aimLaunch(b); }
    // Endless relief after a pressure death: clear the rows nearest the line, then a random effect ball.
    const field=this.physics.endless;
    if(this.pendingRelief&&field&&this.state==='ready'){
      this.pendingRelief=false;const cleared=field.relief(ENDLESS.reliefRows);
      this.physics.effects.emit('relief',C.arena.x,field.top+(field.floorRow+.5)*field.step,cleared);
      const kind=this.physics.drawBonus();this.journal.record({type:'bonus',level:this.levels.current.number,kind});this.physics.applyBonus(kind);
    }
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
    this.pendingRelief = false;
    this.levels.reset(); this.remainingLives = this.mode==='endless'?ENDLESS.lives:ARCADE.initialLives; this.score.reset(); this.result = undefined;
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
    this.physics.powerPointsShown = this.powerPoints ? ARCADE.powerPoints : 0;
    if (this.state === 'running') {
      this.physics.advance(dt);
      // Clear is checked first, including when the final ball leaves on the same tick.
      if (this.physics.blocks.remaining === 0 && this.mode === 'campaign') {
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
        this.audio.play('lost');
        this.score.resetCombo(); this.physics.resetRound(this.lives > 0);
        this.state = this.lives > 0 ? 'ready' : 'gameOver';
        this.readyReason = 'lifeLost';
        this.physics.paused = this.lives === 0;
        if(this.lives===0)this.journal.record({type:'finish',level:this.levels.current.number});
      } else if (this.roundActive && this.physics.endless?.variant.crush && this.physics.endless.pressure >= ENDLESS.crushTicks) {
        // Pressure death: the wall sat on the death line for 10 running seconds.
        const field=this.physics.endless;
        this.roundActive = false;
        this.journal.record({type:'crushed',level:this.levels.current.number});
        this.remainingLives = Math.max(0, this.remainingLives - 1);
        this.physics.effects.emit('crush',C.arena.x,field.top+(field.floorRow+.5)*field.step);
        this.audio.play('lost');
        this.score.resetCombo(); this.physics.resetRound(this.lives > 0);
        this.state = this.lives > 0 ? 'ready' : 'gameOver';
        this.readyReason = 'lifeLost'; this.pendingRelief = this.lives > 0;
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
