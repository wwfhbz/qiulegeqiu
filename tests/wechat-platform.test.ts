import {it,expect,vi,afterEach} from 'vitest';
import {Game} from '../src/Game';
import {C} from '../src/GameConfig';
import {createWebHost} from '../src/platform/WebPlatform';
import {WechatPlatform} from '../wechat-game/src/WechatPlatform';
import {MiniGameApp} from '../wechat-game/src/App';
import {MiniGameApp as CompatibilityApp} from '../minigame/src/App';
import {wxFixture} from './helpers/WxFixture';
import type {FrameRuntime} from '../src/platform/Contracts';
afterEach(()=>vi.unstubAllGlobals());
function browserHost(){
 const frames=new Map<number,FrameRequestCallback>(),listeners=new Map<string,(e:any)=>void>(),visibility=new Map<string,()=>void>();let sequence=0,disconnected=false;
 const ctx=new Proxy({},{get:()=>()=>{},set:()=>true}) as CanvasRenderingContext2D;
 const canvas={width:0,height:0,getContext:()=>ctx,getBoundingClientRect:()=>({left:10,width:400,height:560}),addEventListener:(name:string,fn:(e:any)=>void)=>listeners.set(name,fn),removeEventListener:(name:string)=>listeners.delete(name),setPointerCapture:()=>{},hasPointerCapture:()=>true} as unknown as HTMLCanvasElement;
 const document={hidden:false,createElement:()=>({width:0,height:0,getContext:()=>ctx}),addEventListener:(name:string,fn:()=>void)=>visibility.set(name,fn),removeEventListener:(name:string)=>visibility.delete(name)};
 vi.stubGlobal('document',document);vi.stubGlobal('window',{devicePixelRatio:3,requestAnimationFrame:(fn:FrameRequestCallback)=>{frames.set(++sequence,fn);return sequence;},cancelAnimationFrame:(id:number)=>frames.delete(id)});vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){disconnected=true;}});
 return {host:createWebHost(canvas),frames,listeners,document,visibility,tick:(time:number)=>{const [id,fn]=frames.entries().next().value!;frames.delete(id);fn(time);},get disconnected(){return disconnected;}};
}
it('微信新旧目录导出同一个客户端，不产生第二套实现',()=>{expect(CompatibilityApp).toBe(MiniGameApp);});
it('微信帧循环后台停止，缺cancel能力时旧回调也不会产生双循环',()=>{
 const f=wxFixture(),pending=new Map<number,(t:number)=>void>();let id=0,drawn=0;
 const runtime:FrameRuntime={requestAnimationFrame:callback=>{pending.set(++id,callback);return id;}};
 const platform=new WechatPlatform(f.wx,runtime);platform.start(()=>drawn++);const old=pending.get(1)!;platform.suspend();platform.resume();old(100);expect(drawn).toBe(0);expect(pending.size).toBe(2);const current=pending.get(2)!;pending.delete(2);current(110);expect(drawn).toBe(1);platform.dispose();pending.get(3)!(120);expect(drawn).toBe(1);
});
it('Web适配器保留指针/可见性，dispose取消RAF并释放监听器',()=>{
 const b=browserHost(),game=new Game(b.host);expect(game.renderer?.draw).toBeTypeOf('function');game.start();b.tick(100);b.listeners.get('pointermove')!({pointerType:'mouse',clientX:410});expect(game.physics.targetX).toBeGreaterThan(400);b.document.hidden=true;b.visibility.get('visibilitychange')!();expect(game.state).toBe('paused');game.dispose();expect(b.frames.size).toBe(0);expect(b.listeners.size).toBe(0);expect(b.visibility.size).toBe(0);expect(b.disconnected).toBe(true);expect(game.renderer).toBeUndefined();
});
it('Web帧更新回调中销毁也不会残留下一帧',()=>{const b=browserHost();let dispose=false;const g=new Game(b.host,game=>{if(dispose)game.dispose();});dispose=true;b.tick(100);expect(b.frames.size).toBe(0);});
it('真实两套宿主的12关、触屏/鼠标输入、物理/五道具/积分日志一致',()=>{
 const b=browserHost(),web=new Game(b.host),f=wxFixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),wx=app.game;
 for(const g of [web,wx]){g.journal.seed=12345;g.physics.setSeed(12345);}let now=1000;
 const advance=()=>{now+=1000*C.step;b.tick(now);app.frame(now);};b.tick(now);app.frame(now);
 for(let level=1;level<=12;level++){
  expect(web.levels.current.number).toBe(level);expect(wx.levels.current).toEqual(web.levels.current);expect(wx.physics.blocks.alive).toEqual(web.physics.blocks.alive);
  for(const g of [web,wx])g.start();app.frame(now);
  const view=(app as unknown as {view:{arena:{x:number;y:number;width:number;height:number}}}).view;
  const touch=(x:number)=>f.touch(8,view.arena.x+x/C.width*view.arena.width,view.arena.y+view.arena.height-20);f.events.down(touch(400));
  for(let tick=0;tick<180;tick++){
   const target=400+Math.sin(tick*.04)*120;b.listeners.get('pointermove')!({pointerType:'mouse',clientX:10+target/C.width*400});f.events.move(touch(target));
   if(tick===40)for(const g of [web,wx])g.physics.collect('triple');if(tick===60)for(const g of [web,wx])g.physics.collect('wide');
   if(level>=4&&tick===80)for(const g of [web,wx]){g.physics.collect('halve');g.physics.collect('life');g.physics.collect('bomb');}
   advance();
  }
  f.events.up(touch(400));
  expect(wx.lives).toBe(web.lives);expect(wx.score.total).toBe(web.score.total);expect(wx.physics.blocks.alive).toEqual(web.physics.blocks.alive);expect(wx.physics.balls.length).toBe(web.physics.balls.length);expect(wx.physics.wideRemaining).toBeCloseTo(web.physics.wideRemaining,9);
  for(let i=0;i<web.physics.balls.length;i++){expect(wx.physics.balls[i].x).toBeCloseTo(web.physics.balls[i].x,6);expect(wx.physics.balls[i].y).toBeCloseTo(web.physics.balls[i].y,6);}
  for(const g of [web,wx]){g.start();for(let i=0;i<g.physics.blocks.alive.length;i++)g.physics.blocks.hit(i);g.update(0);if(level>=3&&level<12)g.nextLevel();}
 }
 expect(wx.state).toBe('victory');expect(web.state).toBe('victory');expect(wx.journal.events).toEqual(web.journal.events);expect(wx.score.total).toBe(web.score.total);web.dispose();app.dispose();
});
it('微信音效偏好使用微信存储，存储异常仍可单机启动',()=>{const f=wxFixture(),p=new WechatPlatform(f.wx);p.write('mute',true);expect(p.read('mute')).toBe(true);f.wx.getStorageSync=()=>{throw Error('unavailable');};f.wx.setStorageSync=()=>{throw Error('unavailable');};expect(p.read('mute')).toBeUndefined();expect(()=>p.write('mute',false)).not.toThrow();expect(()=>new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}).frame(100)).not.toThrow();});
import {layout} from '../wechat-game/src/Layout';
it.each([[320,568],[390,844],[430,932],[768,1024]])('竖屏%s×%s的44像素工具按钮不盖HUD，底部与挡板完整显示', (width,height)=>{const view=layout(width,height,44,height-34,80);expect(view.top).toBeGreaterThan(80);expect(view.hudY).toBeGreaterThanOrEqual(view.top+50);expect(view.arena.y).toBeGreaterThan(view.hudY+30);expect(view.buttonsY+44).toBeLessThanOrEqual(view.bottom);expect(view.arena.width/view.arena.height).toBeCloseTo(C.width/C.height,12);});
it('微信触摸开始即解锁原生音效，后台暂停音频，不等待异步登录',()=>{
 const f=wxFixture();let state='suspended';const resume=vi.fn(()=>{state='running';return Promise.resolve();}),suspend=vi.fn(()=>{state='suspended';return Promise.resolve();}),close=vi.fn(()=>Promise.resolve());
 f.wx.createWebAudioContext=()=>({get state(){return state;},destination:{},createGain:()=>({gain:{value:0},connect:()=>{}}),resume,suspend,close}) as unknown as AudioContext;
 const app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});app.frame(100);f.events.down(f.touch(1,195,300));expect(resume).toHaveBeenCalledOnce();expect(f.requests).toHaveLength(0);f.events.hide();expect(suspend).toHaveBeenCalledOnce();app.dispose();expect(close).toHaveBeenCalledOnce();
});
