import {nicknameQuota,renameNickname} from './nickname.js';
import {wechatLogin,productionWechat,identityForSession,attachWechatPlayer,tokenHash,type WechatProvider} from './wechat.js';
import Fastify, { type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import {validationFailure} from './validation.js';
import { openDb, transaction, json, type Db } from './db.js';
import { seedRegions, region, regionView, searchRegions } from './regions.js';
import { ApiError, moderateNickname } from './moderation.js';
import { leaderboard, personalBest, refreshBest,globalLeaderboard,globalPersonalBest,historicalBests,endlessLeaderboard,endlessPersonalBest } from './leaderboard.js';
import { verifyTrace } from './verifier.js';
import { GLOBAL_BOARD_COMPAT_VERSION,CAMPAIGN_RANKING_SCOPE,isEndlessRules,ENDLESS_RANKING_SCOPE,CHALLENGE_PROTOCOL_VERSION,CHALLENGE_FEATURES,RULES_VERSION,V13_RULES_VERSION,V15_RULES_VERSION,V16_RULES_VERSION,V17_RULES_VERSION,PREVIOUS_RULES_VERSION,LEGACY_RULES_VERSION,SUPPORTED_RULES_VERSIONS,GLOBAL_BOARD,ENDLESS_BOARD,ENDLESS_RULES_VERSION,ENDLESS_V5_RULES_VERSION,ENDLESS_V6_RULES_VERSION,MAX_CHALLENGE_EVENTS,ENDLESS_V4_RULES_VERSION,ENDLESS_V1_RULES_VERSION,ENDLESS_V2_RULES_VERSION,ENDLESS_V3_RULES_VERSION, type ChallengeEvent } from '../../shared/Challenge.js';
const selection=(req:FastifyRequest)=>{const q=z.object({board:z.enum([GLOBAL_BOARD,ENDLESS_BOARD]).optional(),rulesVersion:z.string().max(100).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).optional()}).parse(req.query);
 const boardRules=q.board===ENDLESS_BOARD?(q.rulesVersion??ENDLESS_V4_RULES_VERSION):RULES_VERSION;
 if(q.board&&q.rulesVersion&&(q.board===ENDLESS_BOARD?!isEndlessRules(q.rulesVersion):isEndlessRules(q.rulesVersion)))throw new ApiError(400,q.board===ENDLESS_BOARD?'无尽榜只接受无尽模式记录':'闯关榜只接受闯关模式记录');
 return {global:!(q.board===ENDLESS_BOARD||!!q.rulesVersion&&isEndlessRules(q.rulesVersion)),endless:q.board===ENDLESS_BOARD||!!q.rulesVersion&&isEndlessRules(q.rulesVersion),rules:q.board?boardRules:q.rulesVersion??LEGACY_RULES_VERSION};};
