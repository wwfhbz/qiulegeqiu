import {it,expect} from 'vitest';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {POWER_WEIGHTS,weightedPower,seededRandom} from '../../src/PowerRules';
import {RULES_VERSION} from '../../shared/Challenge';
import {verifyTrace} from '../src/verifier';
/** Campaign 1.9: lightning/pierce/fire drop on levels 3–12 (1% of drops each) and verify like any other power. */
it('V1.9掉落表：第3关与第4～12关中闪电、穿透、火球各占1%',()=>{
 const total=(rows:readonly {weight:number}[])=>rows.reduce((s,r)=>s+r.weight,0);
 for(const rows of [POWER_WEIGHTS.firstSkills,POWER_WEIGHTS.scarceSkills]){expect(total(rows)).toBe(1000);for(const kind of ['lightning','pierce','fire'])expect(rows.find(r=>r.kind===kind)!.weight).toBe(10);}
 const random=seededRandom(19),counts:Record<string,number>={};for(let i=0;i<300000;i++){const k=weightedPower('scarceSkills',random);counts[k]=(counts[k]??0)+1;}
 for(const kind of ['lightning','pierce','fire'])expect(Math.abs(counts[kind]/300000-.01)).toBeLessThan(.0015);
});
it('真实对局吃到闪电/穿透/火球：砖块正常计分，服务端验证通过且不误判',()=>{
 const caught=new Set<string>();let runs=0;
 for(let seed=1;seed<=40&&caught.size<3;seed++){
  const g=new Game();g.journal.seed=seed;g.physics.setSeed(seed);g.physics.reset();
  // Clear the two tutorial levels quickly, then play level 3+ with a paddle that chases the nearest drop or the lowest ball.
  for(let level=1;level<=2;level++){g.start();for(let i=0;i<g.physics.blocks.alive.length;i++)if(g.physics.blocks.alive[i]){g.physics.onStep?.(C.step);g.physics.blocks.hit(i);}g.update(0);if(g.state==='levelComplete')g.nextLevel();}
  for(let t=0;t<120*150&&g.state!=='gameOver'&&g.state!=='victory';t++){if(g.state==='ready'||g.state==='paused')g.start();if(g.state==='levelComplete')g.nextLevel();
   const drop=g.physics.powers.items.filter(p=>p.alive&&p.y>C.paddle.y-260).sort((a,b)=>b.y-a.y)[0],low=g.physics.balls.filter(b=>b.alive).sort((a,b)=>b.y-a.y)[0];
   const ballDanger=low&&low.vy>0&&low.y>C.paddle.y-140;if(ballDanger)g.physics.setTarget(low.x);else if(drop)g.physics.setTarget(drop.x);else if(low)g.physics.setTarget(low.x);g.update(C.step);}
  while(g.state!=='gameOver'&&g.state!=='victory'){if(g.state==='ready')g.start();if(g.state==='levelComplete'){g.nextLevel();continue;}for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);}
  for(const e of g.journal.events)if(e.type==='power'&&['lightning','pierce','fire'].includes(e.kind))caught.add(e.kind);
  const v=verifyTrace(g.journal.events,1e9,seed,RULES_VERSION);expect(v.summary).toEqual(g.journal.summary(g.score.total,g.reachedLevel,g.state==='victory'));expect(v.suspicious).toEqual([]);runs++;
 }
 expect([...caught].sort()).toEqual(['fire','lightning','pierce']);expect(runs).toBeGreaterThan(0);
},600000);
