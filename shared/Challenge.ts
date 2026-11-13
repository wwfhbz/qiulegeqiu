export type ChallengeEvent = {type:'launch';tick:number;level:number;tripleRuleVersion?:2;brickPowerVersion?:2;trajectoryVersion?:1} | { type: 'ballLost' | 'lost' | 'clear' | 'next' | 'finish'; tick: number; level: number } | { type: 'hit'; tick: number; level: number; index: number } | { type: 'power'; tick: number; level: number; kind: 'halve'|'triple'|'wide'|'life'|'bomb'|'plus3'|'pierce'|'fire'|'lightning'; dropId?:number } | { type:'bomb'; tick:number; level:number; target:string|null } | { type:'crushed'; tick:number; level:number } | { type:'bonus'; tick:number; level:number; kind:'plus3'|'pierce'|'fire'|'lightning' };
export interface ChallengeSummary { score: number; reachedLevel: number; bricksDestroyed: number; durationMs: number; completedAllLevels: boolean }
export const LEGACY_RULES_VERSION = '0.8.0-arcade-5l-10lv-v1';
export const PREVIOUS_RULES_VERSION = '1.2.0-arcade-5l-12lv-v1';
/** Frozen V1.3 season: tutorial quotas 80%/50%, ~4100-brick later levels. Kept for verification and history. */
export const V13_RULES_VERSION = '1.3.0-arcade-5l-12lv-drops-v2';
/** Frozen V1.5 season: level-1 X3 share 35%, levels 3–12 a 1500→2500-brick disc on the 9px grid. */
export const V15_RULES_VERSION = '1.5.0-arcade-5l-12lv-short-v3';
/** Frozen V1.6 season: tutorials 20%/12% drops, levels 3–12 fill the arena (1320→2560 bricks). */
export const V16_RULES_VERSION = '1.6.0-arcade-5l-12lv-full-v4';
/** Frozen V1.7 season: same layouts; random drops thin out per level (1/14 → 1/50), +1 life and bomb 0.3% each. */
export const V17_RULES_VERSION = '1.7.0-arcade-5l-12lv-scarce-v5';
/** V1.8: same levels and drops as 1.7; every power-up caught is worth +100 points. Only this season ranks as current. */
export const RULES_VERSION = '1.8.0-arcade-5l-12lv-powerpts-v6';
/** Endless mode ("压迫下沉"): its own ruleset and its own board; never mixed into the campaign board. */
/** Frozen endless 1.0: drops every 8 → 30 bricks, wall stopped 80% down the bowl. */
export const ENDLESS_V1_RULES_VERSION = 'endless-1.0.0-3l-sink-v1';
/** Frozen endless 1.1: half the drops; the wall could sink right to the bowl bottom and seal the exit. */
export const ENDLESS_V2_RULES_VERSION = 'endless-1.1.0-3l-sink-v2';
/** Frozen endless 1.2: floor raised 64px above the bowl bottom; the wall only paused on the line. */
export const ENDLESS_V3_RULES_VERSION = 'endless-1.2.0-3l-sink-v3';
/** Frozen endless 1.3: 10s on the death line costs a life (then 5-row relief plus an effect ball); +100 per power caught. */
export const ENDLESS_V4_RULES_VERSION = 'endless-1.3.0-3l-sink-v4';
/** V1.4 is intentionally a separate board: denser drops, larger skills and faster descent. */
export const ENDLESS_RULES_VERSION = 'endless-1.4.0-3l-sink-v5';
/** Frozen pre-V1.4 board. Old clients without rulesVersion keep querying exactly this board. */
export const ENDLESS_BOARD_RULES_VERSIONS=[ENDLESS_V1_RULES_VERSION,ENDLESS_V2_RULES_VERSION,ENDLESS_V3_RULES_VERSION,ENDLESS_V4_RULES_VERSION] as const;
export const ENDLESS_BOARD='endless';
export const SUPPORTED_RULES_VERSIONS=[LEGACY_RULES_VERSION,PREVIOUS_RULES_VERSION,V13_RULES_VERSION,V15_RULES_VERSION,V16_RULES_VERSION,V17_RULES_VERSION,RULES_VERSION,ENDLESS_V1_RULES_VERSION,ENDLESS_V2_RULES_VERSION,ENDLESS_V3_RULES_VERSION,ENDLESS_V4_RULES_VERSION,ENDLESS_RULES_VERSION] as const;
/**
 * Seasons whose verified scores share the global board: every twelve-level ruleset. A rules update must
 * never empty the board, so each player's best across these seasons ranks. Ten-level scores stay history only.
 */
export const GLOBAL_BOARD_RULES_VERSIONS=[PREVIOUS_RULES_VERSION,V13_RULES_VERSION,V15_RULES_VERSION,V16_RULES_VERSION,V17_RULES_VERSION,RULES_VERSION] as const;
/** Seasons whose first launch must declare preassigned tutorial powers and the X3 threshold rule. */
export function usesBrickPowers(rules:string){return rules===RULES_VERSION||rules===V17_RULES_VERSION||rules===V16_RULES_VERSION||rules===V15_RULES_VERSION||rules===V13_RULES_VERSION;}

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

/** Additive capability keeps the protocol-2 handshake compatible with existing clients. */
export const TRIPLE_RULE_FEATURE='triple-threshold20-v1';
export const BRICK_POWER_FEATURE='tutorial-brick-powers-v1';
export const TRAJECTORY_FEATURE='deterministic-trajectory-v1';
export const CHALLENGE_FEATURES=[TRIPLE_RULE_FEATURE,BRICK_POWER_FEATURE,TRAJECTORY_FEATURE] as const;
export function assertTripleRuleSupport(data:{challengeFeatures?:unknown}){if(!Array.isArray(data.challengeFeatures)||!data.challengeFeatures.includes(TRIPLE_RULE_FEATURE))throw Error('排行榜后端尚不支持新版X3规则，请先更新后端；本轮仍可单机游玩');}

export function assertBrickPowerSupport(data:{challengeFeatures?:unknown}){if(!Array.isArray(data.challengeFeatures)||!data.challengeFeatures.includes(BRICK_POWER_FEATURE))throw Error('排行榜后端尚不支持新手关预分配道具，请先更新后端；本轮仍可单机游玩');}

/** Trajectory version is orthogonal to scoring rules: missing means frozen legacy physics (0). */
export function trajectoryVersionFor(events:readonly ChallengeEvent[]):0|1{return events.find(e=>e.type==='launch')?.trajectoryVersion??0;}
export function assertTrajectorySupport(data:{challengeFeatures?:unknown}){if(!Array.isArray(data.challengeFeatures)||!data.challengeFeatures.includes(TRAJECTORY_FEATURE))throw Error('排行榜后端需要更新以支持弹球防卡死轨迹；本轮仍可单机游玩');}
export function validateTrajectoryMarkers(events:readonly ChallengeEvent[]){let launched=false;for(const e of events)if(e.type==='launch'){if(e.trajectoryVersion!==undefined&&(e.trajectoryVersion!==1||launched))throw Error('轨迹版本标记只能在首次发射声明为1');launched=true;}}
