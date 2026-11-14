import {it,expect} from 'vitest';
import {Game} from '../src/Game';
import {Blocks} from '../src/Blocks';
import {Physics,boundary,type Ball} from '../src/Physics';
import {V17_LEVELS as LEVELS,LEVELS as CURRENT_LEVELS,V13_LEVELS,V15_LEVELS,V16_LEVELS,LATER_LAYOUTS,LATER_DROP_EVERY,BASE_DROP_EVERY,V15_LATER_BRICK_COUNTS,dropMultiplier,powerProfile} from '../src/Levels';
import {LEGACY_LEVELS} from '../src/LegacyLevels';
import {C} from '../src/GameConfig';
import {wallForLevel} from '../src/ArenaGeometry';
import {weightedPower,seededRandom} from '../src/PowerRules';
import {FRAME} from '../src/WorldGeometry';
function clear(g:Game){g.start();for(let i=0;i<g.physics.blocks.alive.length;i++)g.physics.blocks.hit(i);g.update(0);}
it('十二关，新关600/1200，无障碍、真实200/160开口、0.85/0.92球速、1.3/1.15挡板',()=>{
 const g=new Game();expect(g.levels.count).toBe(12);
 for(const [index,count,width,speed,paddle] of [[0,600,200,.85,1.3],[1,1200,160,.92,1.15]]){const l=LEVELS[index],p=new Physics();p.level=l;p.speedScale=l.speedScale;p.reset();expect(p.blocks.total).toBe(count);expect(p.blocks.remaining).toBe(count);expect(p.obstacles.items).toHaveLength(0);expect(p.wall.visibleExitWidth).toBeCloseTo(width);expect(p.launchSpeed).toBeCloseTo(C.ball.speed*speed);expect(p.paddleWidth).toBeCloseTo(C.paddle.width*paddle);expect(p.balls).toHaveLength(1);p.advance(C.step);expect(Math.hypot(p.balls[0].vx,p.balls[0].vy)).toBeCloseTo(C.ball.speed*speed);}
});
it('新手网格准确计数、统一大小、细间隙、四邻域连通无孤立块',()=>{
 for(const l of LEVELS.slice(0,2)){const b=new Blocks();b.reset(l.obstacles,l);expect(b.size).toBeLessThan(b.step);expect(b.alive).toBeInstanceOf(Uint8Array);const seen=new Set<number>(),queue=[b.alive.findIndex(Boolean)];seen.add(queue[0]);for(let n=0;n<queue.length;n++){const i=queue[n],row=Math.floor(i/b.cols),col=i%b.cols;for(const [r,c] of [[row-1,col],[row+1,col],[row,col-1],[row,col+1]]){const j=r*b.cols+c;if(r>=0&&r<b.rows&&c>=0&&c<b.cols&&b.alive[j]&&!seen.has(j)){seen.add(j);queue.push(j);}}}expect(seen.size).toBe(l.brickCount);}
});
it('第3～12关铺满砖区：网格逐关变细、砖数递增、覆盖率与新手关一致；机关/球速/出口不变；V1.7掉落逐关变稀',()=>{
 const coverage=(level:typeof LEVELS[number])=>{const {brickCount:_count,...grid}=level,full=new Blocks();full.reset(level.obstacles,grid);return level.brickCount!/full.total;};
 expect(coverage(LEVELS[0])).toBeGreaterThan(.85);expect(coverage(LEVELS[1])).toBeGreaterThan(.85);
 for(const old of LEGACY_LEVELS){const current=LEVELS[old.number+1],[step,count]=LATER_LAYOUTS[old.number-1];expect(current.obstacles).toEqual(old.obstacles);expect(current.speedScale).toBe(old.speedScale);expect(wallForLevel(current)).toEqual(wallForLevel(old));expect(current.gridStep).toBe(step);expect(current.gridSize).toBe(step-2);const fresh=new Blocks();fresh.reset(current.obstacles,current);expect(fresh.total).toBe(count);const c=coverage(current);expect(c).toBeGreaterThan(.85);expect(c).toBeLessThan(.96);}
 for(let i=1;i<LATER_LAYOUTS.length;i++){expect(LATER_LAYOUTS[i][1]).toBeGreaterThan(LATER_LAYOUTS[i-1][1]);expect(LATER_LAYOUTS[i][0]).toBeLessThanOrEqual(LATER_LAYOUTS[i-1][0]);}
 expect(LATER_LAYOUTS[0][0]).toBeLessThan(LEVELS[1].gridStep!);
 // V1.7 drop density: 20% → 12% → one random drop every 14, 18 … 50 bricks. V1.6 stays frozen at 1/14 then 1/28.
 expect(LEVELS[0].brickPowers?.fraction).toBe(.2);expect(LEVELS[1].brickPowers?.fraction).toBe(.12);
 expect(BASE_DROP_EVERY).toBe(C.power.dropEvery);expect(LEVELS.slice(2).map(l=>Math.round(C.power.dropEvery/dropMultiplier(l)))).toEqual([...LATER_DROP_EVERY]);
 expect(V16_LEVELS.slice(2).map(dropMultiplier)).toEqual([1,1,.5,.5,.5,.5,.5,.5,.5,.5]);expect(V16_LEVELS.slice(2).map(l=>l.brickCount)).toEqual(LEVELS.slice(2).map(l=>l.brickCount));
 expect(V15_LEVELS[0].brickPowers?.fraction).toBe(.35);expect(V15_LEVELS.slice(2).map(l=>l.brickCount)).toEqual([...V15_LATER_BRICK_COUNTS]);expect(V15_LEVELS.slice(2).every(l=>l.gridStep===undefined)).toBe(true);
 expect(V13_LEVELS[0].brickPowers?.fraction).toBe(.8);expect(V13_LEVELS[1].brickPowers?.fraction).toBe(.5);
 for(const old of LEGACY_LEVELS){const shifted=V13_LEVELS[old.number+1];expect(shifted.number).toBe(old.number+2);expect(shifted.name).toBe(old.name);expect(shifted.speedScale).toBe(old.speedScale);expect(shifted.obstacles).toEqual(old.obstacles);const a=new Blocks(),b=new Blocks();a.reset(old.obstacles,old);b.reset(shifted.obstacles,shifted);expect(a.alive).toEqual(b.alive);expect(a.total).toBe(b.total);expect(wallForLevel(old)).toEqual(wallForLevel(shifted));expect(dropMultiplier(shifted)).toBe(dropMultiplier(old));const r1=seededRandom(99),r2=seededRandom(99);for(let i=0;i<100;i++)expect(weightedPower(powerProfile(shifted),r1)).toBe(weightedPower(powerProfile(old),r2));}
 expect(V13_LEVELS[2].name).toBe('初试身手');expect(LEVELS[2].name).toBe('初试身手');expect(new Blocks().total).toBe(4203);
});
it('新手通关自动进入下一关，继承生命分数，回合球数恢复1',()=>{const g=new Game();g.start();Object.assign(g.physics.balls[0],{x:400,y:1080,vy:760,outsideArena:true});g.update(C.step);expect(g.lives).toBe(4);clear(g);expect(g.levels.current.number).toBe(2);expect(g.physics.blocks.total).toBe(1446);expect(g.state).toBe('ready');const score=g.score.total;g.start();g.physics.triple();clear(g);expect(g.levels.current.number).toBe(3);expect(g.physics.blocks.total).toBe(1634);expect(g.physics.balls).toHaveLength(1);expect(g.lives).toBe(4);expect(g.score.total).toBeGreaterThan(score);clear(g);expect(g.state).toBe('levelComplete');expect(g.levels.current.number).toBe(3);});
it('更大出口仍可漏接死亡，多球全灭只扣一次，不改变死亡线',()=>{for(const config of LEVELS.slice(0,2)){const g=new Game();if(config.number===2)clear(g);expect(g.levels.current.number).toBe(config.number);g.start();g.physics.triple();for(const b of g.physics.balls)Object.assign(b,{x:300,y:FRAME.deathY+b.radius+2,vy:760,outsideArena:true});g.update(C.step);expect(g.lives).toBe(4);expect(g.physics.balls).toHaveLength(1);expect(FRAME.deathY).toBe(C.paddle.y+C.paddle.height/2+C.frame.deathGap);}});
it('开口视觉和物理一致，200口处可通行而旧106口仍反弹',()=>{const make=():Ball=>({x:470,y:C.arena.y+C.arena.radius-4,vx:0,vy:-440,radius:C.ball.radius,alive:true,outsideArena:true});const open=make(),closed=make();boundary(open,wallForLevel(LEVELS[0]));boundary(closed,wallForLevel(LEVELS[2]));expect(open.vy).toBeLessThan(0);expect(closed.vy).toBeGreaterThan(0);});
it('十二关全部完成最终胜利，通关和死亡同帧优先通关',()=>{const g=new Game();for(let n=1;n<=12;n++){expect(g.levels.current.number).toBe(n);clear(g);if(n>2&&n<12)g.nextLevel();}expect(g.state).toBe('victory');expect(g.lives).toBe(5);const h=new Game();h.start();for(let i=0;i<h.physics.blocks.alive.length;i++)h.physics.blocks.hit(i);Object.assign(h.physics.balls[0],{x:400,y:1080,vy:760,outsideArena:true});h.update(C.step);expect(h.levels.current.number).toBe(2);expect(h.lives).toBe(5);});
import {assertGlobalBoard,CAMPAIGN_RANKING_SCOPE,RULES_VERSION,LEGACY_RULES_VERSION} from '../shared/Challenge';
it('永久闯关榜按mode/scope识别，旧隔离API不可冒充；历史/未来元数据不再划分榜单',()=>{
 expect(()=>assertGlobalBoard({})).toThrow('后端需要更新');expect(()=>assertGlobalBoard({board:'global',rankingRulesVersion:RULES_VERSION})).toThrow();
 for(const tag of [LEGACY_RULES_VERSION,RULES_VERSION,'future'])expect(()=>assertGlobalBoard({board:'global',rankingRulesVersion:tag,rankingScope:CAMPAIGN_RANKING_SCOPE})).not.toThrow();
 expect(()=>assertGlobalBoard({board:'endless',rankingScope:CAMPAIGN_RANKING_SCOPE})).toThrow();
});
import {tutorialTolerance} from './helpers/tutorialTolerance';
it('真实碰撞模型45组出球容错检查，不接球仍会死亡，350ms跟踪可接住',()=>{const [old,...tutorials]=tutorialTolerance();for(const report of tutorials){expect(report.stationary.caught).toBeGreaterThanOrEqual(old.stationary.caught);expect(report.stationary.dead).toBeGreaterThan(0);expect(report.trackingAfter350ms.caught).toBe(45);}});

