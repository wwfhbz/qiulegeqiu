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
