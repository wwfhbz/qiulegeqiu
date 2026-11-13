import {expect,it,vi} from 'vitest';
import {Game} from '../src/Game';
import {Physics} from '../src/Physics';
import {LEVELS,V13_LEVELS,type LevelConfig} from '../src/Levels';
import {C} from '../src/GameConfig';
import {allocateBrickPowers,brickPowerCounts} from '../src/BrickPowerRules';
import {MiniGameApp} from '../wechat-game/src/App';
import {wxFixture} from './helpers/WxFixture';
function counts(values:Uint8Array){return [0,1,2].map(n=>Array.from(values).filter(v=>v===n).length);}
function load(level:number,seed=4,levels:readonly LevelConfig[]=LEVELS){const p=new Physics();p.level=levels[level-1];p.setSeed(seed);p.reset();return p;}
it.each([[1,600,210,0,390,LEVELS,[3,4],[3,4]],[2,1200,360,240,600,LEVELS,[5],[3]],[1,600,480,0,120,V13_LEVELS,[8],[8]]] as const)('第%i关%d砖：X3=%d，加宽=%d，无道具=%d；50个种子配额准确且分层均匀',(level,total,triple,wide,none,levels,perGroup,triplesPerGroup)=>{
 let previous:Uint8Array|undefined,changed=false;
 for(let seed=0;seed<50;seed++){
  const p=load(level,seed,levels),b=p.blocks,cells=Array.from(b.alive.keys()).filter(i=>b.alive[i]);expect(b.total).toBe(total);
  const codes=cells.map(i=>b.powerKinds[i]);expect(counts(Uint8Array.from(codes))).toEqual([none,triple,wide]);
  expect(Array.from(b.powerKinds).every((v,i)=>!v||!!b.alive[i])).toBe(true);
  for(let n=0;n<cells.length;n+=10){const group=codes.slice(n,n+10);expect(perGroup).toContain(group.filter(Boolean).length);expect(triplesPerGroup).toContain(group.filter(v=>v===1).length);}
  expect(allocateBrickPowers(b.alive,levels[level-1].brickPowers,seed,level)).toEqual(b.powerKinds);
  if(previous&&previous.some((v,i)=>v!==b.powerKinds[i]))changed=true;previous=b.powerKinds.slice();
 }
 expect(changed).toBe(true);
});
it('非整除数量按四舍五入确定配额；非存活网格不参与分配',()=>{
 const alive=Uint8Array.from([1,0,1,1,1,0,1,1,1]);const config=LEVELS[1].brickPowers!;
 expect(brickPowerCounts(7,config)).toEqual({drops:4,triple:2,wide:2,none:3});
 expect(counts(allocateBrickPowers(alive,config,1,2))).toEqual([5,2,2]);
});
it.each([[1,210,210,0],[2,600,360,240]])('第%i关同帧击碎所有砖仍生成%d个真实掉落，无池容量丢弃、无重复',(level,total,triple,wide)=>{
 const p=load(level),b=p.blocks;for(let i=0;i<b.alive.length;i++){b.hit(i);b.hit(i);}
 const drops=p.powers.items.filter(d=>d.alive);expect(drops).toHaveLength(total);expect(drops.filter(d=>d.kind==='triple')).toHaveLength(triple);expect(drops.filter(d=>d.kind==='wide')).toHaveLength(wide);expect(new Set(drops.map(d=>d.dropId)).size).toBe(total);expect(b.removed).toBe(b.total);
});
it('未接住的密集掉落全部消失，不改变球数、生命和加宽效果',()=>{
 const g=new Game();g.start();const collected=vi.fn();g.physics.onPowerCollected=collected;
 for(let i=0;i<g.physics.blocks.alive.length;i++)g.physics.blocks.hit(i);
 for(let n=0;n<1100;n++)g.physics.powers.update(C.step,-10000,0,(kind,id)=>g.physics.collect(kind,id));
 expect(g.physics.powers.items.some(p=>p.alive)).toBe(false);expect(collected).not.toHaveBeenCalled();expect(g.physics.balls).toHaveLength(1);expect(g.lives).toBe(5);expect(g.physics.wideRemaining).toBe(0);
});
it('预分配X3必须落到挡板才生效；20→60、21→24，连续拾取封顶100',()=>{
 const p=load(1),i=p.blocks.powerKinds.findIndex(v=>v===1);p.blocks.hit(i);expect(p.balls).toHaveLength(1);
 const drop=p.powers.items.find(d=>d.alive)!;p.resetRound(false);for(let n=0;n<20;n++)p.balls.push(p.newBall());
 p.powers.spawn(drop.x,C.paddle.y-C.power.radius-C.paddle.height/2,'triple');p.powers.update(C.step,drop.x,p.paddleWidth,(kind,id)=>p.collect(kind,id));expect(p.balls).toHaveLength(60);
 p.resetRound(false);for(let n=0;n<21;n++)p.balls.push(p.newBall());p.collect('triple');expect(p.balls).toHaveLength(24);for(let n=0;n<40;n++){p.collect('triple');expect(p.balls.length).toBeLessThanOrEqual(100);}expect(p.balls).toHaveLength(100);
});
it('普通丢命保留分配、砖块进度、积分；清理残留道具，不重新抽签',()=>{
 const g=new Game();g.start();const i=g.physics.blocks.powerKinds.findIndex(v=>v===1),map=g.physics.blocks.powerKinds.slice();g.physics.blocks.hit(i);const score=g.score.total;
 for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);
 expect(g.lives).toBe(4);expect(g.physics.blocks.powerKinds).toEqual(map);expect(g.physics.blocks.alive[i]).toBe(0);expect(g.score.total).toBe(score);expect(g.physics.powers.items.every(d=>!d.alive)).toBe(true);g.start();expect(g.physics.blocks.hit(i)).toBe(false);
});
it('Web与微信同一预分配和日志，第二关同为1200砖',()=>{
 const f=wxFixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),web=new Game();
 try{for(const level of [1,2]){for(const g of [web,app.game]){g.journal.seed=42;g.physics.setSeed(42);g.start();expect(g.physics.blocks.total).toBe(level===1?600:1200);}expect(web.physics.blocks.powerKinds).toEqual(app.game.physics.blocks.powerKinds);expect(web.journal.events).toEqual(app.game.journal.events);if(level===1){for(const g of [web,app.game]){for(let i=0;i<g.physics.blocks.alive.length;i++)g.physics.blocks.hit(i);g.update(0);}}}
 }finally{web.dispose();app.dispose();}
});
it('第三至十二关配置、掉落间隔、类型随机序列和24格池保持不变',()=>{
 const current=new Physics(),old=new Physics();old.brickPowerVersion=1;
 for(const p of [current,old])p.setSeed(67);
 for(const level of LEVELS){const outputs:string[][]=[];for(const p of [current,old]){p.level=level;p.powerUpDropMultiplier=level.powerDropMultiplier??1;p.reset();const kinds:string[]=[];const spawn=p.powers.spawn.bind(p.powers);p.powers.spawn=(x,y,kind)=>{kinds.push(kind);spawn(x,y,kind);};for(let i=0;i<p.blocks.alive.length;i++)p.blocks.hit(i);p.powers.spawn=spawn;outputs.push(kinds);}
 if(level.number>=3){expect(outputs[0]).toEqual(outputs[1]);expect(current.blocks.powerKinds.every(v=>v===0)).toBe(true);expect(current.powers.items).toHaveLength(C.power.maxDrops);expect(current.level.obstacles).toEqual(old.level.obstacles);}}
});
import {scoreHistoryLines} from '../shared/ScoreHistory';
import {RULES_VERSION,V13_RULES_VERSION,PREVIOUS_RULES_VERSION,LEGACY_RULES_VERSION} from '../shared/Challenge';
it('独立新版规则与双端个人历史格式：旧记录明确标记、不换算、不显示为当前排名',()=>{
 expect(RULES_VERSION).toBe('1.5.0-arcade-5l-12lv-short-v3');expect(V13_RULES_VERSION).toBe('1.3.0-arcade-5l-12lv-drops-v2');expect(RULES_VERSION).not.toBe(PREVIOUS_RULES_VERSION);
 expect(scoreHistoryLines([{score:9,reached_level:3,rules_version:V13_RULES_VERSION}])).toEqual(['V1.3赛季记录：9 分 · 第3关']);
 expect(scoreHistoryLines([{score:314115,reached_level:5,rules_version:PREVIOUS_RULES_VERSION},{score:100,reached_level:1,rules_version:LEGACY_RULES_VERSION}])).toEqual(['旧版十二关记录：314115 分 · 第5关','旧版十关记录：100 分 · 第1关']);
 expect(scoreHistoryLines([],{score:1,reached_level:1})).toEqual([]);expect(scoreHistoryLines(undefined,{score:2,reached_level:1})).toEqual(['旧版记录：2 分 · 第1关']);
});
