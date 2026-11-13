import {it,expect,afterEach} from 'vitest';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import {createApp,challengeEvent} from '../src/app';
import {validationFailure} from '../src/validation';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {RULES_VERSION,V13_RULES_VERSION} from '../../shared/Challenge';
import {LevelManager} from '../../src/LevelManager';
import {V13_LEVELS} from '../../src/Levels';
const apps:Awaited<ReturnType<typeof createApp>>[]=[];
afterEach(async()=>{for(const s of apps.splice(0))await s.app.close();});
/** Controlled rule replay of a reported V1.3-season run, not a claim to reproduce the player's physical trajectory. */
function reportedRun(){
 const g=new Game(undefined,undefined,new LevelManager(V13_LEVELS));g.journal.seed=4;g.physics.setSeed(4);
 const advance=(ticks:number)=>{for(let n=0;n<ticks;n++){g.physics.onStep?.(C.step);g.physics.wideRemaining=Math.max(0,g.physics.wideRemaining-C.step);g.physics.powers.update(C.step,C.arena.x,g.physics.paddleWidth,(kind,id)=>g.physics.collect(kind,id));}};
 for(let level=1;level<=4;level++){
  g.start();const cells=Array.from(g.physics.blocks.alive.keys()).filter(i=>g.physics.blocks.alive[i]);
  const chunks=level===1?[...Array(14).fill(20),298,14,8]:[level===2?1200:level===3?4203:10];let index=0;
  chunks.forEach((count,chunk)=>{if(chunk)advance(157);for(let n=0;n<count;n++){advance(5);g.physics.blocks.hit(cells[index++]);}});
  if(level<4){g.update(0);if(g.state==='levelComplete')g.nextLevel();}
 }
 advance(51468-g.journal.tick-5);
 for(let life=0;life<5;life++){g.start();for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);}
 return g;
}
it('相同规则但旧strict power结构拒绝的具体字段是dropId，新结构仍拒绝异常类型/未知字段',()=>{
 const legacyPower=z.object({type:z.literal('power'),tick:z.number().int(),level:z.number().int(),kind:z.enum(['halve','triple','wide','life','bomb'])}).strict();
 const event={type:'power',tick:1000,level:1,kind:'wide',dropId:1};const old=legacyPower.safeParse(event);expect(old.success).toBe(false);
 if(!old.success)expect(old.error.issues).toContainEqual(expect.objectContaining({code:'unrecognized_keys',keys:['dropId']}));
 expect(challengeEvent.safeParse(event).success).toBe(true);expect(challengeEvent.safeParse({...event,dropId:'1'}).success).toBe(false);expect(challengeEvent.safeParse({...event,dropId:-1}).success).toBe(false);expect(challengeEvent.safeParse({...event,unexpected:true}).success).toBe(false);
});
it('428.9秒/6013砖/第4关/186045分的真实规则回调日志通过API，伪分仍拒绝且重试不重复计分',async()=>{
 const g=reportedRun(),summary=g.journal.summary(g.score.total,4,false);expect(summary).toEqual({score:186045,reachedLevel:4,bricksDestroyed:6013,durationMs:428900,completedAllLevels:false});expect(g.journal.events.some(e=>e.type==='power'&&e.dropId!==undefined)).toBe(true);
 let clock=Date.now();const s=await createApp({dbPath:':memory:',secure:true,origin:'https://test.local',rateLimit:false,now:()=>clock});apps.push(s);
 const me=await s.app.inject({url:'/api/me?board=global'}),headers={cookie:'__Secure-qlgq='+me.cookies[0].value,origin:'https://test.local','x-csrf-token':me.json().csrfToken};
 await s.app.inject({method:'POST',url:'/api/players',headers,payload:{nickname:'提交回归玩家',regionCode:'ISO:CN'}});
 const health=(await s.app.inject({url:'/api/health'})).json();expect(health).toMatchObject({rulesVersion:RULES_VERSION,challengeProtocolVersion:2});
 const created=await s.app.inject({method:'POST',url:'/api/challenges',headers,payload:{rulesVersion:V13_RULES_VERSION,seed:g.journal.seed}});expect(created.json().challengeProtocolVersion).toBe(2);const cid=created.json().id;clock+=summary.durationMs+5000;
 for(let offset=0;offset<g.journal.events.length;offset+=256){const result=await s.app.inject({method:'POST',url:`/api/challenges/${cid}/events`,headers,payload:{sequence:offset/256,events:g.journal.events.slice(offset,offset+256)}});expect(result.statusCode,result.body).toBe(200);}
 const payload={idempotencyKey:randomUUID(),summary};expect((await s.app.inject({method:'POST',url:`/api/challenges/${cid}/submit`,headers,payload:{...payload,summary:{...summary,score:summary.score+1}}})).statusCode).toBe(422);
 const accepted=await s.app.inject({method:'POST',url:`/api/challenges/${cid}/submit`,headers,payload});expect(accepted.statusCode,accepted.body).toBe(200);expect(accepted.json().verificationStatus).toBe('verified');
 const retry=await s.app.inject({method:'POST',url:`/api/challenges/${cid}/submit`,headers,payload});expect(retry.json().id).toBe(accepted.json().id);expect(s.db.prepare('SELECT COUNT(*) n FROM scores').get()!.n).toBe(1);
 const invalid=await s.app.inject({method:'POST',url:`/api/challenges/${cid}/events`,headers,payload:{sequence:99,events:[{type:'power',tick:1,level:1,kind:'wide',dropId:'bad'}]}});expect(invalid.statusCode).toBe(400);expect(invalid.json()).toMatchObject({code:'VALIDATION_ERROR',fields:[{field:'events[0].dropId',code:'invalid_type'}]});
});
it('格式诊断只返回安全字段路径，不回显值或未知敏感字段名称',()=>{
 const parsed=z.object({seed:z.number()}).strict().safeParse({seed:'private-value','arbitrary-secret-key':'do-not-return'});expect(parsed.success).toBe(false);if(!parsed.success){const text=JSON.stringify(validationFailure(parsed.error));expect(text).toContain('seed');expect(text).not.toMatch(/private-value|arbitrary-secret-key|do-not-return/);}
});
