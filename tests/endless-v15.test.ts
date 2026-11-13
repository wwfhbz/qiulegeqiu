import {it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Game} from '../src/Game';
import {C} from '../src/GameConfig';
import {EndlessField} from '../src/endless/EndlessField';
import {ENDLESS,ENDLESS_V6 as ENDLESS_CURRENT,ENDLESS_V4,ENDLESS_V5,ENDLESS_V6,ENDLESS_V15_POWER_WEIGHTS,FIRE_OFFSETS_V15,endlessSettings,endlessPower,dropEvery,descentInterval,endlessVersion,type EndlessVariant} from '../src/endless/EndlessRules';
import {seededRandom} from '../src/Random';
import {ENDLESS_V6_RULES_VERSION as ENDLESS_RULES_VERSION,ENDLESS_V5_RULES_VERSION,ENDLESS_V4_RULES_VERSION,RULES_VERSION} from '../shared/Challenge';
import {MiniGameApp} from '../wechat-game/src/App';
import {wxFixture} from './helpers/WxFixture';
import {cloudKey} from '../wechat-game/src/social/Protocol';
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function game(seed=7,v:EndlessVariant=ENDLESS_CURRENT){const g=new Game();g.setMode('endless');g.physics.endless!.variant=v;g.journal.seed=seed;g.physics.setSeed(seed);g.physics.reset();g.start();return g;}
const live=(f:EndlessField)=>Array.from(f.alive.keys()).filter(i=>f.alive[i]);
const step=(g:Game,n:number)=>{for(let t=0;t<n;t++){for(const b of g.physics.balls)Object.assign(b,{x:400,y:920,vx:440,vy:0,outsideArena:true});g.update(C.step);}};
it.each([[0,12],[99,12],[100,13],[500,17],[1000,22],[2000,32],[3000,42],[3800,50],[5000,50]])('V1.5累计D=%s掉落间隔=%s',(d,n)=>expect(dropEvery(d)).toBe(n));
it('600tick开局、0.985整数递减、240封顶；20个初始逻辑行、88%填充率、不压线、世界编号随下沉稳定',()=>{
 expect(descentInterval(0)).toBe(600);for(const n of [1,10,20,60,1000])expect(descentInterval(n)).toBe(Math.max(240,Math.round(600*.985**n)));
 expect(endlessSettings().initialRows).toBe(20);expect(ENDLESS.rowFill).toBe(.88);const f=new EndlessField();f.start(7);expect(f.blocked).toBe(false);expect(f.pressure).toBe(0);
 expect(Math.max(...live(f).map(i=>Math.floor(i/f.cols)))).toBe(19);expect(f.floorRow).toBeGreaterThan(19);expect(f.worldRow(0)).toBe(19);expect(f.worldRow(19)).toBe(0);expect(f.alive.slice(20*f.cols).some(Boolean)).toBe(false);
 // Match every masked cell to its original independent seeded world-row stream (not Math.random).
 for(let row=0;row<20;row++){const world=f.worldRow(row),random=seededRandom((7^Math.imul(world+1,0x9e3779b1))>>>0);for(let col=0;col<f.cols;col++){const spawned=random()<.88,x=f.left+col*f.step,y=f.top+row*f.step;let inside=true;for(const dx of [0,f.size])for(const dy of [0,f.size])if((x+dx-C.arena.x)**2+(y+dy-C.arena.y)**2>C.arena.radius**2)inside=false;expect(!!f.alive[row*f.cols+col]).toBe(spawned&&inside);}}
 const i=live(f).find(i=>Math.floor(i/f.cols)===10)!,id=f.worldId(i);for(let n=0;n<599;n++)expect(f.tick()).toBe(false);expect(f.descents).toBe(0);expect(f.tick()).toBe(true);expect(f.indexOfWorld(id)).toBe(i+f.cols);
});
it('V1.5权重280/150/130/130/140/167/3，抽取边界和消费次数准确，同seed序列一致',()=>{
 expect(ENDLESS_V15_POWER_WEIGHTS.map(r=>r.weight)).toEqual([280,150,130,130,140,167,3]);let start=0;for(const row of ENDLESS_V15_POWER_WEIGHTS){for(const n of [start,start+row.weight-1]){const rng=vi.fn(()=>n/1000);expect(endlessPower(rng)).toBe(row.kind);expect(rng).toHaveBeenCalledTimes(1);}start+=row.weight;}expect(start).toBe(1000);
 const draw=()=>{const rng=seededRandom(91);return Array.from({length:2000},()=>endlessPower(rng));};expect(draw()).toEqual(draw());
});
it('V1.4黄金样本冻结：权重/技能/间隔和10000tick砖墙均不被20行覆盖，V1.3仍18行',()=>{
 const samples=readFileSync(new URL('./fixtures/endless-v14-golden.jsonl',import.meta.url),'utf8').trim().split('\n').map(s=>JSON.parse(s));
 for(const sample of samples){const f=new EndlessField();f.start(sample.seed,ENDLESS_V5);const rng=seededRandom(sample.seed);expect(hash(Array.from({length:200},()=>endlessPower(rng,ENDLESS_V5)))).toBe(sample.powers);expect([0,1,10,1000].map(n=>descentInterval(n,ENDLESS_V5))).toEqual(sample.intervals);expect([0,99,100,199,200,1000,6000].map(n=>dropEvery(n,ENDLESS_V5))).toEqual(sample.drops);
  const settings=endlessSettings(ENDLESS_V5);for(const key of Object.keys(sample.skills))expect(settings[key as keyof typeof settings]).toEqual(sample.skills[key]);
  for(let t=1;t<=10000;t++){f.tick();if(t%6===0){const cells=live(f);if(cells.length)f.hit(cells[t*7919%cells.length]);}}expect(hash([f.descents,f.sinceDescent,f.pressure,f.destroyedTotal,Array.from(f.alive)])).toBe(sample.field);
 }
 expect(endlessSettings(ENDLESS_V4).initialRows).toBe(18);expect(endlessSettings(ENDLESS_V5).initialRows).toBe(18);expect(endlessVersion(ENDLESS_V5)).toBe(ENDLESS_V5_RULES_VERSION);expect(endlessVersion(ENDLESS_V6)).toBe(ENDLESS_RULES_VERSION);
});
it('批量消砖与重复命中：阈值12…96、108、121，按实际掉落后累计D计算；未接住不生效',()=>{
 const g=game(),p=g.physics,f=p.endless!,spawn=vi.spyOn(p.powers,'spawn'),cells=live(f);for(let n=1;n<=121;n++){f.hit(cells[n-1]);f.hit(cells[n-1]);if(n===99||n===100||n===107)expect(spawn).toHaveBeenCalledTimes(8);if(n===108||n===120)expect(spawn).toHaveBeenCalledTimes(9);}expect(spawn).toHaveBeenCalledTimes(10);expect(p.balls).toHaveLength(1);expect(p.wideRemaining).toBe(0);expect(g.journal.events.some(e=>e.type==='power')).toBe(false);
 p.powers.update(100,0,0,()=>{throw Error('不能凭掉落触发效果');});expect(p.powers.items.some(d=>d.alive)).toBe(false);expect(p.balls).toHaveLength(1);
});
it('新版1.8倍8秒、重复刷新、边界合法及暂停冻结；旧版V1.4为2倍8秒、V1.3和闯关为1.8倍5秒',()=>{
 for(const [v,scale,seconds] of [[ENDLESS_V4,1.8,5],[ENDLESS_V5,2,8],[ENDLESS_V6,1.8,8]] as const){const g=game(7,v),p=g.physics,normal=p.paddleWidth;p.setTarget(799);p.paddleX=p.targetX;p.collect('wide');expect(p.paddleWidth).toBeCloseTo(normal*scale);expect(p.wideRemaining).toBe(seconds);expect(p.paddleX+p.paddleWidth/2).toBeLessThanOrEqual(C.width-C.paddle.margin);step(g,120);p.collect('wide');expect(p.wideRemaining).toBe(seconds);expect(p.paddleWidth).toBeCloseTo(normal*scale);g.pause();const since=p.endless!.sinceDescent;g.update(100);expect(p.wideRemaining).toBe(seconds);expect(p.endless!.sinceDescent).toBe(since);g.start();step(g,seconds*120+1);expect(p.paddleWidth).toBeCloseTo(normal);expect(p.wideRemaining).toBe(0);}
 const g=new Game();g.start();const normal=g.physics.paddleWidth;g.physics.collect('wide');expect(g.physics.paddleWidth).toBeCloseTo(normal*1.8);expect(g.physics.wideRemaining).toBe(5);expect(g.rulesVersion).toBe(RULES_VERSION);
});
it('火焰固定12偏移，只有13格而非5×5，不递归/重复消除，边缘裁剪；穿透4秒火焰6秒可叠加且暂停停止',()=>{
 const g=game(),p=g.physics,f=p.endless!;expect(FIRE_OFFSETS_V15).toEqual([[-2,0],[-1,0],[1,0],[2,0],[0,-2],[0,-1],[0,1],[0,2],[-1,-1],[-1,1],[1,-1],[1,1]]);
 const center=live(f).find(i=>{const r=Math.floor(i/f.cols),c=i%f.cols;return r>2&&r<16&&c>2&&c<f.cols-3&&FIRE_OFFSETS_V15.every(([dx,dy])=>f.alive[(r+dy)*f.cols+c+dx]);})!;expect(center).toBeDefined();const row=Math.floor(center/f.cols),col=center%f.cols,expected=[center,...FIRE_OFFSETS_V15.map(([dx,dy])=>(row+dy)*f.cols+col+dx)],before=new Set(live(f)),start=g.journal.events.length;
 const burn=(i:number)=>(p as unknown as {burn(i:number):void}).burn(i);f.hit(center);burn(center);expect([...before].filter(i=>!f.alive[i]).sort((a,b)=>a-b)).toEqual(expected.slice().sort((a,b)=>a-b));expect(g.journal.events.slice(start).filter(e=>e.type==='hit')).toHaveLength(13);burn(center);expect(g.journal.events.slice(start).filter(e=>e.type==='hit')).toHaveLength(13);expect(()=>burn(0)).not.toThrow();
 p.collect('pierce');p.collect('fire');expect(p.pierceRemaining).toBe(4);expect(p.fireRemaining).toBe(6);g.pause();g.update(100);expect(p.pierceRemaining).toBe(4);expect(p.fireRemaining).toBe(6);g.start();step(g,481);expect(p.pierceRemaining).toBe(0);expect(p.fireRemaining).toBeGreaterThan(1.9);step(g,240);expect(p.fireRemaining).toBe(0);
});
it('闪电最多12块、最低行/球水平位置优先；不足12只取现存，+100拾取得分及掉落统计保持',()=>{
 const g=game(),p=g.physics,f=p.endless!;let pickupPoints=-1;const collect=p.onPowerCollected;p.onPowerCollected=(k,id)=>{collect?.(k,id);pickupPoints=g.score.total;};p.balls[0].x=300;const expected=live(f).sort((a,b)=>Math.floor(b/f.cols)-Math.floor(a/f.cols)||Math.abs(f.left+a%f.cols*f.step+f.size/2-300)-Math.abs(f.left+b%f.cols*f.step+f.size/2-300)||a-b).slice(0,12),start=g.journal.events.length;p.collect('lightning');expect(g.journal.events.slice(start).filter(e=>e.type==='hit').map(e=>e.index)).toEqual(expected.map(i=>f.worldId(i)));expect(f.destroyedTotal).toBe(12);expect(g.journal.events[start]).toMatchObject({type:'power',kind:'lightning'});expect(pickupPoints).toBe(100);
 for(const i of live(f).slice(5))f.hit(i);expect(f.remaining).toBe(5);p.lightning();expect(f.remaining).toBe(0);
});
it('+3最多100、÷2向上取整至少1不扣命、生命最多3；普通丢命保留累计计数',()=>{
 const g=game(),p=g.physics;for(let i=0;i<40;i++)p.collect('plus3');expect(p.balls).toHaveLength(100);p.halve();p.halve();p.halve();expect(p.balls).toHaveLength(13);for(let i=0;i<10;i++)p.halve();expect(p.balls).toHaveLength(1);expect(g.lives).toBe(3);p.collect('life');expect(g.lives).toBe(3);const f=p.endless!;f.hit(live(f)[0]);const destroyed=f.destroyedTotal,score=g.score.total;Object.assign(p.balls[0],{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);expect(g.lives).toBe(2);expect(f.destroyedTotal).toBe(destroyed);expect(g.score.total).toBe(score);g.start();p.collect('life');expect(g.lives).toBe(3);
});
it('Web和微信共用V1.5规则/初始20行/确定轨迹与得分；后台计时冻结，好友榜固定键不轮换',()=>{
 const fixture=wxFixture(),app=new MiniGameApp(fixture.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});try{const a=game(31),b=app.game;b.setMode('endless');b.physics.endless!.variant=ENDLESS_CURRENT;b.journal.seed=31;b.physics.setSeed(31);b.physics.reset();b.start();expect(b.rulesVersion).toBe(ENDLESS_RULES_VERSION);for(let n=0;n<1200;n++){a.update(C.step);b.update(C.step);}expect(b.journal.events).toEqual(a.journal.events);expect(b.score.total).toBe(a.score.total);expect(b.physics.balls).toEqual(a.physics.balls);expect(b.physics.endless!.descents).toBe(a.physics.endless!.descents);
 if(b.state==='ready')b.start();b.physics.collect('wide');const time=b.physics.wideRemaining,since=b.physics.endless!.sinceDescent;fixture.events.hide();b.update(100);fixture.events.show();expect(b.physics.wideRemaining).toBe(time);expect(b.physics.endless!.sinceDescent).toBe(since);expect(cloudKey('endless')).toBe('qqcj_endless_'+ENDLESS_V4_RULES_VERSION);
 }finally{app.dispose();}
});
