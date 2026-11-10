export type ChallengeEvent = { type: 'launch' | 'ballLost' | 'lost' | 'clear' | 'next' | 'finish'; tick: number; level: number } | { type: 'hit'; tick: number; level: number; index: number } | { type: 'power'; tick: number; level: number; kind: 'halve'|'triple'|'wide'|'life'|'bomb' } | { type:'bomb'; tick:number; level:number; target:string|null };
export interface ChallengeSummary { score: number; reachedLevel: number; bricksDestroyed: number; durationMs: number; completedAllLevels: boolean }
export const RULES_VERSION = '0.8.0-arcade-5l-10lv-v1';
