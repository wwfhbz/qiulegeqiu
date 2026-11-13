import {afterEach,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {descentInterval} from '../../src/endless/EndlessRules';
import {ENDLESS_RULES_VERSION,RULES_VERSION,type ChallengeEvent} from '../../shared/Challenge';
import {verifyTrace} from '../src/verifier';
import {createApp} from '../src/app';
const apps:Awaited<ReturnType<typeof createApp>>[]=[];
afterEach(async()=>{for(const s of apps.splice(0))await s.app.close();});

/**
 * Real endless callbacks (field descent, hits, seeded drops, pickups, lightning) with scripted contacts:
 * each tick follows Physics.update's order — journal tick, wall descent, then contacts and pickups.
 */
function run(seed:number,ticks=9000,spacing=6){
 const g=new Game();g.setMode('endless');g.journal.seed=seed;g.physics.setSeed(seed);g.physics.reset();g.start();
 const p=g.physics,field=p.endless!;
 for(let t=1;t<=ticks;t++){
  p.onStep?.(C.step);field.tick();
  if(t%spacing===0){const alive=Array.from(field.alive.keys()).filter(i=>field.alive[i]);if(alive.length)field.hit(alive[(t*7919)%alive.length]);}
  const target=p.powers.items.filter(d=>d.alive).sort((a,b)=>b.y-a.y)[0];
  p.powers.update(C.step,target?.x??400,p.paddleWidth,(kind,id)=>p.collect(kind,id));
 }
 for(let life=0;life<5&&g.state!=='gameOver';life++){for(const b of p.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);if(g.state==='ready')g.start();}
 expect(g.state).toBe('gameOver');return g;
}
it('无尽模式真实日志：服务端按同一种子重建下沉砖墙，分数、阶段、击碎数完全一致',()=>{
 for(const seed of [3,21]){const g=run(seed),result=verifyTrace(g.journal.events,1e9,seed,ENDLESS_RULES_VERSION);
  expect(result.summary).toEqual(g.journal.summary(g.score.total,g.reachedLevel,false));expect(result.suspicious).toEqual([]);
  expect(g.physics.endless!.descents).toBeGreaterThanOrEqual(Math.floor(9000/descentInterval(0)));
  expect(g.journal.events.filter(e=>e.type==='power').length).toBeGreaterThan(5);}
});
it('伪造：未出现的砖、重复击碎、错误种子、闯关事件、伪造道具均被拒绝；闯关日志不能冒充无尽',()=>{
 const g=run(3),events=g.journal.events,index=events.findIndex(e=>e.type==='hit'),hit=events[index] as Extract<ChallengeEvent,{type:'hit'}>;
 const future=events.map((e,i)=>i===index?{...hit,index:hit.index+100*45}:e);expect(()=>verifyTrace(future,1e9,3,ENDLESS_RULES_VERSION)).toThrow('方块不存在');
 expect(()=>verifyTrace([...events.slice(0,index+1),events[index],...events.slice(index+1)],1e9,3,ENDLESS_RULES_VERSION)).toThrow('方块不存在');
 expect(()=>verifyTrace(events,1e9,4,ENDLESS_RULES_VERSION)).toThrow();
 expect(()=>verifyTrace([...events.slice(0,-1),{type:'clear',tick:events.at(-1)!.tick,level:1},events.at(-1)!],1e9,3,ENDLESS_RULES_VERSION)).toThrow();
 const power=events.findIndex(e=>e.type==='power');expect(power).toBeGreaterThan(0);
 expect(()=>verifyTrace(events.map((e,i)=>i===power?{...e,dropId:49999}:e) as ChallengeEvent[],1e9,3,ENDLESS_RULES_VERSION)).toThrow('无对应');
 const campaign=new Game();campaign.start();expect(()=>verifyTrace(campaign.journal.events,1e9,campaign.journal.seed,ENDLESS_RULES_VERSION)).toThrow();
});
it('API：无尽成绩进无尽榜、不进闯关全球榜；个人最佳分开记录；伪分拒绝',async()=>{
 let now=Date.now();const s=await createApp({dbPath:':memory:',secure:true,origin:'https://test.local',rateLimit:false,now:()=>now});apps.push(s);
 const health=(await s.app.inject({url:'/api/health'})).json();expect(health.supportedRulesVersions).toContain(ENDLESS_RULES_VERSION);
 const me=await s.app.inject({url:'/api/me?board=endless'}),headers={cookie:'__Secure-qlgq='+me.cookies[0].value,origin:'https://test.local','x-csrf-token':me.json().csrfToken};
 expect(me.json()).toMatchObject({board:'endless',rankingRulesVersion:ENDLESS_RULES_VERSION,best:null});
 await s.app.inject({method:'POST',url:'/api/players',headers,payload:{nickname:'无尽测试',regionCode:'ISO:CN'}});
 const g=run(3),summary=g.journal.summary(g.score.total,g.reachedLevel,false);
 const created=await s.app.inject({method:'POST',url:'/api/challenges',headers,payload:{rulesVersion:ENDLESS_RULES_VERSION,seed:3}});expect(created.statusCode,created.body).toBe(201);const cid=created.json().id;now+=summary.durationMs+5000;
 for(let offset=0;offset<g.journal.events.length;offset+=256){const up=await s.app.inject({method:'POST',url:`/api/challenges/${cid}/events`,headers,payload:{sequence:offset/256,events:g.journal.events.slice(offset,offset+256)}});expect(up.statusCode,up.body).toBe(200);}
expect((await s.app.inject({method:'POST',url:`/api/challenges/${cid}/submit`,headers,payload:{idempotencyKey:randomUUID(),summary:{...summary,score:summary.score+10}}})).statusCode).toBe(422);
 const ok=await s.app.inject({method:'POST',url:`/api/challenges/${cid}/submit`,headers,payload:{idempotencyKey:randomUUID(),summary}});expect(ok.statusCode,ok.body).toBe(200);expect(ok.json().verificationStatus).toBe('verified');
 const endless=(await s.app.inject({url:'/api/leaderboard?board=endless'})).json();expect(endless).toMatchObject({board:'endless',rankingRulesVersion:ENDLESS_RULES_VERSION});expect(endless.items).toHaveLength(1);expect(endless.items[0]).toMatchObject({score:summary.score,rank:1,reached_level:summary.reachedLevel});
 expect((await s.app.inject({url:'/api/leaderboard?board=global'})).json().items).toHaveLength(0);
 expect((await s.app.inject({url:'/api/me/best?board=endless',headers})).json().best.score).toBe(summary.score);
 expect((await s.app.inject({url:'/api/me/best?board=global',headers})).json().best).toBeNull();
 expect((await s.app.inject({url:'/api/leaderboard?board=endless&rulesVersion='+RULES_VERSION})).statusCode).toBe(400);
});
