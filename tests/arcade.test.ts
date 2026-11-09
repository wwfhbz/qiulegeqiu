import { describe, it, expect } from 'vitest';
import { Game } from '../src/Game';
import { ScoreSystem } from '../src/ScoreSystem';
import { ARCADE } from '../src/ArcadeRules';
import { C } from '../src/GameConfig';
const game = () => new Game();
const hitOne = (g: Game) => { const i = g.physics.blocks.alive.findIndex(x => x === 1); g.physics.blocks.hit(i); return i; };
const lose = (g: Game) => { g.start(); for (const b of g.physics.balls) b.alive = false; g.update(C.step); };
const clear = (g: Game) => { g.start(); for(let i=0;i<g.physics.blocks.alive.length;i++)g.physics.blocks.hit(i);g.update(0); };

describe('街机生命与状态协调', () => {
  it('初始3命、0分、第一关、4203块与1颗等待球', () => { const g=game();expect(g.lives).toBe(3);expect(g.score.total).toBe(0);expect(g.levels.current.number).toBe(1);expect(g.physics.blocks.remaining).toBe(4203);expect(g.physics.balls.length).toBe(1);expect(g.state).toBe('ready'); });
  it('单球漏接扣一次生命，等待中不重复扣命', () => { const g=game();lose(g);expect(g.lives).toBe(2);expect(g.state).toBe('ready');for(let i=0;i<20;i++)g.update(.1);expect(g.lives).toBe(2);expect(g.physics.balls.length).toBe(1); });
  it('多球丢一颗不扣命', () => { const g=game();g.start();g.physics.triple();g.physics.balls[0].alive=false;g.update(C.step);expect(g.lives).toBe(3);expect(g.state).toBe('running');expect(g.physics.balls.length).toBe(2); });
  it('100球同时丢失仅扣1命', () => { const g=game();for(let i=0;i<5;i++)g.physics.triple();expect(g.physics.balls.length).toBe(100);lose(g);expect(g.lives).toBe(2);expect(g.physics.balls.length).toBe(1); });
  it('生命耗尽进入游戏结束，禁止发射和下一关', () => { const g=game();for(let i=0;i<3;i++)lose(g);expect(g.lives).toBe(0);expect(g.state).toBe('gameOver');g.start();g.nextLevel();g.update(1);expect(g.state).toBe('gameOver');expect(g.lives).toBe(0);expect(g.physics.balls.length).toBe(0);expect(g.physics.paused).toBe(true); });
  it('扣命保留消除和总分，清除道具、加宽和连击', () => { const g=game();g.start();const index=hitOne(g);g.physics.collect('wide');g.physics.powers.spawn(400,860,'triple');lose(g);expect(g.physics.blocks.alive[index]).toBe(0);expect(g.physics.blocks.removed).toBe(1);expect(g.score.total).toBe(10);expect(g.score.combo).toBe(0);expect(g.physics.wideRemaining).toBe(0);expect(g.physics.powers.items.some(x=>x.alive)).toBe(false);expect(g.physics.effects.particles.some(x=>x.life>0)).toBe(false); });
  it('重开恢复3命、0分和全部方块，不改变静音偏好', () => { const g=game();g.start();hitOne(g);lose(g);g.audio.toggle();g.reset();expect(g.lives).toBe(3);expect(g.score.total).toBe(0);expect(g.physics.blocks.remaining).toBe(4203);expect(g.score.combo).toBe(0);expect(g.state).toBe('ready');expect(g.audio.muted).toBe(true); });
  it('暂停冻结物理、掉落、强化与积分连击计时', () => { const g=game();g.start();hitOne(g);g.physics.collect('wide');g.physics.powers.spawn(400,880,'triple');g.pause();const data=()=>JSON.stringify([g.physics.balls,g.physics.wideRemaining,g.physics.powers.items,g.score.total,g.score.combo,g.score.remaining]);const before=data();for(let i=0;i<240;i++)g.update(C.step);expect(data()).toBe(before);g.start();g.update(.1);expect(g.score.remaining).toBeLessThan(1.2);expect(g.physics.wideRemaining).toBeLessThan(5); });
  it('正常球速与位置修正继续使用原物理引擎', () => { const g=game();const b=g.physics.balls[0];Object.assign(b,{x:400,y:830,vx:0,vy:760,outsideArena:false});g.start();Object.assign(b,{vx:0,vy:760,outsideArena:false});let left=false,bounced=false,returned=false;for(let i=0;i<90;i++){g.update(C.step);if(b.outsideArena)left=true;if(left&&b.vy<0)bounced=true;if(bounced&&!b.outsideArena)returned=true;}expect(left&&bounced&&returned).toBe(true);expect(g.lives).toBe(3);expect(C.paddle.y-C.paddle.height/2-C.arena.y-C.arena.radius).toBe(80); });
});

