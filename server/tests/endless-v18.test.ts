import {expect,it} from 'vitest';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {ENDLESS_RULES_VERSION} from '../../shared/Challenge';
import {verifyTrace} from '../src/verifier';

/** A competent bot: follows the lowest falling ball, grabs drops when safe, plays until game over (no revives). */
export function botRun(seed:number,maxSeconds=1500){
 const g=new Game();g.setMode('endless');g.journal.seed=seed;g.physics.setSeed(seed);g.physics.reset();g.canOfferRevive=()=>false;
 const p=g.physics;g.start();
 for(let t=0;t<maxSeconds&&g.state!=='gameOver';t+=C.step){
  if(g.state==='ready')g.start();
  const balls=p.balls.filter(b=>b.alive),d=balls.filter(b=>b.vy>0).sort((a,b)=>b.y-a.y)[0],pw=p.powers.items.filter(i=>i.alive&&i.kind!=='halve').sort((a,b)=>b.y-a.y)[0];
  let x=d?d.x:C.arena.x;if(pw&&(!d||d.y<C.paddle.y-350||balls.length>8))x=pw.x;p.setTarget(x);g.update(C.step);
 }
 // Finish the run if the time budget ran out: drop every ball until the lives are gone.
 for(let i=0;i<10&&g.state!=='gameOver';i++){for(const b of p.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);if(g.state==='ready')g.start();}
 return g;
}
it('无尽1.8真实对局（硬砖/炸弹/钢砖/火焰击碎/补砖/掉落间隔）服务端按同一规则重放，分数阶段完全一致',()=>{
 let cracks=0,crushes=0,stages:number[]=[];
 for(const seed of [3,8,21,34]){
  const g=botRun(seed),s=g.journal.summary(g.score.total,g.reachedLevel,false);
  const result=verifyTrace(g.journal.events,1e9,seed,ENDLESS_RULES_VERSION);
  expect(result.summary).toEqual(s);expect(result.suspicious).toEqual([]);
  const ids=new Map<number,number>();for(const e of g.journal.events)if(e.type==='hit'){ids.set(e.index,(ids.get(e.index)??0)+1);if((e as {crush?:boolean}).crush)crushes++;}
  cracks+=[...ids.values()].filter(n=>n>1).length;stages.push(g.reachedLevel);
 }
 expect(cracks).toBeGreaterThan(0);expect(crushes).toBeGreaterThan(0);expect(Math.max(...stages)).toBeGreaterThanOrEqual(10);
 console.log('stages',stages,'cracked bricks',cracks,'fire crushes',crushes);
},600000);

/** Keep every ball high and rising: nothing is lost, bricks still break, and the wall sinks onto the line. */
function hover(g:Game,seconds:number,until:()=>boolean=()=>false){for(let t=0;t<seconds&&!until();t+=C.step){if(g.state==='ready')g.start();for(const b of g.physics.balls)if(b.alive){b.y=260;b.vy=-Math.abs(b.vy)||-300;}g.update(C.step);}}
function finish(g:Game){for(let i=0;i<10&&g.state!=='gameOver';i++){for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);if(g.state==='ready')g.start();}}
it('开局补给（+3球、30秒护盾）与压线救援（清底部5行）服务端按同一时刻重放；伪造会被拒绝',()=>{
 const seed=77,g=new Game();g.setMode('endless');g.journal.seed=seed;g.physics.setSeed(seed);g.physics.reset();g.canOfferRevive=()=>false;
 const f=g.physics.endless!;
 expect(g.canSupply).toBe(true);expect(g.armSupply()).toBe(true);g.start();
 expect(g.physics.balls.filter(b=>b.alive)).toHaveLength(4);expect(g.journal.events.slice(0,2).map(e=>e.type)).toEqual(['launch','supply']);
 expect(f.shieldSeconds).toBeCloseTo(30,1);expect(g.canSupply).toBe(false);
 // The shield holds pressure at zero even with the wall on the line; afterwards it builds and a rescue is offered.
 hover(g,60,()=>f.shieldSeconds===0);expect(g.lives).toBe(1);
 hover(g,600,()=>g.canRescue);expect(g.canRescue).toBe(true);expect(f.pressure).toBeGreaterThanOrEqual(600);
 g.pause();const before=f.remaining;expect(g.rescue()).toBe(true);expect(f.pressure).toBe(0);expect(f.remaining).toBeLessThan(before);expect(g.rescue()).toBe(false);g.start();
 hover(g,5);finish(g);expect(g.state).toBe('gameOver');
 const s=g.journal.summary(g.score.total,g.reachedLevel,false),events=g.journal.events;
 expect(verifyTrace(events,1e9,seed,ENDLESS_RULES_VERSION).summary).toEqual(s);
 // Forgeries: a supply on a later launch, a second rescue, a rescue without pressure.
 const supplyAt=events.findIndex(e=>e.type==='supply'),rescueAt=events.findIndex(e=>e.type==='rescue');
 const later=events.findIndex((e,i)=>i>supplyAt+1&&e.type==='launch');
 if(later>0){const forged=[...events];forged.splice(supplyAt,1);forged.splice(later,0,{type:'supply',tick:events[later].tick,level:1});expect(()=>verifyTrace(forged,1e9,seed,ENDLESS_RULES_VERSION)).toThrow();}
 const second=[...events];second.splice(supplyAt+1,0,{...events[supplyAt]});expect(()=>verifyTrace(second,1e9,seed,ENDLESS_RULES_VERSION)).toThrow('开局补给无效');
 const twice=[...events];twice.splice(rescueAt+1,0,{...events[rescueAt]});expect(()=>verifyTrace(twice,1e9,seed,ENDLESS_RULES_VERSION)).toThrow('压线救援无效');
 const early=[...events];early.splice(rescueAt,1);early.splice(supplyAt+1,0,{type:'rescue',tick:events[supplyAt].tick,level:1});expect(()=>verifyTrace(early,1e9,seed,ENDLESS_RULES_VERSION)).toThrow('压线救援无效');
 // Frozen 1.7 runs never accept the new help.
 expect(()=>verifyTrace(events,1e9,seed,'endless-1.7.0-3l-sink-v8')).toThrow();
},300000);
it('无尽 1.9：1 条命开局，丢一次就结束，服务端按同一规则回放；死后继续发射或冒充 1.8 都会被拒绝',()=>{
 const g=new Game();g.setMode('endless');g.journal.seed=5;g.physics.setSeed(5);g.physics.reset();g.canOfferRevive=()=>false;g.start();
 expect(g.lives).toBe(1);hover(g,3);finish(g);expect(g.state).toBe('gameOver');expect(g.journal.events.filter(e=>e.type==='lost')).toHaveLength(1);
 const events=g.journal.events,s=g.journal.summary(g.score.total,g.reachedLevel,false);expect(verifyTrace(events,1e9,5,ENDLESS_RULES_VERSION).summary).toEqual(s);
 const lost=events.findIndex(e=>e.type==='lost'),tick=events[lost].tick;
 const extra=[...events.slice(0,lost+1),{type:'launch' as const,tick,level:1},...events.slice(lost+1)];expect(()=>verifyTrace(extra,1e9,5,ENDLESS_RULES_VERSION)).toThrow();
 expect(()=>verifyTrace(events,1e9,5,'endless-1.8.0-3l-sink-v9')).toThrow();
});
