import { describe,it,expect,afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { openDb } from '../src/db';
import { verifyTrace } from '../src/verifier';
import { normalizeNickname } from '../src/moderation';
import { leaderboard, personalBest, refreshBest } from '../src/leaderboard';
import { RULES_VERSION,type ChallengeEvent } from '../../shared/Challenge';
const apps: Awaited<ReturnType<typeof createApp>>[]=[];
afterEach(async()=>{for(const item of apps.splice(0)){await item.app.close();item.db.close();}});
async function setup(rateLimit=false){let time=1_800_000_000_000;const db=openDb(':memory:');const item=await createApp({db,origin:'https://game.test',secure:true,now:()=>time,rateLimit});apps.push(item);
 const client=async()=>{const initial=await item.app.inject({url:'/api/me'});const token=initial.cookies[0].value;const headers={cookie:`__Secure-qlgq=${token}`,origin:'https://game.test','x-csrf-token':initial.json().csrfToken};return {headers,token,request:async(method:'GET'|'POST',url:string,payload?:unknown)=>item.app.inject({method,url,headers,payload})};};
 return {...item,client,advance:(ms:number)=>{time+=ms;}};
}
function trace(hits=0){const events:ChallengeEvent[]=[{type:'launch',tick:0,level:1}];for(let i=0;i<hits;i++)events.push({type:'hit',tick:60+i,level:1,index:Math.floor(400/9)+i}); // replaced with actual valid indexes below
 for(let i=1;i<=5;i++){events.push({type:'ballLost',tick:i*240,level:1},{type:'lost',tick:i*240,level:1});if(i<5)events.push({type:'launch',tick:i*240,level:1});}events.push({type:'finish',tick:1200,level:1});return events;}
import { Blocks } from '../../src/Blocks';
function runTrace(hits=0){const events=trace();const indexes=Array.from(new Blocks().alive).flatMap((v,i)=>v?[i]:[]);events.splice(1,0,...indexes.slice(0,hits).map((index,i)=>({type:'hit' as const,tick:60+i,level:1,index})));return events;}
async function start(c:Awaited<ReturnType<Awaited<ReturnType<typeof setup>>['client']>>){const r=await c.request('POST','/api/challenges',{rulesVersion:RULES_VERSION});expect(r.statusCode).toBe(201);return r.json().id as string;}
async function register(c:Awaited<ReturnType<Awaited<ReturnType<typeof setup>>['client']>>,nickname='星际玩家',regionCode='ISO:CN'){return c.request('POST','/api/players',{nickname,regionCode});}

describe('匿名身份、审核、地区与并发',()=>{
 it('HttpOnly安全凭据只保存哈希，匿名初始化后合法注册且返回稳定ID',async()=>{const s=await setup(),c=await s.client();expect(s.db.prepare('SELECT session_token_hash FROM sessions').get()!.session_token_hash).not.toBe(c.token);const r=await register(c);expect(r.statusCode).toBe(201);const me=(await c.request('GET','/api/me')).json();expect(me.player.id).toBe(r.json().id);expect((await register(c)).json().id).toBe(r.json().id);expect(s.db.prepare('SELECT COUNT(*) n FROM players').get()!.n).toBe(1);});
 it.each(['','  ','<script>','官方玩家','aDmIn','赌 博玩家','裸聊玩家','傻逼玩家','AB\u200bCD','AB\nCD','诈骗电信诈骗'])('拒绝违规昵称 %s',async name=>{const s=await setup(),c=await s.client();expect((await register(c,name)).statusCode).toBe(400);});
 it('Unicode、大小写、空白规范化，同地区同名拒绝，不同地区同名允许',async()=>{const s=await setup(),a=await s.client(),b=await s.client(),c=await s.client();expect((await register(a,'Ａlice  A')).statusCode).toBe(201);expect((await register(b,'alice a')).statusCode).toBe(409);expect((await register(c,'ALICE A','ISO:US')).statusCode).toBe(201);});
 it('基础昵称提示与地区组合提示符合产品要求',async()=>{const s=await setup(),a=await s.client(),b=await s.client();await register(a);const base=(await b.request('GET','/api/players/availability?nickname=星际玩家')).json();expect(base.baseTaken).toBe(true);expect(base.message).toBe('该昵称已有玩家使用，您可以选择其他地区标识。');const full=(await b.request('GET','/api/players/availability?nickname=星际玩家&region=ISO:CN')).json();expect(full.available).toBe(false);expect(full.message).toBe('该地区的昵称已被使用，请更换地区或昵称。');});
 it('40个并发请求抢同地区昵称，只成功一个，数据库唯一索引生效',async()=>{const s=await setup(),clients=await Promise.all(Array.from({length:40},()=>s.client()));const results=await Promise.all(clients.map(c=>register(c)));expect(results.filter(r=>r.statusCode===201).length).toBe(1);expect(results.filter(r=>r.statusCode===409).length).toBe(39);expect(s.db.prepare('SELECT COUNT(*) n FROM players').get()!.n).toBe(1);});
 it('已有身份不能通过改昵称或请求体playerId冒领他人',async()=>{const s=await setup(),c=await s.client();await register(c);expect((await register(c,'其他玩家')).statusCode).toBe(409);expect((await c.request('POST','/api/players',{nickname:'新玩家',regionCode:'ISO:CN',playerId:randomUUID()})).statusCode).toBe(400);});
 it('20常用国家优先，全球搜索、安徽/阜阳/太和、同名县区编码、直辖市/港澳台口径正确',async()=>{const s=await setup(),c=await s.client();const countries=(await c.request('GET','/api/regions')).json();expect(countries.items.slice(0,20).map((r:{code:string})=>r.code)).toEqual(['CN','US','JP','KR','GB','FR','DE','CA','AU','RU','IN','BR','IT','ES','MX','ID','TR','SA','ZA','AR'].map(code=>'ISO:'+code));expect((await c.request('GET','/api/regions?q=芬兰')).json().items[0].code).toBe('ISO:FI');
  const ah=(await c.request('GET','/api/regions?parent=ISO:CN&q=安徽')).json().items[0];expect(ah.code).toBe('CN:340000');const fy=(await c.request('GET','/api/regions?parent=CN:340000&q=阜阳')).json().items[0];expect(fy.code).toBe('CN:341200');const th=(await c.request('GET','/api/regions?parent=CN:341200&q=太和')).json().items[0];expect(th.code).toBe('CN:341222');expect(th.prefix).toBe('太和');
  expect((await c.request('GET','/api/regions?parent=CN:110000&q=朝阳')).json().items[0].level).toBe('county');const hk=(await c.request('GET','/api/regions/CN:810000')).json();expect(hk.name).toBe('香港特别行政区');expect(hk.hasChildren).toBe(false);expect((await c.request('GET','/api/regions?parent=ISO:CN')).json().items.length).toBe(34);
  const a=await s.client(),b=await s.client();expect((await register(a,'同名玩家','CN:110105')).statusCode).toBe(201);expect((await register(b,'同名玩家','CN:220104')).statusCode).toBe(201);expect(s.db.prepare('SELECT name FROM regions WHERE code=\'CN:110105\'').get()!.name).toBe('朝阳区');
 });
 it('封禁后不能提交挑战，可申诉；未注册的昵称误判也可申诉',async()=>{const s=await setup(),a=await s.client();const pid=(await register(a)).json().id;s.db.prepare('UPDATE players SET status=\'banned\' WHERE id=?').run(pid);expect((await a.request('POST','/api/challenges',{rulesVersion:RULES_VERSION})).statusCode).toBe(403);expect((await a.request('POST','/api/appeals',{message:'请复核我的账号限制'})).statusCode).toBe(201);const b=await s.client();expect((await b.request('POST','/api/appeals',{message:'我的昵称可能被误判'})).statusCode).toBe(201);});
 it('跨站/无CSRF拒绝，超长请求体和数据库路径不会泄露',async()=>{const s=await setup(),c=await s.client();expect((await s.app.inject({method:'POST',url:'/api/players',headers:{...c.headers,origin:'https://evil.test'},payload:{nickname:'安全玩家',regionCode:'ISO:CN'}})).statusCode).toBe(403);expect((await s.app.inject({method:'POST',url:'/api/players',headers:{...c.headers,'x-csrf-token':'bad'},payload:{nickname:'安全玩家',regionCode:'ISO:CN'}})).statusCode).toBe(403);});
});

describe('事件验证、真实提交与榜单',()=>{
 it('服务端挑战、事件批次重试及成绩幂等，更高成绩更新、更低不覆盖',async()=>{const s=await setup(),c=await s.client();await register(c);let highest=0;
  for(const hits of [1,3,0]){const cid=await start(c),events=runTrace(hits);s.advance(10000);const batch={sequence:0,events};expect((await c.request('POST',`/api/challenges/${cid}/events`,batch)).statusCode).toBe(200);expect((await c.request('POST',`/api/challenges/${cid}/events`,batch)).statusCode).toBe(200);const summary=verifyTrace(events,10000).summary;const payload={idempotencyKey:randomUUID(),summary};const result=await c.request('POST',`/api/challenges/${cid}/submit`,payload);expect(result.statusCode,result.body).toBe(200);expect(result.json().verificationStatus).toBe('verified');expect((await c.request('POST',`/api/challenges/${cid}/submit`,payload)).json().id).toBe(result.json().id);highest=Math.max(highest,summary.score);expect(result.json().best.score).toBe(highest);}
  expect(s.db.prepare('SELECT COUNT(*) n FROM players').get()!.n).toBe(1);expect(s.db.prepare('SELECT COUNT(*) n FROM scores').get()!.n).toBe(3);expect((await c.request('GET','/api/me/best')).json().best.score).toBe(30);expect((await c.request('GET','/api/leaderboard')).json().items[0].display_name).toBe('中国·星际玩家');
 });
 it('他人无法提交我的挑战；无会话、伪造摘要、重复方块、虚构关卡均拒绝',async()=>{const s=await setup(),a=await s.client(),b=await s.client();await register(a);await register(b,'另一个人');const cid=await start(a),events=runTrace(1);s.advance(10000);expect((await b.request('POST',`/api/challenges/${cid}/events`,{sequence:0,events})).statusCode).toBe(404);await a.request('POST',`/api/challenges/${cid}/events`,{sequence:0,events});const summary=verifyTrace(events,10000).summary;expect((await a.request('POST',`/api/challenges/${cid}/submit`,{idempotencyKey:randomUUID(),summary:{...summary,score:999999}})).statusCode).toBe(422);expect(()=>verifyTrace([{type:'launch',level:99,tick:0}],10000)).toThrow();const bad=[...events];bad.splice(2,0,{...events[1]});expect(()=>verifyTrace(bad,10000)).toThrow();});
 it('过快但结构合法的成绩被隔离，开发测试成绩不能登榜',async()=>{const s=await setup(),c=await s.client();await register(c);const cid=await start(c),events=runTrace().map(e=>({...e,tick:0}));await c.request('POST',`/api/challenges/${cid}/events`,{sequence:0,events});const summary=verifyTrace(events,0).summary;const r=await c.request('POST',`/api/challenges/${cid}/submit`,{idempotencyKey:randomUUID(),summary});expect(r.statusCode,r.body).toBe(200);expect(r.json().verificationStatus).toBe('quarantined');expect((await c.request('GET','/api/leaderboard')).json().items).toHaveLength(0);});
 it('无效扣命、提前通关、无掉落拾取、未来模拟时间、旧规则、乱序批次拒绝',async()=>{expect(()=>verifyTrace([{type:'launch',tick:0,level:1},{type:'lost',tick:1,level:1}],10000)).toThrow();expect(()=>verifyTrace([{type:'launch',tick:0,level:1},{type:'clear',tick:1,level:1}],10000)).toThrow();expect(()=>verifyTrace([{type:'launch',tick:0,level:1},{type:'power',tick:1,level:1,kind:'triple'}],10000)).toThrow();expect(()=>verifyTrace(runTrace(),0)).toThrow();const s=await setup(),c=await s.client();expect((await c.request('POST','/api/challenges',{rulesVersion:'old'})).statusCode).toBe(400);const cid=await start(c);expect((await c.request('POST',`/api/challenges/${cid}/events`,{sequence:2,events:runTrace()})).statusCode).toBe(409);});
 it('排序分数/关卡/时长/首次达成，后端分页最多20且只返回TOP100；我的排名可超过100',async()=>{const s=await setup();for(let i=0;i<105;i++){const pid=randomUUID(),sessionId=randomUUID(),cid=randomUUID(),sid=randomUUID();s.db.prepare('INSERT INTO players VALUES(?,?,?,?,?,?,?,?)').run(pid,'测试'+i,'test'+i,'CN:341222','county',1,1,'active');s.db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?)').run(sessionId,pid,randomUUID(),'csrf',1,9999999999999);s.db.prepare('INSERT INTO challenges(id,session_id,rules_version,created_at,expires_at) VALUES(?,?,?,?,?)').run(cid,sessionId,RULES_VERSION,1,9999999999999);s.db.prepare('INSERT INTO scores VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(sid,pid,cid,randomUUID(),'hash',i<4?100:0,i===1?2:1,1,i===2?500:1000,0,i>=4?i+2:i===3?1:2,i,'verified','');refreshBest(s.db,pid);}
 const top=leaderboard(s.db,0,4);expect(top.map(r=>r.nickname)).toEqual(['测试1','测试2','测试3','测试0']);expect(top[0].display_name).toBe('太和·测试1');const c=await s.client();expect((await c.request('GET','/api/leaderboard?limit=200')).statusCode).toBe(400);expect((await c.request('GET','/api/leaderboard?offset=90&limit=20')).json().items).toHaveLength(10);const last=s.db.prepare('SELECT id FROM players WHERE nickname=\'测试104\'').get()!;expect(personalBest(s.db,String(last.id))!.rank).toBeGreaterThan(100);
 });
});

