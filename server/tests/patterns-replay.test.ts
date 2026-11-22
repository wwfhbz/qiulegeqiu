import {expect,it} from 'vitest';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {RULES_VERSION} from '../../shared/Challenge';
import {Cell} from '../../src/campaign/Patterns';
import {verifyTrace} from '../src/verifier';
import {breakAll} from '../../tests/helpers/BreakAll';

/** Real physics with a simple autopilot: the paddle follows the lowest falling ball and catches falling powers. */
function play(g:Game,seconds:number){
 for(let t=0;t<seconds/C.step&&g.state==='running';t++){
  const p=g.physics,falling=p.balls.filter(b=>b.alive&&b.vy>0).sort((a,b)=>b.y-a.y)[0];
  const drop=p.powers.items.filter(d=>d.alive&&d.y>C.paddle.y-160).sort((a,b)=>b.y-a.y)[0];
  p.setTarget(falling&&falling.y>C.paddle.y-220?falling.x:drop?drop.x:falling?.x??C.arena.x);
  g.update(C.step);
  if(g.state==='ready')g.start();
 }
}
it.each([11,23,37])('闯关1.11：真实物理打第3～12关（硬砖、钢砖、炸弹、Boss），服务端逐事件复核，分数与击碎数完全一致（种子%i）',seed=>{
 const g=new Game();g.journal.seed=seed;g.physics.setSeed(seed);
 let cracks=0,blasts=0,bossHits=0;
 for(let n=1;n<=12&&g.state!=='gameOver';n++){
  expect(g.levels.current.number).toBe(n);g.start();
  if(n>=3)play(g,25);
  if(g.state==='gameOver')break;
  if(g.state==='running'){breakAll(g);g.update(0);}
  if(g.state==='levelComplete')g.nextLevel();
 }
 for(const e of g.journal.events){if(e.type==='boss')bossHits++;}
 const destroyed=new Set<number>();
 for(const e of g.journal.events)if(e.type==='hit'){if(destroyed.has(e.level*1e6+e.index))cracks++;destroyed.add(e.level*1e6+e.index);}
 blasts=g.journal.events.filter(e=>e.type==='hit').length;
 expect(g.state).toBe('victory');expect(bossHits).toBeGreaterThanOrEqual(40+80);expect(cracks).toBeGreaterThan(100);expect(blasts).toBeGreaterThan(0);
 const v=verifyTrace(g.journal.events,1e9,seed,RULES_VERSION);
 expect(v.summary).toEqual(g.journal.summary(g.score.total,12,true));
});
it('闯关1.11：硬砖每下计分但不算击碎；钢砖打不坏；炸弹炸开周围；火焰(crush)只在火焰时间内有效',()=>{
 const g=new Game();g.journal.seed=5;g.physics.setSeed(5);
 for(let n=1;n<=3;n++){g.start();if(n<3){breakAll(g);g.update(0);if(g.state==='levelComplete')g.nextLevel();}}
 const b=g.physics.blocks,hard=b.kinds.findIndex((k,i)=>k===Cell.Hard2&&b.alive[i]);
 const before=g.score.total;b.hit(hard);expect(b.alive[hard]).toBe(1);expect(b.hp[hard]).toBe(1);expect(g.score.total).toBeGreaterThan(before);
 const remaining=b.remaining;b.hit(hard);expect(b.alive[hard]).toBe(0);expect(b.remaining).toBe(remaining-1);
 const events=g.journal.events.filter(e=>e.type==='hit'&&e.level===3&&e.index===hard);expect(events).toHaveLength(2);expect(g.journal.bricksDestroyed).toBe(600+1446+1);
 // A forged fire crush outside any fire window is rejected.
 const forged=g.journal.events.map(e=>e===events[0]?{...e,crush:true as const}:e);
 for(let life=0;life<3;life++){for(const ball of g.physics.balls)Object.assign(ball,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);if(g.state==='ready')g.start();}
 expect(g.state).toBe('gameOver');
 expect(()=>verifyTrace(g.journal.events,1e9,5,RULES_VERSION)).not.toThrow();
 const tail=g.journal.events.slice(forged.length);expect(()=>verifyTrace([...forged,...tail],1e9,5,RULES_VERSION)).toThrow('火焰');
 // Level 4 bombs: breaking one blasts its neighbours in the same tick.
 const h=new Game();h.journal.seed=6;h.physics.setSeed(6);
 for(let n=1;n<=4;n++){h.start();if(n<4){breakAll(h);h.update(0);if(h.state==='levelComplete')h.nextLevel();}}
 const k=h.physics.blocks,bomb=k.kinds.findIndex((v,i)=>v===Cell.Bomb&&k.alive[i]),count=k.remaining;k.hit(bomb);expect(count-k.remaining).toBeGreaterThan(5);
 // Steel (level 5) is solid and never damaged.
 const s=new Game();for(let n=1;n<=5;n++){s.start();if(n<5){breakAll(s);s.update(0);if(s.state==='levelComplete')s.nextLevel();}}
 const sb=s.physics.blocks,steel=sb.kinds.findIndex((v,i)=>v===Cell.Steel&&sb.alive[i]);expect(steel).toBeGreaterThanOrEqual(0);expect(sb.hit(steel)).toBe(false);expect(sb.alive[steel]).toBe(1);
 let steelCount=0;for(let i=0;i<sb.alive.length;i++)if(sb.alive[i]&&sb.isSteel(i))steelCount++;expect(sb.total+steelCount).toBe(sb.alive.reduce((a,v)=>a+v,0));
});
it('闯关1.11 Boss：第8关核心40下、第12关80下，打掉三分之一血时补一圈硬砖；Boss未倒不能通关',()=>{
 const g=new Game();g.journal.seed=9;g.physics.setSeed(9);
 for(let n=1;n<=12;n++){
  g.start();
  if(n===8||n===12){
   const boss=g.physics.boss!;expect(boss.hp).toBe(n===8?40:80);
   const b=g.physics.blocks;for(let pass=0;pass<4;pass++)for(let i=0;i<b.alive.length;i++)if(b.alive[i]&&!b.isSteel(i))b.hit(i);
   g.update(0);expect(g.state).toBe('running');
   const hit=()=>(g.physics as unknown as {bossHit():void}).bossHit();
   if(n===12){for(let i=0;i<27;i++)hit();expect(b.remaining).toBeGreaterThan(50);expect(boss.stage).toBe(1);}
  }
  breakAll(g);g.update(0);if(g.state==='levelComplete')g.nextLevel();
 }
 expect(g.state).toBe('victory');
 expect(verifyTrace(g.journal.events,1e9,9,RULES_VERSION).summary).toEqual(g.journal.summary(g.score.total,12,true));
});
