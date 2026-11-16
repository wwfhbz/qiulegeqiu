import {it,expect,vi} from 'vitest';
import {MiniGameApp} from '../wechat-game/src/App';
import {wxFixture} from './helpers/WxFixture';
import {AD_UNITS} from '../wechat-game/src/AdConfig';
import {C} from '../src/GameConfig';
import type {RewardedVideoAd} from '../wechat-game/src/Platform';
type Private={chooseMode(m:'campaign'|'endless'):void;busy:boolean;actions:{rect:{x:number;y:number;width:number;height:number};run:()=>void}[];guide:boolean;renderer:{cometTail:boolean;paddleSkin:string};settings():void;skins():void};
const ADS={rewarded:'adunit-rewarded-test',interstitial:'adunit-inter-test',banner:'adunit-banner-test'};
/** A rewarded ad that either finishes (isEnded) or is closed early. */
function withAds(f:ReturnType<typeof wxFixture>,ended=()=>true){let close:((r?:{isEnded?:boolean})=>void)|undefined;const shown=vi.fn();
 f.wx.createRewardedVideoAd=()=>({load:()=>Promise.resolve(),show:()=>{shown();queueMicrotask(()=>close?.({isEnded:ended()}));return Promise.resolve();},onClose:fn=>{close=fn;},onError:()=>{}} as RewardedVideoAd);
 f.wx.createInterstitialAd=()=>({show:()=>Promise.resolve(),onError:()=>{}});
 f.wx.createBannerAd=()=>({show:()=>Promise.resolve(),hide:()=>{},destroy:()=>{},style:{left:0,top:0,width:300},onResize:()=>{},onError:()=>{}});return shown;}
