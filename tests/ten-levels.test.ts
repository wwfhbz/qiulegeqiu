import {describe,it,expect,vi} from 'vitest';
import {LegacyGame as Game} from './helpers/LegacyGame';
import {LevelManager} from '../src/LevelManager';
import {Physics,type Ball} from '../src/Physics';
import {C} from '../src/GameConfig';
import {LEGACY_LEVELS as LEVELS} from '../src/LegacyLevels';
import {type ObstacleConfig} from '../src/Levels';
import {Blocks} from '../src/Blocks';
import {Obstacles} from '../src/Obstacles';
import {sweptBounds,obstaclePose} from '../src/ObstacleGeometry';
import {POWER_WEIGHTS,weightedPower,seededRandom} from '../src/PowerRules';
import {activateCentralAction} from '../src/CentralAction';
const clear=(g:Game)=>{g.start();for(let i=0;i<g.physics.blocks.alive.length;i++)g.physics.blocks.hit(i);g.update(0);};
const fifth=()=>{const g=new Game();for(let i=1;i<5;i++){clear(g);g.nextLevel();}return g;};
const lose=(g:Game)=>{g.start();for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);};
const b=(x:number,y:number,vx=0,vy=760):Ball=>({x,y,vx,vy,radius:C.ball.radius,alive:true,outsideArena:false});

describe('十关配置、空间与可通行性',()=>{
 it('关卡、速度和机关数量/种类完全符合设计表',()=>{
  expect(LEVELS.map(l=>l.number)).toEqual([1,2,3,4,5,6,7,8,9,10]);
  expect(LEVELS.map(l=>l.speedScale)).toEqual([1,1,1.05,1.05,1.1,1.1,1.15,1.15,1.2,1.2]);
  expect(LEVELS.map(l=>l.obstacles!.map(o=>o.kind))).toEqual([[],['fixed'],['fixed','fixed'],['moving'],['fixed','fixed'],['moving','moving'],['rotating'],['fixed','fixed','moving'],['fixed','moving','rotating'],['fixed','fixed','moving','rotating']]);
 });
 for(const level of LEVELS)it(`第${level.number}关：约4203块、整个机关运动范围不与方块/出口重叠且留有通路`,()=>{
  const blocks=new Blocks();blocks.reset(level.obstacles);expect(blocks.total).toBeGreaterThan(3900);expect(blocks.total).toBeLessThanOrEqual(4203);
  for(const obstacle of level.obstacles??[]){const bounds=sweptBounds(obstacle,C.ball.radius);expect(bounds.bottom).toBeLessThan(C.arena.y+C.arena.radius-15);
   for(let t=0;t<12;t+=.2){const pose=obstaclePose(obstacle,t,{x:0,y:0,angle:0,vx:0,vy:0,omega:0});const half=(obstacle.length-obstacle.thickness)/2;for(const sign of [-1,1])expect(Math.hypot(pose.x+sign*half*Math.cos(pose.angle)-C.arena.x,pose.y+sign*half*Math.sin(pose.angle)-C.arena.y)+obstacle.thickness/2+C.ball.radius).toBeLessThan(C.arena.radius);}
   const reserved=sweptBounds(obstacle,C.ball.radius*2+2);for(let i=0;i<blocks.alive.length;i++)if(blocks.alive[i]){const x=blocks.left+i%blocks.cols*C.grid.step,y=blocks.top+Math.floor(i/blocks.cols)*C.grid.step;expect(x+C.grid.size<=reserved.left||x>=reserved.right||y+C.grid.size<=reserved.top||y>=reserved.bottom).toBe(true);}
  }
  // Flood-fill against ALL swept footprints is stronger than a single animation frame.
  const step=5,queue:[[number,number]]=[[400,835]],seen=new Set(['400,835']);let reachable=false;
  for(let head=0;head<queue.length;head++){const [x,y]=queue[head];if(y<=660){reachable=true;break;}for(const [dx,dy]of[[step,0],[-step,0],[0,step],[0,-step]]){const nx=x+dx,ny=y+dy,key=`${nx},${ny}`;if(seen.has(key)||ny<650||ny>835||Math.hypot(nx-C.arena.x,ny-C.arena.y)>C.arena.radius-C.ball.radius-1)continue;seen.add(key);if((level.obstacles??[]).some(o=>{const r=sweptBounds(o,C.ball.radius+1);return nx>r.left&&nx<r.right&&ny>r.top&&ny<r.bottom;}))continue;queue.push([nx,ny]);}}
  expect(reachable).toBe(true);
 });
 it('移动双轨方向相反，暂停冻结机关，旋转角连续变化',()=>{const p=new Physics();p.level=LEVELS[5];p.reset();p.advance(C.step);expect(p.obstacles.items[0].vx*p.obstacles.items[1].vx).toBeLessThan(0);p.paused=true;const time=p.obstacles.time;p.advance(1);expect(p.obstacles.time).toBe(time);p.level=LEVELS[6];p.paused=false;p.reset();p.advance(.1);expect(p.obstacles.items[0].angle).toBeGreaterThan(0);});
});

