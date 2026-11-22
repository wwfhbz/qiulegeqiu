import {expect,it} from 'vitest';
import {Boss,bossStages} from '../src/campaign/Boss';
import {CAMPAIGN_PATTERNS,Cell} from '../src/campaign/Patterns';
import {LEVELS,V110_LEVELS} from '../src/Levels';
import {Blocks} from '../src/Blocks';
import {C} from '../src/GameConfig';

it('1.11关卡表：前两关与1.10相同，第3～12关为图案关，难度参数逐关加大，第8/12关有Boss',()=>{
 expect(LEVELS[0]).toBe(V110_LEVELS[0]);expect(LEVELS[1]).toBe(V110_LEVELS[1]);
 const later=LEVELS.slice(2);expect(later.every(l=>!!l.pattern&&!!l.intro)).toBe(true);
 for(let i=1;i<later.length;i++){expect(later[i].speedScale).toBeGreaterThanOrEqual(later[i-1].speedScale);expect(later[i].paddleScale!).toBeLessThanOrEqual(later[i-1].paddleScale!);expect(later[i].exitWidth!).toBeLessThanOrEqual(later[i-1].exitWidth!);}
 expect(LEVELS.filter(l=>l.pattern?.boss).map(l=>[l.number,l.pattern!.boss!.hp])).toEqual([[8,40],[12,80]]);
 // Total hits needed grow level by level (the boss level 8 is the mid-campaign peak).
 const hits=LEVELS.map(l=>{const b=new Blocks();b.reset(l.obstacles??[],l);let n=l.pattern?.boss?.hp??0;for(let i=0;i<b.alive.length;i++)n+=b.hp[i];return n;});
 for(let i=1;i<12;i++)if(i!==8)expect(hits[i]).toBeGreaterThan(hits[i-1]);
 expect(CAMPAIGN_PATTERNS).toHaveLength(12);
});
it('Boss：钢盾实心处反弹不掉血，从缺口进入撞核心才掉血；半血/三分之一血进入下一阶段',()=>{
 const config=LEVELS[7].pattern!.boss!,boss=new Boss(config),shield=config.shields[0],r=shield.radius*C.arena.radius;
 // Aim at the solid part of the ring (opposite the gap) from outside: bounces outward, core untouched.
 const solid=boss.angles[0]+Math.PI,ball={x:boss.x+Math.cos(solid)*(r+shield.width*C.arena.radius/2+3),y:boss.y+Math.sin(solid)*(r+shield.width*C.arena.radius/2+3),vx:-Math.cos(solid)*400,vy:-Math.sin(solid)*400,radius:C.ball.radius};
 expect(boss.collide(ball)).toBe('shield');expect(ball.vx*Math.cos(solid)+ball.vy*Math.sin(solid)).toBeGreaterThan(0);expect(boss.hp).toBe(40);
 // Touching the core reflects the ball; damage() is the per-hit rule.
 const inside={x:boss.x+boss.radius+C.ball.radius-1,y:boss.y,vx:-400,vy:0,radius:C.ball.radius};expect(boss.collide(inside)).toBe('core');expect(inside.vx).toBeGreaterThan(0);
 expect(bossStages(config)).toEqual([20]);for(let i=0;i<19;i++)expect(boss.damage()).toBeUndefined();expect(boss.damage()).toBe(1);expect(boss.stage).toBe(1);
 const final=new Boss(LEVELS[11].pattern!.boss!);expect(bossStages(final.config)).toEqual([54,27]);
 // Rings turn deterministically each tick and faster after a stage.
 const a0=boss.angles[0];boss.update(C.step);expect(boss.angles[0]).toBeCloseTo(a0+config.shields[0].speed*1.6*C.step,10);
});
it('第12关补砖带只在空格补2下硬砖；钢砖不计入过关数',()=>{
 const b=new Blocks();b.reset([],LEVELS[11]);expect(b.refillCells.length).toBeGreaterThan(50);
 const total=b.total,remaining=b.remaining;expect(b.refill(b.refillCells)).toHaveLength(0);
 for(const i of b.refillCells.slice(0,10)){b.crush=true;b.hit(i);}b.crush=false;
 const revived=b.refill(b.refillCells);expect(revived).toHaveLength(10);expect(b.total).toBe(total+10);expect(b.remaining).toBe(remaining);expect(revived.every(i=>b.kinds[i]===Cell.Hard2&&b.hp[i]===2)).toBe(true);
});
