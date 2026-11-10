import {it,expect,vi} from 'vitest';
import {MiniGameApp} from '../minigame/src/App';
import {WechatApi} from '../minigame/src/Api';
import {layout} from '../minigame/src/Layout';
import {Game} from '../src/Game';
import {C} from '../src/GameConfig';
import type {Wx,TouchEvent,Canvas} from '../minigame/src/Platform';
function fixture(width=375,height=812,dpr=3){
 const events:Record<string,(e?:unknown)=>void>={},storage=new Map<string,unknown>(),requests:Parameters<Wx['request']>[0][]=[];
 const ctx=new Proxy({measureText:(s:string)=>({width:[...s].length*8}),roundRect:undefined},{get:(t,k)=>k in t?t[k as keyof typeof t]:()=>{},set:(t,k,v)=>{Reflect.set(t,k,v);return true;}}) as unknown as CanvasRenderingContext2D;
 const wx:Wx={createCanvas:()=>({width:0,height:0,getContext:()=>ctx}),getWindowInfo:()=>({windowWidth:width,windowHeight:height,pixelRatio:dpr,safeArea:{top:44,bottom:height-34,left:0,right:width}}),getMenuButtonBoundingClientRect:()=>({bottom:80,left:width-90}),
 onTouchStart:f=>{events.down=f as never;},onTouchMove:f=>{events.move=f as never;},onTouchEnd:f=>{events.up=f as never;},onTouchCancel:f=>{events.cancel=f as never;},onHide:f=>{events.hide=f;},onShow:f=>{events.show=f;},onWindowResize:f=>{events.resize=f;},
 login:o=>o.fail(),request:o=>{requests.push(o);o.fail();},getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>{storage.set(k,v);},removeStorageSync:k=>{storage.delete(k);},showModal:o=>o.success?.({confirm:false}),showActionSheet:()=>{},showToast:()=>{},showShareMenu:()=>{},onShareAppMessage:()=>{},shareAppMessage:()=>{}};
 const touch=(identifier:number,x:number,y:number):TouchEvent=>({touches:[{identifier,clientX:x,clientY:y}],changedTouches:[{identifier,clientX:x,clientY:y}]});
 return {wx,events,storage,requests,touch};
}
it('微信无DOM宿主复用同一十关、五命和物理协调器，不复制规则',()=>{
 const f=fixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),web=new Game();
 expect(app.game).toBeInstanceOf(Game);expect(app.game.lives).toBe(5);expect(app.game.levels.count).toBe(10);
 for(let i=0;i<10;i++){expect(app.game.levels.current).toEqual(web.levels.current);app.game.levels.next();web.levels.next();}
 expect(()=>app.frame(100)).not.toThrow();expect(app.canvas.width).toBe(750);
});
it.each([[320,568],[375,812],[430,932],[768,1024]])('分辨率%s×%s安全区和逻辑比例保持，挡板及底部按钮完整', (w,h)=>{
 const v=layout(w,h,44,h-34,80);expect(v.arena.width/v.arena.height).toBeCloseTo(C.width/C.height);expect(v.arena.y).toBeGreaterThan(80);expect(v.buttonsY).toBeGreaterThan(v.arena.y+v.arena.height);expect(v.buttonsY+44).toBeLessThanOrEqual(h-34);expect(v.arena.x).toBeGreaterThanOrEqual(0);
 const f=fixture(w,h);const app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});expect(()=>app.frame(1)).not.toThrow();
});
it('水平触屏控制、多指隔离、取消手势，挡板平滑而不瞬移',()=>{
 const f=fixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),v=layout(375,812,44,778,80);app.frame(100);
 const y=v.arena.y+v.arena.height-20,old=app.game.physics.paddleX;
 f.events.down(f.touch(1,190,y));f.events.move(f.touch(1,350,y));const target=app.game.physics.targetX;
 f.events.down(f.touch(2,10,y));f.events.move(f.touch(2,10,y));expect(app.game.physics.targetX).toBe(target);
 app.frame(116);expect(app.game.physics.paddleX).toBeGreaterThan(old);expect(app.game.physics.paddleX-old).toBeLessThanOrEqual(C.paddle.speed*.016+.001);
 f.events.cancel();f.events.down(f.touch(2,50,y));expect(app.game.physics.targetX).toBeLessThan(target);
});
it('后台自动暂停，前台不自动发射、不累计后台时间，手动继续走同一逻辑',()=>{
 const f=fixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});app.game.start();app.frame(100);app.frame(116);const tick=app.game.journal.tick;
 f.events.hide();expect(app.game.state).toBe('paused');app.frame(100000);expect(app.game.journal.tick).toBe(tick);f.events.show();app.frame(100100);expect(app.game.state).toBe('paused');expect(app.game.journal.tick).toBe(tick);
 app.game.start();app.frame(100116);expect(app.game.journal.tick).toBeGreaterThan(tick);
});
it('道具、多球上限、五条命和继续挑战沿用网页版Game',()=>{
 const f=fixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),g=app.game;g.start();g.physics.triple();expect(g.physics.balls).toHaveLength(3);
 for(let i=0;i<5;i++)g.physics.triple();expect(g.physics.balls.length).toBe(100);
 for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);expect(g.lives).toBe(4);expect(g.readyReason).toBe('lifeLost');expect(g.physics.balls.length).toBe(1);
});
it('网络异常不阻止单机开始、暂停、重开；结束可跳过成绩登记',async()=>{
 const f=fixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});app.game.start();for(const b of app.game.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});app.game.update(C.step);expect(app.game.state).toBe('ready');app.game.reset();app.game.start();expect(app.game.state).toBe('running');
 const request=new WechatApi(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});await expect(request.request('/leaderboard')).rejects.toThrow('网络暂不可用');expect(app.game.state).toBe('running');
});
it('微信登录只提交临时代码，会话持久化和CSRF正确，无openid或分数认证',async()=>{
 const f=fixture();f.wx.login=o=>o.success({code:'temporary-code'});const token='a'.repeat(43),csrfToken='csrf-token';
 f.wx.request=o=>{f.requests.push(o);if(o.url.endsWith('/wechat/login'))o.success({statusCode:200,data:{token,csrfToken,expiresAt:Date.now()+60000}});else o.success({statusCode:200,data:{ok:true}});};
 const api=new WechatApi(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});await Promise.all([api.login(),api.login()]);expect(f.requests).toHaveLength(1);expect(f.requests[0].data).toEqual({code:'temporary-code'});
 await api.request('/challenges',{rulesVersion:'test'});expect(f.requests[1].header.authorization).toBe('Bearer '+token);expect(f.requests[1].header['x-csrf-token']).toBe(csrfToken);
 const back=new WechatApi(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});expect(back.authenticated).toBe(true);
 f.wx.request=o=>o.success({statusCode:401,data:{message:'过期'}});await expect(back.me()).rejects.toThrow('过期');expect(back.authenticated).toBe(false);
});
it('生产禁止HTTP、本地开发可显式HTTP；分享不携带凭据或未经验证成绩',()=>{
 const f=fixture();expect(()=>new WechatApi(f.wx,{apiBase:'http://127.0.0.1:8091/api',development:false})).toThrow();expect(()=>new WechatApi(f.wx,{apiBase:'http://127.0.0.1:8091/api',development:true})).not.toThrow();
 let share:(()=>{title:string;query?:string})|undefined;f.wx.onShareAppMessage=fn=>{share=fn;};new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});expect(share!().title).toContain('球了个球');expect(share!().query).toBe('source=friend');expect(JSON.stringify(share!())).not.toMatch(/token|openid|session/);
});
it('异步微信登录在后台完成时仍保持暂停，不会回到前台自动发射',async()=>{
 const f=fixture();let pending:Parameters<Wx['login']>[0]|undefined;f.wx.login=o=>{pending=o;};f.wx.showModal=o=>o.success?.({confirm:true});f.wx.request=o=>o.success({statusCode:200,data:o.url.endsWith('/wechat/login')?{token:'b'.repeat(43),csrfToken:'csrf',expiresAt:Date.now()+60000}:{player:null,best:null}});
 const app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});const starting=(app as unknown as {activate():Promise<void>}).activate();await vi.waitFor(()=>expect(pending).toBeDefined());f.events.hide();pending!.success({code:'late-login'});await starting;expect(app.game.state).toBe('paused');expect(app.game.journal.tick).toBe(0);f.events.show();expect(app.game.state).toBe('paused');
});
it('选择单机不会继承上一轮联网标记或暗中调用微信登录',async()=>{
 const f=fixture(),login=vi.fn(f.wx.login);f.wx.login=login;const app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});const testApp=app as unknown as {online:boolean;activate():Promise<void>};testApp.online=true;await testApp.activate();expect(app.game.state).toBe('running');expect(testApp.online).toBe(false);expect(login).not.toHaveBeenCalled();expect(f.requests).toHaveLength(0);
});
it('选择联网但API失败时立即降级单机，仍可暂停和重新开始',async()=>{
 const f=fixture();f.wx.showModal=o=>o.success?.({confirm:true});f.wx.login=o=>o.success({code:'failed-api-login'});const app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});await (app as unknown as {activate():Promise<void>}).activate();expect(app.game.state).toBe('running');expect(app.api.authenticated).toBe(false);app.game.pause();expect(app.game.state).toBe('paused');app.game.reset();expect(app.game.lives).toBe(5);expect(app.game.state).toBe('ready');
});