describe('机关碰撞、销毁与高速安全',()=>{
 for(const kind of ['fixed','moving','rotating'] as const)it(`${kind}胶囊法线反弹、炸毁后不碰撞`,()=>{
  const config:ObstacleConfig={id:kind,kind,x:400,y:760,length:120,thickness:10,angle:0,amplitude:30,speed:1,angularSpeed:.6};const obstacles=new Obstacles();obstacles.load([config]);const ball=b(420,752,0,760);expect(obstacles.collide(ball,0)).toBe(true);expect(ball.vy).toBeLessThan(0);expect(Math.hypot(ball.vx,ball.vy)).toBeLessThanOrEqual(760+.001);expect(obstacles.destroyNearest(400,492)!.config.id).toBe(kind);const after=b(420,752);expect(obstacles.collide(after,0)).toBe(false);expect(after.vy).toBe(760);expect(obstacles.destroyNearest(400,492)).toBeUndefined();
 });
 it('高速球不会穿固定、移动、旋转机关，100球长时间更新无NaN',()=>{
  for(const level of [LEVELS[1],LEVELS[3],LEVELS[6]]){const p=new Physics();p.level=level;p.reset();const o=p.obstacles.items[0];const ball=b(o.x+20,o.y-20,0,760);p.balls=[ball];p.advance(C.step*2);expect(ball.vy).toBeLessThan(0);expect(ball.alive).toBe(true);}
  const p=new Physics();p.level=LEVELS[9];p.reset();for(let i=0;i<40;i++)p.triple();expect(p.balls.length).toBe(100);for(let i=0;i<1200;i++)p.advance(C.step);expect(p.balls.every(b=>Number.isFinite(b.x+b.y+b.vx+b.vy)&&Math.hypot(b.vx,b.vy)<=760+.001)).toBe(true);
 });
 it('爆心固定、最近表面决定目标、等距按ID；其他机关仍可碰撞',()=>{const o=new Obstacles();o.load([{id:'b',kind:'fixed',x:350,y:740,length:60,thickness:10,angle:0},{id:'a',kind:'fixed',x:450,y:740,length:60,thickness:10,angle:0}]);expect(o.destroyNearest(400,492)!.config.id).toBe('a');expect(o.items.find(i=>i.config.id==='b')!.destroyed).toBe(false);expect(o.collide(b(350,733),0)).toBe(true);});
});

