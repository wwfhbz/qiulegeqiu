import { LEVELS } from './Levels';
/** All arcade difficulty and scoring constants live here. */
export const ARCADE = {
  /** Campaign 1.10+: 3 lives, the same as endless. Earlier seasons replay with LEGACY_LIVES. */
  initialLives: 3,
  maxLives: 3,
  emptyBombPoints: 100,
  /** Campaign 1.8+ and endless 1.3+: every power-up caught with the paddle is worth a flat 100 points. */
  powerPoints: 100,
  powerUpDropMultiplier: { level1: 1, level2AndAbove: .5 },
  blockPoints: 10,
  comboWindow: 1.2,
  clearBonus: 1000,
  lifeBonus: 500,
  multipliers: [
    { combo: 20, value: 3 },
    { combo: 10, value: 2 },
    { combo: 5, value: 1.5 },
    { combo: 1, value: 1 },
  ],
  levels: LEVELS,
} as const;

/** Lives in every campaign season before 1.10 (verification of frozen seasons only). */
export const LEGACY_LIVES = 5;
