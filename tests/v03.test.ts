import {it,expect,describe} from 'vitest';
import {Physics,boundary,type Ball} from '../src/Physics';
import {C} from '../src/GameConfig';
const run=(p:Physics,t:number)=>{for(let i=0;i<Math.round(t/C.step);i++)p.advance(C.step);};
const ball=(x:number,y:number,vx=0,vy=440):Ball=>({x,y,vx,vy,radius:C.ball.radius,alive:true,outsideArena:false});
describe('圆外水平挡板',()=>{
 it('挡板顶边与圆底保持160逻辑像素间距',()=>{expect(C.paddle.y-C.paddle.height/2-(C.arena.y+C.arena.radius)).toBe(160);});
 it('出口出球继续运动并被圆外挡板弹回圆内',()=>{const p=new Physics();const b=ball(400,830);p.balls=[b];run(p,.12);expect(b.alive).toBe(true);expect(b.outsideArena).toBe(true);expect(b.y).toBeGreaterThan(852);run(p,.32);expect(b.vy).toBeLessThan(0);run(p,.42);expect(b.outsideArena).toBe(false);expect(b.y).toBeLessThan(830);});
 it('漏接球经过挡板仍存活，离开Canvas才回收',()=>{const p=new Physics();p.paddleX=p.targetX=100;const b=ball(400,830);p.balls=[b];run(p,.45);expect(b.y).toBeGreaterThan(C.paddle.y);expect(b.alive).toBe(true);run(p,.4);expect(b.alive).toBe(false);expect(p.balls).toHaveLength(0);});
 it('圆外球撞闭合弧外侧反弹，不被吸入圆内',()=>{const b=ball(600,800,0,-440);b.outsideArena=true;boundary(b);expect(Math.hypot(b.x-400,b.y-492)).toBeGreaterThanOrEqual(C.arena.radius+b.radius);expect(b.outsideArena).toBe(true);});
 it('水平左右移动、加宽与恢复始终不出Canvas',()=>{const p=new Physics();for(const wide of [true,false]){if(wide)p.collect('wide');else p.wideRemaining=0;for(const x of [-1000,10000]){p.setTarget(x);run(p,1);expect(p.paddleX-p.paddleWidth/2).toBeGreaterThanOrEqual(C.arena.x-C.arena.radius);expect(p.paddleX+p.paddleWidth/2).toBeLessThanOrEqual(C.arena.x+C.arena.radius);expect(C.paddle.y).toBe(1018);}}});
 it('圆外拾取三倍球不被瞬移回圆内',()=>{const p=new Physics();p.balls[0].x=400;const y=p.balls[0].y;p.triple();expect(p.balls).toHaveLength(3);for(const b of p.balls){expect(b.outsideArena).toBe(true);expect(b.y).toBe(y);expect(b.alive).toBe(true);}});
 it('挡板两端位置均可发射穿过出口',()=>{for(const x of [96,400,704]){const p=new Physics();p.paddleX=p.targetX=x;p.balls=[p.newBall()];const b=p.balls[0];let entered=false;for(let i=0;i<120;i++){p.advance(C.step);if(!b.outsideArena)entered=true;}expect(b.alive).toBe(true);expect(entered).toBe(true);}});
 it('掉落道具可穿过圆底到达圆外挡板',()=>{const p=new Physics();p.powers.spawn(400,850,'wide');run(p,1.3);expect(p.wideRemaining).toBeGreaterThan(0);});
});
