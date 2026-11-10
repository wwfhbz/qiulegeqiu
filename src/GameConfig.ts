import { ARCADE } from './ArcadeRules';
export const C = {
  width: 800, height: 1120,
  arena: { x: 400, y: 492, radius: 360, exitHalfWidth: 53, wallWidth: 1.4 },
  frame: { sideGap: 16, topGap: 20, deathGap: 48 },
  grid: { step: 9, size: 8, emptyFraction: .20 },
  paddle: { y: 1018, width: 112, height: 12, speed: 1000, margin: 8 },
  ball: { radius: 4.5, speed: 440, minSpeed: 380, maxSpeed: 760 },
  maxBalls: 100,
  power: { duration: 5, wideScale: 1.8, fallSpeed: 125, radius: 15, dropEvery: 14, maxDrops: 24 },
  effects: { particles: 384, flashes: 64, comboWindow: ARCADE.comboWindow },
  step: 1 / 120, maxFrame: .1, maxTravel: 2,
} as const;
