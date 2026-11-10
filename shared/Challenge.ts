export type ChallengeEvent = { type: 'launch' | 'ballLost' | 'lost' | 'clear' | 'next' | 'finish'; tick: number; level: number } | { type: 'hit'; tick: number; level: number; index: number } | { type: 'power'; tick: number; level: number; kind: 'triple' | 'wide' };
export interface ChallengeSummary { score: number; reachedLevel: number; bricksDestroyed: number; durationMs: number; completedAllLevels: boolean }
export const RULES_VERSION = '0.7.0-arcade-5l-3lv-v1';