describe('五大道具',()=>{
 it('首关50/50与后关30/30/30/5/5精确权重及边界',()=>{
  expect(POWER_WEIGHTS.first.map(r=>r.weight)).toEqual([50,50]);expect(POWER_WEIGHTS.later.map(r=>r.weight)).toEqual([30,30,30,5,5]);
  expect([0,.299,.3,.599,.6,.899,.9,.949,.95,.999].map(n=>weightedPower(2,()=>n))).toEqual(['halve','halve','triple','triple','wide','wide','life','life','bomb','bomb']);
  expect(weightedPower(1,()=>.499)).toBe('triple');expect(weightedPower(1,()=>.5)).toBe('wide');
 });
 it('100000次确定性采样符合条件概率，首关只有两种，后关规则一致',()=>{for(const level of [1,2,10]){const random=seededRandom(123),counts:Record<string,number>={};for(let i=0;i<100000;i++){const kind=weightedPower(level,random);counts[kind]=(counts[kind]??0)+1;}for(const row of level===1?POWER_WEIGHTS.first:POWER_WEIGHTS.later)expect(counts[row.kind]/100000).toBeCloseTo(row.weight/100,2);if(level===1)expect(Object.keys(counts).sort()).toEqual(['triple','wide']);}});
 it('第二关起仅间隔14→28，总体频率减半',()=>{const g=new Game();expect(g.physics.powerDropEvery).toBe(14);clear(g);g.nextLevel();expect(g.physics.powerDropEvery).toBe(28);for(let level=2;level<10;level++){clear(g);g.nextLevel();expect(g.physics.powerDropEvery).toBe(28);}});
 for(const count of [1,2,3,9,10,99,100])it(`÷2把${count}球变${Math.ceil(count/2)}，不产生死亡事件`,()=>{const p=new Physics();p.balls=[];for(let i=0;i<count;i++)p.balls.push(p.newBall());const onLost=vi.fn();p.onBallLost=onLost;p.collect('halve');expect(p.balls.length).toBe(Math.ceil(count/2));expect(onLost).not.toHaveBeenCalled();expect(p.effects.powerKind).toBe('halve');});
 it('÷2不扣命/结束回合，×3上限100且球独立',()=>{const g=new Game();g.start();for(let i=0;i<5;i++)g.physics.collect('triple');expect(g.physics.balls.length).toBe(100);g.physics.collect('halve');g.update(0);expect(g.physics.balls.length).toBe(50);expect(g.lives).toBe(5);expect(g.state).toBe('running');expect(new Set(g.physics.balls).size).toBe(50);});
 it('加宽1.8倍、5秒结束和重复拾取刷新',()=>{const p=new Physics();p.collect('wide');expect(p.paddleWidth).toBe(C.paddle.width*1.8);for(let i=0;i<480;i++)p.advance(C.step);p.collect('wide');expect(p.wideRemaining).toBe(5);for(let i=0;i<600;i++)p.advance(C.step);expect(p.wideRemaining).toBe(0);expect(p.paddleWidth).toBe(C.paddle.width);});
 it('生命最多5、丢命后恢复1、不重置进度，Game Over不复活',()=>{const g=new Game();g.start();g.physics.collect('life');expect(g.lives).toBe(5);g.physics.blocks.hit(g.physics.blocks.alive.findIndex(v=>v===1));lose(g);activateCentralAction(g);const score=g.score.total;g.physics.collect('life');expect(g.lives).toBe(5);expect(g.physics.blocks.removed).toBe(1);expect(g.score.total).toBe(score);for(let i=0;i<5;i++)lose(g);g.physics.collect('life');expect(g.lives).toBe(0);expect(g.state).toBe('gameOver');});
 it('炸弹不伤普通块/外墙/挡板，空机关补偿100且每次拾取只结算一次',()=>{const g=new Game();g.start();const before=g.physics.blocks.remaining;g.physics.collect('bomb');expect(g.score.total).toBe(100);expect(g.physics.blocks.remaining).toBe(before);expect(g.physics.paddleWidth).toBe(112);expect(g.physics.effects.explosionRemaining).toBeGreaterThan(0);});
 it('第5关炸毁机关丢命保持，下一关重新加载，整局重开恢复',()=>{const g=fifth();g.start();g.physics.collect('bomb');const destroyed=g.physics.obstacles.items.find(o=>o.destroyed)!;expect(destroyed).toBeDefined();const total=g.score.total;lose(g);expect(destroyed.destroyed).toBe(true);expect(g.levels.current.number).toBe(5);expect(g.score.total).toBe(total);activateCentralAction(g);clear(g);g.nextLevel();expect(g.physics.obstacles.items.every(o=>!o.destroyed)).toBe(true);g.reset();expect(g.levels.current.number).toBe(1);for(let i=1;i<5;i++){clear(g);g.nextLevel();}expect(g.physics.obstacles.items.every(o=>!o.destroyed)).toBe(true);});
 it('已炸毁机关与方块进度共同在多球全漏后保留，最后一颗才扣1命',()=>{const g=fifth();g.start();g.physics.blocks.hit(g.physics.blocks.alive.findIndex(v=>v===1));g.physics.collect('bomb');g.physics.triple();for(const ball of g.physics.balls.slice(0,2))Object.assign(ball,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);expect(g.lives).toBe(5);expect(g.physics.balls.length).toBe(1);lose(g);expect(g.lives).toBe(4);expect(g.physics.blocks.removed).toBe(1);expect(g.physics.obstacles.items.some(o=>o.destroyed)).toBe(true);});
 it('十关真实销毁完成才最终胜利，跨关继承生命分数，奖励符合原规则',()=>{const g=new Game();let totalBricks=0;for(let n=1;n<=10;n++){expect(g.levels.current.number).toBe(n);totalBricks+=g.physics.blocks.total;clear(g);expect(g.lives).toBe(5);if(n<10){expect(g.state).toBe('levelComplete');const total=g.score.total;g.nextLevel();expect(g.score.total).toBe(total);}else expect(g.state).toBe('victory');}expect(g.score.total).toBe(totalBricks*30-255*10+3500*10);g.nextLevel();expect(g.levels.current.number).toBe(10);});
});

