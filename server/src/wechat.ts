import {createHash,randomBytes,randomUUID} from 'node:crypto';
import type {Db} from './db.js';
import {transaction} from './db.js';
import {ApiError} from './moderation.js';
export const tokenHash=(s:string)=>createHash('sha256').update(s).digest('hex');
export interface WechatProvider {appId:string;exchange(code:string):Promise<{openid:string}>}
/** Real official exchange only. Missing credentials disables login, never fabricates success. */
export function productionWechat():WechatProvider|undefined{
 const appId=process.env.WECHAT_APP_ID,secret=process.env.WECHAT_APP_SECRET;
 if(!appId||!secret)return undefined;
 return {appId,async exchange(code){
  if(!/^wx[0-9a-f]{16}$/.test(appId)||!/^[0-9a-f]{32}$/i.test(secret))throw new ApiError(503,'微信登录配置无效');
  const url=new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.search=new URLSearchParams({appid:appId,secret,js_code:code,grant_type:'authorization_code'}).toString();
  try{const response=await fetch(url,{signal:AbortSignal.timeout(5000),redirect:'error'});const data=await response.json() as {errcode?:number;openid?:string};
   if(!response.ok||data.errcode||typeof data.openid!=='string'||!data.openid||data.openid.length>128)throw new Error('exchange rejected');
   return {openid:data.openid}; // session_key is intentionally discarded and never logged or returned.
  }catch{throw new ApiError(503,'微信登录暂不可用，请重试；单机游戏不受影响');}
 }};
}
export function identityForSession(db:Db,sessionId:string){return db.prepare('SELECT i.* FROM wechat_identities i JOIN wechat_sessions w ON w.identity_id=i.id WHERE w.session_id=?').get(sessionId);}
export async function wechatLogin(db:Db,provider:WechatProvider|undefined,code:string,now:number){
 if(!provider)throw new ApiError(503,'微信登录尚未配置，可继续单机游玩');
 const digest=tokenHash(provider.appId+'\0'+code);
 transaction(db,()=>{db.prepare('DELETE FROM wechat_login_codes WHERE expires_at<?').run(now);try{db.prepare('INSERT INTO wechat_login_codes VALUES(?,?)').run(digest,now+600000);}catch{throw new ApiError(409,'登录凭证已使用，请重新登录');}});
 let openid:string;try{({openid}=await provider.exchange(code));}catch(error){if(error instanceof ApiError)throw error;throw new ApiError(503,'微信登录暂不可用，请重新获取凭证');}
 if(typeof openid!=='string'||!openid||openid.length>128)throw new ApiError(503,'微信登录结果无效');
 return transaction(db,()=>{
  const identityHash=tokenHash(provider.appId+'\0'+openid);
  db.prepare('INSERT OR IGNORE INTO wechat_identities VALUES(?,?,?,?,?)').run(randomUUID(),provider.appId,identityHash,null,now);
  const identity=db.prepare('SELECT * FROM wechat_identities WHERE app_id=? AND openid_hash=?').get(provider.appId,identityHash)!;
  const id=randomUUID(),token=randomBytes(32).toString('base64url'),csrfToken=randomBytes(24).toString('base64url'),expiresAt=now+30*86400000;
  db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?)').run(id,identity.player_id,tokenHash(token),csrfToken,now,expiresAt);
  db.prepare('INSERT INTO wechat_sessions VALUES(?,?)').run(id,identity.id);
  return {token,csrfToken,expiresAt};
 });
}
export function attachWechatPlayer(db:Db,sessionId:string,playerId:string){
 const identity=identityForSession(db,sessionId);if(!identity)return;
 if(identity.player_id&&identity.player_id!==playerId)throw new ApiError(409,'微信身份已经绑定其他玩家，不能合并或冒领');
 db.prepare('UPDATE wechat_identities SET player_id=? WHERE id=?').run(playerId,identity.id);
 db.prepare('UPDATE sessions SET player_id=? WHERE id IN(SELECT session_id FROM wechat_sessions WHERE identity_id=?)').run(playerId,identity.id);
}
