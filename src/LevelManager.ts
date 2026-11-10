import { ARCADE } from './ArcadeRules';
import type { LevelConfig } from './Levels';
export type { LevelConfig } from './Levels';
export class LevelManager {
  constructor(private readonly configurations: readonly LevelConfig[] = ARCADE.levels) {
    if (configurations.length === 0) throw new Error('关卡配置不能为空');
  }
  private index = 0;
  get current() { return this.configurations[this.index]; }
  get powerUpDropMultiplier() { return this.current.number === 1 ? ARCADE.powerUpDropMultiplier.level1 : ARCADE.powerUpDropMultiplier.level2AndAbove; }
  get count() { return this.configurations.length; }
  get isFinal() { return this.index === this.count - 1; }
  reset() { this.index = 0; }
  next() { if (this.isFinal) return false; this.index++; return true; }
}
