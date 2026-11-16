import {it,expect,vi} from 'vitest';
import {MiniGameApp} from '../wechat-game/src/App';
import {wxFixture} from './helpers/WxFixture';
import {layout} from '../wechat-game/src/Layout';
import {ChallengeJournal} from '../src/ChallengeJournal';
import {ChallengeSync} from '../src/online/ChallengeSync';
import {Game} from '../src/Game';
import {MAX_CHALLENGE_EVENTS} from '../shared/Challenge';
type Private={view:ReturnType<typeof layout>;busy:boolean;chooseMode(m:'campaign'|'endless'):void};
/** Restart and home live in the pause menu (pause key → 重新开始 / 回到主界面) and confirm inside the panel. */
type Hit={rect:{x:number;y:number;width:number;height:number}};type Panel={title:string;open:boolean;actions:{label:string}[];hits:Hit[]};
function tap(f:ReturnType<typeof wxFixture>,x:number,y:number){const t=f.touch(1,x,y);f.events.down(t);f.events.up(t);}
function tapPause(f:ReturnType<typeof wxFixture>,app:MiniGameApp,p:Private){app.frame(1e5);tap(f,p.view.width-126,p.view.titleY+18);app.frame(1e5+16);}
/** Taps a panel button where it is drawn, through the wx touch callbacks (not by calling run()). */
function tapLabel(f:ReturnType<typeof wxFixture>,app:MiniGameApp,label:string){const panel=(app as unknown as {panel:Panel}).panel;app.frame(2e5);const i=panel.actions.findIndex(a=>a.label===label);expect(i).toBeGreaterThanOrEqual(0);const r=panel.hits[i].rect;tap(f,r.x+r.width/2,r.y+r.height/2);app.frame(2e5+16);}
it('微信：暂停后重新开始——本局进行中先在面板里确认；继续本局回到菜单，确认才重开；未开局直接重开；不调用 wx.showModal',()=>{
 const f=wxFixture(390,844,3),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),p=app as unknown as Private,panel=app as unknown as {panel:Panel};
 try{app.frame(16);p.chooseMode('campaign');app.frame(32);const g=app.game;const modal=vi.fn();f.wx.showModal=modal;
  tapPause(f,app,p);tapLabel(f,app,'重新开始');expect(g.state).toBe('ready');expect(panel.panel.open).toBe(false);
  g.start();for(let i=0;i<5;i++)app.frame(3e5+i*16);const generation=g.journal.generation;tapPause(f,app,p);expect(g.state).toBe('paused');expect(panel.panel.title).toBe('游戏暂停');
  tapLabel(f,app,'重新开始');expect(panel.panel.title).toBe('重新开始');tapLabel(f,app,'继续本局');expect(panel.panel.title).toBe('游戏暂停');expect(g.journal.generation).toBe(generation);
  tapLabel(f,app,'重新开始');tapLabel(f,app,'重新开始');expect(g.journal.generation).toBe(generation+1);expect(g.state).toBe('ready');expect(panel.panel.open).toBe(false);expect(modal).not.toHaveBeenCalled();
 }finally{app.dispose();}
});
it('微信：暂停后回到主界面——确认后回到模式选择页；暂停键在菜单上再点一次即继续游戏（与网页一致）',()=>{
 const f=wxFixture(390,844,3),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),p=app as unknown as Private,panel=app as unknown as {panel:Panel};
 try{app.frame(16);p.chooseMode('campaign');app.frame(32);const g=app.game;g.start();for(let i=0;i<5;i++)app.frame(3e5+i*16);
  tapPause(f,app,p);expect(g.state).toBe('paused');tapPause(f,app,p);expect(panel.panel.open).toBe(false);expect(g.state).toBe('running');
  tapPause(f,app,p);tapLabel(f,app,'回到主界面');expect(panel.panel.title).toBe('回到主界面');tapLabel(f,app,'回到主界面');
  expect(panel.panel.title).toBe('选择游戏模式');expect(g.state).toBe('ready');expect(g.journal.events).toHaveLength(0);
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
it('微信顶栏：⚙ 左上角打开设置（运行中会暂停，完成后继续）；皮肤键在暂停与排行榜之间',()=>{
 const f=wxFixture(390,844,3),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false}),p=app as unknown as Private&{view:{top:number}},panel=app as unknown as {panel:Panel};
 try{app.frame(16);p.chooseMode('campaign');app.frame(32);const g=app.game;g.start();for(let i=0;i<5;i++)app.frame(3e5+i*16);
  tap(f,26,p.view.top+16);expect(panel.panel.title).toBe('设置');expect(g.state).toBe('paused');tapLabel(f,app,'完成');expect(panel.panel.open).toBe(false);expect(g.state).toBe('running');
  app.frame(4e5);tap(f,p.view.width-78,p.view.titleY+18);expect(panel.panel.title).toBe('皮肤');expect(g.state).toBe('paused');tapLabel(f,app,'完成');expect(g.state).toBe('running');
 }finally{app.dispose();}
});
