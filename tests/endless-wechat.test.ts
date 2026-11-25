import {expect,it} from 'vitest';
import {MiniGameApp} from '../wechat-game/src/App';
import {wxFixture} from './helpers/WxFixture';
import {C} from '../src/GameConfig';

type Internals={chooseMode(mode:'campaign'|'endless'):void;draw(now:number):void;frame(now:number):void;rankingBoard:string;picking:boolean;panel:{open:boolean;title:string;actions:{label:string;run:()=>void}[]}};
it('微信：打开即显示模式选择（必须选择才能开始），选无尽后记住选择、HUD显示阶段与下沉；菜单切换模式只在局外可用',async()=>{
 const f=wxFixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),x=app as unknown as Internals;
 try{
  x.frame(16);expect(x.picking).toBe(true);expect(x.panel.open).toBe(true);expect(x.panel.title).toBe('选择游戏模式');
  expect(x.panel.actions.map(a=>a.label.replace('▶ ',''))).toEqual(['闯关模式','无尽模式','关卡地图','设置','皮肤','排行榜']);
  x.panel.actions[1].run();expect(x.picking).toBe(false);expect(app.game.mode).toBe('endless');expect(app.game.lives).toBe(1);expect(x.rankingBoard).toBe('endless');
  expect(f.wx.getStorageSync('qiulegeqiu:wechat-mode:v1')).toBe('endless');
  x.draw(0);expect(f.texts).toContain('第1阶段');expect(f.texts).toContain('已下沉0行');
  const again=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});try{expect(again.game.mode).toBe('endless');expect((again as unknown as Internals).picking).toBe(true);}finally{again.dispose();}
  // Mode switching is the top-bar 闯关/无尽 switch (since 2.13 there is no 更多 page): mid-run it asks first.
  const request=(m:'campaign'|'endless')=>(app as unknown as {requestMode(m:string):Promise<void>}).requestMode(m);
  app.game.start();let asked=0;f.wx.showModal=o=>{asked++;o.success?.({confirm:false});};await request('campaign');expect(asked).toBe(1);expect(app.game.mode).toBe('endless');
  app.game.state='gameOver';await request('campaign');expect(app.game.mode).toBe('campaign');expect(app.game.lives).toBe(3);
 }finally{app.dispose();}
});
it('微信：一局结束后进入全屏结算页，直接给出两种模式；关闭排行榜等弹层后结算页会回来',()=>{
 const f=wxFixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),x=app as unknown as Internals;
 try{
  // Only endless ends on the full-screen result page since 2.16 (a lost campaign level shows its own panel).
  x.chooseMode('endless');const g=app.game;g.start();
  for(let life=0;life<3&&g.state!=='gameOver';life++){for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);if(g.state==='ready')g.start();}
  expect(g.state).toBe('gameOver');x.frame(100);
  const labels=x.panel.actions.map(a=>a.label);expect(labels).toContain('闯关模式');expect(labels).toContain('无尽模式');expect(labels.some(l=>l.includes('重新挑战'))).toBe(false);
  expect((x.panel as unknown as {resultView?:unknown}).resultView).toBeDefined();f.texts.length=0;x.draw(200);expect(f.texts).toContain('再来一局 · 选择模式');
  (x.panel as unknown as {close():void}).close();x.frame(300);expect(x.panel.title).toContain('挑战结束');
  x.panel.actions.length=0;x.chooseMode('endless');expect(g.mode).toBe('endless');expect(g.state).toBe('ready');
 }finally{app.dispose();}
});
