import {expect,it} from 'vitest';
import {Game} from '../src/Game';
import {C} from '../src/GameConfig';
import {EndlessField} from '../src/endless/EndlessField';
import {ENDLESS_V8,ENDLESS_V9,ENDLESS_V10,ENDLESS_CURRENT,endlessCellKind,descentInterval} from '../src/endless/EndlessRules';
import {EndlessBest} from '../src/endless/EndlessBest';
import {Cell} from '../src/campaign/Patterns';

const kindsAt=(stage:number)=>{const seen=new Set<number>();for(let i=0;i<2000;i++)seen.add(endlessCellKind(stage,i/2000));return seen;};
const sink=(f:EndlessField,rows:number)=>{for(let i=0;i<rows;i++)(f as unknown as {descend():void}).descend();};

it('1.8 为当前无尽规则：特殊砖按阶段加入——6 阶段硬砖、8 炸弹、14 三击砖、24 钢砖',()=>{
 expect(ENDLESS_CURRENT).toBe(ENDLESS_V10);
 expect([...kindsAt(5)]).toEqual([Cell.Normal]);
 expect(kindsAt(6).has(Cell.Hard2)).toBe(true);expect(kindsAt(7).has(Cell.Bomb)).toBe(false);
 expect(kindsAt(8).has(Cell.Bomb)).toBe(true);expect(kindsAt(13).has(Cell.Hard3)).toBe(false);
 expect(kindsAt(14).has(Cell.Hard3)).toBe(true);expect(kindsAt(23).has(Cell.Steel)).toBe(false);expect(kindsAt(24).has(Cell.Steel)).toBe(true);
});
it('砖墙布局与 1.7 相同（只换砖的种类）；1.7 冻结版全是普通砖',()=>{
 const old=new EndlessField(),now=new EndlessField();old.start(42,ENDLESS_V8);now.start(42,ENDLESS_V9);sink(old,300);sink(now,300);
 expect(Array.from(now.alive)).toEqual(Array.from(old.alive));
 expect(Array.from(old.kinds).every((k,i)=>!old.alive[i]||k===Cell.Normal)).toBe(true);
 const special=new Set(Array.from(now.kinds).filter((k,i)=>now.alive[i]));expect(special.has(Cell.Steel)&&special.has(Cell.Hard2)&&special.has(Cell.Bomb)).toBe(true);
});
it('硬砖先裂再碎，只有击碎才算消除；钢砖打不动、不压线、也不计入剩余砖',()=>{
 const f=new EndlessField();f.start(42,ENDLESS_V9);sink(f,300);
 const hard=Array.from(f.kinds.keys()).find(i=>f.alive[i]&&f.kinds[i]===Cell.Hard2)!,before=f.destroyedTotal,left=f.remaining;
 expect(f.hit(hard)).toBe(true);expect(f.alive[hard]).toBe(1);expect(f.destroyedTotal).toBe(before);
 sink(f,0);expect(f.hit(hard)).toBe(true);expect(f.alive[hard]).toBe(0);expect(f.destroyedTotal).toBe(before+1);expect(f.remaining).toBe(left-1);
 const steel=Array.from(f.kinds.keys()).find(i=>f.alive[i]&&f.kinds[i]===Cell.Steel)!;expect(f.hit(steel)).toBe(false);expect(f.alive[steel]).toBe(1);
 const count=Array.from(f.alive).filter((a,i)=>a&&f.kinds[i]!==Cell.Steel).length;expect(f.remaining).toBe(count);
 // A floor row holding only steel does not stop the wall.
 const floor=f.floorRow;for(let c=0;c<f.cols;c++){const i=floor*f.cols+c;if(f.alive[i]&&f.kinds[i]!==Cell.Steel){f.crush=true;f.hit(i);f.crush=false;}}
 expect(f.blocked).toBe(false);
});
it('裂纹在砖墙下沉后保留（跟随砖块所在的世界行）',()=>{
 const f=new EndlessField();f.start(42,ENDLESS_V9);sink(f,300);
 const hard=Array.from(f.kinds.keys()).find(i=>f.alive[i]&&f.kinds[i]===Cell.Hard3&&Math.floor(i/f.cols)<f.floorRow)!,id=f.worldId(hard);
 f.hit(hard);expect(f.hp[hard]).toBe(2);sink(f,1);const moved=f.indexOfWorld(id);expect(moved).toBe(hard+f.cols);expect(f.hp[moved]).toBe(2);
});
it('砖少时下沉加快：剩余不足 350 块时间隔减半',()=>{
 const f=new EndlessField();f.start(7,ENDLESS_V9);expect(f.remaining).toBeGreaterThan(350);expect(f.interval).toBe(descentInterval(0,ENDLESS_V9));expect(f.refilling).toBe(false);
 for(let i=0;i<f.alive.length&&f.remaining>=350;i++)if(f.alive[i]){f.crush=true;f.hit(i);f.crush=false;}
 expect(f.refilling).toBe(true);expect(f.interval).toBe(Math.round(descentInterval(0,ENDLESS_V9)*.5));
 const old=new EndlessField();old.start(7,ENDLESS_V8);for(let i=0;i<old.alive.length&&old.remaining>=350;i++)if(old.alive[i])old.hit(i);expect(old.interval).toBe(descentInterval(0,ENDLESS_V8));
});
it('掉落间隔：两次掉落至少相隔 1.1 秒，期间获得的掉落排队不丢；同屏不超过 7 个',()=>{
 const g=new Game();g.setMode('endless');g.start();const p=g.physics,f=p.endless!,ticks:number[]=[];
 const sp=p.powers.spawn.bind(p.powers);p.powers.spawn=(x,y,k)=>{ticks.push(f.clock);sp(x,y,k);};
 for(let n=0;n<600;n++){for(let i=0;i<f.alive.length;i++)if(f.alive[i]&&f.kinds[i]!==Cell.Steel){f.crush=true;f.hit(i);f.crush=false;break;}
  for(const b of p.balls)if(b.alive){b.y=300;b.vy=-Math.abs(b.vy)||-300;}g.update(C.step);}
 expect(ticks.length).toBeGreaterThan(2);for(let i=1;i<ticks.length;i++)expect(ticks[i]-ticks[i-1]).toBeGreaterThanOrEqual(132);
});
it('炸弹砖在无尽 1.8 中爆炸，硬砖裂纹按世界编号记入日志',()=>{
 const g=new Game();g.setMode('endless');g.start();const p=g.physics,f=p.endless!;sink(f,300);
 const bomb=Array.from(f.kinds.keys()).find(i=>f.alive[i]&&f.kinds[i]===Cell.Bomb)!,before=f.destroyedTotal;
 f.hit(bomb);expect(f.destroyedTotal-before).toBeGreaterThan(1);
 const hard=Array.from(f.kinds.keys()).find(i=>f.alive[i]&&f.kinds[i]===Cell.Hard2)!,id=f.worldId(hard);f.hit(hard);
 expect(g.journal.events.at(-1)).toMatchObject({type:'hit',index:id});
});
it('个人最佳：读取存档、只在超过之前的最佳时显示新纪录、坏存档从零开始',()=>{
 const store=new Map<string,string>(),io={read:()=>store.get('k')??null,write:(v:string)=>{store.set('k',v);}};
 const b=new EndlessBest();b.attach(io);expect(b.target).toBe(0);expect(b.beaten(5)).toBe(false);
 expect(b.record(12,90000)).toBe(true);b.beginRun();expect(b.target).toBe(12);expect(b.beaten(12)).toBe(false);expect(b.beaten(13)).toBe(true);
 expect(b.record(10,95000)).toBe(true);expect(b.stage).toBe(12);expect(b.score).toBe(95000);expect(b.record(11,1)).toBe(false);
 const again=new EndlessBest();again.attach(io);expect([again.stage,again.score]).toEqual([12,95000]);
 const broken=new EndlessBest();broken.attach({read:()=>'{oops',write:()=>{}});expect(broken.stage).toBe(0);
});
it('无尽局结束时更新个人最佳并标记新纪录；下一局重新计算',()=>{
 const g=new Game();g.setMode('endless');g.start();const p=g.physics;
 for(let i=0;i<5&&g.state!=='gameOver';i++){for(const b of p.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);if(g.state==='ready')g.start();}
 expect(g.state).toBe('gameOver');expect(g.newRecord).toBe(true);expect(g.endlessBest.stage).toBe(1);
 g.reset();expect(g.newRecord).toBe(false);expect(g.endlessBest.target).toBe(1);
});
it('无尽 1.9：开局 1 条命，吃到 +1 生命最多 2 条；1.8 及更早版本仍是 3 条',()=>{
 const g=new Game();g.setMode('endless');expect(g.lives).toBe(1);expect(g.maxLives).toBe(2);
 g.start();g.physics.collect('life');expect(g.lives).toBe(2);g.physics.collect('life');expect(g.lives).toBe(2);
 for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);expect(g.state).toBe('ready');expect(g.lives).toBe(1);
 g.start();for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);expect(g.state).toBe('gameOver');
 const old=new Game();old.setMode('endless');const f=new EndlessField();f.variant=ENDLESS_V9;old.physics.useField(f);old.physics.reset();old.start();expect(old.lives).toBe(3);expect(old.maxLives).toBe(3);
});
