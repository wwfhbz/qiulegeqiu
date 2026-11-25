import {it,expect,vi} from 'vitest';
import {Game} from '../src/Game';
import {C} from '../src/GameConfig';
import {EndlessField} from '../src/endless/EndlessField';
import {ENDLESS_V8,ENDLESS_V9} from '../src/endless/EndlessRules';
import {MiniGameApp} from '../wechat-game/src/App';
import {wxFixture} from './helpers/WxFixture';
import type {RewardedVideoAd} from '../wechat-game/src/Platform';
import {RESCUE_MIN_PRESSURE,SUPPLY_FEATURE} from '../shared/Challenge';

type Act={rect:{x:number;y:number;width:number;height:number};run:()=>void};
type Private={chooseMode(m:'campaign'|'endless'):void;busy:boolean;actions:Act[];offlinePreference:boolean;resultPage():void;runShards:{amount:number}};
const ADS={rewarded:'adunit-rewarded-test',interstitial:'adunit-inter-test',banner:'adunit-banner-test'};
function withAds(f:ReturnType<typeof wxFixture>){let close:((r?:{isEnded?:boolean})=>void)|undefined;
 f.wx.createRewardedVideoAd=()=>({load:()=>Promise.resolve(),show:()=>{queueMicrotask(()=>close?.({isEnded:true}));return Promise.resolve();},onClose:fn=>{close=fn;},onError:()=>{}} as RewardedVideoAd);
 f.wx.createInterstitialAd=()=>({show:()=>Promise.resolve(),onError:()=>{}});
 f.wx.createBannerAd=()=>({show:()=>Promise.resolve(),hide:()=>{},destroy:()=>{},style:{left:0,top:0,width:300},onResize:()=>{},onError:()=>{}});}
function endlessApp(f:ReturnType<typeof wxFixture>){const a=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false,ads:ADS});a.frame(16);(a as unknown as Private).chooseMode('endless');a.frame(32);return a;}
const press=(g:Game)=>{const f=g.physics.endless!;f.pressure=RESCUE_MIN_PRESSURE;};

