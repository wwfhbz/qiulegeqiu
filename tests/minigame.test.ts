import type {Wx} from '../wechat-game/src/Platform';
import {wxFixture as fixture} from './helpers/WxFixture';
import {RULES_VERSION} from '../shared/Challenge';
import {it,expect,vi} from 'vitest';
import {MiniGameApp} from '../minigame/src/App';
import {WechatApi} from '../minigame/src/Api';
import {layout} from '../minigame/src/Layout';
import {Game} from '../src/Game';
import {C} from '../src/GameConfig';
it('微信无DOM宿主复用同一十二关、五命和物理协调器，不复制规则',()=>{
 const f=fixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),web=new Game();
 expect(app.game).toBeInstanceOf(Game);expect(app.game.lives).toBe(5);expect(app.game.levels.count).toBe(12);
 for(let i=0;i<12;i++){expect(app.game.levels.current).toEqual(web.levels.current);app.game.levels.next();web.levels.next();}
 expect(()=>app.frame(100)).not.toThrow();expect(app.canvas.width).toBe(750);
});
it.each([[320,568],[375,812],[430,932],[768,1024]])('分辨率%s×%s安全区和逻辑比例保持，挡板及底部按钮完整', (w,h)=>{
 const v=layout(w,h,44,h-34,80);expect(v.arena.width/v.arena.height).toBeCloseTo(C.width/C.height);expect(v.arena.y).toBeGreaterThan(80);expect(v.buttonsY).toBeGreaterThanOrEqual(v.arena.y+v.arena.height);expect(v.pad.y).toBe(v.arena.y+v.arena.height);expect(v.pad.height).toBeGreaterThanOrEqual(60);expect(v.buttonsY+44).toBeLessThanOrEqual(h-34);expect(v.arena.x).toBeGreaterThanOrEqual(0);
 const f=fixture(w,h);const app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});expect(()=>app.frame(1)).not.toThrow();
});
it('水平触屏控制、多指隔离、取消手势，挡板平滑而不瞬移',()=>{
 const f=fixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});(app as unknown as {chooseMode(m:string):void}).chooseMode('campaign');const v=layout(375,812,44,778,80);app.frame(100);
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
 for(let i=0;i<40;i++)g.physics.triple();expect(g.physics.balls.length).toBe(100);
 for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);expect(g.lives).toBe(4);expect(g.readyReason).toBe('lifeLost');expect(g.physics.balls.length).toBe(1);
});
it('网络异常不阻止单机开始、暂停、重开；结束可跳过成绩登记',async()=>{
 const f=fixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});app.game.start();for(const b of app.game.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});app.game.update(C.step);expect(app.game.state).toBe('ready');app.game.reset();app.game.start();expect(app.game.state).toBe('running');
 const request=new WechatApi(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});await expect(request.request('/leaderboard')).rejects.toThrow('网络暂不可用');expect(app.game.state).toBe('running');
});
it('微信登录只提交临时代码，会话持久化和CSRF正确，无openid或分数认证',async()=>{
 const f=fixture();f.wx.login=o=>o.success({code:'temporary-code'});const token='a'.repeat(43),csrfToken='csrf-token';
 f.wx.request=o=>{f.requests.push(o);if(o.url.endsWith('/wechat/login'))o.success({statusCode:200,data:{token,csrfToken,expiresAt:Date.now()+60000}});else o.success({statusCode:200,data:o.url.includes('/me?')?{csrfToken,player:null,best:null,board:'global',rankingRulesVersion:RULES_VERSION}:{ok:true}});};
 const api=new WechatApi(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});await Promise.all([api.login(),api.login()]);expect(f.requests).toHaveLength(1);expect(f.requests[0].data).toEqual({code:'temporary-code'});
 await api.request('/challenges',{rulesVersion:'test'});const challenge=f.requests.find(r=>r.url.endsWith('/challenges'))!;expect(challenge.header.authorization).toBe('Bearer '+token);expect(challenge.header['x-csrf-token']).toBe(csrfToken);
 const back=new WechatApi(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});expect(back.authenticated).toBe(true);
 f.wx.request=o=>o.success({statusCode:401,data:{message:'过期'}});await expect(back.me()).rejects.toThrow('过期');expect(back.authenticated).toBe(false);
});
it('生产禁止HTTP、本地开发可显式HTTP；分享不携带凭据或未经验证成绩',()=>{
 const f=fixture();expect(()=>new WechatApi(f.wx,{apiBase:'http://127.0.0.1:8091/api',development:false})).toThrow();expect(()=>new WechatApi(f.wx,{apiBase:'http://127.0.0.1:8091/api',development:true})).not.toThrow();
 let share:(()=>{title:string;query?:string})|undefined;f.wx.onShareAppMessage=fn=>{share=fn;};new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});expect(share!().title).toContain('球球出击');expect(share!().query).toBe('source=friend');expect(JSON.stringify(share!())).not.toMatch(/token|openid|session/);
});
it('异步微信登录在后台完成时仍保持暂停，不会回到前台自动发射',async()=>{
 const f=fixture();let pending:Parameters<Wx['login']>[0]|undefined;f.wx.login=o=>{pending=o;};f.wx.showModal=o=>o.success?.({confirm:true});f.wx.request=o=>o.success({statusCode:200,data:o.url.endsWith('/wechat/login')?{token:'b'.repeat(43),csrfToken:'csrf',expiresAt:Date.now()+60000}:{csrfToken:'csrf',rulesVersion:RULES_VERSION,player:null,best:null}});
 const app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});const starting=(app as unknown as {activate():Promise<void>}).activate();await vi.waitFor(()=>expect(pending).toBeDefined());f.events.hide();pending!.success({code:'late-login'});await starting;expect(app.game.state).toBe('paused');expect(app.game.journal.tick).toBe(0);f.events.show();expect(app.game.state).toBe('paused');
});
it('选择单机不会继承上一轮联网标记或暗中调用微信登录',async()=>{
 const f=fixture(),login=vi.fn(f.wx.login);f.wx.login=login;const app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});const testApp=app as unknown as {online:boolean;activate():Promise<void>};testApp.online=true;await testApp.activate();expect(app.game.state).toBe('running');expect(testApp.online).toBe(false);expect(login).not.toHaveBeenCalled();expect(f.requests).toHaveLength(0);
});
it('选择联网但API失败时立即降级单机，仍可暂停和重新开始',async()=>{
 const f=fixture();f.wx.showModal=o=>o.success?.({confirm:true});f.wx.login=o=>o.success({code:'failed-api-login'});const app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});await (app as unknown as {activate():Promise<void>}).activate();expect(app.game.state).toBe('running');expect(app.api.authenticated).toBe(false);app.game.pause();expect(app.game.state).toBe('paused');app.game.reset();expect(app.game.lives).toBe(5);expect(app.game.state).toBe('ready');
});

