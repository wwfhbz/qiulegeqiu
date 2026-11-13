import {expect,it} from 'vitest';
import {EndlessField} from '../src/endless/EndlessField';
import {ENDLESS,descentInterval,dropEvery,endlessSpeed,endlessStage,endlessPower,ENDLESS_POWER_WEIGHTS} from '../src/endless/EndlessRules';
import {C} from '../src/GameConfig';
import {seededRandom} from '../src/Random';

function field(seed=7){const f=new EndlessField();f.start(seed);return f;}
function snapshot(f:EndlessField){return Array.from(f.alive.slice(0,f.cols*f.rows)).join('');}

it('同一种子生成完全相同的砖墙；不同种子不同；所有砖都在圆内且在底线之上',()=>{
 const a=field(7),b=field(7),c=field(8);expect(snapshot(a)).toBe(snapshot(b));expect(snapshot(a)).not.toBe(snapshot(c));
 const {x,y,radius}=C.arena,floorY=a.top+2*radius*(1-C.grid.emptyFraction);
 for(let i=0;i<a.cols*a.rows;i++)if(a.alive[i]){const bx=a.left+i%a.cols*a.step,by=a.top+Math.floor(i/a.cols)*a.step;
  for(const dx of [0,a.size])for(const dy of [0,a.size])expect((bx+dx-x)**2+(by+dy-y)**2).toBeLessThanOrEqual(radius*radius+1e-6);
  expect(by+a.size).toBeLessThanOrEqual(floorY);}
 // Initial wall fills the top rows only.
 const lowest=Math.max(...Array.from(a.alive.keys()).filter(i=>a.alive[i]).map(i=>Math.floor(i/a.cols)));expect(lowest).toBe(ENDLESS.initialRows-1);
});
it('按递减间隔整体下沉一行：旧砖下移一格，顶部补新行，砖的世界编号不变',()=>{
 const f=field(),before=new Map<number,number>();for(let i=0;i<f.cols*f.rows;i++)if(f.alive[i])before.set(f.worldId(i),i);
 let ticks=0;while(!f.tick())ticks++;expect(ticks+1).toBe(descentInterval(0));expect(f.descents).toBe(1);
 for(const [id,index] of before){const now=f.indexOfWorld(id);if(now>=0)expect(now).toBe(index+f.cols);}
 expect(f.indexOfWorld(f.worldId(5*f.cols+22))).toBe(5*f.cols+22);
 expect(descentInterval(0)).toBe(720);expect(descentInterval(10)).toBeLessThan(720);expect(descentInterval(1000)).toBe(ENDLESS.descent.minTicks);
});
it('砖块压到底线时停止下沉；清掉底线那行后继续',()=>{
 const f=field();let guard=0;while(!f.blocked&&guard++<200000)f.tick();expect(f.blocked).toBe(true);
 const descents=f.descents;for(let n=0;n<5000;n++)f.tick();expect(f.descents).toBe(descents);
 for(let i=f.floorRow*f.cols;i<(f.floorRow+1)*f.cols;i++)f.hit(i);expect(f.blocked).toBe(false);
 for(let n=0;n<descentInterval(f.descents)&&f.descents===descents;n++)f.tick();expect(f.descents).toBe(descents+1);
});
it('击碎只记一次；被击碎的砖下沉后不会复活；编号失效后不可再击中',()=>{
 const f=field(),index=Array.from(f.alive.keys()).find(i=>f.alive[i])!,id=f.worldId(index),before=f.destroyedTotal;
 expect(f.hit(index)).toBe(true);expect(f.hit(index)).toBe(false);expect(f.destroyedTotal).toBe(before+1);expect(f.indexOfWorld(id)).toBe(-1);
 while(!f.tick());expect(f.indexOfWorld(id)).toBe(-1);expect(f.alive[index+f.cols]).toBe(0);
 expect(f.indexOfWorld(-1)).toBe(-1);expect(f.indexOfWorld(1e12)).toBe(-1);
});
it('数值曲线：球速0.9起逐行加快封顶1.25；掉落从每8块到每30块；阶段每10行+1',()=>{
 expect(endlessSpeed(0)).toBeCloseTo(.9);expect(endlessSpeed(1000)).toBe(1.25);
 expect(dropEvery(0)).toBe(8);expect(dropEvery(250)).toBe(9);expect(dropEvery(1e6)).toBe(30);
 expect(endlessStage(0)).toBe(1);expect(endlessStage(10)).toBe(2);expect(endlessStage(1e6)).toBe(100);
});
it('无尽道具表：没有×3和炸弹；+1生命0.3%；权重合计1000；抽样分布符合',()=>{
 expect(ENDLESS_POWER_WEIGHTS.reduce((s,r)=>s+r.weight,0)).toBe(1000);const kinds=ENDLESS_POWER_WEIGHTS.map(r=>r.kind);
 expect(kinds).not.toContain('triple');expect(kinds).not.toContain('bomb');expect(ENDLESS_POWER_WEIGHTS.find(r=>r.kind==='life')!.weight).toBe(3);
 const random=seededRandom(1),counts:Record<string,number>={};for(let i=0;i<100000;i++){const k=endlessPower(random);counts[k]=(counts[k]??0)+1;}
 expect(counts.life/100000).toBeGreaterThan(.001);expect(counts.life/100000).toBeLessThan(.005);expect(counts.plus3/100000).toBeGreaterThan(.25);
});
