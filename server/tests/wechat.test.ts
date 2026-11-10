import {it,expect,afterEach,vi} from 'vitest';
import {createApp} from '../src/app';
import {productionWechat,type WechatProvider} from '../src/wechat';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {rollbackWechatEmpty} from '../src/db';
import {RULES_VERSION} from '../../shared/Challenge';
import {verifyTrace} from '../src/verifier';
const apps:Awaited<ReturnType<typeof createApp>>[]=[];
afterEach(async()=>{for(const s of apps.splice(0))await s.app.close();vi.unstubAllEnvs();vi.unstubAllGlobals();});
async function setup(provider?:WechatProvider){let now=Date.now();const s=await createApp({dbPath:':memory:',origin:'https://ball.gmgnclaw.com',secure:true,now:()=>now,wechat:provider||{appId:'wx0000000000000000',exchange:async code=>({openid:code.split(':')[0]})}});apps.push(s);return {...s,advance:(dt:number)=>{now+=dt;}};}
async function login(s:Awaited<ReturnType<typeof setup>>,code:string){return s.app.inject({method:'POST',url:'/api/wechat/login',payload:{code}});}
function headers(c:{token:string;csrfToken:string}){return {authorization:'Bearer '+c.token,'x-csrf-token':c.csrfToken};}
async function register(s:Awaited<ReturnType<typeof setup>>,h:Record<string,string>,name='微信玩家'){return s.app.inject({method:'POST',url:'/api/players',headers:h,payload:{nickname:name,regionCode:'ISO:CN'}});}
async function web(s:Awaited<ReturnType<typeof setup>>){const r=await s.app.inject({url:'/api/me'});return {cookie:'__Secure-qlgq='+r.cookies[0].value,origin:'https://ball.gmgnclaw.com','x-csrf-token':r.json().csrfToken};}
it('缺少正式配置拒绝登录，不伪造成功；客户端openid等字段不能作为身份',async()=>{
 vi.stubEnv('WECHAT_APP_ID','');vi.stubEnv('WECHAT_APP_SECRET','');const real=await createApp({dbPath:':memory:'});apps.push(real);
 expect((await real.app.inject({method:'POST',url:'/api/wechat/login',payload:{code:'test'}})).statusCode).toBe(503);
 const s=await setup();expect((await s.app.inject({method:'POST',url:'/api/wechat/login',payload:{code:'ok',openid:'victim'}})).statusCode).toBe(400);
});
it('微信换码只访问官方HTTPS，丢弃session_key，错误不泄露secret/code',async()=>{
 vi.stubEnv('WECHAT_APP_ID','wx0123456789abcdef');vi.stubEnv('WECHAT_APP_SECRET','a'.repeat(32));
 const fetcher=vi.fn(async(url:URL)=>{expect(url.origin).toBe('https://api.weixin.qq.com');expect(url.pathname).toBe('/sns/jscode2session');expect(url.searchParams.get('js_code')).toBe('private-code');return new Response(JSON.stringify({openid:'server-only-openid',session_key:'must-not-return'}));});
 vi.stubGlobal('fetch',fetcher);expect(await productionWechat()!.exchange('private-code')).toEqual({openid:'server-only-openid'});
 vi.stubGlobal('fetch',async()=>{throw Error('secret='+process.env.WECHAT_APP_SECRET);});await expect(productionWechat()!.exchange('private-code')).rejects.toThrow('微信登录暂不可用');
});
it('安全Bearer会话持久映射微信玩家，旧码重放拒绝、过期拒绝、不会设置网页Cookie',async()=>{
 const s=await setup();const a=await login(s,'user:a');expect(a.statusCode).toBe(200);expect(a.headers['set-cookie']).toBeUndefined();expect(a.body).not.toContain('openid');expect(a.body).not.toContain('session_key');
 const c=a.json();expect(c.token).toHaveLength(43);expect(s.db.prepare('SELECT session_token_hash FROM sessions').get()!.session_token_hash).not.toBe(c.token);
 const p=await register(s,headers(c));expect(p.statusCode).toBe(201);
 const again=(await login(s,'user:b')).json();expect(again.token).not.toBe(c.token);expect((await s.app.inject({url:'/api/me',headers:headers(again)})).json().player.id).toBe(p.json().id);
 expect((await login(s,'user:a')).statusCode).toBe(409);
 s.advance(31*86400000);expect((await s.app.inject({url:'/api/me',headers:headers(c)})).statusCode).toBe(401);
});
it('Cookie和Bearer不能混淆，CSRF、跨站保护保持有效，伪造token不能访问',async()=>{
 const s=await setup(),c=(await login(s,'one:a')).json(),h=await web(s);
 expect((await s.app.inject({url:'/api/me',headers:{authorization:'Bearer '+'x'.repeat(43)}})).statusCode).toBe(401);
 expect((await s.app.inject({url:'/api/me',headers:{authorization:'Bearer bad',cookie:h.cookie}})).statusCode).toBe(401);
 const bearerAsCookie=await s.app.inject({url:'/api/me',headers:{cookie:'__Secure-qlgq='+c.token}});expect(bearerAsCookie.json().player).toBeNull();expect(bearerAsCookie.cookies.length).toBe(1);
 expect((await register(s,{authorization:'Bearer '+c.token})).statusCode).toBe(403);
 expect((await register(s,{...headers(c),origin:'https://evil.invalid'})).statusCode).toBe(403);
 expect((await register(s,{cookie:h.cookie,'x-csrf-token':h['x-csrf-token']})).statusCode).toBe(403);
 expect((await register(s,h,'网页仍可玩')).statusCode).toBe(201);
});
it('微信会话并发注册同一身份只保留一个玩家，跨端昵称地区唯一约束保留',async()=>{
 const s=await setup(),a=(await login(s,'same:a')).json(),b=(await login(s,'same:b')).json();
 const results=await Promise.all([register(s,headers(a),'一致身份'),register(s,headers(b),'一致身份')]);expect(results.every(r=>[200,201].includes(r.statusCode))).toBe(true);expect(results[0].json().id).toBe(results[1].json().id);expect(s.db.prepare('SELECT COUNT(*) n FROM players').get()!.n).toBe(1);
 const browser=await web(s);expect((await register(s,browser,'一致身份')).statusCode).toBe(409);
});
it('绑定必须同时持有真实网页会话生成的单次码和微信凭据，保留原玩家/历史、不可冒领和重复消费',async()=>{
 const s=await setup(),wh=await web(s),pid=(await register(s,wh,'原网页玩家')).json().id;
 const c=(await login(s,'bind:a')).json(),ticket=(await s.app.inject({method:'POST',url:'/api/account/link-ticket',headers:wh,payload:{}})).json().ticket;
 expect((await s.app.inject({method:'POST',url:'/api/account/link-ticket',headers:headers(c),payload:{}})).statusCode).toBe(403);
 expect((await s.app.inject({method:'POST',url:'/api/wechat/bind',headers:wh,payload:{ticket}})).statusCode).toBe(403);
 expect((await s.app.inject({method:'POST',url:'/api/wechat/bind',headers:headers(c),payload:{ticket}})).statusCode).toBe(200);
 expect((await s.app.inject({url:'/api/me',headers:headers(c)})).json().player.id).toBe(pid);
 const other=(await login(s,'other:a')).json();expect((await s.app.inject({method:'POST',url:'/api/wechat/bind',headers:headers(other),payload:{ticket}})).statusCode).toBe(409);
 expect(s.db.prepare('SELECT COUNT(*) n FROM players').get()!.n).toBe(1);
 const fresh=(await login(s,'bind:b')).json();expect((await s.app.inject({url:'/api/me',headers:headers(fresh)})).json().player.id).toBe(pid);
});
it('过期绑定码、已登记微信玩家、封禁账号不能自动合并/复活',async()=>{
 const s=await setup(),wh=await web(s);await register(s,wh,'不可冒名');const c=(await login(s,'late:a')).json();const ticket=(await s.app.inject({method:'POST',url:'/api/account/link-ticket',headers:wh,payload:{}})).json().ticket;
 s.advance(301000);expect((await s.app.inject({method:'POST',url:'/api/wechat/bind',headers:headers(c),payload:{ticket}})).statusCode).toBe(409);
 await register(s,headers(c),'已有微信身份');const next=(await s.app.inject({method:'POST',url:'/api/account/link-ticket',headers:wh,payload:{}})).json().ticket;
 expect((await s.app.inject({method:'POST',url:'/api/wechat/bind',headers:headers(c),payload:{ticket:next}})).statusCode).toBe(409);
 s.db.prepare('UPDATE players SET status=\'banned\' WHERE nickname=?').run('已有微信身份');expect((await s.app.inject({method:'POST',url:'/api/challenges',headers:headers(c),payload:{rulesVersion:RULES_VERSION}})).statusCode).toBe(403);
});
it('微信成绩仍用真实日志校验，网页同榜可读，不信任伪造分数且他人不能提交',async()=>{
 const s=await setup(),c=(await login(s,'score:a')).json(),h=headers(c);await register(s,h,'共同榜单');
 const g=new Game();for(let round=0;round<5;round++){g.start();for(let n=0;n<20;n++)g.update(.1);Object.assign(g.physics.balls[0],{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);}
 const cid=(await s.app.inject({method:'POST',url:'/api/challenges',headers:h,payload:{rulesVersion:RULES_VERSION,seed:g.journal.seed}})).json().id;s.advance(20000);
 const events=g.journal.events;expect(g.state).toBe('gameOver');const summary=verifyTrace(events,20000,g.journal.seed).summary;
 expect((await s.app.inject({method:'POST',url:`/api/challenges/${cid}/events`,headers:h,payload:{sequence:0,events}})).statusCode).toBe(200);
 const key=randomUUID();expect((await s.app.inject({method:'POST',url:`/api/challenges/${cid}/submit`,headers:h,payload:{idempotencyKey:key,summary:{...summary,score:99999}}})).statusCode).toBe(422);
 const result=await s.app.inject({method:'POST',url:`/api/challenges/${cid}/submit`,headers:h,payload:{idempotencyKey:key,summary}});expect(result.statusCode,result.body).toBe(200);
 const browser=await web(s),board=await s.app.inject({url:'/api/leaderboard',headers:browser});expect(board.json().items[0].display_name).toBe('中国·共同榜单');
 const other=(await login(s,'stranger:a')).json();expect((await s.app.inject({method:'POST',url:`/api/challenges/${cid}/events`,headers:headers(other),payload:{sequence:0,events}})).statusCode).toBe(404);
});
it('换码失败、登录频率限制及重放保护有效',async()=>{
 const s=await setup({appId:'wx0000000000000000',exchange:async()=>{throw Error('secret-detail');}});
 const r=await login(s,'bad:a');expect(r.statusCode).toBe(503);expect(r.body).not.toContain('secret-detail');
 for(let i=0;i<29;i++)await login(s,'bad:'+i);expect((await login(s,'too-many')).statusCode).toBe(429);
});

it('追加迁移只允许空微信表结构回退，非空拒绝且玩家会话数据不丢失',async()=>{
 const empty=await setup(),wh=await web(empty);await register(empty,wh,'保留网页身份');const before=empty.db.prepare('SELECT COUNT(*) n FROM sessions').get()!.n;
 rollbackWechatEmpty(empty.db);expect(empty.db.prepare('SELECT COUNT(*) n FROM sessions').get()!.n).toBe(before);expect(empty.db.prepare('SELECT COUNT(*) n FROM players').get()!.n).toBe(1);expect(empty.db.prepare('SELECT 1 FROM schema_migrations WHERE version=3').get()).toBeUndefined();
 const filled=await setup();await login(filled,'rollback:a');expect(()=>rollbackWechatEmpty(filled.db)).toThrow();expect(filled.db.prepare('SELECT COUNT(*) n FROM wechat_sessions').get()!.n).toBe(1);expect(filled.db.prepare('SELECT 1 FROM schema_migrations WHERE version=3').get()).toBeTruthy();
});

it('微信身份及令牌在真实SQLite关闭重开后保持，不建立重复玩家',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'qlgq-wx-persist-')),path=join(dir,'board.sqlite');let current:Awaited<ReturnType<typeof createApp>>|undefined;
 const provider={appId:'wx0000000000000000',exchange:async()=>({openid:'persistent-wx-identity'})};
 try{current=await createApp({dbPath:path,secure:true,origin:'https://ball.gmgnclaw.com',wechat:provider});const c=(await current.app.inject({method:'POST',url:'/api/wechat/login',payload:{code:'first-code'}})).json();
  const p=await current.app.inject({method:'POST',url:'/api/players',headers:headers(c),payload:{nickname:'微信持久身份',regionCode:'ISO:CN'}});expect(p.statusCode).toBe(201);const pid=p.json().id;
  await current.app.close();current=await createApp({dbPath:path,secure:true,origin:'https://ball.gmgnclaw.com',wechat:provider});expect((await current.app.inject({url:'/api/me',headers:headers(c)})).json().player.id).toBe(pid);
  const next=(await current.app.inject({method:'POST',url:'/api/wechat/login',payload:{code:'second-code'}})).json();expect((await current.app.inject({url:'/api/me',headers:headers(next)})).json().player.id).toBe(pid);expect(current.db.prepare('SELECT COUNT(*) n FROM players').get()!.n).toBe(1);
 }finally{if(current)await current.app.close();rmSync(dir,{recursive:true,force:true});}
});
it('同一绑定码并发消费只成功一个，微信注册不能绕过昵称审核',async()=>{
 const s=await setup(),wh=await web(s);await register(s,wh,'并发绑定网页');const ticket=(await s.app.inject({method:'POST',url:'/api/account/link-ticket',headers:wh,payload:{}})).json().ticket;
 const a=(await login(s,'race-one:a')).json(),b=(await login(s,'race-two:a')).json();const results=await Promise.all([a,b].map(c=>s.app.inject({method:'POST',url:'/api/wechat/bind',headers:headers(c),payload:{ticket}})));expect(results.map(r=>r.statusCode).sort()).toEqual([200,409]);expect(s.db.prepare('SELECT COUNT(*) n FROM wechat_identities WHERE player_id IS NOT NULL').get()!.n).toBe(1);
 const bad=(await login(s,'moderation:a')).json();expect((await register(s,headers(bad),'官方管理员')).statusCode).toBe(400);
});
