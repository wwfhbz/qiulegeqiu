import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {ENDLESS,ENDLESS_V4,ENDLESS_V5,ENDLESS_V6,type EndlessVariant} from '../../src/endless/EndlessRules';
import {ENDLESS_V6_RULES_VERSION as ENDLESS_RULES_VERSION,ENDLESS_V4_RULES_VERSION,ENDLESS_V5_RULES_VERSION,ENDLESS_RANKING_SCOPE,type ChallengeEvent} from '../../shared/Challenge';
import {verifyTrace} from '../src/verifier';
import {createApp} from '../src/app';
function finish(g:Game){for(let n=0;n<10&&g.state!=='gameOver';n++){for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);if(g.state==='ready')g.start();}expect(g.state).toBe('gameOver');}
/** Scripted contacts use real field, drop pool, pickup callbacks and journal; physical=true also drives actual ball/area contacts. */
function run(seed:number,v:EndlessVariant,ticks=6000,physical=false){
 const g=new Game();g.setMode('endless');g.physics.endless!.variant=v;g.journal.seed=seed;g.physics.setSeed(seed);g.physics.reset();g.start();const p=g.physics,f=p.endless!;let burned=false,slashed=false;
 for(let t=1;t<=ticks;t++){
  if(g.state==='ready')g.start();expect(g.state).toBe('running');const target=p.powers.items.filter(d=>d.alive).sort((a,b)=>b.y-a.y)[0];
  if(physical){p.setTarget(target?.x??400);p.paddleX=p.targetX;for(const b of p.balls)Object.assign(b,{x:400,y:920,vx:440,vy:0,outsideArena:true});
   if((p.fireRemaining>0||p.pierceRemaining>0)&&t%30===0){const i=Array.from(f.alive.keys()).find(i=>f.alive[i]&&i%f.cols===22);if(i!==undefined)Object.assign(p.balls[0],{x:f.left+22*f.step+f.size/2,y:f.top+Math.floor(i/f.cols)*f.step+f.size+2,vx:0,vy:-440,outsideArena:false});}
   const seq=p.effects.eventSeq;g.update(C.step);if(p.effects.events.some(e=>e.seq>seq&&e.kind==='burn'))burned=true;if(p.effects.events.some(e=>e.seq>seq&&e.kind==='slash'))slashed=true;
  }else{p.onStep?.(C.step);f.tick();}
  if(t%6===0){const cells=Array.from(f.alive.keys()).filter(i=>f.alive[i]);if(cells.length)f.hit(cells[t*7919%cells.length]);}
  if(!physical)p.powers.update(C.step,target?.x??400,p.paddleWidth,(k,id)=>p.collect(k,id));
 }
 finish(g);return {g,burned,slashed};
}
it.each([1,7,31])('V1.5 seed=%s确定性日志与服务端20行/权重/计分回放一致，不能冒充V1.4',seed=>{
 const {g}=run(seed,ENDLESS_V6),{g:b}=run(seed,ENDLESS_V6);expect(g.rulesVersion).toBe(ENDLESS_RULES_VERSION);expect(g.journal.events).toEqual(b.journal.events);const r=verifyTrace(g.journal.events,1e9,seed,g.rulesVersion);expect(r.summary).toEqual(g.journal.summary(g.score.total,g.reachedLevel,false));expect(r.suspicious).toEqual([]);expect(()=>verifyTrace(g.journal.events,1e9,seed,ENDLESS_V5_RULES_VERSION)).toThrow();
});
it('V1.5真实穿透/火焰范围/闪电物理接触和连续掉落、拾取日志正确回放，伪造道具/版本/种子仍拒绝',()=>{
 const {g,burned,slashed}=run(7,ENDLESS_V6,6000,true);expect(burned).toBe(true);expect(slashed).toBe(true);expect(g.journal.events.some(e=>e.type==='power'&&e.kind==='lightning')).toBe(true);const r=verifyTrace(g.journal.events,1e9,7,g.rulesVersion);expect(r.summary).toEqual(g.journal.summary(g.score.total,g.reachedLevel,false));expect(r.suspicious).toEqual([]);
 const at=g.journal.events.findIndex(e=>e.type==='power');expect(at).toBeGreaterThan(0);expect(()=>verifyTrace(g.journal.events.map((e,i)=>i===at?{...e,dropId:49999}:e) as ChallengeEvent[],1e9,7,g.rulesVersion)).toThrow('无对应');expect(()=>verifyTrace(g.journal.events,1e9,8,g.rulesVersion)).toThrow();expect(()=>verifyTrace(g.journal.events,1e9,7,'endless-unknown')).toThrow('不支持');
});
it('V1.5仍1200tick压迫扣命，暂停不计时，下一发射清底部5行并按原种子给予补偿',()=>{
 const g=new Game();g.setMode('endless');g.journal.seed=31;g.physics.setSeed(31);g.physics.reset();g.start();const p=g.physics,f=p.endless!,park=()=>{for(const b of p.balls)Object.assign(b,{x:400,y:900,vx:0,vy:-1,outsideArena:true});};let guard=0;while(!f.blocked&&guard++<100000){park();g.update(C.step);}expect(f.blocked).toBe(true);expect(f.pressure).toBe(0);g.pause();const time=f.sinceDescent;g.update(1000);expect(f.sinceDescent).toBe(time);g.start();for(let n=0;n<1199;n++){park();g.update(C.step);}expect(g.lives).toBe(3);park();g.update(C.step);expect(g.lives).toBe(2);expect(g.pendingRelief).toBe(true);
 const before=f.destroyedTotal;g.start();expect(g.pendingRelief).toBe(false);expect(f.blocked).toBe(false);expect(f.pressure).toBe(0);expect(f.destroyedTotal-before).toBeLessThanOrEqual(12);const events=g.journal.events,launch=events.map(e=>e.type).lastIndexOf('launch');expect(events[launch+1].type).toBe('bonus');expect(ENDLESS.reliefRows).toBe(5);for(let row=f.floorRow-4;row<=f.floorRow;row++)expect(f.alive.slice(row*f.cols,(row+1)*f.cols).some(Boolean)).toBe(false);
 finish(g);expect(verifyTrace(g.journal.events,1e9,31,g.rulesVersion).summary).toEqual(g.journal.summary(g.score.total,g.reachedLevel,false));
});
it('V1.3/V1.4/V1.5实际成绩统一上榜：跨版本最高、原记录保持、低分不覆盖、幂等和非法分数拒绝',async()=>{
 let now=Date.now();const s=await createApp({dbPath:':memory:',secure:true,origin:'https://test.local',rateLimit:false,now:()=>now});try{
 const account=async(name:string)=>{const me=await s.app.inject({url:'/api/me?board=endless'}),headers={cookie:'__Secure-qlgq='+me.cookies[0].value,origin:'https://test.local','x-csrf-token':me.json().csrfToken};expect((await s.app.inject({method:'POST',url:'/api/players',headers,payload:{nickname:name,regionCode:'ISO:CN'}})).statusCode).toBe(201);return headers;};
 const a=await account('平衡测试甲'),b=await account('平衡测试乙'),c=await account('平衡测试丙');
 const submit=async(headers:typeof a,v:EndlessVariant,ticks:number)=>{const {g}=run(7,v,ticks),summary=g.journal.summary(g.score.total,g.reachedLevel,false),created=await s.app.inject({method:'POST',url:'/api/challenges',headers,payload:{rulesVersion:g.rulesVersion,seed:7}});expect(created.statusCode,created.body).toBe(201);const id=created.json().id;now+=summary.durationMs+5000;
  for(let o=0;o<g.journal.events.length;o+=256){const r=await s.app.inject({method:'POST',url:`/api/challenges/${id}/events`,headers,payload:{sequence:o/256,events:g.journal.events.slice(o,o+256)}});expect(r.statusCode,r.body).toBe(200);}
  const url=`/api/challenges/${id}/submit`,payload={idempotencyKey:randomUUID(),summary};expect((await s.app.inject({method:'POST',url,headers,payload:{...payload,summary:{...summary,score:summary.score+1}}})).statusCode).toBe(422);const r=await s.app.inject({method:'POST',url,headers,payload});expect(r.statusCode,r.body).toBe(200);expect(r.json().verificationStatus).toBe('verified');expect((await s.app.inject({method:'POST',url,headers,payload})).json().id).toBe(r.json().id);return {id:r.json().id,summary};
 };
 const old13=await submit(a,ENDLESS_V4,1800),old14=await submit(a,ENDLESS_V5,9000),snapshot=s.db.prepare('SELECT * FROM scores WHERE id IN (?,?) ORDER BY id').all(old13.id,old14.id);
 await submit(a,ENDLESS_V6,1800);await submit(b,ENDLESS_V6,6000);await submit(c,ENDLESS_V4,6000);
 const board=(await s.app.inject({url:'/api/leaderboard?board=endless'})).json();expect(board.rankingScope).toBe(ENDLESS_RANKING_SCOPE);expect(board.items).toHaveLength(3);expect(new Set(board.items.map((r:{rules_version:string})=>r.rules_version))).toEqual(new Set([ENDLESS_V4_RULES_VERSION,ENDLESS_V5_RULES_VERSION,ENDLESS_RULES_VERSION]));expect((await s.app.inject({url:'/api/me/best?board=endless',headers:a})).json().best.id).toBe(old14.id);
 for(const version of [ENDLESS_V4_RULES_VERSION,ENDLESS_V5_RULES_VERSION,ENDLESS_RULES_VERSION])expect((await s.app.inject({url:'/api/leaderboard?board=endless&rulesVersion='+version})).json().items).toEqual(board.items);
 const better=await submit(a,ENDLESS_V6,12000);expect(better.summary.score).toBeGreaterThan(old14.summary.score);expect((await s.app.inject({url:'/api/me/best?board=endless',headers:a})).json().best.id).toBe(better.id);expect(s.db.prepare('SELECT * FROM scores WHERE id IN (?,?) ORDER BY id').all(old13.id,old14.id)).toEqual(snapshot);
 expect((await s.app.inject({url:'/api/leaderboard?board=global'})).json().items).toEqual([]);expect((await s.app.inject({method:'POST',url:'/api/challenges',headers:a,payload:{rulesVersion:'endless-9.9-unknown',seed:7}})).statusCode).toBe(400);expect(s.db.prepare('SELECT COUNT(*) n FROM players').get()!.n).toBe(3);
 }finally{await s.app.close();}
});
