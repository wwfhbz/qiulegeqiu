/** All arcade difficulty and scoring constants live here. */
export const ARCADE = {
  initialLives: 3,
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
  levels: [
    { number: 1, name: '核心初探', speedScale: 1 },
    { number: 2, name: '加速突破', speedScale: 1.1 },
    { number: 3, name: '最终核心', speedScale: 1.2 },
  ],
} as const;
