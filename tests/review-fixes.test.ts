import {it,expect,vi} from 'vitest';
import {MiniGameApp} from '../wechat-game/src/App';
import {wxFixture} from './helpers/WxFixture';
import {layout} from '../wechat-game/src/Layout';
import {ChallengeJournal} from '../src/ChallengeJournal';
import {ChallengeSync} from '../src/online/ChallengeSync';
import {Game} from '../src/Game';
import {MAX_CHALLENGE_EVENTS} from '../shared/Challenge';
type Private={view:ReturnType<typeof layout>;busy:boolean;chooseMode(m:'campaign'|'endless'):void};
function tapRestart(f:ReturnType<typeof wxFixture>,p:Private){const v=p.view,t=f.touch(1,v.width-30,v.titleY+18);f.events.down(t);f.events.up(t);}
it('微信：本局进行中点重开先弹确认；取消保留本局并继续，确认才重开；未开局直接重开',async()=>{
 const f=wxFixture(390,844,3),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),p=app as unknown as Private;
 try{app.frame(16);p.chooseMode('campaign');app.frame(32);const g=app.game;
  let answer:((r:{confirm:boolean})=>void)|undefined;const modal=vi.fn((o:Parameters<typeof f.wx.showModal>[0])=>{answer=o.success;});f.wx.showModal=modal;
  tapRestart(f,p);expect(modal).not.toHaveBeenCalled();
  g.start();const generation=g.journal.generation;tapRestart(f,p);expect(modal).toHaveBeenCalledTimes(1);expect(g.state).toBe('paused');
  answer!({confirm:false});await vi.waitFor(()=>expect(p.busy).toBe(false));expect(g.journal.generation).toBe(generation);expect(g.state).toBe('running');
  tapRestart(f,p);answer!({confirm:true});await vi.waitFor(()=>expect(p.busy).toBe(false));expect(g.journal.generation).toBe(generation+1);expect(g.state).toBe('ready');
 }finally{app.dispose();}
});
it('记录上限：90%时提醒，满额后截断并禁止提交',()=>{
 const j=new ChallengeJournal();for(let i=0;i<MAX_CHALLENGE_EVENTS*.9-1;i++)j.events.push({type:'ballLost',tick:0,level:1});expect(j.nearLimit).toBe(false);
 j.record({type:'ballLost',level:1});expect(j.nearLimit).toBe(true);expect(MAX_CHALLENGE_EVENTS).toBe(200000);
 while(j.events.length<MAX_CHALLENGE_EVENTS)j.events.push({type:'ballLost',tick:0,level:1});j.record({type:'ballLost',level:1});expect(j.truncated).toBe(true);expect(j.events).toHaveLength(MAX_CHALLENGE_EVENTS);
});
it('网页：未连上排行榜服务的局不算"已连接"，结束时不自动弹出提交框',async()=>{
 const g=new Game(),sync=new ChallengeSync({request:()=>Promise.reject(Object.assign(Error('offline'),{status:undefined}))},g);
 expect(sync.connected).toBe(false);g.start();sync.observe();expect(sync.connected).toBe(true);
 await vi.waitFor(()=>expect(sync.connected).toBe(false));
});
