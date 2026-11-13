import {expect,it} from 'vitest';
import {Game} from '../src/Game';
import {C} from '../src/GameConfig';
import type {PowerKind} from '../src/PowerRules';
import {ENDLESS,descentInterval} from '../src/endless/EndlessRules';
import {ENDLESS_RULES_VERSION,RULES_VERSION} from '../shared/Challenge';

function endless(seed=11){const g=new Game();g.setMode('endless');g.journal.seed=seed;g.physics.setSeed(seed);g.physics.reset();return g;}
function loseRound(g:Game){for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);}

it('切换无尽模式：3条命、单一关卡、规则版本独立；切回闯关恢复12关与5条命',()=>{
 const g=new Game();expect(g.rulesVersion).toBe(RULES_VERSION);g.setMode('endless');
 expect(g.mode).toBe('endless');expect(g.lives).toBe(3);expect(g.maxLives).toBe(3);expect(g.levels.count).toBe(1);expect(g.rulesVersion).toBe(ENDLESS_RULES_VERSION);
 expect(g.physics.endless).toBeDefined();expect(g.physics.blocks.total).toBeGreaterThan(400);expect(g.reachedLevel).toBe(1);
 g.setMode('campaign');expect(g.lives).toBe(5);expect(g.levels.count).toBe(12);expect(g.physics.endless).toBeUndefined();expect(g.physics.blocks.total).toBe(600);
});
it('运行时砖墙按间隔下沉，球速随之加快；日志记录稳定的世界编号而非格子位置',()=>{
 const g=endless();g.start();const field=g.physics.endless!;const index=Array.from(field.alive.keys()).find(i=>field.alive[i])!,id=field.worldId(index);
 field.hit(index);const hit=g.journal.events.find(e=>e.type==='hit');expect(hit).toMatchObject({type:'hit',index:id});
 for(const b of g.physics.balls)Object.assign(b,{x:400,y:860,vx:0,vy:-1});// keep the ball out of the way, the test only drives time
 const speed=g.physics.speedScale;for(let n=0;n<descentInterval(0);n++){for(const b of g.physics.balls)Object.assign(b,{x:400,y:820,vx:0,vy:-440});g.update(C.step);}
 expect(field.descents).toBe(1);expect(g.physics.speedScale).toBeGreaterThan(speed);expect(g.state).toBe('running');
});
it('清空砖墙不会结束或切关；三次全部漏球后游戏结束，阶段写入成绩',()=>{
 const g=endless();g.start();const field=g.physics.endless!;for(let i=0;i<field.alive.length;i++)field.hit(i);g.update(0);
 expect(field.remaining).toBe(0);expect(g.state).toBe('running');
 loseRound(g);expect(g.lives).toBe(2);expect(g.state).toBe('ready');g.start();loseRound(g);expect(g.lives).toBe(1);g.start();loseRound(g);
 expect(g.state).toBe('gameOver');expect(g.journal.events.at(-1)?.type).toBe('finish');expect(g.reachedLevel).toBe(1);
});
it('+3球、穿透、火焰、闪电各自生效；闪电先记道具再记击碎；+1生命不超过3',()=>{
 const g=endless();g.start();const p=g.physics,field=p.endless!;
 p.collect('plus3');expect(p.balls.filter(b=>b.alive)).toHaveLength(4);
 p.collect('pierce');expect(p.pierceRemaining).toBe(ENDLESS.pierceSeconds);p.collect('fire');expect(p.fireRemaining).toBe(ENDLESS.fireSeconds);
 const before=field.remaining,events=g.journal.events.length;p.collect('lightning');expect(before-field.remaining).toBe(ENDLESS.lightningBricks);
 const tail=g.journal.events.slice(events);expect(tail[0]).toMatchObject({type:'power',kind:'lightning'});expect(tail.slice(1).every(e=>e.type==='hit')).toBe(true);expect(tail).toHaveLength(1+ENDLESS.lightningBricks);
 p.collect('life');expect(g.lives).toBe(3);
});
it('火焰：一次碰撞烧掉周围8格；穿透：穿过砖块不反弹',()=>{
 const g=endless();g.start();const p=g.physics,field=p.endless!,row=8,col=22,index=row*field.cols+col;
 const x=field.left+col*field.step+field.size/2,y=field.top+row*field.step+field.size+3;
 for(let r=row-1;r<=row+1;r++)for(let c=col-1;c<=col+1;c++)if(!field.alive[r*field.cols+c])continue;
 p.fireRemaining=5;const before=field.remaining;Object.assign(p.balls[0],{x,y,vx:0,vy:-440,outsideArena:false});p.update(C.step);
 expect(field.alive[index]).toBe(0);expect(before-field.remaining).toBeGreaterThanOrEqual(5);
 const g2=endless();g2.start();const q=g2.physics,f2=q.endless!;q.pierceRemaining=5;Object.assign(q.balls[0],{x,y,vx:0,vy:-440,outsideArena:false});
 for(let n=0;n<30;n++)q.update(C.step);expect(q.balls[0].vy).toBeLessThan(0);expect(f2.total-f2.remaining).toBeGreaterThan(3);
});
it('随机掉落按无尽道具表从同一种子复现，起始每16块一个（1.1版减半）',()=>{
 const run=()=>{const g=endless(5);g.start();const f=g.physics.endless!;let n=0;for(let i=0;i<f.alive.length&&n<40;i++)if(f.alive[i]){f.hit(i);n++;}return g.physics.powers.items.filter(d=>d.alive).map(d=>d.kind);};
 const a=run();expect(a).toEqual(run());expect(a).toHaveLength(2);for(const k of a)expect(['plus3','wide','halve','pierce','fire','lightning','life']).toContain(k);
});
it('道具特效事件：火焰每次接触发出燃烧事件，穿透每块砖发出切割事件，÷2为每颗被移除的球发出消散事件；不改变物理结果',()=>{
 const g=endless();g.start();const p=g.physics,fx=p.effects,kinds=()=>fx.events.filter(e=>e.seq>0).map(e=>e.kind);
 p.collect('plus3');p.collect('plus3');const balls=p.balls.filter(b=>b.alive).length;const before=fx.eventSeq;p.collect('halve');
 expect(fx.events.filter(e=>e.seq>before&&e.kind==='poof')).toHaveLength(balls-Math.ceil(balls/2));
 const field=p.endless!,row=8,col=22,x=field.left+col*field.step+field.size/2,y=field.top+row*field.step+field.size+3;
 p.fireRemaining=5;Object.assign(p.balls[0],{x,y,vx:0,vy:-440,outsideArena:false});p.update(C.step);expect(kinds()).toContain('burn');
 const g2=endless();g2.start();const q=g2.physics;q.pierceRemaining=5;Object.assign(q.balls[0],{x,y,vx:0,vy:-440,outsideArena:false});for(let n=0;n<30;n++)q.update(C.step);
 expect(q.effects.events.filter(e=>e.kind==='slash').length).toBeGreaterThan(2);
});

