import {it,expect} from 'vitest';
import {Game} from '../src/Game';
import {C} from '../src/GameConfig';
import {FRAME} from '../src/WorldGeometry';
import {ARCADE} from '../src/ArcadeRules';
import {LevelManager} from '../src/LevelManager';
function drop(g:Game,dt=C.step){g.start();for(const b of g.physics.balls)Object.assign(b,{x:C.arena.x,y:FRAME.deathY+b.radius+1,vx:0,vy:C.ball.maxSpeed,outsideArena:true});g.update(dt);}
const level2=()=>new Game(undefined,undefined,new LevelManager([ARCADE.levels[1]]));
it('全灭后的待拾取生命不能抵消本轮扣命：4→3',()=>{const g=level2();drop(g);expect(g.lives).toBe(4);g.start();g.physics.powers.spawn(g.physics.paddleX,C.paddle.y,'life');drop(g);expect(g.lives).toBe(3);expect(g.journal.events.filter(e=>e.type==='power')).toHaveLength(0);});
it('最后一命全灭后即使有生命道具也进入Game Over',()=>{const g=level2();for(let i=0;i<4;i++)drop(g);g.start();g.physics.powers.spawn(g.physics.paddleX,C.paddle.y,'life');drop(g);expect(g.lives).toBe(0);expect(g.state).toBe('gameOver');g.physics.collect('life');g.start();g.update(.1);expect(g.lives).toBe(0);});
it('一次显示帧全灭后，后续固定步的掉落道具不能补命',()=>{const g=level2();drop(g);g.start();g.physics.powers.spawn(g.physics.paddleX,C.paddle.y-C.power.radius-C.paddle.height/2-4,'life');drop(g,.1);expect(g.lives).toBe(3);expect(g.journal.events.filter(e=>e.type==='power')).toHaveLength(0);});
it('五命逐轮5→4→3→2→1→0，重发不回满、等待不重复扣命，重开才回5',()=>{const g=new Game();expect(g.lives).toBe(5);for(let lives=4;lives>=0;lives--){drop(g);expect(g.lives).toBe(lives);g.update(.1);expect(g.lives).toBe(lives);if(lives){g.start();expect(g.lives).toBe(lives);}}expect(g.state).toBe('gameOver');g.reset();expect(g.lives).toBe(5);});
it('多球一颗死亡不扣命，余球同帧全灭只扣一次',()=>{const g=new Game();g.start();g.physics.triple();Object.assign(g.physics.balls[0],{x:400,y:1080,vy:760,outsideArena:true});g.update(C.step);expect(g.lives).toBe(5);expect(g.physics.balls).toHaveLength(2);drop(g);expect(g.lives).toBe(4);expect(g.journal.events.filter(e=>e.type==='lost')).toHaveLength(1);});
it('普通丢命保留当前关、方块、分数和已炸毁机关',()=>{const g=level2();g.start();const index=g.physics.blocks.alive.findIndex(Boolean);g.physics.blocks.hit(index);g.physics.collect('bomb');const grid=g.physics.blocks.alive.slice(),score=g.score.total,obstacles=g.physics.obstacles.items.map(o=>o.destroyed);drop(g);expect(g.levels.current.number).toBe(2);expect(g.physics.blocks.alive).toEqual(grid);expect(g.score.total).toBe(score);expect(g.physics.obstacles.items.map(o=>o.destroyed)).toEqual(obstacles);expect(g.physics.balls).toHaveLength(1);});
it('有效球仍存活时生命道具有效，上限5，同帧仍可接道具',()=>{const g=level2();drop(g);g.start();g.physics.collect('life');expect(g.lives).toBe(5);g.physics.collect('life');expect(g.lives).toBe(5);g.physics.triple();g.physics.powers.spawn(g.physics.paddleX,C.paddle.y,'life');Object.assign(g.physics.balls[0],{x:400,y:1080,vy:760,outsideArena:true});g.update(C.step);expect(g.lives).toBe(5);expect(g.physics.balls.length).toBeGreaterThan(0);});