it('V1.9：第1关不变；第2～12关铺满整个球体到底线（比V1.8多13%～26%），机关扫过区域保持空出；第2关×3/加宽数不变',()=>{
 const counts=CURRENT_LEVELS.map(l=>{const b=new Blocks();b.reset(l.obstacles??[],l);return b.total;});
 expect(counts).toEqual([600,1446,1634,1852,2139,2105,2518,2450,2444,2949,2928,2894]);
 const old=LEVELS.map(l=>{const b=new Blocks();b.reset(l.obstacles??[],l);return b.total;});
 for(let i=1;i<12;i++){expect(counts[i]/old[i]).toBeGreaterThan(1.12);expect(counts[i]/old[i]).toBeLessThan(1.3);}
 expect(CURRENT_LEVELS[0]).toBe(LEVELS[0]);
 for(const l of CURRENT_LEVELS.slice(1)){expect(l.fullFloorGap).toBe(64);expect(l.obstacles).toEqual(LEVELS[l.number-1].obstacles);expect(l.speedScale).toBe(LEVELS[l.number-1].speedScale);}
 expect(CURRENT_LEVELS[1].brickPowers).toEqual({fraction:.1,tripleShare:.6,stratumSize:10});
 expect(CURRENT_LEVELS.slice(2).map(powerProfile)).toEqual(['firstSkills',...Array(9).fill('scarceSkills')]);
});
