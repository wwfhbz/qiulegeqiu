import {it,expect,vi,afterEach} from 'vitest';
import {apiPayload,ApiResponseError} from '../shared/ApiErrors';
import {ApiClient} from '../src/online/ApiClient';
afterEach(()=>vi.unstubAllGlobals());
it('HTML/无效JSON不是赛季不支持，502与429保留准确状态',async()=>{
 vi.stubGlobal('fetch',async()=>new Response('<html>wrong proxy</html>',{status:200}));
 await expect(new ApiClient().request('/leaderboard')).rejects.toMatchObject({code:'INVALID_RESPONSE',status:200});
 expect(()=>apiPayload(502,'<html>gateway</html>')).toThrow('服务暂不可用');
 expect(()=>apiPayload(429,null)).toThrow('操作过于频繁');
});
it('后端明确版本错误保留code，不把昵称错误解释为版本错误',()=>{
 try{apiPayload(400,{message:'请升级后端',code:'UNSUPPORTED_RULES'});}catch(error){expect(error).toBeInstanceOf(ApiResponseError);expect(error).toMatchObject({code:'UNSUPPORTED_RULES',status:400,message:'请升级后端'});}
 expect(()=>apiPayload(400,{message:'昵称未通过审核'})).toThrow('昵称未通过审核');
 expect(apiPayload(200,{items:[]})).toEqual({items:[]});
});
import {RULES_VERSION,LEGACY_RULES_VERSION,assertChallengeSupport,assertGlobalBoard} from '../shared/Challenge';
import {ChallengeSync} from '../src/online/ChallengeSync';
import {Game} from '../src/Game';
import type {ApiTransport} from '../shared/ApiTransport';
it('身份和规则检查解耦，旧后端仍可登记昵称，但不能冒用旧榜排名',async()=>{
 const calls:{path:string;init?:RequestInit}[]=[];
 vi.stubGlobal('fetch',async(path:string,init?:RequestInit)=>{calls.push({path,init});return new Response(JSON.stringify(path.includes('/me')?{csrfToken:'real-csrf',player:null,best:{score:999,rank:1},rulesVersion:LEGACY_RULES_VERSION}:{id:'player'}));});
 const api=new ApiClient(),me=await api.me();expect(me.best).toBeNull();expect(me.historicalBest?.score).toBe(999);expect(me.rankingAvailable).toBe(false);
 await api.request('/players',{nickname:'测试玩家',regionCode:'ISO:CN'});expect(calls[1].init?.headers).toMatchObject({'x-csrf-token':'real-csrf'});
 expect(()=>assertGlobalBoard(me)).toThrow('后端需要更新');
});
it('规则能力预检区分旧后端和异常响应，拒绝旧规则但保留单机',async()=>{
 expect(()=>assertChallengeSupport({ok:true,rulesVersion:LEGACY_RULES_VERSION})).toThrow('尚不支持十二关');
 expect(()=>assertChallengeSupport({})).toThrow('响应无效');expect(()=>assertChallengeSupport({ok:true,supportedRulesVersions:RULES_VERSION as unknown as string[]})).toThrow('响应无效');
 expect(()=>assertChallengeSupport({ok:true,rulesVersion:LEGACY_RULES_VERSION,supportedRulesVersions:[RULES_VERSION,LEGACY_RULES_VERSION]})).not.toThrow();
 const calls:string[]=[],g=new Game();g.start();const api:ApiTransport={request:async<T>(path:string)=>{calls.push(path);return {ok:true,rulesVersion:LEGACY_RULES_VERSION} as T;}};const sync=new ChallengeSync(api,g);sync.observe();await expect(sync.flush()).rejects.toThrow('尚不支持十二关');expect(calls).toEqual(['/health']);expect(g.state).toBe('running');
});
it('服务端创建挑战必须回传相同规则，不能把十二关提交给旧验证器',async()=>{
 const g=new Game();g.start();const api:ApiTransport={request:async<T>(path:string)=>path==='/health'?{ok:true,supportedRulesVersions:[RULES_VERSION]} as T:{id:'wrong',rulesVersion:LEGACY_RULES_VERSION} as T};const sync=new ChallengeSync(api,g);sync.observe();await expect(sync.flush()).rejects.toThrow('规则版本或标识无效');
});
it('身份正在读取时强制刷新等待后重新请求，不返回提交前的旧最佳分',async()=>{
 let release!:()=>void,n=0;const gate=new Promise<void>(r=>{release=r;});vi.stubGlobal('fetch',async()=>{const index=++n;if(index===1)await gate;return new Response(JSON.stringify({board:'global',rankingRulesVersion:RULES_VERSION,csrfToken:'proof',player:null,best:{score:index,rank:index}}));});
 const api=new ApiClient(),first=api.me(),refreshed=api.me(true);release();expect((await first).best?.score).toBe(1);expect((await refreshed).best?.score).toBe(2);expect(n).toBe(2);
});
it('提交等待上传期间重新开始，不能把旧提交错误绑定到新挑战',async()=>{
 const g=new Game();for(let n=0;n<5;n++){g.start();for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(1/120);}
 let release!:()=>void;const gate=new Promise<void>(r=>{release=r;}),posts:string[]=[];
 const api:ApiTransport={request:async<T>(path:string)=>{posts.push(path);if(path==='/health')return {ok:true,supportedRulesVersions:[RULES_VERSION]} as T;if(path==='/challenges')return {id:'challenge',rulesVersion:RULES_VERSION} as T;if(path.endsWith('/events')){await gate;return {nextSequence:1} as T;}throw Error('不应提交');}};
 const sync=new ChallengeSync(api,g);sync.observe();const submitted=sync.submit();g.reset();release();await expect(submitted).rejects.toThrow('挑战已重新开始');expect(posts.some(p=>p.endsWith('/submit'))).toBe(false);
});
it('身份接口无效JSON对象不能当作未注册玩家或赛季错误',async()=>{vi.stubGlobal('fetch',async()=>new Response(JSON.stringify({ok:true})));await expect(new ApiClient().me()).rejects.toMatchObject({code:'INVALID_IDENTITY',message:'身份接口响应无效，请检查API代理配置'});});
it('清库后旧挑战401/404永久停止上传，重新开始才创建新的挑战',async()=>{
 let now=2000,attempts=0,created=0;const g=new Game();g.start();const api:ApiTransport={request:async<T>(path:string)=>{if(path==='/health')return {ok:true,supportedRulesVersions:[RULES_VERSION]} as T;if(path==='/challenges')return {id:'run-'+(++created),rulesVersion:RULES_VERSION} as T;attempts++;throw new ApiResponseError('挑战已不存在',404,'HTTP_ERROR');}};const sync=new ChallengeSync(api,g,()=>now);sync.observe();await expect(sync.flush()).rejects.toThrow('请重新开始');for(let i=0;i<50;i++){now+=2000;sync.observe();}expect(attempts).toBe(1);expect(created).toBe(1);g.reset();g.start();sync.observe();await expect(sync.flush()).rejects.toThrow('请重新开始');expect(created).toBe(2);expect(attempts).toBe(2);
});
it('503采用退避，不会因待上传事件超过128条而每帧重试',async()=>{
 let now=2000,attempts=0;const g=new Game();g.start();let hits=0;for(let i=0;i<g.physics.blocks.alive.length&&hits<160;i++)if(g.physics.blocks.alive[i]){g.physics.blocks.hit(i);hits++;}expect(g.journal.events.length).toBeGreaterThan(128);const api:ApiTransport={request:async<T>(path:string)=>{if(path==='/health')return {ok:true,supportedRulesVersions:[RULES_VERSION]} as T;if(path==='/challenges')return {id:'run',rulesVersion:RULES_VERSION} as T;attempts++;throw new ApiResponseError('服务暂不可用',503,'HTTP_ERROR');}};const sync=new ChallengeSync(api,g,()=>now);sync.observe();await expect(sync.flush()).rejects.toThrow('服务暂不可用');for(let i=0;i<50;i++){now+=10;sync.observe();}expect(attempts).toBe(1);now+=2000;sync.observe();await expect(sync.flush()).rejects.toThrow();expect(attempts).toBe(2);
});
it('新挑战创建前刷新浏览器匿名身份，不能复用清库前的CSRF缓存',async()=>{
 let identities=0;const posted:string[]=[];vi.stubGlobal('fetch',async(path:string,init?:RequestInit)=>{if(path.includes('/me?'))return new Response(JSON.stringify({csrfToken:'csrf-'+(++identities),player:null,best:null,board:'global',rankingRulesVersion:RULES_VERSION}));posted.push((init?.headers as Record<string,string>)['x-csrf-token']);return new Response(JSON.stringify({id:'new-run',rulesVersion:RULES_VERSION}));});const api=new ApiClient();await api.me();await api.request('/challenges',{rulesVersion:RULES_VERSION});expect(identities).toBe(2);expect(posted).toEqual(['csrf-2']);
});
