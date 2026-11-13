import {RULES_VERSION,ENDLESS_RULES_VERSION} from '../../../shared/Challenge';
export type SocialMode='campaign'|'endless';
export const SOCIAL_VERSION='2.1.0-social';
export const rulesFor=(mode:SocialMode)=>mode==='campaign'?RULES_VERSION:ENDLESS_RULES_VERSION;
export const cloudKey=(mode:SocialMode)=>'qqcj_'+mode+'_'+rulesFor(mode);
export interface CloudScore {schema:1;score:number;rulesVersion:string;marker:string}
export function cloudScore(value:string|undefined,mode:SocialMode):CloudScore|undefined{try{const r=JSON.parse(value||'');if(r.schema===1&&Number.isSafeInteger(r.score)&&r.score>=0&&r.rulesVersion===rulesFor(mode)&&typeof r.marker==='string'&&/^[a-zA-Z0-9_-]{16,80}$/.test(r.marker))return r;}catch{/* Invalid or old records never become invented scores. */}}
export interface KV {key:string;value:string}
export interface FriendRecord {openid:string;nickname:string;avatarUrl:string;KVDataList:KV[]}
export function friendRows(data:FriendRecord[],mode:SocialMode){return data.filter(friend=>friend&&typeof friend.openid==='string'&&typeof friend.nickname==='string'&&typeof friend.avatarUrl==='string'&&Array.isArray(friend.KVDataList)).map((friend,index)=>({friend,index,record:cloudScore(friend.KVDataList?.find(k=>k.key===cloudKey(mode))?.value,mode)})).filter((r):r is typeof r&{record:CloudScore}=>!!r.record).sort((a,b)=>b.record.score-a.record.score||a.index-b.index);}