describe('积分与连击', () => {
  it('普通块10分，同一块不会重复计分或延长连击', () => { const g=game();g.start();const i=hitOne(g);const remaining=g.score.remaining;expect(g.physics.blocks.hit(i)).toBe(false);expect(g.score.total).toBe(10);expect(g.score.hit(i)).toBe(0);expect(g.score.remaining).toBe(remaining); });
  it('各连击阈值按当前这一击计算，所有得分为整数', () => { const s=new ScoreSystem(50);for(let n=1;n<=21;n++){const p=s.hit(n);const m=n<5?1:n<10?1.5:n<20?2:3;expect(s.multiplier).toBe(m);expect(p).toBe(10*m);expect(Number.isInteger(s.total)).toBe(true);}expect(s.total).toBe(375); });
  it('连击1.2秒超时重置，下一块从10分开始', () => { const s=new ScoreSystem(30);for(let i=0;i<10;i++)s.hit(i);s.update(1.19);expect(s.combo).toBe(10);s.update(.01);expect(s.combo).toBe(0);expect(s.multiplier).toBe(1);expect(s.hit(20)).toBe(10); });
  it('固定步长驱动连击，在30/60/144Hz下超时一致', () => { for(const hz of [30,60,144]){const g=game();g.start();hitOne(g);g.physics.onBlockDestroyed=undefined;g.physics.balls.length=0;const b=g.physics.newBall();b.x=400;b.y=780;b.vx=380;b.vy=0;b.outsideArena=false;g.physics.balls.push(b);for(let i=0;i<hz*1.2;i++)g.update(1/hz);expect(g.score.combo).toBe(0);} });
  it('本关奖励不重复，奖励不受连击倍率影响', () => { const s=new ScoreSystem(30);for(let i=0;i<20;i++)s.hit(i);const points=s.total;const result=s.complete(2);expect(result.clearBonus).toBe(1000);expect(result.lifeBonus).toBe(1000);expect(result.totalScore).toBe(points+2000);expect(s.complete(2)).toBe(result);expect(s.total).toBe(points+2000);expect(s.hit(21)).toBe(0); });
  it('新关可再次给相同格子计分，跨关总分保留', () => { const s=new ScoreSystem(3);s.hit(1);s.complete(3);const total=s.total;s.beginLevel();expect(s.hit(1)).toBe(10);expect(s.total).toBe(total+10);expect(s.levelPoints).toBe(10); });
});

describe('三关与结算', () => {
  it('真实销毁4203块后奖励1000+500乘剩余生命，只结算一次', () => { const g=game();clear(g);expect(g.state).toBe('levelComplete');expect(g.lives).toBe(3);expect(g.result?.clearBonus).toBe(1000);expect(g.result?.lifeBonus).toBe(1500);expect(g.result?.blockScore).toBe(125835);expect(g.score.total).toBe(128335);const total=g.score.total;g.update(.1);g.start();expect(g.score.total).toBe(total);expect(g.state).toBe('levelComplete'); });
  it('切关保留生命和总分，清空球、方块、强化、道具和连击', () => { const g=game();lose(g);clear(g);const total=g.score.total;g.nextLevel();expect(g.levels.current.number).toBe(2);expect(g.lives).toBe(2);expect(g.score.total).toBe(total);expect(g.physics.blocks.remaining).toBe(4203);expect(g.physics.balls.length).toBe(1);expect(g.physics.wideRemaining).toBe(0);expect(g.physics.powers.items.every(x=>!x.alive)).toBe(true);expect(g.score.combo).toBe(0);expect(g.state).toBe('ready');g.nextLevel();expect(g.levels.current.number).toBe(2); });
  it('三关的基础速度为440、484、528且不超安全上限', () => { const g=game();for(let i=0;i<3;i++){expect(g.levels.current.speedScale).toBe(ARCADE.levels[i].speedScale);const b=g.physics.balls[0];expect(Math.hypot(b.vx,b.vy)).toBeCloseTo(C.ball.speed*ARCADE.levels[i].speedScale);expect(Math.hypot(b.vx,b.vy)).toBeLessThanOrEqual(C.ball.maxSpeed);clear(g);if(i<2)g.nextLevel();} });
  it('第3关结束后最终胜利，下一关和开始均无效，仍可重开', () => { const g=game();for(let i=0;i<3;i++){clear(g);if(i<2)g.nextLevel();}expect(g.state).toBe('victory');expect(g.score.total).toBe(385005);g.nextLevel();g.start();expect(g.state).toBe('victory');expect(g.levels.current.number).toBe(3);g.reset();expect(g.state).toBe('ready');expect(g.levels.current.number).toBe(1);expect(g.score.total).toBe(0); });
  it('同一帧通关和全部漏球，优先通关且不扣生命', () => { const g=game();g.start();for(let i=0;i<g.physics.blocks.alive.length;i++)g.physics.blocks.hit(i);for(const b of g.physics.balls)b.alive=false;g.update(C.step);expect(g.state).toBe('levelComplete');expect(g.lives).toBe(3);expect(g.result?.lifeBonus).toBe(1500); });
  it('非运行状态销毁事件不产生玩家分数', () => { const g=game();hitOne(g);expect(g.score.total).toBe(0); });
  it('不让最高速度或多球越过引擎限制', () => { const g=game();g.physics.speedScale=100;g.physics.reset();g.start();for(let i=0;i<6;i++)g.physics.collect('triple');g.update(C.step);expect(g.physics.balls.length).toBe(100);expect(g.physics.balls.every(b=>Math.hypot(b.vx,b.vy)<=C.ball.maxSpeed+1e-8)).toBe(true); });
});