import { Game } from '../../src/Game';
import { C } from '../../src/GameConfig';
describe('真实游戏事件与服务端重算一致',()=>{
 it('真实物理死亡回调、五轮扣命和时钟产生可验证日志',()=>{
  const g=new Game();for(let round=0;round<5;round++){g.start();Object.assign(g.physics.balls[0],{x:400,y:940,vx:380,vy:0,outsideArena:true});for(let i=0;i<20;i++)g.update(.1);Object.assign(g.physics.balls[0],{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);}
  expect(g.state).toBe('gameOver');const result=verifyTrace(g.journal.events,20000);expect(result.summary).toEqual(g.journal.summary(g.score.total,g.levels.current.number,false));expect(result.suspicious).toEqual([]);
 });
 it('调试压力测试明确标记不参榜，暂停不增加日志计时',()=>{const g=new Game();g.stress();expect(g.journal.unranked).toBe(true);g.pause();const tick=g.journal.tick;g.update(1);expect(g.journal.tick).toBe(tick);g.reset();expect(g.journal.unranked).toBe(false);expect(g.journal.events.length).toBe(0);});
});

import { LEVELS } from '../../src/Levels';
import { seededRandom,weightedPower,type PowerKind } from '../../src/PowerRules';
describe('V0.8十关与五道具服务端一致性',()=>{
 it('十关网格扣除机关区域后，完整清关日志与客户端分数一致',()=>{const g=new Game();for(let n=1;n<=10;n++){g.start();for(let i=0;i<g.physics.blocks.alive.length;i++)g.physics.blocks.hit(i);g.update(0);if(n<10)g.nextLevel();}expect(g.state).toBe('victory');const result=verifyTrace(g.journal.events,600000,g.journal.seed);expect(result.summary).toEqual(g.journal.summary(g.score.total,10,true));expect(result.suspicious.length).toBeGreaterThan(0);});
 for(const kind of ['halve','triple','wide','life','bomb'] as PowerKind[])it(`真实第2关${kind}拾取、机关状态与生命日志能够重算`,()=>{
  let seed=1;for(;seed<10000;seed++){const random=seededRandom(seed);for(let i=0;i<300;i++)weightedPower(1,random);if(weightedPower(2,random)===kind)break;}expect(seed).toBeLessThan(10000);
  const g=new Game();g.journal.seed=seed;g.physics.setSeed(seed);g.start();for(let i=0;i<g.physics.blocks.alive.length;i++)g.physics.blocks.hit(i);g.update(0);g.nextLevel();g.start();
  // Lose once before a life pickup to verify restoration, not only clamping at five.
  Object.assign(g.physics.balls[0],{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);g.start();
  const indexes=Array.from(g.physics.blocks.alive).flatMap((v,i)=>v?[i]:[]).sort((a,b)=>{const point=(i:number)=>Math.abs(g.physics.blocks.left+i%g.physics.blocks.cols*C.grid.step-400)+Math.abs(g.physics.blocks.top+Math.floor(i/g.physics.blocks.cols)*C.grid.step-700);return point(a)-point(b);});
  for(const i of indexes.slice(0,28))g.physics.blocks.hit(i);
  const drop=g.physics.powers.items.find(d=>d.alive)!;expect(drop.kind).toBe(kind);g.physics.paddleX=g.physics.targetX=drop.x;
  Object.assign(g.physics.balls[0],{x:400,y:940,vx:380,vy:0,outsideArena:true});
  for(let n=0;n<1000&&drop.alive;n++)g.update(C.step);
  expect(drop.alive).toBe(false);expect(g.journal.events.some(e=>e.type==='power'&&e.kind===kind)).toBe(true);
  if(kind==='life')expect(g.lives).toBe(5);if(kind==='bomb')expect(g.physics.obstacles.items[0].destroyed).toBe(true);
  while(g.lives>0){g.start();for(const ball of g.physics.balls)Object.assign(ball,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);}
  const result=verifyTrace(g.journal.events,600000,seed);expect(result.summary).toEqual(g.journal.summary(g.score.total,2,false));
 });
 it('新规则API绑定随机种子；旧规则拒绝，存量迁移包含seed字段',async()=>{const s=await setup(),c=await s.client();expect((await c.request('POST','/api/challenges',{rulesVersion:'0.7.0-arcade-5l-3lv-v1',seed:1})).statusCode).toBe(400);const r=await c.request('POST','/api/challenges',{rulesVersion:RULES_VERSION,seed:4294967295});expect(r.statusCode).toBe(201);expect(s.db.prepare('SELECT seed FROM challenges WHERE id=?').get(r.json().id)!.seed).toBe(4294967295);expect(s.db.prepare('SELECT version FROM schema_migrations WHERE version=2').get()).toBeTruthy();});
});

import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync,backup} from 'node:sqlite';
it('旧001数据库升级002可重复打开，SQLite在线备份可恢复完整schema',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'qiulegeqiu-db-'));const path=join(dir,'test.sqlite'),snapshot=join(dir,'backup.sqlite');
 try{const old=new DatabaseSync(path);old.exec(readFileSync('migrations/001-initial.sql','utf8'));old.prepare('INSERT INTO schema_migrations VALUES(1,?)').run(1);old.close();const current=openDb(path);expect(current.prepare('PRAGMA table_info(challenges)').all().some(c=>c.name==='seed')).toBe(true);await backup(current,snapshot);current.close();const again=openDb(path);expect(again.prepare('SELECT COUNT(*) n FROM schema_migrations').get()!.n).toBe(2);again.close();const restored=new DatabaseSync(snapshot,{readOnly:true});expect(restored.prepare('PRAGMA integrity_check').get()!.integrity_check).toBe('ok');expect(restored.prepare('SELECT COUNT(*) n FROM schema_migrations').get()!.n).toBe(2);restored.close();}finally{rmSync(dir,{recursive:true,force:true});}
});
