import {expect,it} from 'vitest';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {RULES_VERSION} from '../../shared/Challenge';
import {verifyTrace} from '../src/verifier';
function run(version:1|2){
 const g=new Game();g.physics.brickPowerVersion=1;g.physics.tripleRuleVersion=version;g.physics.reset();g.journal.seed=4;g.physics.setSeed(4);g.start();
 const cells=Array.from(g.physics.blocks.alive.keys()).filter(i=>g.physics.blocks.alive[i]);let index=0;const counts:number[]=[];
 for(let wave=0;wave<20;wave++){
  for(let n=0;n<14;n++){g.physics.onStep?.(C.step);g.physics.blocks.hit(cells[index++]);}
  for(let tick=0;tick<700;tick++){
   g.physics.onStep?.(C.step);g.physics.wideRemaining=Math.max(0,g.physics.wideRemaining-C.step);
   const item=g.physics.powers.items.find(p=>p.alive);
   g.physics.powers.update(C.step,item?.x??400,g.physics.paddleWidth,(kind,id)=>{g.physics.collect(kind,id);if(kind==='triple')counts.push(g.physics.balls.length);});
  }
 }
 for(let life=0;life<5;life++){for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);if(g.state==='ready')g.start();}
 return {g,counts};
}
it.each([1,2] as const)('真实连续掉落拾取/死亡日志在服务端按X3版本%i严格回放',version=>{
 const {g,counts}=run(version);expect(counts.length).toBeGreaterThan(4);expect(counts.slice(0,4)).toEqual(version===1?[3,9,27,81]:[3,9,27,30]);
 expect(verifyTrace(g.journal.events,1000000,4,RULES_VERSION).summary).toEqual(g.journal.summary(g.score.total,1,false));
 const altered=g.journal.events.map((e,i)=>i===0&&e.type==='launch'?{...e,tripleRuleVersion:version===1?2 as const:undefined}:e);
 expect(()=>verifyTrace(altered,1000000,4,RULES_VERSION)).toThrow();
 const second=g.journal.events.findIndex((e,i)=>i>0&&e.type==='launch');
 const switched=g.journal.events.map((e,i)=>i===second?{...e,tripleRuleVersion:2 as const}:e);
 expect(()=>verifyTrace(switched,1000000,4,RULES_VERSION)).toThrow('首次');
});
import {createApp} from '../src/app';
import {randomUUID} from 'node:crypto';
it('新旧客户端真实规则日志均可提交同一API，伪分拒绝，安全重试不重复计分',async()=>{
 let now=Date.now();const s=await createApp({dbPath:':memory:',secure:true,origin:'https://test.local',rateLimit:false,now:()=>now});
 try{
 const me=await s.app.inject({url:'/api/me?board=global'}),headers={cookie:'__Secure-qlgq='+me.cookies[0].value,origin:'https://test.local','x-csrf-token':me.json().csrfToken};
 expect((await s.app.inject({method:'POST',url:'/api/players',headers,payload:{nickname:'多球规则测试',regionCode:'ISO:CN'}})).statusCode).toBe(201);
 expect((await s.app.inject({url:'/api/health'})).json().challengeFeatures).toContain('triple-threshold20-v1');
 for(const version of [1,2] as const){const {g}=run(version),summary=g.journal.summary(g.score.total,1,false);
 const created=(await s.app.inject({method:'POST',url:'/api/challenges',headers,payload:{rulesVersion:RULES_VERSION,seed:4}})).json();expect(created.challengeFeatures).toContain('triple-threshold20-v1');now+=summary.durationMs+5000;
 for(let offset=0;offset<g.journal.events.length;offset+=256){const r=await s.app.inject({method:'POST',url:`/api/challenges/${created.id}/events`,headers,payload:{sequence:offset/256,events:g.journal.events.slice(offset,offset+256)}});expect(r.statusCode,r.body).toBe(200);}
 const payload={idempotencyKey:randomUUID(),summary};const post=(body:unknown)=>s.app.inject({method:'POST',url:`/api/challenges/${created.id}/submit`,headers,payload:body});
 expect((await post({...payload,summary:{...summary,score:summary.score+1}})).statusCode).toBe(422);
 const accepted=await post(payload);expect(accepted.statusCode,accepted.body).toBe(200);expect(accepted.json().verificationStatus).toBe('verified');expect((await post(payload)).json().id).toBe(accepted.json().id);
 }
 expect(s.db.prepare('SELECT COUNT(*) n FROM players').get()!.n).toBe(1);expect(s.db.prepare('SELECT COUNT(*) n FROM scores').get()!.n).toBe(2);
 expect((await s.app.inject({url:'/api/leaderboard?board=global'})).json().items).toHaveLength(1);
 }finally{await s.app.close();}
});