function app(f:ReturnType<typeof wxFixture>,ads=true){const a=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false,...(ads?{ads:ADS}:{})});a.frame(16);(a as unknown as Private).chooseMode('campaign');a.frame(32);return a;}
const lose=(a:MiniGameApp)=>{const g=a.game;if(g.state==='ready')g.start();for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);};
it('默认未填广告位：所有广告入口隐藏，生命耗尽直接结算（与之前完全一致）',()=>{
 expect(AD_UNITS).toEqual({rewarded:'',interstitial:'',banner:''});
 const f=wxFixture();const a=app(f,false);try{for(let i=0;i<5;i++)lose(a);expect(a.game.state).toBe('gameOver');expect(a.game.awaitingRevive).toBe(false);a.frame(48);expect(a.panel.title).not.toBe('生命耗尽');expect(f.texts.join()).not.toContain('看视频');}finally{a.dispose();}
});
it('生命耗尽：弹出复活卡，看完视频+1命继续本局；最多2次，第3次直接结算',async()=>{
 const f=wxFixture();const shown=withAds(f);const a=app(f),p=a as unknown as Private;
 try{for(let round=1;round<=3;round++){
   while(a.game.state!=='gameOver')lose(a);a.frame(100*round);
   if(round<=2){expect(a.panel.title).toBe('生命耗尽');expect(a.panel.lines.join()).toContain(`还可复活 ${3-round} 次`);a.panel.actions[0].run();await vi.waitFor(()=>expect(p.busy).toBe(false));expect(a.game.state).toBe('ready');expect(a.game.lives).toBe(1);expect(a.panel.open).toBe(false);}
   else{expect(a.game.awaitingRevive).toBe(false);expect(a.panel.title).not.toBe('生命耗尽');expect(a.game.journal.events.at(-1)!.type).toBe('finish');}
  }
  expect(shown).toHaveBeenCalledTimes(2);expect(a.game.journal.events.filter(e=>e.type==='revive')).toHaveLength(2);
 }finally{a.dispose();}
});
it('中途关闭视频不发奖励；选择放弃则正常结算',async()=>{
 const f=wxFixture();withAds(f,()=>false);const a=app(f),p=a as unknown as Private;
 try{while(a.game.state!=='gameOver')lose(a);a.frame(64);a.panel.actions[0].run();await vi.waitFor(()=>expect(p.busy).toBe(false));expect(a.game.state).toBe('gameOver');expect(a.game.awaitingRevive).toBe(true);
  a.panel.actions[1].run();expect(a.game.journal.events.at(-1)!.type).toBe('finish');a.frame(80);a.frame(96);expect(a.panel.title).toContain('挑战结束');
 }finally{a.dispose();}
});
it('丢一条命后才出现"看视频：下一球+3"，开局不出现；看完后下一次发射多3个球',async()=>{
 const f=wxFixture();withAds(f);const a=app(f),p=a as unknown as Private;
 try{a.frame(40);expect(f.texts).not.toContain('看视频：下一球 +3');
  lose(a);expect(a.game.state).toBe('ready');f.texts.length=0;a.frame(56);expect(f.texts).toContain('看视频：下一球 +3');
  p.actions.find(x=>x.rect.width===192)!.run();await vi.waitFor(()=>expect(p.busy).toBe(false));expect(a.game.boostArmed).toBe(true);
  a.game.start();expect(a.game.physics.balls.length).toBe(4);expect(a.game.journal.events.at(-1)!.type).toBe('boost');
 }finally{a.dispose();}
});
it('设置：音乐/音效/震动分别开关并记住；看视频永久解锁彗星拖尾',async()=>{
 const f=wxFixture();withAds(f);const a=app(f),p=a as unknown as Private;
 try{p.settings();const label=(t:string)=>a.panel.actions.find(x=>x.label.startsWith(t))!;
  label('背景音乐').run();expect(a.game.audio.musicOn).toBe(false);expect(f.storage.get('qiulegeqiu:wechat-music:v1')).toBe(false);
  label('音效').run();expect(a.game.audio.sfxOn).toBe(false);label('震动').run();expect(f.storage.get('qiulegeqiu:wechat-vibrate:v1')).toBe(false);
  expect(a.panel.actions.some(x=>x.label==='皮肤：小球拖尾 · 挡板')).toBe(true);p.skins();
  label('▶ 看视频解锁彗星拖尾').run();await vi.waitFor(()=>expect(p.busy).toBe(false));expect(p.renderer.cometTail).toBe(true);expect(f.storage.get('qiulegeqiu:wechat-trail:v1')).toBe('comet');expect(f.storage.get('qiulegeqiu:wechat-trails:v1')).toEqual(['comet']);
  expect(a.panel.actions.some(x=>x.label==='彗星拖尾：使用中')).toBe(true);label('▶ 看视频解锁爱心拖尾').run();await vi.waitFor(()=>expect(p.busy).toBe(false));expect((p.renderer as unknown as {trail:string}).trail).toBe('heart');expect(a.panel.actions.some(x=>x.label==='彗星拖尾：使用')).toBe(true);label('彗星拖尾').run();expect((p.renderer as unknown as {trail:string}).trail).toBe('comet');
  label('▶ 看视频解锁黄金荣耀').run();await vi.waitFor(()=>expect(p.busy).toBe(false));expect(p.renderer.paddleSkin).toBe('gold');expect(f.storage.get('qiulegeqiu:wechat-paddles:v1')).toEqual(['gold']);label('默认挡板').run();expect(p.renderer.paddleSkin).toBe('default');label('黄金荣耀').run();expect(p.renderer.paddleSkin).toBe('gold');
  const again=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false,ads:ADS});try{expect((again as unknown as Private).renderer.paddleSkin).toBe('gold');expect(again.game.audio.musicOn).toBe(false);expect((again as unknown as Private).renderer.cometTail).toBe(true);}finally{again.dispose();}
 }finally{a.dispose();}
});
it('第二局结束后只出现一次"添加到我的小程序"引导，点任意处关闭',()=>{
 const f=wxFixture();const a=app(f,false),p=a as unknown as Private;
 try{for(let run=1;run<=3;run++){while(a.game.state!=='gameOver')lose(a);f.texts.length=0;a.frame(200*run);a.frame(200*run+16);
   expect(p.guide).toBe(run===2);if(run===2){expect(f.texts).toContain('添加到我的小程序');const t=f.touch(1,100,300);f.events.down(t);f.events.up(t);expect(p.guide).toBe(false);}
   p.chooseMode('campaign');a.frame(200*run+32);}
 }finally{a.dispose();}
});