it('机关端帽旁拾取×3，新球不出生在实体内部',()=>{const p=new Physics();p.level=LEVELS[1];p.reset();const o=p.obstacles.items[0];p.balls=[b(o.x+o.config.length/2+C.ball.radius+.02,o.y,0,440)];p.triple();expect(p.balls.length).toBe(3);expect(p.balls.every(ball=>!p.obstacles.overlaps(ball))).toBe(true);});
it('旋转到45度时沿实际胶囊法线反弹，移动端帽按相对速度反射',()=>{
 const rotating:ObstacleConfig={id:'转梁',kind:'rotating',x:400,y:750,length:120,thickness:10,angle:0,angularSpeed:Math.PI/2};const o=new Obstacles();o.load([rotating]);const pose=obstaclePose(rotating,.5,{x:0,y:0,angle:0,vx:0,vy:0,omega:0}),nx=-Math.sin(pose.angle),ny=Math.cos(pose.angle),ball=b(pose.x+nx*8,pose.y+ny*8,-nx*700,-ny*700);expect(o.collide(ball,.5)).toBe(true);expect(ball.vx*nx+ball.vy*ny).toBeGreaterThan(0);
 const moving:ObstacleConfig={id:'动梁',kind:'moving',x:400,y:750,length:120,thickness:10,angle:0,amplitude:30,speed:1};o.load([moving]);const p=obstaclePose(moving,.5,{x:0,y:0,angle:0,vx:0,vy:0,omega:0}),cap=b(p.x+moving.length/2+3,p.y,-700,0);expect(o.collide(cap,.5)).toBe(true);expect(cap.vx).toBeGreaterThan(700);expect(Math.hypot(cap.vx,cap.vy)).toBeLessThanOrEqual(760);
});

it('注入单关配置时初始网格、机关及球速一致加载',()=>{const g=new Game(undefined,undefined,new LevelManager([LEVELS[6]]));expect(g.physics.blocks.total).toBe(4103);expect(g.physics.obstacles.items.length).toBe(1);expect(Math.hypot(g.physics.balls[0].vx,g.physics.balls[0].vy)).toBeCloseTo(506);});