it('修复：砖墙压到底线后，球仍能从出口掉出并扣命（1.1版砖墙会封住出口）',()=>{
 const g=endless();g.start();const f=g.physics.endless!;let guard=0;while(!f.blocked&&guard++<400000)f.tick();expect(f.blocked).toBe(true);
 // A ball in the open band above the exit, heading straight down through it.
 Object.assign(g.physics.balls[0],{x:C.arena.x,y:C.arena.y+C.arena.radius-30,vx:0,vy:500,outsideArena:false});
 g.physics.setTarget(120);g.physics.paddleX=g.physics.targetX;// paddle away so it cannot save the ball
 for(let n=0;n<360&&g.state==='running';n++){g.physics.setTarget(120);g.update(C.step);}
 expect(g.lives).toBe(2);expect(g.state).toBe('ready');
});
it('1.3压线死亡：砖墙压线满10秒扣1条命；下次发射清掉底线附近5行（不计分）并立即奖励一个效果球',()=>{
 const g=endless(21);g.start();const f=g.physics.endless!;let guard=0;while(!f.blocked&&guard++<400000)f.tick();expect(f.blocked).toBe(true);
 const keep=()=>{for(const b of g.physics.balls)Object.assign(b,{x:C.arena.x,y:C.arena.y+C.arena.radius+40,vx:0,vy:-1,outsideArena:true});};
 // 9.9 running seconds on the line: no penalty yet.
 for(let n=0;n<1188;n++){keep();g.update(C.step);}expect(g.lives).toBe(3);expect(g.state).toBe('running');
 for(let n=0;n<20&&g.state==='running';n++){keep();g.update(C.step);}
 expect(g.lives).toBe(2);expect(g.state).toBe('ready');expect(g.pendingRelief).toBe(true);expect(g.journal.events.at(-1)?.type).toBe('crushed');
 const score=g.score.total,before=f.remaining,bottom=Array.from({length:ENDLESS.reliefRows},(_,k)=>f.floorRow-k);
 g.start();expect(g.pendingRelief).toBe(false);expect(f.blocked).toBe(false);expect(f.pressure).toBe(0);
 for(const row of bottom)for(let c=0;c<f.cols;c++)expect(f.alive[row*f.cols+c]).toBe(0);
 const events=g.journal.events,launch=events.map(e=>e.type).lastIndexOf('launch'),tail=events.slice(launch);expect(tail[1]?.type).toBe('bonus');
 const bonus=tail[1] as {kind:string};expect(['plus3','pierce','fire','lightning']).toContain(bonus.kind);
 // Relief itself scores nothing; only a lightning bonus may add real hits.
 if(bonus.kind!=='lightning')expect(g.score.total).toBe(score);expect(f.remaining).toBeLessThan(before);
});
it('压线计时只在游戏进行中累计，清掉底线砖块后归零；普通漏球扣命不触发补偿',()=>{
 const g=endless(22);g.start();const f=g.physics.endless!;let guard=0;while(!f.blocked&&guard++<400000)f.tick();
 for(let n=0;n<600;n++){for(const b of g.physics.balls)Object.assign(b,{x:400,y:900,vx:0,vy:-1,outsideArena:true});g.update(C.step);}expect(f.pressure).toBeGreaterThan(500);
 g.pause();for(let n=0;n<2000;n++)g.update(C.step);expect(f.pressure).toBeLessThan(700);g.start();
 for(let i=f.floorRow*f.cols;i<(f.floorRow+1)*f.cols;i++)f.hit(i);g.update(C.step);expect(f.pressure).toBe(0);
 loseRound(g);expect(g.lives).toBe(2);expect(g.pendingRelief).toBe(false);
});
it('吃道具加分：闯关与无尽每接住一个道具+100分（不乘连击），旧赛季回放不加',()=>{
 for(const mode of ['campaign','endless'] as const){
  const g=new Game();if(mode==='endless')g.setMode('endless');g.start();const before=g.score.total;
  const kinds:PowerKind[]=mode==='endless'?['plus3','wide','halve','pierce','fire','life']:['triple','wide','halve','life'];for(const kind of kinds)g.physics.collect(kind);
  expect(g.score.total-before).toBe(mode==='endless'?600:400);
  const old=new Game();old.powerPointsEnabled=false;old.start();old.physics.collect('wide');expect(old.score.total).toBe(0);
 }
});
