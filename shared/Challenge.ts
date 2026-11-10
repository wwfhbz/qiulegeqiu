export type ChallengeEvent = { type: 'launch' | 'ballLost' | 'lost' | 'clear' | 'next' | 'finish'; tick: number; level: number } | { type: 'hit'; tick: number; level: number; index: number } | { type: 'power'; tick: number; level: number; kind: 'halve'|'triple'|'wide'|'life'|'bomb' } | { type:'bomb'; tick:number; level:number; target:string|null };
export interface ChallengeSummary { score: number; reachedLevel: number; bricksDestroyed: number; durationMs: number; completedAllLevels: boolean }
export const LEGACY_RULES_VERSION = '0.8.0-arcade-5l-10lv-v1';
export const RULES_VERSION = '1.2.0-arcade-5l-12lv-v1';
export const SUPPORTED_RULES_VERSIONS=[LEGACY_RULES_VERSION,RULES_VERSION] as const;

/** Old API servers may silently ignore unknown query parameters: never label that old board as new. */
export function assertRulesVersion(actual:unknown,requested:string){if(actual===requested||(requested===LEGACY_RULES_VERSION&&actual===undefined))return;throw Error('排行榜服务尚未支持此赛季，请等待后端升级或查看旧版历史榜');}
