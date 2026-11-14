import {it,expect,afterEach} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createApp} from '../src/app';
import {refreshBest,globalLeaderboard,globalPersonalBest} from '../src/leaderboard';
import {GLOBAL_BOARD_COMPAT_VERSION,RULES_VERSION,LEGACY_RULES_VERSION,type ChallengeEvent} from '../../shared/Challenge';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {verifyTrace} from '../src/verifier';
import {LEGACY_LEVELS} from '../../src/LegacyLevels';
import {LevelManager} from '../../src/LevelManager';
const apps:Awaited<ReturnType<typeof createApp>>[]=[];
afterEach(async()=>{for(const s of apps.splice(0))await s.app.close();});
async function setup(){let clock=Date.now();const s=await createApp({dbPath:':memory:',secure:true,origin:'https://test.local',rateLimit:false,now:()=>clock,wechat:{appId:'wx0000000000000000',exchange:async code=>({openid:code.split(':')[0]})}});apps.push(s);return {...s,advance:(ms=12000)=>{clock+=ms;}};}
async function web(s:Awaited<ReturnType<typeof setup>>){const r=await s.app.inject({url:'/api/me?board=global'});return {cookie:'__Secure-qlgq='+r.cookies[0].value,origin:'https://test.local','x-csrf-token':r.json().csrfToken};}
function record(s:Awaited<ReturnType<typeof setup>>,p:string,score:number,level=1,duration=1000,time=1,rules=RULES_VERSION,status='verified',unranked=0){const session=randomUUID(),challenge=randomUUID(),id=randomUUID();s.db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?)').run(session,p,randomUUID(),'csrf',1,9999999999999);s.db.prepare('INSERT INTO challenges(id,session_id,rules_version,created_at,expires_at,unranked) VALUES(?,?,?,?,?,?)').run(challenge,session,rules,1,9999999999999,unranked);s.db.prepare('INSERT INTO scores VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,p,challenge,randomUUID(),'digest',score,level,1,duration,0,time,time,status,'');return id;}
function player(s:Awaited<ReturnType<typeof setup>>,n:number){const p=randomUUID();s.db.prepare('INSERT INTO players VALUES(?,?,?,?,?,?,?,?)').run(p,'全球玩家'+n,'global'+n,'CN:341222','county',1,1,'active');return p;}
it('统一榜单与真实个人排名一致，按玩家最高有效记录去重，TOP100分页与末页正确',async()=>{
 const s=await setup();const ids=Array.from({length:105},(_,i)=>player(s,i));
 for(let i=0;i<ids.length;i++)record(s,ids[i],105-i);
 record(s,ids[0],0);record(s,ids[104],999999,12,1,1,RULES_VERSION,'quarantined');record(s,ids[104],999998,12,1,1,RULES_VERSION,'verified',1);
 const legacyId=record(s,ids[104],999997,10,1,1,LEGACY_RULES_VERSION);refreshBest(s.db,ids[104],LEGACY_RULES_VERSION);
 const snapshot=s.db.prepare('SELECT * FROM scores ORDER BY id').all(),oldPointer=s.db.prepare('SELECT * FROM player_bests').all();
 const result=await s.app.inject({url:'/api/leaderboard?board=global&limit=20'});expect(result.json().board).toBe('global');expect(result.json().rankingRulesVersion).toBe(GLOBAL_BOARD_COMPAT_VERSION);expect(result.json().items.map((r:{rank:number})=>r.rank)).toEqual(Array.from({length:20},(_,i)=>i+1));
 const all=[];let offset:number|null=0;while(offset!==null){const page=(await s.app.inject({url:`/api/leaderboard?board=global&limit=20&offset=${offset}`})).json();all.push(...page.items);offset=page.nextOffset;}expect(all).toHaveLength(100);expect(new Set(all.map(r=>r.player_id)).size).toBe(100);
 for(const row of all)expect(globalPersonalBest(s.db,row.player_id)!.rank).toBe(row.rank);
 expect(globalPersonalBest(s.db,ids[104])).toMatchObject({score:999997,rank:1});expect(globalPersonalBest(s.db,ids[103])).toMatchObject({score:2,rank:105});
 const headers=await web(s),session=s.db.prepare('SELECT id FROM sessions WHERE csrf_token=?').get(headers['x-csrf-token'])!;s.db.prepare('UPDATE sessions SET player_id=? WHERE id=?').run(ids[104],session.id);
 const me=(await s.app.inject({url:'/api/me?board=global',headers})).json();expect(me.best.rank).toBe(1);expect(me.historicalBest.id).toBe(legacyId);expect((await s.app.inject({url:'/api/me/best?board=global',headers})).json().best.rank).toBe(1);
 expect(s.db.prepare('SELECT * FROM scores ORDER BY id').all()).toEqual(snapshot);expect(s.db.prepare('SELECT * FROM player_bests').all()).toEqual(oldPointer);
 expect((await s.app.inject({url:'/api/leaderboard?board=global&offset=100'})).statusCode).toBe(400);
 expect((await s.app.inject({url:'/api/leaderboard?board=global&rulesVersion='+LEGACY_RULES_VERSION})).statusCode).toBe(200);
});
it('并列分按关卡、用时、首次达成、稳定ID排序，个人排名不错误固定为1',async()=>{
 const s=await setup(),ps=Array.from({length:5},(_,i)=>player(s,i));
 record(s,ps[0],100,1,1000,10);record(s,ps[1],100,2,1000,10);record(s,ps[2],100,1,500,10);record(s,ps[3],100,1,1000,5);record(s,ps[4],100,1,1000,10);
 const board=globalLeaderboard(s.db,0,20);expect(board.slice(0,3).map(r=>r.player_id)).toEqual([ps[1],ps[2],ps[3]]);expect(board.slice(3).map(r=>r.id)).toEqual(board.slice(3).map(r=>r.id).sort());
 expect(globalLeaderboard(s.db,0,20)).toEqual(board);for(const row of board)expect(globalPersonalBest(s.db,String(row.player_id))!.rank).toBe(row.rank);
 s.db.prepare("UPDATE players SET status='banned' WHERE id=?").run(ps[1]);expect(globalLeaderboard(s.db,0,1)[0].rank).toBe(1);expect(globalPersonalBest(s.db,ps[1])).toBeNull();
});
function run(hits=1){const g=new Game();for(let round=0;round<5;round++){g.start();if(!round){let n=hits;for(let i=0;i<g.physics.blocks.alive.length&&n;i++)if(g.physics.blocks.alive[i]){g.physics.blocks.hit(i);n--;}}Object.assign(g.physics.balls[0],{x:400,y:940,vx:380,vy:0,outsideArena:true});for(let n=0;n<20;n++)g.update(.1);Object.assign(g.physics.balls[0],{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);}return g;}
it('新版十二关真实日志可提交，微信绑定同一网页玩家并共享最高分，重复提交幂等且伪分/越权拒绝',async()=>{
 const s=await setup(),wh=await web(s);const p=await s.app.inject({method:'POST',url:'/api/players',headers:wh,payload:{nickname:'跨端最高玩家',regionCode:'ISO:CN'}});expect(p.statusCode).toBe(201);
 const login=(await s.app.inject({method:'POST',url:'/api/wechat/login',payload:{code:'same:first'}})).json(),wx={authorization:'Bearer '+login.token,'x-csrf-token':login.csrfToken};
 const ticket=(await s.app.inject({method:'POST',url:'/api/account/link-ticket',headers:wh,payload:{}})).json().ticket;expect((await s.app.inject({method:'POST',url:'/api/wechat/bind',headers:wx,payload:{ticket}})).statusCode).toBe(200);
 for(const [headers,hits] of [[wh,1],[wx,3],[wh,0]] as const){const g=run(hits),cid=(await s.app.inject({method:'POST',url:'/api/challenges',headers,payload:{rulesVersion:RULES_VERSION,seed:g.journal.seed}})).json().id;s.advance();expect((await s.app.inject({method:'POST',url:`/api/challenges/${cid}/events`,headers,payload:{sequence:0,events:g.journal.events}})).statusCode).toBe(200);
 const payload={idempotencyKey:randomUUID(),summary:g.journal.summary(g.score.total,1,false)};
 expect((await s.app.inject({method:'POST',url:`/api/challenges/${cid}/submit`,headers,payload:{...payload,summary:{...payload.summary,score:999999}}})).statusCode).toBe(422);
 const submit=()=>s.app.inject({method:'POST',url:`/api/challenges/${cid}/submit`,headers,payload});expect((await submit()).json().verificationStatus).toBe('verified');expect((await submit()).statusCode).toBe(200);
 const stranger=await web(s);expect((await s.app.inject({method:'POST',url:`/api/challenges/${cid}/events`,headers:stranger,payload:{sequence:0,events:g.journal.events}})).statusCode).toBe(404);}
 expect(s.db.prepare('SELECT COUNT(*) n FROM players').get()!.n).toBe(1);expect(s.db.prepare('SELECT COUNT(*) n FROM scores').get()!.n).toBe(3);
 const browser=(await s.app.inject({url:'/api/me?board=global',headers:wh})).json(),mini=(await s.app.inject({url:'/api/me?board=global',headers:wx})).json();expect(browser.best).toEqual(mini.best);expect(browser.best.score).toBe(30);expect(browser.best.rank).toBe(1);
 expect((await s.app.inject({url:'/api/leaderboard?board=global'})).json().items).toHaveLength(1);
});
it('不支持规则明确返回错误码，health报告十二关能力，查询异常不伪装成赛季错误',async()=>{const s=await setup(),headers=await web(s);const r=await s.app.inject({method:'POST',url:'/api/challenges',headers,payload:{rulesVersion:'unknown'}});expect(r.statusCode).toBe(400);expect(r.json().code).toBe('UNSUPPORTED_RULES');expect((await s.app.inject({url:'/api/health'})).json().supportedRulesVersions).toContain(RULES_VERSION);expect((await s.app.inject({url:'/api/leaderboard?board=wrong'})).statusCode).toBe(400);});
it('零球不能继续拾取生命/三倍球，不能通过构造请求抵消扣命',()=>{
 for(const kind of ['life','triple'] as const){let seed=1;const g=new Game(undefined,undefined,new LevelManager(LEGACY_LEVELS));
 // Replay only needs one valid drop. Find a seed producing desired kind at legacy level 2.
 for(;seed<10000;seed++){const random=seededRandom(seed);for(let i=0;i<300;i++)weightedPower(1,random);if(weightedPower(2,random)===kind)break;}
 g.physics.tripleRuleVersion=1;g.journal.seed=seed;g.physics.setSeed(seed);g.start();for(let i=0;i<g.physics.blocks.alive.length;i++)g.physics.blocks.hit(i);g.update(0);g.nextLevel();g.start();let n=28;for(let i=0;i<g.physics.blocks.alive.length&&n;i++)if(g.physics.blocks.alive[i]){g.physics.blocks.hit(i);n--;}
 const events:ChallengeEvent[]=g.journal.events.map(e=>({...e}));const tick=g.journal.tick+1000;events.push({type:'ballLost',level:2,tick},{type:'power',kind,level:2,tick});expect(()=>verifyTrace(events,600000,seed,LEGACY_RULES_VERSION)).toThrow('道具拾取状态无效');
 }
});
import {seededRandom,weightedPower} from '../../src/PowerRules';
it('恰好20名的末页不能提供空下一页',async()=>{const s=await setup();for(let n=0;n<20;n++)record(s,player(s,n),n);const page=(await s.app.inject({url:'/api/leaderboard?board=global&limit=20'})).json();expect(page.items).toHaveLength(20);expect(page.nextOffset).toBeNull();});
it('SQLite关闭重开后统一榜成绩、真实名次与玩家会话仍保持',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'qq13-persist-')),path=join(dir,'board.sqlite');let current:Awaited<ReturnType<typeof createApp>>|undefined;
 try{current=await createApp({dbPath:path,secure:true,origin:'https://test.local'});const wrapped={...current,advance:()=>{}},headers=await web(wrapped);const p=(await current.app.inject({method:'POST',url:'/api/players',headers,payload:{nickname:'统一榜持久玩家',regionCode:'ISO:CN'}})).json();record(wrapped,p.id,1234);await current.app.close();current=await createApp({dbPath:path,secure:true,origin:'https://test.local'});const me=(await current.app.inject({url:'/api/me?board=global',headers})).json();expect(me.player.id).toBe(p.id);expect(me.best).toMatchObject({score:1234,rank:1});expect((await current.app.inject({url:'/api/leaderboard?board=global'})).json().items[0].player_id).toBe(p.id);expect(current.db.prepare('SELECT COUNT(*) n FROM players').get()!.n).toBe(1);
 }finally{if(current)await current.app.close();rmSync(dir,{recursive:true,force:true});}
});
import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