it('新版品牌与Canvas HUD读取同一个真实生命源，逐轮立即显示5至0',()=>{
 const f=fixture(),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});let now=100;app.frame(now);expect(f.texts).toContain('球球出击');
 for(let lives=4;lives>=0;lives--){app.game.start();for(const b of app.game.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});app.game.physics.powers.spawn(400,C.paddle.y,'life');f.texts.length=0;now+=20;app.frame(now);expect(app.game.lives).toBe(lives);expect(f.texts).toContain('生命');if(lives>0)expect(f.texts).toContain('♥'.repeat(lives));if(lives<5)expect(f.texts).toContain('♡'.repeat(5-lives));}
 expect(app.game.state).toBe('gameOver');
});
it('微信个人会话失效不能隐藏公开全球榜，只有一个榜单且可刷新',async()=>{
 const f=fixture();f.wx.login=o=>o.success({code:'login-code'});f.wx.request=o=>{
  if(o.url.endsWith('/wechat/login'))return o.success({statusCode:200,data:{token:'c'.repeat(43),csrfToken:'proof',expiresAt:Date.now()+60000}});
  if(o.url.includes('/leaderboard?'))return o.success({statusCode:200,data:{board:'global',rankingRulesVersion:RULES_VERSION,items:[{rank:1,display_name:'中国·公开榜玩家',score:10,reached_level:1}],nextOffset:null}});
  o.success({statusCode:401,data:{message:'登录状态失效'}});
 };const app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});await app.api.login();await (app as unknown as {board():Promise<void>}).board();
 expect(app.panel.title).toContain('全球历史排行榜');expect(app.panel.lines.join('')).toContain('中国·公开榜玩家');expect(app.panel.lines.join('')).toContain('重新登录');expect(app.panel.actions.map(a=>a.label)).toContain('刷新');expect(app.panel.actions.some(a=>/赛季|旧版/.test(a.label))).toBe(false);expect(app.api.authenticated).toBe(false);
});
it('重置数据库后旧微信凭据失效：身份GET只续登一次，随后可重新登记',async()=>{
 const f=fixture();let logins=0,reads=0;f.wx.login=o=>{logins++;o.success({code:'new-code-'+logins});};f.wx.request=o=>{
  if(o.url.endsWith('/wechat/login'))return o.success({statusCode:200,data:{token:(logins===1?'a':'b').repeat(43),csrfToken:'proof',expiresAt:Date.now()+60000}});
  if(++reads===1)return o.success({statusCode:401,data:{message:'旧会话已失效'}});
  o.success({statusCode:200,data:{csrfToken:'proof',player:null,best:null,board:'global',rankingRulesVersion:RULES_VERSION}});
 };const api=new WechatApi(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});await api.login();const me=await api.me();expect(me.player).toBeNull();expect(me.rankingAvailable).toBe(true);expect(logins).toBe(2);expect(reads).toBe(2);expect(api.authenticated).toBe(true);
});
it('持续401有明确终止，旧写请求绝不在新身份下自动重放',async()=>{
 const f=fixture();let logins=0,posts=0,reads=0;f.wx.login=o=>{logins++;o.success({code:'code-'+logins});};f.wx.request=o=>{if(o.url.endsWith('/wechat/login'))return o.success({statusCode:200,data:{token:'a'.repeat(43),csrfToken:'proof',expiresAt:Date.now()+60000}});if(o.method==='POST')posts++;else reads++;o.success({statusCode:401,data:{message:'会话不存在'}});};
 const api=new WechatApi(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});await expect(api.me()).rejects.toThrow('会话不存在');expect(logins).toBe(2);expect(reads).toBe(2);
 logins=0;await api.login();await expect(api.request('/players',{nickname:'重新登记',regionCode:'ISO:CN'})).rejects.toThrow('会话不存在');expect(logins).toBe(1);expect(posts).toBe(1);
});
it.each([[320,568],[390,844]])('微信%s×%s个人历史显示旧版记录，未重赛不冒充当前排名，菜单不新增整行高度',async(w,h)=>{
 const f=fixture(w,h),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});(app as unknown as {chooseMode(m:string):void}).chooseMode('campaign');
 vi.spyOn(app.api,'me').mockResolvedValue({rankingAvailable:true,csrfToken:'fixture',player:null,best:null,board:'global',rankingRulesVersion:RULES_VERSION,historicalBests:[{rules_version:'1.2.0-arcade-5l-12lv-v1',score:314115,reached_level:5,bricks_destroyed:10258,duration_ms:632700,rank:1,display_name:'历史玩家'}]});
 try{app.frame(100);f.events.down(f.touch(1,20,100));f.events.up(f.touch(1,20,100));expect(app.panel.title).toBe('游戏菜单');const action=app.panel.actions.find(a=>a.label==='个人历史记录');expect(action?.half).toBe(true);action!.run();
 await vi.waitFor(()=>expect(app.panel.title).toBe('个人历史记录'));expect(app.panel.lines).toContain('旧版十二关记录：314115 分 · 第5关');expect(app.panel.lines.join('')).toContain('重新挑战');app.frame(116);expect(app.panel.hits.every(hit=>hit.rect.y+hit.rect.height<h-34)).toBe(true);expect(app.game.state).toBe('ready');expect(app.game.journal.events).toHaveLength(0);
 }finally{app.dispose();}
});