/** Board metadata, ranking and personal best for whichever board the request selected. */
const boardOf=(selected:ReturnType<typeof selection>)=>selected.global?boardMetadata:selected.endless?{board:ENDLESS_BOARD,rankingRulesVersion:selected.rules,rankingScope:ENDLESS_RANKING_SCOPE}:{};
const selectedRules=(req:FastifyRequest)=>selection(req).rules;
const boardMetadata={board:GLOBAL_BOARD,rankingRulesVersion:GLOBAL_BOARD_COMPAT_VERSION,rankingScope:CAMPAIGN_RANKING_SCOPE};
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const id=z.string().uuid(), integer=z.number().int().nonnegative().max(100000000);
const base={tick:integer,level:z.number().int().min(1).max(100)};
export const challengeEvent=z.discriminatedUnion('type',[
 z.object({...base,type:z.literal('launch'),tripleRuleVersion:z.literal(2).optional(),brickPowerVersion:z.literal(2).optional(),trajectoryVersion:z.literal(1).optional()}).strict(),
 z.object({...base,type:z.enum(['ballLost','lost','clear','next','finish'])}).strict(),
 z.object({...base,type:z.literal('hit'),index:integer}).strict(),
 z.object({...base,type:z.literal('power'),kind:z.enum(['halve','triple','wide','life','bomb','plus3','pierce','fire','lightning']),dropId:z.number().int().positive().max(MAX_CHALLENGE_EVENTS).optional()}).strict(),
 z.object({...base,type:z.literal('bomb'),target:z.string().max(50).nullable()}).strict(),
 z.object({...base,type:z.literal('crushed')}).strict(),
 z.object({...base,type:z.literal('bonus'),kind:z.enum(['plus3','pierce','fire','lightning'])}).strict()
]);
type Session={id:string;player_id:string|null;csrf_token:string};
type Challenge={id:string;session_id:string;rules_version:string;created_at:number;expires_at:number;finished_at:number|null;next_sequence:number;event_count:number;state:string;unranked:number;seed:number};
export interface AppOptions { db?:Db; dbPath?:string; origin?:string; secure?:boolean; now?:()=>number; rateLimit?:boolean; wechat?:WechatProvider }
export async function createApp(options:AppOptions={}) {
 const db=options.db||openDb(options.dbPath||process.env.DB_PATH||'../work/leaderboard.sqlite'); seedRegions(db);
 const activeRules:readonly string[]=SUPPORTED_RULES_VERSIONS;
 const bestFor=(selected:ReturnType<typeof selection>,playerId:string)=>selected.global?globalPersonalBest(db,playerId):selected.endless?endlessPersonalBest(db,playerId):personalBest(db,playerId,selected.rules);
 const historyFields=(playerId:string|null)=>{const records=playerId?historicalBests(db,playerId):[];return {historicalBest:records[0]??null,historicalBests:records};};
 const now=options.now||Date.now, origin=options.origin||process.env.PUBLIC_ORIGIN||'http://127.0.0.1:5173', secure=options.secure??process.env.NODE_ENV==='production';
 if(secure&&!origin.startsWith('https://'))throw new Error('生产PUBLIC_ORIGIN必须使用HTTPS');
 const app=Fastify({bodyLimit:256*1024,trustProxy:['127.0.0.1','::1'],logger:process.env.NODE_ENV==='production'?{level:'info',redact:['req.headers.cookie','req.headers.authorization','req.headers["x-csrf-token"]','res.headers["set-cookie"]'],serializers:{req:(r:{method:string;url:string})=>({method:r.method,path:r.url.split('?')[0]})}}:false}); await app.register(cookie);
 app.addHook('onSend',async(_request,reply,payload)=>{reply.header('cache-control','no-store').header('x-content-type-options','nosniff').header('referrer-policy','same-origin');return payload;});
 function session(req:FastifyRequest,required=true):Session|undefined {
  const authorization=req.headers.authorization;
  if(authorization&&!/^Bearer [A-Za-z0-9_-]{43}$/.test(authorization))throw new ApiError(401,'微信会话格式无效');
  const bearer=authorization?.slice(7),token=bearer||req.cookies[secure?'__Secure-qlgq':'qlgq_dev'];
  const transport=bearer?'EXISTS':'NOT EXISTS';
  const s=token&&token.length<128?db.prepare(`SELECT id,player_id,csrf_token FROM sessions WHERE session_token_hash=? AND expires_at>? AND ${transport}(SELECT 1 FROM wechat_sessions w WHERE w.session_id=sessions.id)`).get(hash(token),now()) as unknown as Session:undefined;
  if(bearer&&!s)throw new ApiError(401,'微信登录已失效，请重新登录');
  if(s&&bearer){const identity=identityForSession(db,s.id);if(identity?.player_id)s.player_id=String(identity.player_id);}

  if(!s&&required)throw new ApiError(401,'登录状态已失效，请刷新后重试'); return s||undefined;
 }
 function active(s:Session){if(!s.player_id)throw new ApiError(401,'请先登记昵称');const player=db.prepare('SELECT * FROM players WHERE id=?').get(s.player_id)!;if(player.status!=='active')throw new ApiError(403,'账号已被限制，可提交申诉');return player;}
 function rate(key:string,max:number,windowMs:number){if(options.rateLimit===false)return;const time=now();db.prepare('DELETE FROM rate_limits WHERE expires_at<=?').run(time);const r=db.prepare('INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').get(key,time+windowMs)!;if(Number(r.count)>max)throw new ApiError(429,'操作过于频繁，请稍后重试');}
 app.addHook('preHandler',async(req)=>{
  rate(`ip:${req.ip}`,600,60000);
  if(req.method==='POST'){
   if(req.url.split('?')[0]==='/api/wechat/login')return;
   if((!req.headers.authorization&&req.headers.origin!==origin)||(req.headers.origin&&req.headers.origin!==origin))throw new ApiError(403,'请求来源无效');
   const s=session(req)!;if(req.headers['x-csrf-token']!==s.csrf_token)throw new ApiError(403,'请求校验失败，请刷新后重试');
  }
 });
 app.setErrorHandler((error,_req,reply)=>{
  if(error instanceof z.ZodError)return reply.status(400).send(validationFailure(error));
  if(error instanceof ApiError)return reply.status(error.statusCode).send({message:error.message,...(error.code?{code:error.code}:{})});
  const httpError=error as { code?:string; statusCode?:number };
  if(httpError.code==='FST_ERR_CTP_BODY_TOO_LARGE')return reply.status(413).send({message:'提交内容过大'});
  if(httpError.statusCode&&httpError.statusCode<500)return reply.status(httpError.statusCode).send({message:'请求格式不正确'});
  app.log.error({err:error},'接口异常');return reply.status(503).send({message:'服务暂不可用，单机游戏不受影响'});
 });
 function challenge(req:FastifyRequest){const s=session(req)!;const cid=id.parse((req.params as {id:string}).id);const c=db.prepare('SELECT * FROM challenges WHERE id=? AND session_id=?').get(cid,s.id) as unknown as Challenge;if(!c)throw new ApiError(404,'挑战不存在或无权访问');if(c.expires_at<now())throw new ApiError(410,'挑战已过期，本次可继续单机游玩');if(!SUPPORTED_RULES_VERSIONS.includes(c.rules_version as typeof SUPPORTED_RULES_VERSIONS[number]))throw new ApiError(409,'游戏规则版本已更新，请开始新的挑战');return {s,c};}
 app.post('/api/wechat/login',async(req)=>{
  rate(`wxlogin:${req.ip}`,30,60000);
  const {code}=z.object({code:z.string().min(1).max(256)}).strict().parse(req.body);
  return wechatLogin(db,options.wechat||productionWechat(),code,now());
 });
 app.post('/api/account/link-ticket',async(req)=>{
  if(req.headers.authorization)throw new ApiError(403,'请在已登录的网页账号生成绑定凭据');
  const s=session(req)!,p=active(s);rate(`link:${s.id}`,5,3600000);
  const ticket=randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO account_link_tickets VALUES(?,?,?,?,NULL)').run(tokenHash(ticket),p.id,s.id,now()+300000);
  return {ticket,expiresAt:now()+300000};
 });
 app.post('/api/wechat/bind',async(req)=>{
  if(!req.headers.authorization)throw new ApiError(403,'请在微信小游戏中绑定');
  const s=session(req)!,{ticket}=z.object({ticket:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict().parse(req.body);
  const identity=identityForSession(db,s.id);if(!identity)throw new ApiError(403,'需要微信登录');rate(`bind:${identity.id}`,10,3600000);
  return transaction(db,()=>{
   if(identity.player_id||s.player_id)throw new ApiError(409,'微信已登记玩家，不能自动合并历史账号');
   const proof=db.prepare('SELECT t.* FROM account_link_tickets t JOIN sessions s ON s.id=t.session_id WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at>? AND s.expires_at>?').get(tokenHash(ticket),now(),now());
   if(!proof)throw new ApiError(409,'绑定凭据无效、过期或已使用');
   const player=db.prepare('SELECT status FROM players WHERE id=?').get(proof.player_id);if(player?.status!=='active')throw new ApiError(403,'玩家账号不可绑定');
   try{attachWechatPlayer(db,s.id,String(proof.player_id));}catch(error){if(String(error).includes('UNIQUE'))throw new ApiError(409,'此网页账号已绑定其他微信身份');throw error;}
   db.prepare('UPDATE account_link_tickets SET used_at=? WHERE token_hash=?').run(now(),tokenHash(ticket));
   return {id:proof.player_id};
  });
 });
 app.get('/api/health',async()=>{db.prepare('SELECT 1').get();return {ok:true,challengeProtocolVersion:CHALLENGE_PROTOCOL_VERSION,challengeFeatures:CHALLENGE_FEATURES,rulesVersion:RULES_VERSION,database:'ready',supportedRulesVersions:activeRules,leaderboard:boardMetadata};});
 app.get('/api/me',async(req,reply)=>{
  const rules=selectedRules(req);
  let s=session(req,false);
  if(!s){rate(`bootstrap:${req.ip}`,120,3600000);const token=randomBytes(32).toString('base64url');s={id:randomUUID(),player_id:null,csrf_token:randomBytes(24).toString('base64url')};db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?)').run(s.id,null,hash(token),s.csrf_token,now(),now()+90*86400000);reply.setCookie(secure?'__Secure-qlgq':'qlgq_dev',token,{path:'/api',httpOnly:true,secure,sameSite:'strict',maxAge:90*86400});}
  const p=s.player_id?db.prepare('SELECT p.id,p.nickname,p.region_code,p.region_level,p.status,r.prefix FROM players p JOIN regions r ON r.code=p.region_code WHERE p.id=?').get(s.player_id):null;
  const selected=selection(req);
  return {rulesVersion:rules,...boardOf(selected),csrfToken:s.csrf_token,player:p?{...p,display_name:`${p.prefix}·${p.nickname}`}:null,best:s.player_id?bestFor(selected,s.player_id):null,nicknameChange:s.player_id?nicknameQuota(db,s.player_id,now()):null,...(selection(req).global?historyFields(s.player_id): {})};
 });
 app.get('/api/regions',async(req)=>{const q=z.object({parent:z.string().max(32).optional(),q:z.string().max(40).default(''),offset:z.coerce.number().int().min(0).max(10000).default(0)}).parse(req.query);return searchRegions(db,q.parent,q.q,q.offset);});
 app.get('/api/regions/:code',async(req)=>{const code=z.string().max(32).parse((req.params as {code:string}).code),r=region(db,code);if(!r)throw new ApiError(404,'地区不存在');return regionView(db,r);});
 app.get('/api/players/availability',async(req)=>{
  rate(`names:${req.ip}`,120,60000);const q=z.object({nickname:z.string().max(100),region:z.string().max(32).optional()}).parse(req.query);const name=await moderateNickname(q.nickname);const self=session(req,false)?.player_id||'';
  const baseTaken=!!db.prepare('SELECT 1 FROM players WHERE normalized_nickname=? AND id<>? LIMIT 1').get(name.normalized,self);
  if(q.region&&!region(db,q.region))throw new ApiError(400,'请选择有效地区');
  const available=!q.region||!db.prepare('SELECT 1 FROM players WHERE region_code=? AND normalized_nickname=? AND id<>?').get(q.region,name.normalized,self);
  return {baseTaken,available,message:!available?'该地区的昵称已被使用，请更换地区或昵称。':baseTaken?'该昵称已有玩家使用，您可以选择其他地区标识。':'昵称可用'};
 });
 app.post('/api/players',async(req,reply)=>{
  const s=session(req)!;const input=z.object({nickname:z.string().max(100),regionCode:z.string().max(32)}).strict().parse(req.body);const name=await moderateNickname(input.nickname),r=region(db,input.regionCode);if(!r)throw new ApiError(400,'请选择有效地区');
  if(s.player_id){const p=active(s);if(p.normalized_nickname!==name.normalized||p.region_code!==r.code)throw new ApiError(409,'已绑定玩家身份，不能通过修改昵称冒领或切换账号');return {id:s.player_id};}
  rate(`register:${req.ip}`,10,3600000);
  try{return transaction(db,()=>{const current=db.prepare('SELECT player_id FROM sessions WHERE id=?').get(s.id)!;const identity=identityForSession(db,s.id);if(current.player_id||identity?.player_id)return {id:current.player_id||identity!.player_id};const pid=randomUUID();db.prepare('INSERT INTO players VALUES(?,?,?,?,?,?,?,?)').run(pid,name.nickname,name.normalized,r.code,r.level,now(),now(),'active');db.prepare('UPDATE sessions SET player_id=? WHERE id=? AND player_id IS NULL').run(pid,s.id);attachWechatPlayer(db,s.id,pid);reply.status(201);return {id:pid};});}
  catch(error){if(String(error).includes('UNIQUE constraint failed'))throw new ApiError(409,'该地区的昵称已被使用，请更换地区或昵称。');throw error;}
 });
 app.get('/api/players/nickname',async(req)=>{const p=active(session(req)!);return {nickname:p.nickname,nicknameChange:nicknameQuota(db,String(p.id),now())};});
 app.post('/api/players/nickname',async(req)=>{
  const current=session(req)!,p=active(current);rate(`rename:${p.id}`,30,3600000);
  const {nickname}=z.object({nickname:z.string().max(100)}).strict().parse(req.body),name=await moderateNickname(nickname);
  if(session(req)!.player_id!==p.id)throw new ApiError(409,'玩家身份已变化，请重新读取资料');
  return renameNickname(db,String(p.id),name,now);
 });
 app.post('/api/challenges',async(req,reply)=>{
  const s=session(req)!;if(s.player_id)active(s);rate(`challenge:${s.id}`,120,3600000);const input=z.object({rulesVersion:z.string().max(100),unranked:z.boolean().default(false),seed:z.number().int().min(0).max(4294967295).default(1)}).strict().parse(req.body);
  if(!SUPPORTED_RULES_VERSIONS.includes(input.rulesVersion as typeof SUPPORTED_RULES_VERSIONS[number]))throw new ApiError(400,'服务器不支持当前游戏规则，请更新排行榜后端；本次仍可单机游玩','UNSUPPORTED_RULES');
  const cid=randomUUID();transaction(db,()=>{db.prepare('INSERT INTO challenges(id,session_id,rules_version,created_at,expires_at,unranked,seed,mode) VALUES(?,?,?,?,?,?,?,?)').run(cid,s.id,input.rulesVersion,now(),now()+6*3600000,input.unranked?1:0,input.seed,isEndlessRules(input.rulesVersion)?'endless':'campaign');});reply.status(201);return {id:cid,expiresAt:now()+6*3600000,rulesVersion:input.rulesVersion,challengeProtocolVersion:CHALLENGE_PROTOCOL_VERSION,challengeFeatures:CHALLENGE_FEATURES};
 });
 app.post('/api/challenges/:id/events',async(req)=>{
  const {c}=challenge(req);const batch=z.object({sequence:integer,events:z.array(challengeEvent).min(1).max(256)}).strict().parse(req.body);const payload=JSON.stringify(batch.events),digest=hash(payload);
  return transaction(db,()=>{const previous=db.prepare('SELECT payload_hash FROM challenge_batches WHERE challenge_id=? AND sequence=?').get(c.id,batch.sequence);if(previous){if(previous.payload_hash!==digest)throw new ApiError(409,'重复批次内容不一致');return {nextSequence:batch.sequence+1};}if(c.state!=='open'||c.finished_at)throw new ApiError(409,'挑战已结束');if(batch.sequence!==c.next_sequence)throw new ApiError(409,'事件批次顺序错误');if(c.event_count+batch.events.length>MAX_CHALLENGE_EVENTS)throw new ApiError(413,'事件数量超限，本次成绩无法联网登记');
   db.prepare('INSERT INTO challenge_batches VALUES(?,?,?,?,?)').run(c.id,batch.sequence,payload,digest,now());const finished=batch.events.some(e=>e.type==='finish');db.prepare('UPDATE challenges SET next_sequence=next_sequence+1,event_count=event_count+?,finished_at=? WHERE id=?').run(batch.events.length,finished?now():null,c.id);return {nextSequence:batch.sequence+1};});
 });
 app.post('/api/challenges/:id/submit',async(req)=>{
  const {s,c}=challenge(req);const p=active(s);rate(`submit:${s.id}`,30,3600000);
  const input=z.object({idempotencyKey:id,summary:z.object({score:integer,reachedLevel:z.number().int().min(1).max(100),bricksDestroyed:integer,durationMs:integer,completedAllLevels:z.boolean()}).strict()}).strict().parse(req.body);const digest=hash(JSON.stringify(input));
  return transaction(db,()=>{
   const previous=db.prepare('SELECT * FROM scores WHERE challenge_id=? OR (player_id=? AND idempotency_key=?)').get(c.id,p.id,input.idempotencyKey);if(previous){if(previous.player_id!==p.id||previous.challenge_id!==c.id||previous.request_hash!==digest)throw new ApiError(409,'重复提交内容不一致');return {id:previous.id,verificationStatus:previous.verification_status,best:personalBest(db,String(p.id),c.rules_version)};}
   if(c.state!=='open'||!c.finished_at)throw new ApiError(409,'挑战尚未结束或已被替换');if(c.unranked)throw new ApiError(422,'开发压力测试成绩不能进入排行榜');
   const events=db.prepare('SELECT payload FROM challenge_batches WHERE challenge_id=? ORDER BY sequence').all(c.id).flatMap(b=>json<ChallengeEvent[]>(b.payload));const verified=verifyTrace(events,c.finished_at-c.created_at,c.seed,c.rules_version);
   if(Object.keys(verified.summary).some(key=>verified.summary[key as keyof typeof verified.summary]!==input.summary[key as keyof typeof input.summary]))throw new ApiError(422,'成绩与挑战记录不一致');
   const scoreId=randomUUID(),status=verified.suspicious.length?'quarantined':'verified';const v=verified.summary;
   db.prepare('INSERT INTO scores VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(scoreId,p.id,c.id,input.idempotencyKey,digest,v.score,v.reachedLevel,v.bricksDestroyed,v.durationMs,v.completedAllLevels?1:0,c.finished_at,now(),status,verified.suspicious.join('；'));
   db.prepare('UPDATE challenges SET state=\'submitted\' WHERE id=?').run(c.id);if(status==='verified')refreshBest(db,String(p.id),c.rules_version);return {id:scoreId,verificationStatus:status,best:personalBest(db,String(p.id),c.rules_version)};
  });
 });
 app.get('/api/leaderboard',async(req)=>{const q=z.object({offset:z.coerce.number().int().min(0).max(99).default(0),limit:z.coerce.number().int().min(1).max(20).default(20)}).parse(req.query);const limit=Math.min(q.limit,100-q.offset),selected=selection(req),read=(offset:number,size:number)=>selected.global?globalLeaderboard(db,offset,size):selected.endless?endlessLeaderboard(db,offset,size):leaderboard(db,offset,size,selected.rules),items=read(q.offset,limit),next=q.offset+items.length;return {rulesVersion:selected.rules,...boardOf(selected),items,nextOffset:next<100&&items.length===limit&&read(next,1).length?next:null};});
 app.get('/api/me/best',async(req)=>{const s=session(req)!,rules=selectedRules(req),selected=selection(req);return {rulesVersion:rules,...boardOf(selected),best:s.player_id?bestFor(selected,s.player_id):null,nicknameChange:s.player_id?nicknameQuota(db,s.player_id,now()):null,...(selection(req).global?historyFields(s.player_id): {})};});
 app.post('/api/appeals',async(req,reply)=>{const s=session(req)!;rate(`appeal:${s.id}`,3,86400000);const {message}=z.object({message:z.string().trim().min(5).max(500)}).strict().parse(req.body);const appealId=randomUUID();db.prepare('INSERT INTO appeals(id,player_id,session_id,message,created_at) VALUES(?,?,?,?,?)').run(appealId,s.player_id,s.id,message,now());reply.status(201);return {id:appealId};});
 app.addHook('onClose',async()=>{if(!options.db)db.close();});return {app,db};
}
