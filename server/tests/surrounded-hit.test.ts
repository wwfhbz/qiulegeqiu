import {it,expect} from 'vitest';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {Blocks} from '../../src/Blocks';
import {LEVELS} from '../../src/Levels';
import {RULES_VERSION,type ChallengeEvent} from '../../shared/Challenge';
import {verifyTrace} from '../src/verifier';
const FLAG='击碎了四周无空隙的砖块';
it('真实对局（多球、丢命、跨关）不会被误判为击碎被包围的砖块',()=>{
 for(const seed of [3,8,13,21]){const g=new Game();g.journal.seed=seed;g.physics.setSeed(seed);g.physics.reset();
  for(let t=0;t<120*120&&g.state!=='gameOver'&&g.state!=='victory';t++){if(g.state==='ready'||g.state==='paused')g.start();if(g.state==='levelComplete')g.nextLevel();const low=g.physics.balls.filter(b=>b.alive).sort((a,b)=>b.y-a.y)[0];if(low&&t%(3+seed%5)===0)g.physics.setTarget(low.x+((seed*37+t)%40-20));g.update(C.step);}
  while(g.state!=='gameOver'&&g.state!=='victory'){if(g.state==='ready')g.start();if(g.state==='levelComplete'){g.nextLevel();continue;}for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);}
  expect(verifyTrace(g.journal.events,1e9,g.journal.seed,g.rulesVersion).suspicious).not.toContain(FLAG);}
},300000);
it('伪造日志直接击碎砖墙内部的砖块：标记为可疑，进入人工复核',()=>{
 const blocks=new Blocks();blocks.reset(LEVELS[0].obstacles??[],LEVELS[0]);const cols=blocks.cols;
 const inner=Array.from(blocks.alive.keys()).find(i=>{if(!blocks.alive[i])return false;const r=Math.floor(i/cols),c=i%cols;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const rr=r+dr,cc=c+dc;if(rr<0||cc<0||rr>=blocks.rows||cc>=cols||!blocks.alive[rr*cols+cc])return false;}return true;})!;
 expect(inner).toBeDefined();
 const events:ChallengeEvent[]=[{type:'launch',tick:0,level:1,tripleRuleVersion:2,brickPowerVersion:2,trajectoryVersion:1},{type:'hit',tick:600,level:1,index:inner}];
 for(let n=0;n<5;n++){const tick=700+n;events.push({type:'ballLost',tick,level:1},{type:'lost',tick,level:1});events.push(n<4?{type:'launch',tick,level:1}:{type:'finish',tick,level:1});}
 expect(verifyTrace(events,1e9,1,RULES_VERSION).suspicious).toContain(FLAG);
});
