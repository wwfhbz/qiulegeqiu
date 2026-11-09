import { ARCADE } from './ArcadeRules';
export class LevelManager {
  private index = 0;
  get current() { return ARCADE.levels[this.index]; }
  get count() { return ARCADE.levels.length; }
  get isFinal() { return this.index === this.count - 1; }
  reset() { this.index = 0; }
  next() { if (this.isFinal) return false; this.index++; return true; }
}
