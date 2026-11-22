import {expect,it,vi} from 'vitest';
import {Game} from '../src/Game';
import {C} from '../src/GameConfig';
import {CampaignProgress,levelStars,starText,STAR_SKIN_UNLOCKS} from '../src/campaign/Progress';
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
 expect(Math.max(...Object.values(STAR_SKIN_UNLOCKS))).toBe(36);
});
it('完整挑战每过一关记星；单关练习从任意关开始、不上传、不复活不跳关，通关停在本关可接下一关',()=>{
 const g=new Game(),cleared:[number,number][]=[];g.onLevelCleared=(l,s)=>cleared.push([l,s]);
 g.start();breakAll(g);g.update(0);expect(cleared).toEqual([[1,3]]);
 g.startPractice(5);expect(g.levels.current.number).toBe(5);expect(g.practice).toBe(true);expect(g.journal.unranked).toBe(true);expect(g.lives).toBe(3);expect(g.canSkip).toBe(false);
 const offer=vi.fn(()=>true);g.canOfferRevive=offer;
 g.start();loseLife(g);expect(g.lives).toBe(2);g.start();breakAll(g);g.update(0);
 expect(g.state).toBe('levelComplete');expect(g.lastStars).toBe(2);expect(cleared.at(-1)).toEqual([5,2]);expect(g.journal.events.some(e=>e.type==='finish')).toBe(false);
 g.nextLevel();expect(g.levels.current.number).toBe(6);expect(g.practice).toBe(true);expect(g.lives).toBe(3);
 g.start();for(let i=0;i<3;i++){loseLife(g);if(g.state==='ready')g.start();}expect(g.state).toBe('gameOver');expect(offer).not.toHaveBeenCalled();
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
  p.skins();expect(p.panel.actions.some(a=>a.label==='★6 解锁流星拖尾')).toBe(true);
  for(let n=2;n<=3;n++)app.progress.record(n,3);p.skins();expect(p.panel.actions.some(a=>a.label.startsWith('流星拖尾'))).toBe(true);
 }finally{app.dispose();}
});
