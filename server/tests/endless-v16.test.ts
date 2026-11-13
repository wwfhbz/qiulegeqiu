import {it,expect} from 'vitest';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {ENDLESS} from '../../src/endless/EndlessRules';
import {verifyTrace} from '../src/verifier';
/** Endless 1.5: a relief lightning bonus is journaled and scored; a lost life restarts the pressure timer. */
function sinkToFloor(g:Game){const f=g.physics.endless!;let n=0;while(!f.blocked&&n<400000){g.physics.balls.length=1;Object.assign(g.physics.balls[0],{x:400,y:200,vx:0,vy:0,alive:true});g.update(C.step);n++;}}
function hold(g:Game,ticks:number){for(let t=0;t<ticks&&g.state==='running';t++){Object.assign(g.physics.balls[0],{x:400,y:200,vx:0,vy:0});g.update(C.step);}}
function finish(g:Game){while(g.state!=='gameOver'){if(g.state==='ready')g.start();for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);}}
function verified(g:Game){const v=verifyTrace(g.journal.events,1e9,g.journal.seed,g.rulesVersion);expect(v.summary).toEqual(g.journal.summary(g.score.total,g.reachedLevel,false));expect(v.suspicious).toEqual([]);}
it('压线补偿抽到闪电：击碎的砖块计入日志并得分，服务端验证通过（之前必被拒）',()=>{
 let checked=0;
 for(let seed=1;seed<80&&checked<2;seed++){const g=new Game();g.setMode('endless');g.journal.seed=seed;g.physics.setSeed(seed);g.physics.reset();g.start();
  sinkToFloor(g);hold(g,ENDLESS.crushTicks+20);expect(g.state).toBe('ready');
  const hits=g.journal.bricksDestroyed,score=g.score.total;g.start();
  const bonus=g.journal.events.findLast(e=>e.type==='bonus') as {kind:string};if(bonus.kind!=='lightning')continue;
  expect(g.journal.bricksDestroyed).toBeGreaterThan(hits);expect(g.score.total).toBeGreaterThan(score);
  // Keep playing with a paddle that follows the lowest ball, so later drops and pickups depend on the schedule.
  for(let t=0;t<120*30&&g.state!=='gameOver';t++){if(g.state==='ready')g.start();const low=g.physics.balls.filter(b=>b.alive).sort((a,b)=>b.y-a.y)[0];if(low)g.physics.setTarget(low.x);g.update(C.step);}
  finish(g);verified(g);checked++;}
 expect(checked).toBe(2);
},120000);
it('丢命后压线计时重新开始：重新发射后仍有完整10秒，服务端同步复位',()=>{
 const g=new Game();g.setMode('endless');g.start();const f=g.physics.endless!;sinkToFloor(g);
 hold(g,1080);expect(f.pressure).toBeGreaterThanOrEqual(1080);
 for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);
 expect(g.state).toBe('ready');expect(f.pressure).toBe(0);
 g.start();let t=0;while(g.state==='running'&&t<2400){Object.assign(g.physics.balls[0],{x:400,y:200,vx:0,vy:0});g.update(C.step);t++;}
 expect(t/120).toBeGreaterThanOrEqual(9.9);
 finish(g);verified(g);
},60000);
