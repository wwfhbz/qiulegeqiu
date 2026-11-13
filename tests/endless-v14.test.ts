import {expect,it,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Game} from '../src/Game';
import {C} from '../src/GameConfig';
import {EndlessField} from '../src/endless/EndlessField';
import {ENDLESS,ENDLESS_V4,ENDLESS_V5,ENDLESS_V5 as ENDLESS_CURRENT,ENDLESS_POWER_WEIGHTS,ENDLESS_V14_POWER_WEIGHTS,FIRE_OFFSETS_V14,FIRE_OFFSETS_LEGACY,descentInterval as interval,dropEvery as drops,endlessPower as power,endlessSettings,endlessVersion,ENDLESS_VARIANTS,type EndlessVariant} from '../src/endless/EndlessRules';
import {seededRandom} from '../src/Random';
import {ENDLESS_V5_RULES_VERSION as ENDLESS_RULES_VERSION,ENDLESS_V4_RULES_VERSION,RULES_VERSION} from '../shared/Challenge';
import {MiniGameApp} from '../wechat-game/src/App';
import {wxFixture} from './helpers/WxFixture';
import {cloudKey} from '../wechat-game/src/social/Protocol';
const descentInterval=(n:number,v=ENDLESS_V5)=>interval(n,v),dropEvery=(n:number,v=ENDLESS_V5)=>drops(n,v),endlessPower=(r:()=>number,v=ENDLESS_V5)=>power(r,v);
function game(seed=7,v:EndlessVariant=ENDLESS_CURRENT){const g=new Game();g.setMode('endless');g.physics.endless!.variant=v;g.journal.seed=seed;g.physics.setSeed(seed);g.physics.reset();g.start();return g;}
const park=(g:Game)=>{for(const b of g.physics.balls)Object.assign(b,{x:400,y:920,vx:440,vy:0,outsideArena:true});};
const step=(g:Game,n:number)=>{for(let i=0;i<n;i++){park(g);g.update(C.step);}};
const live=(g:Game)=>Array.from(g.physics.blocks.alive.keys()).filter(i=>g.physics.blocks.alive[i]);
const burn=(g:Game,i:number)=>(g.physics as unknown as {burn(i:number):void}).burn(i);
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

