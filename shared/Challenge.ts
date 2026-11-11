export type ChallengeEvent = { type: 'launch' | 'ballLost' | 'lost' | 'clear' | 'next' | 'finish'; tick: number; level: number } | { type: 'hit'; tick: number; level: number; index: number } | { type: 'power'; tick: number; level: number; kind: 'halve'|'triple'|'wide'|'life'|'bomb'; dropId?:number } | { type:'bomb'; tick:number; level:number; target:string|null };
export interface ChallengeSummary { score: number; reachedLevel: number; bricksDestroyed: number; durationMs: number; completedAllLevels: boolean }
export const LEGACY_RULES_VERSION = '0.8.0-arcade-5l-10lv-v1';
export const RULES_VERSION = '1.2.0-arcade-5l-12lv-v1';
export const SUPPORTED_RULES_VERSIONS=[LEGACY_RULES_VERSION,RULES_VERSION] as const;

/** Old API servers may silently ignore unknown query parameters: never label that old board as new. */
export function assertRulesVersion(actual:unknown,requested:string){if(actual===requested||(requested===LEGACY_RULES_VERSION&&actual===undefined))return;throw Error('排行榜服务尚未支持此赛季，请等待后端升级或查看旧版历史榜');}

export const GLOBAL_BOARD='global';
export const GLOBAL_BOARD_PATH='/leaderboard?board=global';
export interface LeaderboardMetadata {board?:string;rankingRulesVersion?:string;rulesVersion?:string}
export function assertGlobalBoard(data:LeaderboardMetadata){
 if(data.board!==GLOBAL_BOARD||data.rankingRulesVersion!==RULES_VERSION)throw Error('排行榜后端需要更新，暂时无法读取统一榜单；历史成绩仍保留，单机游戏不受影响');
}
export function assertChallengeSupport(data:{ok?:boolean;rulesVersion?:string;supportedRulesVersions?:readonly string[]}){
 if(data.ok!==true)throw Error('排行榜健康检查响应无效，请检查API代理配置');
 if(data.supportedRulesVersions!==undefined&&(!Array.isArray(data.supportedRulesVersions)||!data.supportedRulesVersions.every(value=>typeof value==='string')))throw Error('排行榜规则能力响应无效，请检查API代理配置');
 const supported=data.supportedRulesVersions??(data.rulesVersion?[data.rulesVersion]:[]);
 if(!supported.includes(RULES_VERSION))throw Error('服务器尚不支持十二关挑战，请更新排行榜后端；本轮仍可单机游玩');
}

/** Wire format changes independently from gameplay/scoring rules. */
export const CHALLENGE_PROTOCOL_VERSION=2;
export function assertChallengeProtocol(data:{challengeProtocolVersion?:unknown}){if(data.challengeProtocolVersion!==CHALLENGE_PROTOCOL_VERSION)throw Error('排行榜后端日志协议需要更新（需要协议2，支持dropId）；规则版本相同不代表接口兼容，本轮仍可单机游玩');}
