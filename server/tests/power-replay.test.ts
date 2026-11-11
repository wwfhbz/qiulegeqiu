import {expect,it} from 'vitest';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {seededRandom} from '../../src/PowerRules';
import {RULES_VERSION} from '../../shared/Challenge';
import {verifyTrace} from '../src/verifier';

function run(seed:number,initialLevel=3,ticks=4800,spacing=2){
 const g=new Game(),random=seededRandom(seed);g.journal.seed=seed;g.physics.setSeed(seed);g.start();
 for(let level=1;level<initialLevel;level++){for(let i=0;i<g.physics.blocks.alive.length;i++)if(g.physics.blocks.alive[i])g.physics.blocks.hit(i);g.update(C.step);if(g.state==='levelComplete')g.nextLevel();g.start();}
 const cells=Array.from(g.physics.blocks.alive.keys()).filter(i=>g.physics.blocks.alive[i]);
 // Controlled collision fixture: real block-destroy/drop/pickup/journal callbacks,
 // while positions and hit scheduling are deterministic instead of playing a GUI.
 for(let tick=1;tick<=ticks;tick++){
  g.journal.tick++;g.score.update(C.step);
  if(tick%spacing===0&&cells.length>1){const n=Math.floor(random()*cells.length);g.physics.blocks.hit(cells.splice(n,1)[0]);}
  const nearest=g.physics.powers.items.filter(p=>p.alive).sort((a,b)=>Math.abs(a.y-C.paddle.y)-Math.abs(b.y-C.paddle.y))[0];
  const target=initialLevel>=4&&nearest?nearest.x:180+Math.floor(tick/90)%5*110;
  g.physics.powers.update(C.step,target,g.physics.paddleWidth,(kind,id)=>g.physics.collect(kind,id));
 }
 for(let life=0;g.state!=='gameOver'&&life<10;life++){
  for(const ball of g.physics.balls)Object.assign(ball,{x:400,y:1080,vx:0,vy:760,outsideArena:true});
  g.update(C.step);if(g.state==='ready')g.start();
 }
 return g;
}
it('真实道具池连续掉落、拾取和多球日志可被服务端回放',()=>{
 for(let seed=1;seed<=100;seed++){
  const g=run(seed);
  expect(()=>verifyTrace(g.journal.events,1000000,seed,RULES_VERSION),`seed=${seed}`).not.toThrow();
 }
});

it('旧客户端不带标识的同类型交错掉落也按最早拾取截止时间回放',()=>{
 for(const seed of [4]){
  const g=run(seed);const legacy=g.journal.events.map(e=>e.type==='power'?{type:e.type,kind:e.kind,tick:e.tick,level:e.level}:e);
  expect(()=>verifyTrace(legacy,1000000,seed,RULES_VERSION),`legacy seed=${seed}`).not.toThrow();
 }
});

it('伪造标识、重复拾取和提前拾取仍被拒绝',()=>{
 const g=run(4),events=g.journal.events,index=events.findIndex(e=>e.type==='power');expect(index).toBeGreaterThan(0);
 const changed=events.map((e,i)=>i===index&&e.type==='power'?{...e,dropId:49999}:e);
 expect(()=>verifyTrace(changed,1000000,4,RULES_VERSION)).toThrow('无对应可拾取道具');
 const duplicate=[...events.slice(0,index+1),events[index],...events.slice(index+1)];
 expect(()=>verifyTrace(duplicate,1000000,4,RULES_VERSION)).toThrow('无对应可拾取道具');
 const early=events.map((e,i)=>i===index?{...e,tick:0}:e);
 expect(()=>verifyTrace(early,1000000,4,RULES_VERSION)).toThrow();
});

it('超过632秒、到达第五关、五种道具及炸弹目标的长局保持规则一致',()=>{
 const g=run(4,5,75924,30);
 const result=verifyTrace(g.journal.events,1000000,4,RULES_VERSION);
 expect(result.summary).toEqual(g.journal.summary(g.score.total,5,false));
 expect(result.summary.durationMs).toBeGreaterThanOrEqual(632700);
 expect(g.journal.events.some(e=>e.type==='bomb')).toBe(true);
});