it('护盾期间砖墙压线不累计压线时间；1.7 冻结版没有补给和救援',()=>{
 const f=new EndlessField();f.start(5,ENDLESS_V9);for(let i=0;i<40;i++)(f as unknown as {descend():void}).descend();expect(f.blocked).toBe(true);
 f.shieldUntil=f.clock+240;for(let i=0;i<200;i++)f.tick();expect(f.pressure).toBe(0);
 for(let i=0;i<60;i++)f.tick();expect(f.pressure).toBeGreaterThan(0);
 const g=new Game();g.setMode('endless');const old=new EndlessField();old.variant=ENDLESS_V8;g.physics.useField(old);g.physics.reset();expect(g.canSupply).toBe(false);
});
it('开局补给只在无尽模式第一次发射前提供；闯关不提供；发射后多 3 球并开护盾',()=>{
 const camp=new Game();expect(camp.canSupply).toBe(false);
 const g=new Game();g.setMode('endless');expect(g.canSupply).toBe(true);expect(g.armSupply()).toBe(true);expect(g.canSupply).toBe(false);
 g.start();expect(g.physics.balls.filter(b=>b.alive)).toHaveLength(4);expect(g.physics.endless!.shieldSeconds).toBeCloseTo(30,1);
 expect(g.journal.events.map(e=>e.type)).toEqual(['launch','supply']);
 const later=new Game();later.setMode('endless');later.start();later.update(C.step);expect(later.canSupply).toBe(false);
});
it('压线救援：压线过半才出现，清掉底部 5 行并重置压线，每局一次',()=>{
 const g=new Game();g.setMode('endless');g.start();const f=g.physics.endless!;
 expect(g.canRescue).toBe(false);press(g);expect(g.canRescue).toBe(true);
 for(let i=0;i<30;i++)(f as unknown as {descend():void}).descend();const before=f.remaining;
 expect(g.rescue()).toBe(true);expect(f.pressure).toBe(0);expect(f.remaining).toBeLessThan(before);expect(g.journal.events.at(-1)!.type).toBe('rescue');
 press(g);expect(g.canRescue).toBe(false);expect(g.rescue()).toBe(false);
 g.reset();press(g);expect(g.rescueUsed).toBe(false);
});
it('微信：无尽开局显示"看视频开局"，看完后发射多 3 球；压线时出现救命按钮，看视频期间暂停、看完清行并继续',async()=>{
 const f=wxFixture();withAds(f);const a=endlessApp(f),p=a as unknown as Private;p.offlinePreference=true;
 try{f.texts.length=0;a.frame(48);expect(f.texts).toContain('看视频开局：+3 球 · 30 秒护盾');
  p.actions.find(x=>x.rect.width===240)!.run();await vi.waitFor(()=>expect(p.busy).toBe(false));expect(a.game.supplyArmed).toBe(true);
  a.game.start();expect(a.game.physics.balls.filter(b=>b.alive)).toHaveLength(4);
  press(a.game);f.texts.length=0;a.frame(64);expect(f.texts).toContain('救命！看视频清底部 5 行');
  const pause=vi.spyOn(a.game,'pause');p.actions.find(x=>x.rect.width===200)!.run();expect(pause).toHaveBeenCalled();
  await vi.waitFor(()=>expect(p.busy).toBe(false));expect(a.game.rescueUsed).toBe(true);expect(a.game.state).toBe('running');
  press(a.game);f.texts.length=0;a.frame(80);expect(f.texts).not.toContain('救命！看视频清底部 5 行');
 }finally{a.dispose();}
});
it('微信：已知服务器不支持时不显示开局补给（避免整局被拒）',()=>{
 const f=wxFixture();withAds(f);const a=endlessApp(f);
 try{(a as unknown as {sync:{features?:unknown[]}}).sync.features=['triple-threshold20-v1'];f.texts.length=0;a.frame(48);expect(f.texts).not.toContain('看视频开局：+3 球 · 30 秒护盾');
  (a as unknown as {sync:{features?:unknown[]}}).sync.features=[SUPPLY_FEATURE];f.texts.length=0;a.frame(64);expect(f.texts).toContain('看视频开局：+3 球 · 30 秒护盾');
 }finally{a.dispose();}
});
it('微信结算页：本局获得碎片时"看视频 本局碎片×2"，看完翻倍且只能一次，之后换成每日视频碎片',async()=>{
 const f=wxFixture();withAds(f);const a=endlessApp(f),p=a as unknown as Private;
 try{a.game.start();a.frame(48);const earned=a.shards.balance;expect(earned).toBeGreaterThan(0);// today's first game
  while(a.game.state!=='gameOver'){for(const b of a.game.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});a.game.update(C.step);if(a.game.state==='ready')a.game.start();}
  a.frame(100);a.frame(116);p.resultPage();
  const double=a.panel.actions.find(x=>x.label.startsWith('▶ 看视频 本局碎片×2'))!;expect(double.label).toBe(`▶ 看视频 本局碎片×2（再得 ${earned} 片）`);
  expect(a.panel.resultView?.reward).toBe(`看视频 本局碎片×2（再得 ${earned} 片）`);
  double.run();await vi.waitFor(()=>expect(p.busy).toBe(false));expect(a.shards.balance).toBe(earned*2);
  expect(a.panel.actions.some(x=>x.label.startsWith('▶ 看视频 本局碎片×2'))).toBe(false);
  const daily=a.panel.actions.find(x=>x.label.startsWith('▶ 看视频领 3 碎片'))!;daily.run();await vi.waitFor(()=>expect(p.busy).toBe(false));expect(a.shards.balance).toBe(earned*2+3);
 }finally{a.dispose();}
});
