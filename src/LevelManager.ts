import { ARCADE } from './ArcadeRules';
import {dropMultiplier,V110_LEVELS} from './Levels';
import type { LevelConfig } from './Levels';
export type { LevelConfig } from './Levels';
export class LevelManager {
  constructor(private readonly configurations: readonly LevelConfig[] = ARCADE.levels) {
    if (configurations.length === 0) throw new Error('关卡配置不能为空');
  }
  private index = 0;
  /** True for the current campaign table (the one new runs use); frozen tables replay older seasons. */
  get isStandard() { return this.configurations === ARCADE.levels; }
  /** 3 lives, +100 per power and rewarded skips: the current table and the frozen 1.10 table. */
  get isThreeLife() { return this.isStandard || this.configurations === V110_LEVELS; }
  get current() { return this.configurations[this.index]; }
  get powerUpDropMultiplier() { return dropMultiplier(this.current); }
  get count() { return this.configurations.length; }
  get isFinal() { return this.index === this.count - 1; }
  reset() { this.index = 0; }
  /** Level map practice: start on any level (1-based). */
  jump(number: number) { this.index = Math.max(0, Math.min(this.count - 1, number - 1)); }
  next() { if (this.isFinal) return false; this.index++; return true; }
}
