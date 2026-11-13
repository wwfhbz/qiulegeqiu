import {afterEach,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {RULES_VERSION,PREVIOUS_RULES_VERSION,type ChallengeEvent} from '../../shared/Challenge';
import {verifyTrace} from '../src/verifier';
import {createApp} from '../src/app';
const apps:Awaited<ReturnType<typeof createApp>>[]=[];
afterEach(async()=>{for(const s of apps.splice(0))await s.app.close();});
/** Real drop, pickup, score and journal callbacks; deterministic collision scheduling. */
function run(level:number,seed=4,version:1|2=2){
 const g=new Game();g.physics.brickPowerVersion=version;g.journal.seed=seed;g.physics.setSeed(seed);g.physics.reset();g.start();
 const advance=()=>{g.physics.onStep?.(C.step);g.physics.wideRemaining=Math.max(0,g.physics.wideRemaining-C.step);};
 if(level===2){for(let i=0;i<g.physics.blocks.alive.length;i++)if(g.physics.blocks.alive[i]){advance();g.physics.blocks.hit(i);}g.update(0);g.start();}
 const cells=Array.from(g.physics.blocks.alive.keys()).filter(i=>g.physics.blocks.alive[i]);let hit=0;
 for(let tick=0;tick<2200;tick++){
  advance();if(tick%5===0&&hit<200)g.physics.blocks.hit(cells[hit++]);
  const target=g.physics.powers.items.filter(p=>p.alive).sort((a,b)=>b.y-a.y)[0];
  g.physics.powers.update(C.step,target?.x??400,g.physics.paddleWidth,(kind,id)=>g.physics.collect(kind,id));
 }
 for(let life=0;life<5;life++){for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);if(g.state==='ready')g.start();}
 expect(g.state).toBe('gameOver');return g;
}
it.each([1,2])('第%i关预分配密集掉落、多球拾取与丢命的真实日志通过严格回放',level=>{
 for(const seed of [1,4,13]){const g=run(level,seed),result=verifyTrace(g.journal.events,1000000,seed,RULES_VERSION);
 expect(result.summary).toEqual(g.journal.summary(g.score.total,level,false));expect(result.suspicious).toEqual([]);
 const powers=g.journal.events.filter(e=>e.type==='power');expect(powers.length).toBeGreaterThan(10);expect(powers.some(e=>e.type==='power'&&e.kind==='triple')).toBe(true);
 expect(powers.every(e=>e.type==='power'&&(e.kind==='triple'||e.kind==='wide'))).toBe(true);
 }
});
it('错误道具类型、错误标识、重复拾取和提前拾取仍拒绝，规则标记不可中途切换',()=>{
 const g=run(1),events=g.journal.events,index=events.findIndex(e=>e.type==='power');expect(index).toBeGreaterThan(0);
 for(const change of [{kind:'wide' as const},{dropId:49000},{tick:1}]){const bad=events.map((e,i)=>i===index?{...e,...change}:e) as ChallengeEvent[];expect(()=>verifyTrace(bad,1000000,4,RULES_VERSION)).toThrow();}
 expect(()=>verifyTrace([...events.slice(0,index+1),events[index],...events.slice(index+1)],1000000,4,RULES_VERSION)).toThrow('无对应');
 expect(()=>verifyTrace(events.map((e,i)=>i===0&&e.type==='launch'?{...e,brickPowerVersion:undefined}:e),1000000,4,RULES_VERSION)).toThrow();
 const second=events.findIndex((e,i)=>i>0&&e.type==='launch');expect(()=>verifyTrace(events.map((e,i)=>i===second?{...e,brickPowerVersion:2 as const}:e),1000000,4,RULES_VERSION)).toThrow('首次');
});
it('新旧道具日志均可提交；Web与微信共享真实排名，旧成绩行保持原样，伪分和重复提交受校验',async()=>{
 let now=Date.now();const s=await createApp({dbPath:':memory:',secure:true,origin:'https://test.local',rateLimit:false,now:()=>now,wechat:{appId:'wx0000000000000000',exchange:async()=>({openid:'fixture-only'})}});apps.push(s);
 const me=await s.app.inject({url:'/api/me?board=global'}),web={cookie:'__Secure-qlgq='+me.cookies[0].value,origin:'https://test.local','x-csrf-token':me.json().csrfToken};
 expect((await s.app.inject({method:'POST',url:'/api/players',headers:web,payload:{nickname:'新手关验证玩家',regionCode:'ISO:CN'}})).statusCode).toBe(201);
 const login=(await s.app.inject({method:'POST',url:'/api/wechat/login',payload:{code:'local-fixture'}})).json(),wechat={authorization:'Bearer '+login.token,'x-csrf-token':login.csrfToken};
 const ticket=(await s.app.inject({method:'POST',url:'/api/account/link-ticket',headers:web,payload:{}})).json().ticket;
 expect((await s.app.inject({method:'POST',url:'/api/wechat/bind',headers:wechat,payload:{ticket}})).statusCode).toBe(200);
 let old:unknown,id:string|undefined;
 for(const [level,version,headers] of [[1,1,web],[1,2,web],[2,2,wechat]] as const){
  const g=run(level,4,version),summary=g.journal.summary(g.score.total,level,false);
  const created=(await s.app.inject({method:'POST',url:'/api/challenges',headers,payload:{rulesVersion:version===1?PREVIOUS_RULES_VERSION:RULES_VERSION,seed:4}})).json();expect(created.challengeFeatures).toContain('tutorial-brick-powers-v1');now+=summary.durationMs+5000;
  for(let offset=0;offset<g.journal.events.length;offset+=256){const r=await s.app.inject({method:'POST',url:`/api/challenges/${created.id}/events`,headers,payload:{sequence:offset/256,events:g.journal.events.slice(offset,offset+256)}});expect(r.statusCode,r.body).toBe(200);}
  const payload={idempotencyKey:randomUUID(),summary},submit=(body:unknown)=>s.app.inject({method:'POST',url:`/api/challenges/${created.id}/submit`,headers,payload:body});
  expect((await submit({...payload,summary:{...summary,score:summary.score+1}})).statusCode).toBe(422);
  const result=await submit(payload);expect(result.statusCode,result.body).toBe(200);expect(result.json().verificationStatus).toBe('verified');expect((await submit(payload)).json().id).toBe(result.json().id);
  if(version===1){id=result.json().id;old=s.db.prepare('SELECT * FROM scores WHERE id=?').get(id!);}
 }
 expect(s.db.prepare('SELECT * FROM scores WHERE id=?').get(id!)).toEqual(old);
 expect(s.db.prepare('SELECT COUNT(*) n FROM players').get()!.n).toBe(1);expect(s.db.prepare('SELECT COUNT(*) n FROM scores').get()!.n).toBe(3);
 const a=(await s.app.inject({url:'/api/me?board=global',headers:web})).json(),b=(await s.app.inject({url:'/api/me?board=global',headers:wechat})).json();expect(a.best).toEqual(b.best);expect(a.best.rank).toBe(1);
 expect((await s.app.inject({url:'/api/leaderboard?board=global'})).json().items).toHaveLength(1);
});
