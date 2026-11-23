import {expect,it,vi} from 'vitest';
import {Game} from '../src/Game';
import {C} from '../src/GameConfig';
import {CampaignProgress,levelStars,starText,trialHoursLeft,LEGACY_PADDLE_STAR_UNLOCKS} from '../src/campaign/Progress';
import {ChallengeSync} from '../src/online/ChallengeSync';
import {MiniGameApp} from '../wechat-game/src/App';
import {wxFixture} from './helpers/WxFixture';
import {breakAll} from './helpers/BreakAll';

const loseLife=(g:Game)=>{for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);};
it('星级：不丢命三星、丢1命两星、其余一星；进度保存最好成绩，通关前一关才解锁下一关',()=>{
 expect([0,1,2,5].map(levelStars)).toEqual([3,2,1,1]);expect(starText(2)).toBe('★★☆');
 const store=new Map<string,string>(),io={read:()=>store.get('k')??null,write:(v:string)=>{store.set('k',v);}};
 const p=new CampaignProgress(io);expect(p.unlocked(1)).toBe(true);expect(p.unlocked(2)).toBe(false);
 expect(p.record(1,2)).toBe(true);expect(p.record(1,1)).toBe(false);expect(p.record(1,3)).toBe(true);expect(p.unlocked(2)).toBe(true);expect(p.frontier).toBe(2);
 const again=new CampaignProgress(io);expect(again.stars[0]).toBe(3);expect(again.total).toBe(3);
 expect(new CampaignProgress({read:()=>'{broken',write:()=>{}}).total).toBe(0);
 expect(LEGACY_PADDLE_STAR_UNLOCKS).toEqual({neon:12,flame:24,gold:36});
 expect(trialHoursLeft(1000+3600000*23.5,1000)).toBe(24);expect(trialHoursLeft(500,1000)).toBe(0);expect(trialHoursLeft(undefined,1000)).toBe(0);
});
it('完整挑战每过一关记星；闯关存档：从任意已解锁关开始、不上传，可看视频复活/跳关，通关停在本关可接下一关',()=>{
 const g=new Game(),cleared:[number,number][]=[];g.onLevelCleared=(l,s)=>cleared.push([l,s]);
 g.start();breakAll(g);g.update(0);expect(cleared).toEqual([[1,3]]);
 g.startPractice(5);expect(g.levels.current.number).toBe(5);expect(g.practice).toBe(true);expect(g.journal.unranked).toBe(true);expect(g.lives).toBe(3);expect(g.canSkip).toBe(true);
 const offer=vi.fn(()=>true);g.canOfferRevive=offer;
 g.start();loseLife(g);expect(g.lives).toBe(2);g.start();breakAll(g);g.update(0);
 expect(g.state).toBe('levelComplete');expect(g.lastStars).toBe(2);expect(cleared.at(-1)).toEqual([5,2]);expect(g.journal.events.some(e=>e.type==='finish')).toBe(false);
 g.nextLevel();expect(g.levels.current.number).toBe(6);expect(g.practice).toBe(true);expect(g.lives).toBe(3);
 g.start();for(let i=0;i<3;i++){loseLife(g);if(g.state==='ready')g.start();}expect(g.state).toBe('gameOver');expect(offer).toHaveBeenCalled();expect(g.awaitingRevive).toBe(true);g.endRun();
 const requests:string[]=[],sync=new ChallengeSync({request:async(path:string)=>{requests.push(path);return {} as never;}},g);sync.observe();expect(requests).toHaveLength(0);
 // Practising the final level never ends in victory; a normal run again clears the practice flag.
 g.startPractice(12);g.start();breakAll(g);g.update(0);expect(g.state).toBe('levelComplete');g.reset();expect(g.practice).toBe(false);expect(g.levels.current.number).toBe(1);
});
it('微信：选模式页有关卡地图；未解锁关卡点不动；练习通关弹出星级面板；攒够星星解锁皮肤',()=>{
 const f=wxFixture(390,844,3),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});
 type P={panel:{title:string;mapView?:{open:boolean[]};actions:{label:string;run():void}[];hits:{rect:{x:number;y:number;width:number;height:number}}[]};picking:boolean;skins():void};const p=app as unknown as P;
 try{app.frame(16);expect(p.panel.title).toBe('选择游戏模式');p.panel.actions.find(a=>a.label==='关卡地图')!.run();app.frame(32);
  expect(p.panel.title).toBe('关卡地图');expect(p.panel.mapView!.open.slice(0,3)).toEqual([true,false,false]);
  p.panel.actions[3].run();expect(p.panel.title).toBe('关卡地图');// level 3 is locked: no hit target is registered for it
  expect(p.panel.hits.length).toBe(2);
  p.panel.actions[1].run();expect(app.game.practice).toBe(true);expect(app.game.levels.current.number).toBe(1);
  app.game.start();breakAll(app.game);app.frame(48);app.frame(64);
  expect(p.panel.title).toContain('第1关');expect(p.panel.title).toContain('★★★');expect(p.panel.actions.map(a=>a.label)).toEqual(['下一关','再来一次','关卡地图']);
  expect(app.progress.stars[0]).toBe(3);expect(f.storage.get('qiulegeqiu:wechat-stars:v1')).toContain('3');
  // 2.17 shards: the first three-star clear of level 1 paid 2 shards; stars only open skins, shards buy them.
  expect(app.shards.balance).toBe(2);p.skins();
  expect(p.panel.actions.some(a=>a.label==='流星拖尾：差8碎片')).toBe(true);expect(p.panel.actions.some(a=>a.label==='★9 开放爱心拖尾')).toBe(true);expect(p.panel.actions.some(a=>a.label==='★6 开放霓虹光剑')).toBe(true);
  for(let n=2;n<=5;n++){app.progress.record(n,3);app.shards.earnThreeStars(n);}expect(app.shards.earnThreeStars(2)).toBe(0);expect(app.shards.balance).toBe(10);
  p.skins();p.panel.actions.find(a=>a.label==='兑换流星拖尾（10碎片）')!.run();expect(app.shards.balance).toBe(0);expect((app as unknown as {renderer:{trail:string}}).renderer.trail).toBe('comet');expect(f.storage.get('qiulegeqiu:wechat-trails:v1')).toContain('comet');
  expect(p.panel.actions.some(a=>a.label==='流星拖尾：使用中')).toBe(true);expect(p.panel.actions.some(a=>a.label==='霓虹光剑：差10碎片')).toBe(true);
 }finally{app.dispose();}
});
it('微信：V2.15 已靠星星解锁的拖尾（6/18/30星）升级后永久保留，只迁移一次',()=>{
 const f=wxFixture(390,844,3);f.storage.set('qiulegeqiu:wechat-stars:v1',JSON.stringify({stars:[3,3,3,3,3,3,2,0,0,0,0,0]}));
 const app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});
 try{expect(app.progress.total).toBe(20);expect(f.storage.get('qiulegeqiu:wechat-trails:v1')).toEqual(['comet','heart']);expect(f.storage.get('qiulegeqiu:wechat-trail-stars-kept:v1')).toBe(true);}finally{app.dispose();}
 // Later star gains never unlock trails by themselves again.
 f.storage.set('qiulegeqiu:wechat-stars:v1',JSON.stringify({stars:Array(12).fill(3)}));const again=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});
 try{expect(f.storage.get('qiulegeqiu:wechat-trails:v1')).toEqual(['comet','heart']);}finally{again.dispose();}
});
it('2.16 闯关存档：选闯关直接从最远解锁关开始；跳关也会解锁下一关；重新开始只重打本关；排行榜只剩无尽榜',async()=>{
 const store=new Map<string,string>(),io={read:()=>store.get('k')??null,write:(v:string)=>{store.set('k',v);}},p=new CampaignProgress(io);
 p.reach(4);expect(p.unlocked(4)).toBe(true);expect(p.unlocked(5)).toBe(false);expect(new CampaignProgress(io).frontier).toBe(4);
 const f=wxFixture(390,844,3),app=new MiniGameApp(f.wx,{apiBase:'https://ball.gmgnclaw.com/api',development:false});
 type P={chooseMode(m:string):void;rankingBoard:string;panel:{actions:{label:string;run():void}[]};confirmRestart():void;board():Promise<void>};const x=app as unknown as P;
 try{for(let n=1;n<=3;n++)app.progress.record(n,2);
  x.chooseMode('campaign');expect(app.game.practice).toBe(true);expect(app.game.levels.current.number).toBe(4);expect(app.game.journal.unranked).toBe(true);
  // A rewarded skip opens the next level in the save even without stars.
  expect(app.game.skipLevel()).toBe(true);expect(app.game.levels.current.number).toBe(5);expect(app.progress.unlocked(5)).toBe(true);expect(app.progress.frontier).toBe(5);expect(app.game.lives).toBe(3);
  app.game.start();x.confirmRestart();x.panel.actions.find(a=>a.label==='重新开始')!.run();expect(app.game.levels.current.number).toBe(5);expect(app.game.practice).toBe(true);expect(app.game.journal.events).toHaveLength(0);
  expect(x.rankingBoard).toBe('endless');await x.board();expect(x.panel.actions.some(a=>a.label==='闯关榜'||a.label==='无尽榜')).toBe(false);
 }finally{app.dispose();}
});
it('闯关通关后（levelComplete）不算对局进行中：网页顶部模式按钮与微信切换/重开/回主页都无需确认',async()=>{
 const {runInProgress}=await import('../src/GameUI');
 const g=new Game();g.startPractice(1);expect(runInProgress(g)).toBe(false);
 g.start();g.update(C.step);expect(runInProgress(g)).toBe(true);
 breakAll(g);g.update(0);expect(g.state).toBe('levelComplete');expect(runInProgress(g)).toBe(false);
 const full=new Game();full.start();full.update(C.step);breakAll(full);full.update(0);expect(full.practice).toBe(false);expect(runInProgress(full)).toBe(true);
});
