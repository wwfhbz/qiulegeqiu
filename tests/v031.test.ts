import {describe,it,expect} from 'vitest';
import {C} from '../src/GameConfig';
import {Physics,type Ball} from '../src/Physics';
const run=(p:Physics,t:number)=>{for(let i=0;i<Math.round(t/C.step);i++)p.advance(C.step);};
describe('双倍可见间距',()=>{
 it('可见间距按最新需求为160且厚度、长度不变，Canvas保留底部余量',()=>{expect(C.paddle.y-C.paddle.height/2-C.arena.y-C.arena.radius).toBe(160);expect(C.paddle.width).toBe(112);expect(C.paddle.height).toBe(12);expect(C.height-C.paddle.y).toBe(102);});
 it('高速百球在新挡板位置全部被接住并回到圆内',()=>{const p=new Physics();p.collect('wide');p.balls.length=0;for(let i=0;i<100;i++){const b:Ball={x:400+(i%5-2)*2,y:860+(i%3)*2,vx:0,vy:760,radius:C.ball.radius,alive:true,outsideArena:true};p.balls.push(b);}let bounced=0;for(let i=0;i<60;i++){p.advance(C.step);bounced=Math.max(bounced,p.balls.filter(b=>b.vy<0).length);}expect(p.balls.length).toBe(100);expect(bounced).toBe(100);expect(p.balls.every(b=>!b.outsideArena)).toBe(true);});
 it('漏球经过新挡板下方不提前清除，完全越过挡板下方死亡线才回收',()=>{const p=new Physics();p.paddleX=p.targetX=96;const b=p.balls[0];Object.assign(b,{x:400,y:C.paddle.y+12,vx:0,vy:440,outsideArena:true});run(p,.1);expect(b.alive).toBe(true);expect(b.y).toBeGreaterThan(C.paddle.y);run(p,.2);expect(b.alive).toBe(false);expect(p.balls.length).toBe(0);});
});
