import { ARCADE } from './ArcadeRules';
export interface LevelScore {
  blockScore: number; clearBonus: number; lifeBonus: number; levelTotal: number; totalScore: number;
}
export class ScoreSystem {
  total = 0;
  combo = 0;
  remaining = 0;
  private levelStart = 0;
  private readonly scored: Uint8Array;
  private completed?: Readonly<LevelScore>;
  constructor(blockSlots: number) { this.scored = new Uint8Array(blockSlots); }
  get multiplier() { return ARCADE.multipliers.find(t => this.combo >= t.combo)?.value ?? 1; }
  get levelPoints() { return this.total - this.levelStart; }
  resetCombo() { this.combo = 0; this.remaining = 0; }
  reset() { this.total = 0; this.beginLevel(); }
  beginLevel() { this.levelStart = this.total; this.scored.fill(0); this.completed = undefined; this.resetCombo(); }
  update(dt: number) {
    this.remaining = Math.max(0, this.remaining - dt);
    if (this.remaining < 1e-9) this.resetCombo();
  }
  hit(index: number) {
    if (this.completed || !Number.isInteger(index) || index < 0 || index >= this.scored.length || this.scored[index]) return 0;
    this.scored[index] = 1;
    this.combo++; this.remaining = ARCADE.comboWindow;
    const points = Math.round(ARCADE.blockPoints * this.multiplier);
    this.total += points; return points;
  }
  complete(lives: number): Readonly<LevelScore> {
    if (this.completed) return this.completed;
    const blockScore = this.levelPoints;
    const clearBonus = ARCADE.clearBonus, lifeBonus = ARCADE.lifeBonus * lives;
    this.total += clearBonus + lifeBonus;
    return this.completed = Object.freeze({ blockScore, clearBonus, lifeBonus, levelTotal: blockScore + clearBonus + lifeBonus, totalScore: this.total });
  }
}
