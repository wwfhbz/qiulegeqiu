import Fastify, { type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { openDb, transaction, json, type Db } from './db.js';
import { seedRegions, region, regionView, searchRegions } from './regions.js';
import { ApiError, moderateNickname } from './moderation.js';
import { leaderboard, personalBest, refreshBest } from './leaderboard.js';
import { verifyTrace } from './verifier.js';
import { RULES_VERSION, type ChallengeEvent } from '../../shared/Challenge.js';
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const id=z.string().uuid(), integer=z.number().int().nonnegative().max(100000000);
const base={tick:integer,level:z.number().int().min(1).max(100)};
const event=z.union([
 z.object({...base,type:z.enum(['launch','ballLost','lost','clear','next','finish'])}).strict(),
 z.object({...base,type:z.literal('hit'),index:integer}).strict(),
 z.object({...base,type:z.literal('power'),kind:z.enum(['triple','wide'])}).strict()
]);
type Session={id:string;player_id:string|null;csrf_token:string};
type Challenge={id:string;session_id:string;rules_version:string;created_at:number;expires_at:number;finished_at:number|null;next_sequence:number;event_count:number;state:string;unranked:number};
export interface AppOptions { db?:Db; dbPath?:string; origin?:string; secure?:boolean; now?:()=>number; rateLimit?:boolean }
export async function createApp(options:AppOptions={}) {
 const db=options.db||openDb(options.dbPath||process.env.DB_PATH||'../work/leaderboard.sqlite'); seedRegions(db);
 const now=options.now||Date.now, origin=options.origin||process.env.PUBLIC_ORIGIN||'http://127.0.0.1:5173', secure=options.secure??process.env.NODE_ENV==='production';
 if(secure&&!origin.startsWith('https://'))throw new Error('生产PUBLIC_ORIGIN必须使用HTTPS');
 const app=Fastify({bodyLimit:256*1024,trustProxy:['127.0.0.1','::1'],logger:false}); await app.register(cookie);
 app.addHook('onSend',async(_request,reply,payload)=>{reply.header('cache-control','no-store').header('x-content-type-options','nosniff').header('referrer-policy','same-origin');return payload;});
 function session(req:FastifyRequest,required=true):Session|undefined {
  const token=req.cookies[secure?'__Secure-qlgq':'qlgq_dev'];
  const s=token&&token.length<128?db.prepare('SELECT id,player_id,csrf_token FROM sessions WHERE session_token_hash=? AND expires_at>?').get(hash(token),now()) as unknown as Session:undefined;
  if(!s&&required)throw new ApiError(401,'登录状态已失效，请刷新后重试'); return s||undefined;
 }
 function active(s:Session){if(!s.player_id)throw new ApiError(401,'请先登记昵称');const player=db.prepare('SELECT * FROM players WHERE id=?').get(s.player_id)!;if(player.status!=='active')throw new ApiError(403,'账号已被限制，可提交申诉');return player;}
 function rate(key:string,max:number,windowMs:number){if(options.rateLimit===false)return;const time=now();db.prepare('DELETE FROM rate_limits WHERE expires_at<=?').run(time);const r=db.prepare('INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').get(key,time+windowMs)!;if(Number(r.count)>max)throw new ApiError(429,'操作过于频繁，请稍后重试');}
 app.addHook('preHandler',async(req)=>{
  rate(`ip:${req.ip}`,600,60000);
  if(req.method==='POST'){
   if(req.headers.origin!==origin)throw new ApiError(403,'请求来源无效');
   const s=session(req)!;if(req.headers['x-csrf-token']!==s.csrf_token)throw new ApiError(403,'请求校验失败，请刷新后重试');
  }
 });
 app.setErrorHandler((error,_req,reply)=>{
  if(error instanceof z.ZodError)return reply.status(400).send({message:'提交内容格式不正确'});
  if(error instanceof ApiError)return reply.status(error.statusCode).send({message:error.message});
  const httpError=error as { code?:string; statusCode?:number };
  if(httpError.code==='FST_ERR_CTP_BODY_TOO_LARGE')return reply.status(413).send({message:'提交内容过大'});
  if(httpError.statusCode&&httpError.statusCode<500)return reply.status(httpError.statusCode).send({message:'请求格式不正确'});
  app.log.error({err:error},'接口异常');return reply.status(503).send({message:'服务暂不可用，单机游戏不受影响'});
 });
 function challenge(req:FastifyRequest){const s=session(req)!;const cid=id.parse((req.params as {id:string}).id);const c=db.prepare('SELECT * FROM challenges WHERE id=? AND session_id=?').get(cid,s.id) as unknown as Challenge;if(!c)throw new ApiError(404,'挑战不存在或无权访问');if(c.expires_at<now())throw new ApiError(410,'挑战已过期，本次可继续单机游玩');if(c.rules_version!==RULES_VERSION)throw new ApiError(409,'游戏规则版本已更新，请开始新的挑战');return {s,c};}
 app.get('/api/health',async()=>({ok:true,rulesVersion:RULES_VERSION}));
 app.get('/api/me',async(req,reply)=>{
  let s=session(req,false);
  if(!s){rate(`bootstrap:${req.ip}`,120,3600000);const token=randomBytes(32).toString('base64url');s={id:randomUUID(),player_id:null,csrf_token:randomBytes(24).toString('base64url')};db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?)').run(s.id,null,hash(token),s.csrf_token,now(),now()+90*86400000);reply.setCookie(secure?'__Secure-qlgq':'qlgq_dev',token,{path:'/api',httpOnly:true,secure,sameSite:'strict',maxAge:90*86400});}
  const p=s.player_id?db.prepare('SELECT p.id,p.nickname,p.region_code,p.region_level,p.status,r.prefix FROM players p JOIN regions r ON r.code=p.region_code WHERE p.id=?').get(s.player_id):null;
  return {csrfToken:s.csrf_token,player:p?{...p,display_name:`${p.prefix}·${p.nickname}`}:null,best:s.player_id?personalBest(db,s.player_id):null};
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
  try{return transaction(db,()=>{const current=db.prepare('SELECT player_id FROM sessions WHERE id=?').get(s.id)!;if(current.player_id)return {id:current.player_id};const pid=randomUUID();db.prepare('INSERT INTO players VALUES(?,?,?,?,?,?,?,?)').run(pid,name.nickname,name.normalized,r.code,r.level,now(),now(),'active');db.prepare('UPDATE sessions SET player_id=? WHERE id=? AND player_id IS NULL').run(pid,s.id);reply.status(201);return {id:pid};});}
  catch(error){if(String(error).includes('UNIQUE constraint failed'))throw new ApiError(409,'该地区的昵称已被使用，请更换地区或昵称。');throw error;}
 });
 app.post('/api/challenges',async(req,reply)=>{
  const s=session(req)!;if(s.player_id)active(s);rate(`challenge:${s.id}`,30,3600000);const input=z.object({rulesVersion:z.literal(RULES_VERSION),unranked:z.boolean().default(false)}).strict().parse(req.body);
  const cid=randomUUID();transaction(db,()=>{db.prepare('INSERT INTO challenges(id,session_id,rules_version,created_at,expires_at,unranked) VALUES(?,?,?,?,?,?)').run(cid,s.id,input.rulesVersion,now(),now()+6*3600000,input.unranked?1:0);});reply.status(201);return {id:cid,expiresAt:now()+6*3600000,rulesVersion:RULES_VERSION};
 });
 app.post('/api/challenges/:id/events',async(req)=>{
  const {c}=challenge(req);const batch=z.object({sequence:integer,events:z.array(event).min(1).max(256)}).strict().parse(req.body);const payload=JSON.stringify(batch.events),digest=hash(payload);
  return transaction(db,()=>{const previous=db.prepare('SELECT payload_hash FROM challenge_batches WHERE challenge_id=? AND sequence=?').get(c.id,batch.sequence);if(previous){if(previous.payload_hash!==digest)throw new ApiError(409,'重复批次内容不一致');return {nextSequence:batch.sequence+1};}if(c.state!=='open'||c.finished_at)throw new ApiError(409,'挑战已结束');if(batch.sequence!==c.next_sequence)throw new ApiError(409,'事件批次顺序错误');if(c.event_count+batch.events.length>50000)throw new ApiError(413,'事件数量超限，本次成绩无法联网登记');
   db.prepare('INSERT INTO challenge_batches VALUES(?,?,?,?,?)').run(c.id,batch.sequence,payload,digest,now());const finished=batch.events.some(e=>e.type==='finish');db.prepare('UPDATE challenges SET next_sequence=next_sequence+1,event_count=event_count+?,finished_at=? WHERE id=?').run(batch.events.length,finished?now():null,c.id);return {nextSequence:batch.sequence+1};});
 });
 app.post('/api/challenges/:id/submit',async(req)=>{
  const {s,c}=challenge(req);const p=active(s);rate(`submit:${s.id}`,30,3600000);
  const input=z.object({idempotencyKey:id,summary:z.object({score:integer,reachedLevel:z.number().int().min(1).max(100),bricksDestroyed:integer,durationMs:integer,completedAllLevels:z.boolean()}).strict()}).strict().parse(req.body);const digest=hash(JSON.stringify(input));
  return transaction(db,()=>{
   const previous=db.prepare('SELECT * FROM scores WHERE challenge_id=? OR (player_id=? AND idempotency_key=?)').get(c.id,p.id,input.idempotencyKey);if(previous){if(previous.player_id!==p.id||previous.challenge_id!==c.id||previous.request_hash!==digest)throw new ApiError(409,'重复提交内容不一致');return {id:previous.id,verificationStatus:previous.verification_status,best:personalBest(db,String(p.id))};}
   if(c.state!=='open'||!c.finished_at)throw new ApiError(409,'挑战尚未结束或已被替换');if(c.unranked)throw new ApiError(422,'开发压力测试成绩不能进入排行榜');
   const events=db.prepare('SELECT payload FROM challenge_batches WHERE challenge_id=? ORDER BY sequence').all(c.id).flatMap(b=>json<ChallengeEvent[]>(b.payload));const verified=verifyTrace(events,c.finished_at-c.created_at);
   if(Object.keys(verified.summary).some(key=>verified.summary[key as keyof typeof verified.summary]!==input.summary[key as keyof typeof input.summary]))throw new ApiError(422,'成绩与挑战记录不一致');
   const scoreId=randomUUID(),status=verified.suspicious.length?'quarantined':'verified';const v=verified.summary;
   db.prepare('INSERT INTO scores VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(scoreId,p.id,c.id,input.idempotencyKey,digest,v.score,v.reachedLevel,v.bricksDestroyed,v.durationMs,v.completedAllLevels?1:0,c.finished_at,now(),status,verified.suspicious.join('；'));
   db.prepare('UPDATE challenges SET state=\'submitted\' WHERE id=?').run(c.id);if(status==='verified')refreshBest(db,String(p.id));return {id:scoreId,verificationStatus:status,best:personalBest(db,String(p.id))};
  });
 });
 app.get('/api/leaderboard',async(req)=>{const q=z.object({offset:z.coerce.number().int().min(0).max(99).default(0),limit:z.coerce.number().int().min(1).max(20).default(20)}).parse(req.query);const limit=Math.min(q.limit,100-q.offset),items=leaderboard(db,q.offset,limit);return {items,nextOffset:items.length===limit&&q.offset+limit<100?q.offset+limit:null};});
 app.get('/api/me/best',async(req)=>{const s=session(req)!;return {best:s.player_id?personalBest(db,s.player_id):null};});
 app.post('/api/appeals',async(req,reply)=>{const s=session(req)!;rate(`appeal:${s.id}`,3,86400000);const {message}=z.object({message:z.string().trim().min(5).max(500)}).strict().parse(req.body);const appealId=randomUUID();db.prepare('INSERT INTO appeals(id,player_id,session_id,message,created_at) VALUES(?,?,?,?,?)').run(appealId,s.player_id,s.id,message,now());reply.status(201);return {id:appealId};});
 app.addHook('onClose',async()=>{if(!options.db)db.close();});return {app,db};
}
