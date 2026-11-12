import {it,expect,afterEach} from 'vitest';
import {createApp} from '../src/app';
import {Game} from '../../src/Game';
import {LevelManager} from '../../src/LevelManager';
import {LEGACY_LEVELS} from '../../src/LegacyLevels';
import {C} from '../../src/GameConfig';
import {RULES_VERSION,LEGACY_RULES_VERSION} from '../../shared/Challenge';
import {verifyTrace} from '../src/verifier';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {openDb} from '../src/db';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {seedRegions} from '../src/regions';
const apps:Awaited<ReturnType<typeof createApp>>[]=[];afterEach(async()=>{for(const s of apps.splice(0))await s.app.close();});
async function setup(){let clock=Date.now();const s=await createApp({dbPath:':memory:',secure:true,origin:'https://test.local',rateLimit:false,now:()=>clock});apps.push(s);return {...s,advance:()=>{clock+=12000;}};}
async function client(s:Awaited<ReturnType<typeof setup>>,nickname:string){const r=await s.app.inject({url:'/api/me'}),headers={cookie:'__Secure-qlgq='+r.cookies[0].value,origin:'https://test.local','x-csrf-token':r.json().csrfToken};const p=await s.app.inject({method:'POST',url:'/api/players',headers,payload:{nickname,regionCode:'ISO:CN'}});expect(p.statusCode).toBe(201);return {headers,pid:p.json().id};}
function trace(rules:string,hits:number){const g=rules===LEGACY_RULES_VERSION?new Game(undefined,undefined,new LevelManager(LEGACY_LEVELS)):new Game();if(rules===LEGACY_RULES_VERSION)g.physics.tripleRuleVersion=1;for(let round=0;round<5;round++){g.start();if(!round){let n=hits;for(let i=0;i<g.physics.blocks.alive.length&&n;i++)if(g.physics.blocks.alive[i]){g.physics.blocks.hit(i);n--;}}Object.assign(g.physics.balls[0],{x:400,y:940,vx:380,vy:0,outsideArena:true});for(let n=0;n<20;n++)g.update(.1);Object.assign(g.physics.balls[0],{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);}expect(g.state).toBe('gameOver');return g;}
async function submit(s:Awaited<ReturnType<typeof setup>>,c:Awaited<ReturnType<typeof client>>,rules:string,hits:number){const g=trace(rules,hits);const created=await s.app.inject({method:'POST',url:'/api/challenges',headers:c.headers,payload:{rulesVersion:rules,seed:g.journal.seed}});expect(created.statusCode,created.body).toBe(201);expect(created.json().rulesVersion).toBe(rules);const cid=created.json().id;s.advance();const batch=await s.app.inject({method:'POST',url:`/api/challenges/${cid}/events`,headers:c.headers,payload:{sequence:0,events:g.journal.events}});expect(batch.statusCode,batch.body).toBe(200);const input={idempotencyKey:randomUUID(),summary:g.journal.summary(g.score.total,g.levels.current.number,false)};const response=await s.app.inject({method:'POST',url:`/api/challenges/${cid}/submit`,headers:c.headers,payload:input});expect(response.statusCode,response.body).toBe(200);expect(response.json().verificationStatus).toBe('verified');return {response,cid,input};}
it('旧客户端无查询参数仍读旧榜，新十二关按规则隔离，同一玩家双最佳不覆盖',async()=>{
 const s=await setup(),c=await client(s,'双赛季玩家');const old=await submit(s,c,LEGACY_RULES_VERSION,3),snapshot=s.db.prepare('SELECT * FROM scores WHERE id=?').get(old.response.json().id),pointer=s.db.prepare('SELECT * FROM player_bests WHERE player_id=?').get(c.pid);
 await submit(s,c,RULES_VERSION,1);await submit(s,c,RULES_VERSION,0);
 expect(s.db.prepare('SELECT * FROM scores WHERE id=?').get(old.response.json().id)).toEqual(snapshot);expect(s.db.prepare('SELECT * FROM player_bests WHERE player_id=?').get(c.pid)).toEqual(pointer);
 const legacy=(await s.app.inject({url:'/api/leaderboard'})).json().items,current=(await s.app.inject({url:'/api/leaderboard?rulesVersion='+RULES_VERSION})).json().items;expect(legacy).toHaveLength(1);expect(current).toHaveLength(1);expect(legacy[0].score).toBe(30);expect(current[0].score).toBe(10);
 expect((await s.app.inject({url:'/api/me',headers:c.headers})).json().best.score).toBe(30);expect((await s.app.inject({url:'/api/me?rulesVersion='+RULES_VERSION,headers:c.headers})).json().best.score).toBe(10);
 const b=await client(s,'新赛季领先者');await submit(s,b,RULES_VERSION,3);expect((await s.app.inject({url:'/api/me/best?rulesVersion='+RULES_VERSION,headers:c.headers})).json().best.rank).toBe(2);expect((await s.app.inject({url:'/api/me/best',headers:c.headers})).json().best.rank).toBe(1);
});
it('已上线旧规则继续创建、上传、提交；新客户端不能伪报旧规则过验证',async()=>{
 const s=await setup(),c=await client(s,'版本校验玩家');await submit(s,c,LEGACY_RULES_VERSION,1);const g=trace(RULES_VERSION,1);expect(()=>verifyTrace(g.journal.events,12000,g.journal.seed,RULES_VERSION)).not.toThrow();expect(()=>verifyTrace(g.journal.events,12000,g.journal.seed,'unknown')).toThrow();
 // Index from the old dense grid is not valid in the new coarse tutorial grid.
 const legacy=trace(LEGACY_RULES_VERSION,1),fresh=new Game();const index=legacy.physics.blocks.alive.findIndex((v,i)=>!!v&&!fresh.physics.blocks.alive[i]);const event=legacy.journal.events.find(e=>e.type==='hit')!;if(event.type==='hit')event.index=index;expect(index).toBeGreaterThanOrEqual(0);expect(()=>verifyTrace(legacy.journal.events,12000,legacy.journal.seed,RULES_VERSION)).toThrow();
 expect((await s.app.inject({url:'/api/leaderboard?rulesVersion=unknown'})).statusCode).toBe(400);expect((await s.app.inject({url:'/api/me?rulesVersion=unknown'})).statusCode).toBe(400);
});
it('十二关完整日志在新规则验证成功，在旧十关规则下拒绝',()=>{const g=new Game();for(let n=1;n<=12;n++){g.start();for(let i=0;i<g.physics.blocks.alive.length;i++)g.physics.blocks.hit(i);g.update(0);if(n>2&&n<12)g.nextLevel();}expect(g.state).toBe('victory');const v=verifyTrace(g.journal.events,3600000,g.journal.seed,RULES_VERSION);expect(v.summary.reachedLevel).toBe(12);expect(v.summary.completedAllLevels).toBe(true);expect(v.summary.score).toBe(g.score.total);expect(()=>verifyTrace(g.journal.events,3600000,g.journal.seed,LEGACY_RULES_VERSION)).toThrow();});
it('004迁移幂等，只追加赛季表，原scores和player_bests数据完全不变',()=>{
 const dir=mkdtempSync(join(tmpdir(),'qq12-migration-')),path=join(dir,'board.sqlite');
 try{const old=new DatabaseSync(path);for(const [n,file] of [[1,'001-initial.sql'],[2,'002-challenge-seed.sql'],[3,'003-wechat.sql']] as const){old.exec(readFileSync('migrations/'+file,'utf8'));old.prepare('INSERT INTO schema_migrations VALUES(?,?)').run(n,1);}seedRegions(old);
 old.prepare('INSERT INTO players VALUES(?,?,?,?,?,?,?,?)').run('player','历史玩家','历史玩家','ISO:CN','country',1,1,'active');old.prepare('INSERT INTO sessions VALUES(?,?,?,?,?,?)').run('session','player','hash','csrf',1,9999999999999);old.prepare('INSERT INTO challenges(id,session_id,rules_version,created_at,expires_at) VALUES(?,?,?,?,?)').run('challenge','session',LEGACY_RULES_VERSION,1,9999999999999);old.prepare('INSERT INTO scores VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('score','player','challenge','key','digest',12345,10,4203,200000,1,1,1,'verified','');old.prepare('INSERT INTO player_bests VALUES(?,?)').run('player','score');const before=old.prepare('SELECT * FROM scores').all();old.close();
 for(let n=0;n<2;n++){const db=openDb(path);expect(db.prepare('SELECT * FROM scores').all()).toEqual(before);expect(db.prepare('SELECT * FROM player_bests').all()).toEqual([{player_id:'player',score_id:'score'}]);expect(db.prepare('SELECT COUNT(*) n FROM season_player_bests').get()!.n).toBe(0);expect(db.prepare('SELECT COUNT(*) n FROM schema_migrations').get()!.n).toBe(4);db.close();}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