it.each([[0,10],[199,10],[200,11],[1000,15],[4000,30],[6000,40],[1e9,40]])('V1.4掉落间隔 D=%s → %s',(d,n)=>expect(dropEvery(d)).toBe(n));
it('累计阈值在实际掉落后计算：10…200、211；重复击碎不生成第二份，未接住不产生效果',()=>{
 const g=game(),f=g.physics.endless!,spawn=vi.spyOn(g.physics.powers,'spawn'),indices=live(g),base=g.physics.paddleWidth;
 for(let n=1;n<=211;n++){f.hit(indices[n-1]);f.hit(indices[n-1]);if(n===199)expect(spawn).toHaveBeenCalledTimes(19);if(n===200||n===210)expect(spawn).toHaveBeenCalledTimes(20);}
 expect(spawn).toHaveBeenCalledTimes(21);expect(g.physics.balls).toHaveLength(1);expect(g.physics.paddleWidth).toBe(base);expect(g.journal.events.some(e=>e.type==='power')).toBe(false);
 g.physics.powers.update(100,0,0,()=>{throw Error('漏接不得触发');});expect(g.physics.powers.items.some(d=>d.alive)).toBe(false);expect(g.physics.balls).toHaveLength(1);
});
it('新版权重严格1000，每种道具所有整数抽取边界正确，且每次只消耗一个随机数',()=>{
 expect(ENDLESS_V14_POWER_WEIGHTS.map(p=>p.weight)).toEqual([300,130,130,130,140,167,3]);let start=0;
 for(const p of ENDLESS_V14_POWER_WEIGHTS){for(const v of [start,start+p.weight-1]){const rng=vi.fn(()=>v/1000);expect(endlessPower(rng)).toBe(p.kind);expect(rng).toHaveBeenCalledTimes(1);}start+=p.weight;}expect(start).toBe(1000);
 expect(ENDLESS_POWER_WEIGHTS.map(p=>p.weight)).toEqual([270,200,130,130,120,147,3]);
 const sequence=()=>{const r=seededRandom(123);return Array.from({length:1000},()=>endlessPower(r));};expect(sequence()).toEqual(sequence());
});
it('旧main黄金样本：V1.3的三组随机道具和10000tick砖墙逐字节保持不变',()=>{
 const golden=readFileSync(new URL('./fixtures/endless-v13-golden.jsonl',import.meta.url),'utf8').trim().split('\n').map(s=>JSON.parse(s));
 for(const sample of golden){const f=new EndlessField();f.start(sample.seed,ENDLESS_V4);const rng=seededRandom(sample.seed);expect(hash(Array.from({length:200},()=>endlessPower(rng,ENDLESS_V4)))).toBe(sample.powers);
  for(let t=1;t<=10000;t++){f.tick();if(t%6===0){const alive=Array.from(f.alive.keys()).filter(i=>f.alive[i]);if(alive.length)f.hit(alive[t*7919%alive.length]);}}
  expect(hash([f.descents,f.sinceDescent,f.pressure,f.destroyedTotal,Array.from(f.alive)])).toBe(sample.field);
  expect([0,1,10,1000].map(n=>descentInterval(n,ENDLESS_V4))).toEqual(sample.intervals);expect([0,125,199,200,1000,6000].map(n=>dropEvery(n,ENDLESS_V4))).toEqual(sample.drops);
 }
});
it('规则注册表同时保留V1.0–V1.4；未知配置不能冒充当前规则',()=>{
 expect(Object.keys(ENDLESS_VARIANTS)).toHaveLength(6);expect(endlessVersion(ENDLESS_V4)).toBe(ENDLESS_V4_RULES_VERSION);expect(endlessVersion(ENDLESS_V5)).toBe(ENDLESS_RULES_VERSION);expect(()=>endlessVersion({...ENDLESS_V5})).toThrow('未知');
 const g=game(7,ENDLESS_V4);expect(g.rulesVersion).toBe(ENDLESS_V4_RULES_VERSION);g.setMode('campaign');expect(g.rulesVersion).toBe(RULES_VERSION);
});
it('新加宽2倍8秒、刷新不叠加、边缘合法；闯关和旧版仍1.8倍5秒',()=>{
 for(const v of [ENDLESS_V4,ENDLESS_V5]){const g=game(7,v),p=g.physics,width=p.paddleWidth,settings=endlessSettings(v);p.setTarget(799);p.paddleX=p.targetX;p.collect('wide');expect(p.paddleWidth).toBeCloseTo(width*settings.wideScale);expect(p.wideRemaining).toBe(settings.wideSeconds);expect(p.paddleX+p.paddleWidth/2).toBeLessThanOrEqual(C.width-C.paddle.margin);
  step(g,120);p.collect('wide');expect(p.wideRemaining).toBe(settings.wideSeconds);expect(p.paddleWidth).toBeCloseTo(width*settings.wideScale);
  g.pause();const since=p.endless!.sinceDescent;g.update(30);expect(p.wideRemaining).toBe(settings.wideSeconds);expect(p.endless!.sinceDescent).toBe(since);g.start();step(g,settings.wideSeconds*120+1);expect(p.wideRemaining).toBe(0);expect(p.paddleWidth).toBeCloseTo(width);
 }
 const g=new Game();g.start();const width=g.physics.paddleWidth;g.physics.collect('wide');expect(g.physics.wideRemaining).toBe(5);expect(g.physics.paddleWidth).toBeCloseTo(width*1.8);
});
it('V1.4火焰只烧中心+12格，固定偏移/事件顺序，无递归连锁；旧版仍3×3',()=>{
 for(const v of [ENDLESS_V4,ENDLESS_V5]){const g=game(7,v),f=g.physics.endless!,offsets=endlessSettings(v).fireOffsets;
  const center=live(g).find(i=>{const row=Math.floor(i/f.cols),col=i%f.cols;return row>2&&col>2&&col<f.cols-3&&row<15&&FIRE_OFFSETS_V14.every(([dx,dy])=>f.alive[(row+dy)*f.cols+col+dx]);})!;expect(center).toBeDefined();
  const row=Math.floor(center/f.cols),col=center%f.cols,before=f.remaining,tail=g.journal.events.length;f.hit(center);burn(g,center);
  expect(before-f.remaining).toBe(1+offsets.length);expect(g.journal.events.slice(tail).filter(e=>e.type==='hit').map(e=>e.index)).toEqual([center,...offsets.map(([dx,dy])=>(row+dy)*f.cols+col+dx)].map(i=>f.worldId(i)));
  burn(g,center);expect(before-f.remaining).toBe(1+offsets.length);expect(f.alive[(row+3)*f.cols+col]).toBe(1);
 }
 expect(FIRE_OFFSETS_V14).toHaveLength(12);expect(FIRE_OFFSETS_LEGACY).toHaveLength(8);
});
it('火焰网格边缘不越界或跨行；穿透与火焰可同时生效，速度不因砖块反转',()=>{
 const g=game(),p=g.physics,f=p.endless!,before=f.remaining;burn(g,0);expect(before-f.remaining).toBeLessThanOrEqual(12);
 const i=live(g).find(n=>Math.floor(n/f.cols)===8)!;const x=f.left+i%f.cols*f.step+f.size/2,y=f.top+Math.floor(i/f.cols)*f.step+f.size+2;
 p.collect('pierce');p.collect('fire');expect(p.pierceRemaining).toBe(4);expect(p.fireRemaining).toBe(6);Object.assign(p.balls[0],{x,y,vx:0,vy:-440,outsideArena:false});p.update(C.step);expect(f.alive[i]).toBe(0);expect(p.balls[0].vy).toBeLessThan(0);expect(p.effects.events.some(e=>e.kind==='burn')).toBe(true);
});
it('闪电15块：先最低行再距首颗球水平距离，少于15只清存活；计分和掉落仍走真实事件',()=>{
 const g=game(),p=g.physics,f=p.endless!,x=p.balls[0].x,expected=live(g).sort((a,b)=>Math.floor(b/f.cols)-Math.floor(a/f.cols)||Math.abs(f.left+a%f.cols*f.step+f.size/2-x)-Math.abs(f.left+b%f.cols*f.step+f.size/2-x)||a-b).slice(0,15),start=g.journal.events.length;
 p.collect('lightning');const hits=g.journal.events.slice(start);expect(hits[0]).toMatchObject({type:'power',kind:'lightning'});expect(hits.filter(e=>e.type==='hit').map(e=>e.index)).toEqual(expected.map(i=>f.worldId(i)));expect(f.destroyedTotal).toBe(15);expect(p.powers.items.filter(d=>d.alive)).toHaveLength(1);
 for(const i of live(g).slice(5))f.hit(i);const remain=f.remaining;p.lightning();expect(remain).toBe(5);expect(f.remaining).toBe(0);
});
it('+3上限100、减半向上取整至少1、生命最多3；丢命清临时技能保留进度',()=>{
 const g=game(),p=g.physics;for(let n=0;n<40;n++)p.collect('plus3');expect(p.balls).toHaveLength(100);p.halve();expect(p.balls).toHaveLength(50);p.halve();p.halve();expect(p.balls).toHaveLength(13);for(let n=0;n<10;n++)p.halve();expect(p.balls).toHaveLength(1);
 p.collect('life');expect(g.lives).toBe(3);p.collect('wide');p.collect('fire');const f=p.endless!;f.hit(live(g)[0]);const score=g.score.total,removed=f.destroyedTotal;
 Object.assign(p.balls[0],{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);expect(g.lives).toBe(2);expect(f.destroyedTotal).toBe(removed);expect(g.score.total).toBe(score);expect([p.wideRemaining,p.fireRemaining,p.pierceRemaining]).toEqual([0,0,0]);g.start();p.collect('life');expect(g.lives).toBe(3);
});
it('540tick初始下沉、10行公式、180封顶；同一种子和规则的生成几何不变',()=>{
 expect(descentInterval(0)).toBe(540);expect(descentInterval(10)).toBe(Math.round(540*.98**10));expect(descentInterval(10000)).toBe(180);
 const a=new EndlessField(),b=new EndlessField();a.start(7,ENDLESS_V4);b.start(7,ENDLESS_V5);expect(b.alive).toEqual(a.alive);expect(b.floorRow).toBe(a.floorRow);for(let n=0;n<539;n++)expect(b.tick()).toBe(false);expect(b.tick()).toBe(true);expect(b.sinceDescent).toBe(0);expect(a.descents).toBe(0);
});
it('Web与微信共享V1.4；固定输入产生相同轨迹、分数、日志；后台不累计下沉或技能时间',()=>{
 const f=wxFixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});try{const web=game(31),wx=app.game;wx.setMode('endless');wx.physics.endless!.variant=ENDLESS_V5;wx.journal.seed=31;wx.physics.setSeed(31);wx.physics.reset();wx.start();
  expect(wx.rulesVersion).toBe(web.rulesVersion);for(let n=0;n<900;n++){web.update(C.step);wx.update(C.step);}expect(wx.physics.balls).toEqual(web.physics.balls);expect(wx.score.total).toBe(web.score.total);expect(wx.journal.events).toEqual(web.journal.events);expect(wx.physics.endless!.descents).toBe(web.physics.endless!.descents);
  wx.physics.collect('wide');const time=wx.physics.wideRemaining,since=wx.physics.endless!.sinceDescent;f.events.hide();wx.update(1000);f.events.show();expect(wx.physics.wideRemaining).toBe(time);expect(wx.physics.endless!.sinceDescent).toBe(since);
  expect(cloudKey('endless')).toBe('qqcj_endless_'+ENDLESS_V4_RULES_VERSION);
 }finally{app.dispose();}
});
it('穿透4秒、火焰6秒按固定tick到期；暂停和重复拾取不消耗/叠加技能时长',()=>{
 const g=game(),p=g.physics;p.collect('pierce');p.collect('fire');step(g,120);g.pause();const values=[p.pierceRemaining,p.fireRemaining];g.update(100);expect([p.pierceRemaining,p.fireRemaining]).toEqual(values);g.start();p.collect('pierce');p.collect('fire');expect(p.pierceRemaining).toBe(4);expect(p.fireRemaining).toBe(6);step(g,481);expect(p.pierceRemaining).toBe(0);expect(p.fireRemaining).toBeGreaterThan(1.9);step(g,240);expect(p.fireRemaining).toBe(0);
});
it('普通丢命不重置累计掉落阈值：消除11块后继续本轮，累计第20块才生成下一份',()=>{
 const g=game(),p=g.physics,f=p.endless!,spawn=vi.spyOn(p.powers,'spawn'),cells=live(g);for(const i of cells.slice(0,11))f.hit(i);expect(spawn).toHaveBeenCalledTimes(1);
 Object.assign(p.balls[0],{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);expect(g.lives).toBe(2);expect(p.powers.items.some(d=>d.alive)).toBe(false);g.start();for(const i of cells.slice(11,19))f.hit(i);expect(spawn).toHaveBeenCalledTimes(1);f.hit(cells[19]);expect(spawn).toHaveBeenCalledTimes(2);
});
