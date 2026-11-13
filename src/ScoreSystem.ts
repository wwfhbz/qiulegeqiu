import { ARCADE } from './ArcadeRules';
export interface LevelScore {
  blockScore: number; clearBonus: number; lifeBonus: number; levelTotal: number; totalScore: number;
}
export class ScoreSystem {
  total = 0;
  combo = 0;
  remaining = 0;
  private levelStart = 0;
  /** Fixed grids use a bitmap; endless brick ids are unbounded, so they use a set. */
  private readonly scored: Uint8Array|Set<number>;
  private completed?: Readonly<LevelScore>;
  constructor(blockSlots: number|'unbounded') { this.scored = blockSlots==='unbounded'?new Set<number>():new Uint8Array(blockSlots); }
  get multiplier() { return ARCADE.multipliers.find(t => this.combo >= t.combo)?.value ?? 1; }
  get levelPoints() { return this.total - this.levelStart; }
  resetCombo() { this.combo = 0; this.remaining = 0; }
  reset() { this.total = 0; this.beginLevel(); }
  beginLevel() { this.levelStart = this.total; if(this.scored instanceof Set)this.scored.clear();else this.scored.fill(0); this.completed = undefined; this.resetCombo(); }
  update(dt: number) {
    this.remaining = Math.max(0, this.remaining - dt);
    if (this.remaining < 1e-9) this.resetCombo();
  }
  hit(index: number) {
    if (this.completed || !Number.isSafeInteger(index) || index < 0) return 0;
    if (this.scored instanceof Set) { if (this.scored.has(index)) return 0; this.scored.add(index); }
    else { if (index >= this.scored.length || this.scored[index]) return 0; this.scored[index] = 1; }
    this.combo++; this.remaining = ARCADE.comboWindow;
    const points = Math.round(ARCADE.blockPoints * this.multiplier);
    this.total += points; return points;
  }
  addBombCompensation() { if(!this.completed)this.total+=ARCADE.emptyBombPoints; }
  complete(lives: number): Readonly<LevelScore> {
    if (this.completed) return this.completed;
    const blockScore = this.levelPoints;
    const clearBonus = ARCADE.clearBonus, lifeBonus = ARCADE.lifeBonus * lives;
    this.total += clearBonus + lifeBonus;
    return this.completed = Object.freeze({ blockScore, clearBonus, lifeBonus, levelTotal: blockScore + clearBonus + lifeBonus, totalScore: this.total });
  }
}
