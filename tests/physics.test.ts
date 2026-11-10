import { describe, it, expect } from 'vitest';
import { C } from '../src/GameConfig';
import { Blocks } from '../src/Blocks';
import { Physics, boundary, blockCollision, paddleCollision, type Ball } from '../src/Physics';
const ball = (x: number, y: number, vx = 440, vy = 0): Ball => ({ x, y, vx, vy, radius: C.ball.radius, alive: true });
describe('核心物理', () => {
  it('圆形边界沿法线反射并纠正位置', () => { const b = ball(760,492); boundary(b); expect(b.vx).toBeLessThan(0); expect(b.x).toBeLessThan(760); });
  it('斜向撞墙保持速率', () => { const b = ball(660,232,300,-300); const speed = Math.hypot(b.vx,b.vy); boundary(b); expect(b.vx).toBeLessThan(0); expect(b.vy).toBeGreaterThan(0); expect(Math.hypot(b.vx,b.vy)).toBeCloseTo(speed); });
  it('实际命中方块只增加一次计数', () => { const blocks = new Blocks(); const i = blocks.alive.findIndex(x => x === 1); const x = blocks.left + i % blocks.cols * C.grid.step; const y = blocks.top + Math.floor(i / blocks.cols) * C.grid.step; const b = ball(x + 4, y - 3,0,440); expect(blockCollision(b,blocks)).toBe(true); expect(blocks.removed).toBe(1); expect(blocks.hit(i)).toBe(false); expect(blocks.removed).toBe(1); });
  it('已消除方块不重复计数', () => { const b = new Blocks(); const i = b.alive.findIndex(x => x === 1); b.hit(i); b.hit(i); expect(b.removed).toBe(1); });
  it('挡板让球向上反弹，撞击偏移改变方向', () => { const b = ball(420,C.paddle.y-8,0,440); expect(paddleCollision(b,400)).toBe(true); expect(b.vy).toBeLessThan(0); expect(b.vx).toBeGreaterThan(0); });
  it('重开恢复方块和单球', () => { const p = new Physics(); const total = p.blocks.total; p.blocks.hit(p.blocks.alive.findIndex(x=>x===1)); p.reset(); expect(p.blocks.remaining).toBe(total); expect(p.blocks.removed).toBe(0); expect(p.balls).toHaveLength(1); });
  it('30、60、144赫兹获得一致物理结果', () => { const run = (hz:number) => { const p = new Physics(); for(let i=0;i<hz*4;i++) p.advance(1/hz); return p; }; const a=run(30); for(const hz of [60,144]) { const b=run(hz); expect(b.ticks).toBe(480); expect(b.balls.length).toBe(a.balls.length); for(let i=0;i<a.balls.length;i++){ expect(b.balls[i].x).toBeCloseTo(a.balls[i].x,8); expect(b.balls[i].y).toBeCloseTo(a.balls[i].y,8); } expect(b.blocks.removed).toBe(a.blocks.removed); } });
  it('生成至少3000块且所有角都在圆内，底部留空', () => { const b = new Blocks(); expect(b.total).toBeGreaterThanOrEqual(3000); for(let i=0;i<b.alive.length;i++) if(b.alive[i]) { const x=b.left+i%b.cols*C.grid.step; const y=b.top+Math.floor(i/b.cols)*C.grid.step; expect(y+C.grid.size).toBeLessThanOrEqual(b.top+720*.8); for(const dx of [0,8]) for(const dy of [0,8]) expect(Math.hypot(x+dx-400,y+dy-492)).toBeLessThanOrEqual(360); } });
  it('高速球不能穿过一排薄方块', () => { const p = new Physics(); const row=63; const i=row*p.blocks.cols+40; expect(p.blocks.alive[i]).toBe(1); const y=p.blocks.top+row*C.grid.step; p.balls=[ball(404,y+20,0,-760)]; p.advance(1/30); expect(p.blocks.removed).toBeGreaterThan(0); expect(p.balls[0].vy).toBeGreaterThan(0); });
  it('圆形边界不再按Canvas越界直接判死', () => { const b=ball(400,C.height+10,0,440); boundary(b); expect(b.alive).toBe(true); });
  it('挡板目标限制在竞技场宽度内且平滑移动', () => { const p=new Physics(); p.setTarget(10000); p.update(C.step); expect(p.paddleX-400).toBeLessThanOrEqual(C.paddle.speed*C.step); expect(p.targetX+C.paddle.width/2).toBeLessThanOrEqual(C.arena.x+C.arena.radius); });
});
