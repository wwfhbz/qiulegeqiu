import {expect,it} from 'vitest';
import {MiniGameApp} from '../wechat-game/src/App';
import {wxFixture} from './helpers/WxFixture';

type Internals={switchMode(mode:'campaign'|'endless'):Promise<void>;draw(now:number):void;rankingBoard:string};
it('微信：菜单切换无尽模式（记住选择）、HUD显示阶段与下沉、排行榜默认切到无尽榜',async()=>{
 const f=wxFixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),x=app as unknown as Internals;
 try{
  await x.switchMode('endless');expect(app.game.mode).toBe('endless');expect(app.game.lives).toBe(3);expect(x.rankingBoard).toBe('endless');
  expect(f.wx.getStorageSync('qiulegeqiu:wechat-mode:v1')).toBe('endless');
  x.draw(0);expect(f.texts).toContain('第1阶段');expect(f.texts).toContain('已下沉0行');
  const again=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});try{expect(again.game.mode).toBe('endless');}finally{again.dispose();}
  await x.switchMode('campaign');expect(app.game.mode).toBe('campaign');expect(app.game.lives).toBe(5);
 }finally{app.dispose();}
});
