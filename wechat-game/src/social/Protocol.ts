import {RULES_VERSION,ENDLESS_RULES_VERSION,ENDLESS_V4_RULES_VERSION,ENDLESS_BOARD_RULES_VERSIONS,isEndlessRules} from '../../../shared/Challenge';
export type SocialMode='campaign'|'endless';
export const SOCIAL_VERSION='2.1.0-social';
export const rulesFor=(mode:SocialMode)=>mode==='campaign'?RULES_VERSION:ENDLESS_RULES_VERSION;
/** Reuse the deployed V1.3 key permanently; never rotate it when gameplay rules change. */
export const cloudKey=(mode:SocialMode)=>'qqcj_'+mode+'_'+(mode==='endless'?ENDLESS_V4_RULES_VERSION:rulesFor(mode));
export const cloudReadKeys=(mode:SocialMode)=>mode==='endless'?[...new Set([cloudKey(mode),...ENDLESS_BOARD_RULES_VERSIONS.map(v=>'qqcj_endless_'+v)])]:[cloudKey(mode)];
export interface CloudScore {schema:1;score:number;rulesVersion:string;marker:string;sourceRulesVersion?:string}
export function cloudScore(value:string|undefined,mode:SocialMode):CloudScore|undefined{try{const r=JSON.parse(value||'');if(r.schema===1&&Number.isSafeInteger(r.score)&&r.score>=0&&typeof r.rulesVersion==='string'&&r.rulesVersion.length<=100&&(mode==='endless'?isEndlessRules(r.rulesVersion):r.rulesVersion===rulesFor(mode))&&typeof r.marker==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(r.marker))return r;}catch{/* Invalid or old records never become invented scores. */}}
export interface KV {key:string;value:string}
/** One logical best, merging pre-unification keys without deleting or downgrading any record. */
export function cloudBest(rows:KV[],mode:SocialMode){let best:CloudScore|undefined;for(const key of cloudReadKeys(mode)){const record=cloudScore(rows.find(k=>k.key===key)?.value,mode);if(record&&(!best||record.score>best.score))best=record;}return best;}
export function cloudEnvelope(record:CloudScore,mode:SocialMode):CloudScore{return mode==='endless'?{...record,sourceRulesVersion:record.sourceRulesVersion??record.rulesVersion,rulesVersion:ENDLESS_V4_RULES_VERSION}:record;}
export interface FriendRecord {openid:string;nickname:string;avatarUrl:string;KVDataList:KV[]}
export function friendRows(data:FriendRecord[],mode:SocialMode){return data.filter(friend=>friend&&typeof friend.openid==='string'&&typeof friend.nickname==='string'&&typeof friend.avatarUrl==='string'&&Array.isArray(friend.KVDataList)).map((friend,index)=>({friend,index,record:cloudBest(friend.KVDataList,mode)})).filter((r):r is typeof r&{record:CloudScore}=>!!r.record).sort((a,b)=>b.record.score-a.record.score||a.index-b.index);}
