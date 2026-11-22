import {CloudSync} from './social/CloudSync';
import {FriendBoard} from './social/FriendBoard';
import {Profile} from './social/Profile';
import {scoreShare,shareTitle} from './social/Share';
import {ball as defaultAvatar} from '../../src/online/ranking/Artwork';
import {touchPoint} from './TouchPoint';
import {drawHud} from './GameChrome';
import {HapticTracker} from '../../src/Haptics';
import {VIEW,viewX,viewFraction} from '../../src/Viewport';
const MODE_KEY='qiulegeqiu:wechat-mode:v1';
const STARS_KEY='qiulegeqiu:wechat-stars:v1';
const SETTING={music:'qiulegeqiu:wechat-music:v1',sfx:'qiulegeqiu:wechat-sfx:v1',vibrate:'qiulegeqiu:wechat-vibrate:v1',trail:'qiulegeqiu:wechat-trail:v1',trails:'qiulegeqiu:wechat-trails:v1',paddle:'qiulegeqiu:wechat-paddle:v1',paddles:'qiulegeqiu:wechat-paddles:v1',runs:'qiulegeqiu:wechat-runs:v1',guide:'qiulegeqiu:wechat-mp-guide:v1'};
const REVIVE_TITLE='生命耗尽';
import {OCEAN,brickColor} from '../../shared/VisualTheme';
import {drawIcon,type IconName} from '../../shared/Icons';
import {canvasText,neonButton,candyButton,NEON,type NeonAccent} from '../../shared/CanvasUI';
import {scoreHistoryLines} from '../../shared/ScoreHistory';
import {nicknameQuotaText} from '../../shared/NicknamePolicy';
import {assertGlobalBoard,assertEndlessBoard,type LeaderboardMetadata} from '../../shared/Challenge';
import type {GameMode} from '../../src/Game';
import {GAME_NAME} from '../../shared/Brand';
import {Game} from '../../src/Game';
import {startFromPlayfield} from '../../src/PlayfieldStart';
import {C} from '../../src/GameConfig';
import {Renderer} from '../../src/Renderer';
import {WechatPlatform} from './WechatPlatform';
import {centralActionFor,activateCentralAction} from '../../src/CentralAction';
import {ChallengeSync} from '../../src/online/ChallengeSync';
import type {Me,BestScore} from '../../src/online/ApiClient';
import {WechatApi} from './Api';
import {layout,inside,type Rect} from './Layout';
import {context} from './CanvasAdapter';
import {rankingCard,type RankingScore} from '../../src/online/ranking/Presentation';
import {Panel,type Action} from './Panel';
import {WechatAds} from './Ads';
import {AD_UNITS} from './AdConfig';
import {MAX_REVIVES,MAX_SKIPS} from '../../shared/Challenge';
import {TRAIL_SKINS,PADDLE_SKINS,isTrailSkin,isPaddleSkin,migratePaddle} from '../../shared/Skins';
import type {TrailSkin,PaddleSkin} from '../../src/Renderer';
import {privacy,agreement} from './Policies';
import {CampaignProgress,MAX_STARS,STAR_SKIN_UNLOCKS} from '../../src/campaign/Progress';
import {LEVELS} from '../../src/Levels';
import type {Wx,Canvas,Config,TouchEvent} from './Platform';
interface Region {code:string;prefix:string;name:string;hasChildren:boolean;path:string}
// This ID is only an idempotency key, never an authentication credential.
function clientId(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const n=Math.floor(Math.random()*16);return (c==='x'?n:(n&3)|8).toString(16);});}
/** Candy key in custom colours (top, bottom, drop edge): the dark gear key and the pink skins key. */
function flatCandy(c:CanvasRenderingContext2D,r:Rect,[top,bottom,edge]:[string,string,string]){c.fillStyle=edge;c.beginPath();c.roundRect(r.x,r.y+3,r.width,r.height,12);c.fill();const g=c.createLinearGradient(0,r.y,0,r.y+r.height);g?.addColorStop(0,top);g?.addColorStop(1,bottom);c.fillStyle=g||bottom;c.beginPath();c.roundRect(r.x,r.y,r.width,r.height,12);c.fill();c.strokeStyle='rgba(255,255,255,.22)';c.lineWidth=1;c.stroke();}
export class MiniGameApp {
 readonly game:Game;readonly progress:CampaignProgress;readonly api:WechatApi;readonly panel=new Panel();readonly canvas:Canvas;
 readonly platform:WechatPlatform;readonly profile:Profile;private cloud:CloudSync;private scoreShareImage?:string;private sharing=false;
 private rankingArt?:CanvasImageSource;
 private backgroundFill?:CanvasGradient|string;
 private arena:Canvas;private renderer:Renderer;private ctx:CanvasRenderingContext2D;private sync:ChallengeSync;
 private view=layout(375,667);private dpr=1;private previous=0;private active=true;private online=false;private offlinePreference=false;private busy=false;private lastEnd=-1;
 private touch?:{id:number;x:number;y:number;moved:boolean;drag:boolean;lastY:number;mode?:GameMode};private actions:{rect:Rect;run:()=>void}[]=[];
 private lowDevice=false;private boardLoading=false;private boardRevision=0;private me?:Me;private nicknameDraft='';private region:Region={code:'ISO:CN',prefix:'中国',name:'中国',hasChildren:true,path:''};private shareImage?:string;
 constructor(private wx:Wx,config:Config){
  try{this.lowDevice=(wx.getDeviceInfo?.().benchmarkLevel??30)<20;}catch{/* Old runtimes use viewport/frame-time fallback. */}
  this.platform=new WechatPlatform(wx);this.canvas=this.platform.createCanvas();this.arena=this.platform.createCanvas();const cache=this.platform.createCanvas();
  this.panel.configureRankingCache(()=>this.platform.createCanvas());

  const rankingImage=wx.createImage?.();if(rankingImage){rankingImage.onload=()=>{this.rankingArt=rankingImage as unknown as CanvasImageSource;};rankingImage.src="assets/ranking-scene.png";}
  this.ctx=context(this.canvas);context(this.arena);context(cache);
  this.api=new WechatApi(wx,config);this.profile=new Profile(wx);this.cloud=new CloudSync(wx,this.api);
  this.game=new Game(undefined,()=>{},undefined,this.platform.createAudio());
  // Level map stars (this phone only; never part of scoring).
  this.progress=new CampaignProgress({read:()=>{const v=this.platform.read(STARS_KEY);return typeof v==='string'?v:null;},write:v=>this.platform.write(STARS_KEY,v)});
  this.game.onLevelCleared=(level,stars)=>{this.progress.record(level,stars);this.panel.mapStars=`${this.progress.total}/${MAX_STARS}`;};this.panel.mapStars=`${this.progress.total}/${MAX_STARS}`;
  // 2.9: the top-bar speaker is gone; an old master mute becomes "effects off + music off" in the menu switches.
  if(this.platform.read('qiulegeqiu:wechat-muted:v1')===true){this.platform.write(SETTING.sfx,false);this.platform.write(SETTING.music,false);this.platform.write('qiulegeqiu:wechat-muted:v1',false);}
  // Settings (each remembered): background music, sound effects, vibration, and the comet-tail skin.
  this.game.audio.setMusic(this.platform.read(SETTING.music)!==false);this.game.audio.setSfx(this.platform.read(SETTING.sfx)!==false);
  this.vibrationOn=this.platform.read(SETTING.vibrate)!==false;
  this.ads=new WechatAds(wx,config.ads??AD_UNITS);
  // A revive is only offered when a rewarded video can play and (online) the server verifies revives for ranking.
  this.game.canOfferRevive=()=>this.ads.rewardedAvailable&&(!this.online||this.sync.rewardsSupported);
  // A shared score card opens straight into the same mode.
  try{const mode=wx.getLaunchOptionsSync?.().query?.mode;if(mode==='endless'||mode==='campaign'){this.game.setMode(mode);this.platform.write(MODE_KEY,mode);}}catch{/* Optional API. */}
  if(this.platform.read(MODE_KEY)==='endless'){this.game.setMode('endless');this.rankingBoard='endless';}
  const renderHost=this.platform.rendererHost(cache,()=>({width:this.view.arena.width,height:this.view.arena.height}),()=>this.dpr);renderHost.lowPerformance=()=>this.lowDevice||this.view.width<360;this.renderer=new Renderer(this.arena,renderHost);this.renderer.trail=this.selectedTrail();this.renderer.paddleSkin=this.selectedPaddle();
  this.sync=new ChallengeSync(this.api,this.game,()=>Date.now(),clientId);this.resize();
  wx.onTouchStart(e=>this.down(e));wx.onTouchMove(e=>this.move(e));wx.onTouchEnd(e=>this.up(e));wx.onTouchCancel(()=>{this.touch=undefined;});
  wx.onHide(()=>this.hide());wx.onShow(()=>{this.active=true;this.previous=0;this.resize();this.platform.resume();this.panel.friend?.resume();this.cloud.resume();});wx.onWindowResize?.(()=>this.resize());
  wx.showShareMenu({menus:['shareAppMessage']});wx.onShareAppMessage(()=>this.shareData());this.makeShareImage();
 }
 resize(){this.profile?.clearButton();const w=this.wx.getWindowInfo();const menu=this.wx.getMenuButtonBoundingClientRect?.();this.view=layout(w.windowWidth,w.windowHeight,w.safeArea?.top,w.safeArea?.bottom,menu?.bottom,menu?.top,menu?.left);this.dpr=Math.min(w.pixelRatio||1,2);
  this.canvas.width=Math.round(w.windowWidth*this.dpr);this.canvas.height=Math.round(w.windowHeight*this.dpr);this.backgroundFill=undefined;this.renderer.resize();}
 run(){this.platform.start(now=>this.frame(now));}
 dispose(){this.profile.clearButton();this.panel.close();this.platform.dispose();this.renderer.dispose();this.game.dispose();}
 hide(){this.profile.clearButton();this.panel.friend?.hide();this.platform.suspend();this.game.audio.suspend();this.active=false;this.previous=0;this.touch=undefined;this.game.pause();if(this.online)void this.sync.flush().catch(()=>{});}
 frame(now:number){if(!this.active)return;if(this.panel.title!=='我的资料')this.profile.clearButton();const dt=this.previous?Math.min(.1,Math.max(0,(now-this.previous)/1000)):0;this.previous=now;
  // Before the first choice the picker stays up; if another panel closes over it, show it again.
  if(this.picking&&!this.panel.open)this.modePicker();
  else if(this.game.awaitingRevive&&this.panel.title!==REVIVE_TITLE&&!this.busy)this.revivePanel();
  else if(this.game.practice&&!this.panel.open&&!this.busy&&(this.game.state==='levelComplete'||this.game.state==='gameOver'))this.practicePanel();
  else if(!this.game.practice&&!this.panel.open&&!this.busy&&(this.game.state==='gameOver'||this.game.state==='victory')&&this.lastEnd===this.game.journal.generation)this.resultPage();
  this.game.update(dt);this.haptics();if(this.online)this.sync.observe();if(!this.panel.ranking&&!this.panel.friend&&!this.titleOpen)this.renderer.draw(this.game.physics,this.game.state==='ready',now);this.draw(now);
  if(!this.game.practice&&(this.game.state==='gameOver'||this.game.state==='victory')&&!this.game.awaitingRevive&&this.lastEnd!==this.game.journal.generation){this.lastEnd=this.game.journal.generation;this.result();}
  // The banner lives only at the bottom of the result page, never during play.
  if(this.panel.resultView&&!this.guide)this.ads.showBanner(this.view.width,this.view.height,this.view.bottom);else this.ads.hideBanner();
 }
 private draw(now:number){const c=this.ctx,v=this.view;c.setTransform(this.dpr,0,0,this.dpr,0,0);
  // The mode picker is a page of its own: it covers the whole screen (game, HUD and top bar).
  if(this.titleOpen){this.actions=[];this.panel.screen={height:v.height,top:v.titleY,resultTop:v.top+8,muted:this.game.audio.muted};this.panel.draw(c,v.width,v.titleY,v.bottom-(this.panel.resultView?this.ads.bannerHeight:0),now);if(this.guide)this.drawGuide(c,now);return;}
  // Candy-night sky with two soft glows, like the web version.
  // Deep-space backdrop: one cached linear gradient (cheap). Radial glows or a full-screen image blit every frame
  // cost up to half the frame rate on tablets, so the WeChat build keeps the plain gradient.
  if(!this.backgroundFill){const gradient=c.createLinearGradient(0,0,0,v.height);gradient?.addColorStop(0,'#081028');gradient?.addColorStop(.45,'#050816');gradient?.addColorStop(1,'#03050C');this.backgroundFill=gradient||OCEAN.colors.background;
}
  c.fillStyle=this.backgroundFill;c.fillRect(0,0,v.width,v.height);
  const g=this.game;drawHud(c,g,{x:6,y:v.hudY,width:v.width-12,height:v.hudHeight});
  if(!this.panel.ranking&&!this.panel.friend)c.drawImage(this.arena as CanvasImageSource,v.arena.x,v.arena.y,v.arena.width,v.arena.height);this.actions=[];
  const button=(rect:Rect,label:string,run:()=>void)=>{neonButton(c,rect,'cyan',rect.height/2);c.font='700 15px '+OCEAN.fonts.body;c.textAlign='center';c.textBaseline='middle';c.fillStyle=NEON.cyan;c.fillText(label,rect.x+rect.width/2,rect.y+rect.height/2,rect.width-16);this.actions.push({rect,run});};
  const iconButton=(rect:Rect,icon:IconName,run:()=>void,accent:NeonAccent|'gear'|'pink'='dim')=>{if(accent==='gear'||accent==='pink')flatCandy(c,rect,accent==='gear'?['#3A3F7A','#262A5C','#171A40']:['#FF8CC6','#E0458F','#A82A66']);else candyButton(c,rect,accent==='gold'?'gold':'violet',12);drawIcon(c,icon,rect.x+rect.width/2,rect.y+rect.height/2,accent==='gear'?20:16,accent==='gold'?'#6A3A00':accent==='gear'?'#FFD24D':'#FFFFFF');this.actions.push({rect:{x:rect.x-2,y:rect.y-4,width:44,height:44},run});};
  if(g.physics.wideRemaining>0||g.score.multiplier>1)canvasText(c,`${g.physics.wideRemaining>0?'加宽 '+g.physics.wideRemaining.toFixed(1)+' 秒 ':''}${g.score.multiplier>1?'连击 ×'+g.score.multiplier:''}`,v.width/2,v.buttonsY-6,v.width-16,10,OCEAN.colors.positive,'center');
  // Long endless runs: warn before the record limit makes the run impossible to submit.
  if(g.journal.truncated||g.journal.nearLimit)canvasText(c,g.journal.truncated?'记录已满，本局无法上榜':'记录即将满额，请尽快结束本局',v.width/2,v.buttonsY-22,v.width-16,11,OCEAN.colors.warning,'center');
  const action=centralActionFor(g);
  if(g.state==='levelComplete'&&g.result){c.fillStyle=OCEAN.colors.text;c.font='14px sans-serif';c.fillText(`第${g.levels.current.number}关突破！本关 ${g.result.levelTotal} 分${g.lastStars?'  '+'★'.repeat(g.lastStars)+` ${g.lastStars}星`:''}`,v.width/2,v.arena.y+(C.arena.y-VIEW.y)*v.scale-38);}
  if(g.state==='paused'){c.fillStyle=OCEAN.alpha.veil;c.fillRect(v.arena.x,v.arena.y,v.arena.width,v.arena.height);}
  // After a finished run the central button reopens the mode picker instead of retrying the same mode.
  const ended=(g.state==='gameOver'||g.state==='victory')&&!g.practice;
  if(ended&&!this.busy&&!this.panel.open){const centerY=v.arena.y+(C.arena.y-VIEW.y)*v.scale;button({x:v.width/2-70,y:centerY-22,width:140,height:44},'选择模式',()=>this.modePicker());}
  else if(action&&g.state!=='ready'&&!this.busy){const centerY=v.arena.y+(C.arena.y-VIEW.y)*v.scale;button({x:v.width/2-70,y:centerY-22,width:140,height:44},action.label.replace('▶ ',''),()=>void this.activate());}
  // After a lost life (never at a level start): an optional rewarded video for +3 balls on the next launch.
  if(!this.panel.open&&!this.busy&&g.state==='ready'){const r={x:v.width/2-96,y:v.arena.y+v.arena.height-60,width:192,height:38};
   if(g.boostArmed)canvasText(c,'下一球 +3 已就绪，点击球场发射',v.width/2,r.y+r.height/2,v.width-24,12,NEON.gold,'center');
   else if(g.canBoost&&this.ads.rewardedAvailable&&(!this.online||this.sync.rewardsSupported)){candyButton(c,r,'gold',19);drawIcon(c,'film',r.x+26,r.y+r.height/2,18,'#6A3A00');c.font=`800 14px ${OCEAN.fonts.body}`;c.textAlign='center';c.textBaseline='middle';c.fillStyle='#5A2C00';c.fillText('看视频：下一球 +3',r.x+r.width/2+12,r.y+r.height/2,r.width-56);this.actions.push({rect:r,run:()=>void this.watchReward('boost')});}}
  // Touch strip under the arena: a quiet hint; dragging here steers the paddle (see down/move).
  // Joined to the arena's bottom edge: same width, rounded bottom corners, and a swipe hint (the real paddle is the only paddle).
  if((!this.panel.open||this.picking)&&v.pad.height>=30){const p={x:v.arena.x,y:v.pad.y,width:v.arena.width,height:v.pad.height};// Fills to the screen bottom: the whole strip steers.
   // Borderless: no frame around the arena; the strip is a plain dark band from the arena's bottom edge to the screen bottom.
   c.save();c.fillStyle='rgba(6,10,24,.95)';c.fillRect(p.x,p.y,p.width,p.height);
   // A quiet swipe hint (no duplicate paddle): ‹‹‹ 左右滑动控制挡板 ››› with arrows drifting outward.
   const cy=p.y+Math.min(p.height/2,p.height*.45);
   c.restore();
   c.font=`500 12px ${OCEAN.fonts.body}`;const label='左右滑动控制挡板',half=Math.min(c.measureText(label).width,v.width-120)/2+16;
   canvasText(c,label,v.width/2,cy,v.width-120,12,'#8FA6C8','center');
   const pressed=this.touch?.drag&&inside(v.pad,this.touch.x,this.touch.y);
   c.save();c.lineWidth=2;c.lineCap='round';c.lineJoin='round';
   for(const side of [-1,1])for(let i=0;i<3;i++){
    // Outermost arrow lights last, so the wave reads as "slide outward".
    const phase=((now/1600-i*.125)%1+1)%1,alpha=.2+.75*Math.max(0,Math.sin(Math.min(1,phase/.8)*Math.PI));
    const x=v.width/2+side*(half+i*11);c.strokeStyle=pressed?`rgba(255,226,122,${alpha})`:`rgba(79,227,255,${alpha})`;
    c.beginPath();c.moveTo(x-side*3.5,cy-5);c.lineTo(x+side*1.5,cy);c.lineTo(x-side*3.5,cy+5);c.stroke();}
   c.restore();}
  // Top bar like the web: ⚙ settings at the top-left (capsule row, beside the title); mode switch, then pause · skins · trophy.
  iconButton({x:6,y:v.top-2,width:40,height:36},'gear',()=>this.settings(),'gear');
  iconButton({x:v.width-50,y:v.titleY,width:40,height:36},'trophy',()=>void this.board(),'gold');
  iconButton({x:v.width-98,y:v.titleY,width:40,height:36},'spark',()=>this.skins(),'pink');
  c.font=`900 23px ${OCEAN.fonts.body}`;c.textAlign='left';c.textBaseline='middle';const titleGold=c.createLinearGradient(0,v.top,0,v.top+32);titleGold?.addColorStop(0,'#FFFFFF');titleGold?.addColorStop(.6,'#FFE27A');titleGold?.addColorStop(1,'#FFB31F');c.fillStyle=titleGold||'#FFE27A';c.fillText(GAME_NAME,54,v.top+v.barHeight/2,Math.max(60,v.barRight-62));
  neonButton(c,{x:4,y:v.titleY+4,width:118,height:40},'dim',20);
  for(const tab of v.modeTabs){const selected=tab.mode===g.mode,visual={x:tab.x,y:v.titleY+6,width:tab.width,height:36};if(selected)candyButton(c,visual,'gold',18);c.font=`800 14px ${OCEAN.fonts.body}`;c.textAlign='center';c.textBaseline='middle';c.fillStyle=selected?'#5A2C00':OCEAN.colors.secondary;c.fillText(tab.mode==='campaign'?'闯关':'无尽',tab.x+tab.width/2,v.titleY+24,tab.width-8);this.actions.push({rect:tab,run:()=>void this.requestMode(tab.mode)});}
  // Pause opens the menu; like the web key it shows ▶ while the game is paused, and tapping it again resumes.
  iconButton(this.pauseKey,g.state==='paused'||this.menuOpen?'play':'pause',()=>this.menu());
  this.panel.screen={height:v.height,top:v.titleY,resultTop:v.top+8,muted:this.game.audio.muted};
  this.panel.draw(c,v.width,(this.panel.ranking||this.panel.friend)?v.top:v.hudY,v.bottom,now,g.state!=='paused',this.lowDevice||v.width<360,this.rankingArt,this.dpr);
  if(this.panel.title==='我的资料'){if(this.profile.image){try{c.drawImage(this.profile.image,v.width-56,v.hudY+8,32,32);}catch{defaultAvatar(c,v.width-40,v.hudY+24,16);}}else defaultAvatar(c,v.width-40,v.hudY+24,16);}
 }
 private down(e:TouchEvent){
  if(this.touch)return;const t=e.changedTouches[0],point=t&&touchPoint(t);if(!point)return;this.game.audio.unlock();const {x,y}=point;
  this.touch={id:t.identifier,x,y,mode:!this.panel.ranking&&!this.panel.friend&&!this.titleOpen?this.view.modeTabs.find(tab=>inside(tab,x,y))?.mode:undefined,moved:false,lastY:y,drag:!this.panel.open&&(inside(this.view.arena,x,y)||inside(this.view.pad,x,y))&&!this.actions.some(a=>inside(a.rect,x,y))};
  if(this.touch.drag){this.target(x);if(!this.busy&&!this.boardLoading)startFromPlayfield(this.game,()=>void this.activate());}
 }
 private move(e:TouchEvent){
  const active=this.touch;if(!active)return;const t=e.touches.find(t=>t.identifier===active.id),point=t&&touchPoint(t);if(!point)return;
  if(Math.hypot(point.x-active.x,point.y-active.y)>(this.panel.title==='选择游戏模式'?18:8))active.moved=true;
  if(this.panel.open)this.panel.scroll(point.y-active.lastY,active.x,active.y);else if(active.drag)this.target(point.x);active.lastY=point.y;
 }
 private up(e:TouchEvent){
  const active=this.touch;if(!active)return;const t=e.changedTouches.find(t=>t.identifier===active.id);if(!t)return;this.touch=undefined;
  const point=touchPoint(t);if(!point||active.moved||active.drag)return;
  if(this.guide){this.guide=false;return;}
  if(active.mode){const tab=this.view.modeTabs.find(tab=>tab.mode===active.mode);if(tab&&inside(tab,point.x,point.y))void this.requestMode(active.mode);return;}
  // The pause key stays live over the menu: tapping it again closes the menu and resumes, like the web key.
  if(this.menuOpen&&inside(this.pauseKey,active.x,active.y)&&inside(this.pauseKey,point.x,point.y)){this.panel.close();if(this.game.state==='paused')this.game.start();this.previous=0;return;}
  if(this.panel.open){this.panel.tap(active.x,active.y,point.x,point.y);return;}
  this.actions.find(a=>inside(a.rect,active.x,active.y)&&inside(a.rect,point.x,point.y))?.run();
 }
 /**
  * Restart and home confirm inside the candy panel, not with wx.showModal: the native dialog refuses button texts
  * over 4 characters (so "回到主界面" silently failed) and can be dismissed by the host. 继续本局 returns to the menu.
  */
 private confirmSheet(title:string,line:string,confirm:string,icon:IconName,run:()=>void){
  this.panel.show(title,[line],[{label:confirm,icon,primary:true,run},{label:'继续本局',icon:'play',run:()=>this.menu(false)}]);
 }
 private get pauseKey():Rect{const v=this.view;return {x:v.width-146,y:v.titleY,width:40,height:36};}
 private get menuOpen(){return this.panel.open&&(this.panel.title==='游戏暂停'||this.panel.title==='菜单');}
 private inRun(){const g=this.game;return g.journal.events.length>0&&g.state!=='gameOver'&&g.state!=='victory';}
 private confirmRestart(){const g=this.game;if(this.busy)return;
  const restart=()=>{this.panel.close();g.reset();this.previous=0;};
  if(!this.inRun()){restart();return;}
  g.pause();const generation=g.journal.generation;
  this.confirmSheet('重新开始','确定放弃本局，重新开始吗？当前分数不会保留。','重新开始','restart',()=>{if(g.journal.generation===generation)restart();else this.panel.close();});
 }
 readonly ads:WechatAds;private vibrationOn=true;private guide=false;private lastInterstitial=0;
 /** Lives ran out and a rewarded video can bring the run back (up to MAX_REVIVES per run, still ranked). */
 private revivePanel(){const g=this.game,endless=g.mode==='endless';
  this.panel.showRevive(REVIVE_TITLE,[`本局得分 ${g.score.total}`,`看完一段视频即可复活：+1 条命继续本局${endless?'，并一次清掉最底部 20 行砖':'，下一球随机送一种特效（×3球 / 闪电 / 火球 / 穿透）'}`,`本局还可复活 ${g.revivesLeft} 次（共 ${MAX_REVIVES} 次）· 复活后成绩照常上榜`],[
   {label:'▶ 看视频复活',run:()=>void this.watchReward('revive')},
   {label:'放弃，查看结算',run:()=>{this.panel.close();g.endRun();}},
  ],{score:g.score.total,left:g.revivesLeft,max:MAX_REVIVES,endless});}
 /** Every rewarded video goes through here: the reward is only granted when the video was watched to the end. */
 private async watchReward(kind:'revive'|'boost'|'skip'|`trail:${Exclude<TrailSkin,'none'>}`|`paddle:${Exclude<PaddleSkin,'default'>}`){
  if(this.busy)return;this.busy=true;const g=this.game,generation=g.journal.generation;
  try{const result=await this.ads.showRewarded();this.previous=0;
   if(result!=='rewarded'){this.toast(result==='closed'?'完整看完视频才能领取奖励':'暂时没有可播放的视频，请稍后再试');return;}
   if(kind.startsWith('trail:')){const id=kind.slice(6) as Exclude<TrailSkin,'none'>;this.platform.write(SETTING.trails,[...new Set([...this.unlockedTrails(),id])]);this.useTrail(id);this.toast(`${TRAIL_SKINS.find(t=>t.id===id)!.name}拖尾已永久解锁`);this.skins();return;}
   if(kind.startsWith('paddle:')){const id=kind.slice(7) as Exclude<PaddleSkin,'default'>;this.platform.write(SETTING.paddles,[...new Set([...this.unlockedPaddles(),id])]);this.usePaddle(id);this.toast(`${PADDLE_SKINS.find(t=>t.id===id)!.name}挡板已永久解锁`);this.skins();return;}
   if(g.journal.generation!==generation)return;
   if(kind==='revive'){if(g.revive()){this.panel.close();this.toast('复活成功，继续加油！');}}
   else if(kind==='skip'){if(g.skipLevel()){this.panel.close();this.toast(`已跳过，进入第${g.levels.current.number}关`);}}
   else if(g.armBoost())this.toast('下一球出发时多 3 个分身');
  }finally{this.busy=false;}
 }
 /** Music, effects, vibration and the comet tail; each switch is remembered. */
 /**
  * Settings (⚙, top-left): music / effects / vibration switches, then account and policy items. Nothing here repeats
  * the pause menu. Opening it pauses a running game; 完成 resumes it.
  */
 private overlayResume=false;
 private settings(){const a=this.game.audio,g=this.game;
  if(g.state==='running'){g.pause();this.overlayResume=true;}
  const flip=(key:string,on:boolean,apply:(on:boolean)=>void)=>()=>{apply(on);this.platform.write(key,on);this.settings();};
  const done=()=>{this.panel.close();if(this.overlayResume&&g.state==='paused')g.start();this.overlayResume=false;this.previous=0;};
  const inRun=this.inRun();
  const actions:Action[]=[
   {label:'音乐',icon:'music',toggle:a.musicOn,run:flip(SETTING.music,!a.musicOn,on=>{a.unlock();a.setMusic(on);})},
   {label:'音效',icon:a.sfxOn?'soundOn':'soundOff',toggle:a.sfxOn,run:flip(SETTING.sfx,!a.sfxOn,on=>a.setSfx(on))},
   {label:'震动',icon:'vibrate',toggle:this.vibrationOn,run:flip(SETTING.vibrate,!this.vibrationOn,on=>{this.vibrationOn=on;})},
   {label:'分享小游戏',run:()=>this.wx.shareAppMessage(this.shareData()),half:true},{label:'个人历史记录',run:()=>void this.history(),half:true},
   {label:'绑定网页账号',run:()=>void this.bind(),half:true},{label:'隐私与账号',run:()=>this.privacyPage(),half:true},
  ];
  if(!inRun)actions.push({label:'单机挑战',run:()=>{this.offlinePreference=true;this.online=false;this.overlayResume=false;this.panel.close();g.reset();},half:true},{label:'联网挑战',run:()=>{this.offlinePreference=false;this.overlayResume=false;this.panel.close();g.reset();},half:true});
  actions.push({label:'完成',primary:true,run:done});
  this.panel.show('设置',[this.me?.best?`我的历史最高：${this.me.best.score}，排名 ${this.me.best.rank}`:'只改设置，不影响本局'],actions);
 }
 /** One level down from settings: policies and the account appeal, so the settings card fits small phones. */
 private privacyPage(){this.panel.show('隐私与账号',['成绩与昵称仅用于排行榜；可随时申请更正、注销或删除。'],[
  {label:'隐私保护说明',run:()=>this.wx.showModal({title:'隐私保护说明',content:privacy,showCancel:false}),half:true},{label:'用户协议',run:()=>this.wx.showModal({title:'用户协议',content:agreement,showCancel:false}),half:true},
  {label:'账号及隐私申诉',run:()=>void this.appeal()},{label:'返回设置',run:()=>this.settings()}]);}
 /** Skins page: ball trails and paddle skins. Each unlocked once by a rewarded video, then freely switched. */
 private skins(){const actions:Action[]=[];if(this.game.state==='running'){this.game.pause();this.overlayResume=true;}
  // Trail skins: each one unlocked once by a rewarded video, then freely switched (only the look changes).
  const unlocked=this.unlockedTrails(),current=this.selectedTrail();
  for(const skin of TRAIL_SKINS){if(unlocked.includes(skin.id))actions.push({label:`${skin.name}拖尾：${current===skin.id?'使用中':'使用'}`,half:true,run:()=>{this.useTrail(skin.id);this.skins();}});
   else{if(this.ads.rewardedAvailable)actions.push({label:`▶ 看视频解锁${skin.name}拖尾`,half:true,tone:'outline',run:()=>void this.watchReward(`trail:${skin.id}`)});actions.push(this.starLock(`trail:${skin.id}`,`${skin.name}拖尾`));}}
  if(unlocked.length&&current!=='none')actions.push({label:'不使用拖尾',half:true,run:()=>{this.useTrail('none');this.skins();}});
  const paddles=this.unlockedPaddles(),paddle=this.selectedPaddle();
  for(const skin of PADDLE_SKINS){if(paddles.includes(skin.id))actions.push({label:`${skin.name}：${paddle===skin.id?'使用中':'使用'}`,half:true,run:()=>{this.usePaddle(skin.id);this.skins();}});
   else{if(this.ads.rewardedAvailable)actions.push({label:`▶ 看视频解锁${skin.name}`,half:true,tone:'outline',run:()=>void this.watchReward(`paddle:${skin.id}`)});actions.push(this.starLock(`paddle:${skin.id}`,skin.name));}}
  if(paddles.length&&paddle!=='default')actions.push({label:'默认挡板',half:true,run:()=>{this.usePaddle('default');this.skins();}});
  actions.push({label:'完成',primary:true,run:()=>{this.panel.close();if(this.overlayResume&&this.game.state==='paused')this.game.start();this.overlayResume=false;this.previous=0;}});
  this.panel.show('皮肤',[`关卡地图攒星解锁${this.ads.rewardedAvailable?'，或看一次视频解锁':''} · 当前 ★${this.progress.total}`,'只改外观，不影响成绩。'],actions);
 }
 private unlockedPaddles():Exclude<PaddleSkin,'default'>[]{const list=this.platform.read(SETTING.paddles);const own=Array.isArray(list)?[...new Set(list.map(migratePaddle))].filter((v):v is Exclude<PaddleSkin,'default'>=>isPaddleSkin(v)&&v!=='default'):[];return [...new Set([...own,...PADDLE_SKINS.map(s=>s.id).filter(id=>this.starUnlocked('paddle:'+id))])];}
 /** A locked skin: shows how many stars it needs; tapping says how many are still missing. */
 private starLock(key:string,name:string):Action{const need=STAR_SKIN_UNLOCKS[key]??MAX_STARS;return {label:`★${need} 解锁${name}`,half:true,tone:'outline',run:()=>this.toast(`再拿 ${Math.max(0,need-this.progress.total)} 颗星解锁${name}`)};}
 /** Skins also unlock by collecting stars on the level map (no video needed). */
 private starUnlocked(key:string){const need=STAR_SKIN_UNLOCKS[key];return need!==undefined&&this.progress.total>=need;}
 private selectedPaddle():PaddleSkin{const v=migratePaddle(this.platform.read(SETTING.paddle));return isPaddleSkin(v)&&(v==='default'||this.unlockedPaddles().includes(v))?v:'default';}
 private usePaddle(id:PaddleSkin){this.platform.write(SETTING.paddle,id);this.renderer.paddleSkin=id;}
 /** Unlocked trail skins (the 2.7 comet setting counts as an unlocked comet). */
 private unlockedTrails():Exclude<TrailSkin,'none'>[]{const list=this.platform.read(SETTING.trails),legacy=this.platform.read(SETTING.trail);
  const ids=Array.isArray(list)?list.filter((v):v is Exclude<TrailSkin,'none'>=>isTrailSkin(v)&&v!=='none'):[];if((legacy==='on'||legacy==='off')&&!ids.includes('comet'))ids.push('comet');for(const t of TRAIL_SKINS)if(!ids.includes(t.id)&&this.starUnlocked('trail:'+t.id))ids.push(t.id);return ids;}
 private selectedTrail():TrailSkin{const v=this.platform.read(SETTING.trail);if(v==='on')return 'comet';return isTrailSkin(v)&&(v==='none'||this.unlockedTrails().includes(v))?v:'none';}
 private useTrail(id:TrailSkin){this.platform.write(SETTING.trail,id);this.renderer.trail=id;}
 /** Interstitials only at a natural pause (opening the menu), never in the first 3 runs and at most every 3 minutes. */
 private maybeInterstitial(){const runs=Number(this.platform.read(SETTING.runs))||0,now=Date.now();if(runs<3||now-this.lastInterstitial<180000)return;this.lastInterstitial=now;this.ads.showInterstitial();}
 /** One-time card after the second finished run: how to find the game again from 我的小程序. */
 private drawGuide(c:CanvasRenderingContext2D,now:number){
  const v=this.view,menu=this.wx.getMenuButtonBoundingClientRect?.(),tx=(menu?.left??v.width-95)+22,ty=(menu?.bottom??v.top+32)+6;
  c.save();c.fillStyle='rgba(3,5,12,.72)';c.fillRect(0,0,v.width,v.height);
  const w=Math.min(320,v.width-40),h=176,x=(v.width-w)/2,y=Math.max(ty+70,v.height*.32);
  c.fillStyle='#C9770A';c.beginPath();c.roundRect(x,y+5,w,h,22);c.fill();const bg=c.createLinearGradient(0,y,0,y+h);bg?.addColorStop(0,'#1B2052');bg?.addColorStop(1,'#10143A');c.fillStyle=bg||'#141A44';c.beginPath();c.roundRect(x,y,w,h,22);c.fill();c.strokeStyle='rgba(255,226,122,.55)';c.lineWidth=1.5;c.stroke();
  canvasText(c,'下次怎么找回来',v.width/2,y+26,w-32,12,'#A9C1DE','center');
  c.font=`900 22px ${OCEAN.fonts.body}`;c.textAlign='center';c.textBaseline='middle';c.fillStyle='#FFE27A';c.fillText('添加到我的小程序',v.width/2,y+58,w-32);
  canvasText(c,'点右上角的 ···，选「添加到我的小程序」',v.width/2,y+92,w-28,13,'#EAF6FF','center');
  canvasText(c,'下次在微信首页下拉，就能直接回来接着玩',v.width/2,y+114,w-28,12,'#A9C1DE','center');
  const bw=110,bx=v.width/2-bw/2,by=y+134;c.fillStyle='#C9770A';c.beginPath();c.roundRect(bx,by+3,bw,30,15);c.fill();c.fillStyle='#FFD24D';c.beginPath();c.roundRect(bx,by,bw,30,15);c.fill();canvasText(c,'知道了',v.width/2,by+15,bw-10,13,'#5A2C00','center');
  // Bouncing arrow up to the capsule's ··· button, with a ring around it.
  const bob=Math.sin(now/220)*5,ax=tx,ay=ty+18+bob;c.strokeStyle='#FFD24D';c.fillStyle='#FFD24D';c.lineWidth=4;c.lineCap='round';
  c.beginPath();c.moveTo(ax,y-8);c.lineTo(ax,ay+10);c.stroke();c.beginPath();c.moveTo(ax-10,ay+12);c.lineTo(ax,ay);c.lineTo(ax+10,ay+12);c.closePath();c.fill();
  c.lineWidth=2.5;c.beginPath();c.ellipse(tx,ty-16,26,15,0,0,Math.PI*2);c.stroke();c.restore();
 }
 private hapticTracker=new HapticTracker();
 /** Short vibration on decisive moments only (shared policy with Web); silent when muted. */
 private haptics(){const type=this.hapticTracker.next(this.game.physics.effects,this.game.state!=='running',Date.now());if(type&&this.vibrationOn&&!this.game.audio.muted){try{this.wx.vibrateShort?.({type,fail:()=>{}});}catch{/* Optional device capability. */}}}
 private target(x:number){this.game.physics.setTarget(viewX((x-this.view.arena.x)/this.view.arena.width));}
 private async activate(){if(this.busy)return;this.busy=true;const generation=this.game.journal.generation,state=this.game.state;
  try{if(this.game.state==='ready'&&this.game.readyReason==='initial'){
    this.online=false;
    if(this.offlinePreference){}else if(this.api.authenticated){this.me=await this.api.me();this.online=true;}
    else{const network=await this.modal('开始挑战','联网挑战需要微信登录，昵称与地区可在结束后自行登记。也可选择单机，不上传成绩。','联网挑战','单机游玩');
     if(network.confirm){const consent=await this.modal('隐私说明',privacy,'同意登录','单机游玩');if(consent.confirm){await this.loginWithPrivacy();this.me=await this.api.me();this.online=true;}}
    }
   }
  }catch(error){this.online=false;this.toast((error as Error).message);}finally{this.busy=false;if(this.game.journal.generation===generation&&this.game.state===state)activateCentralAction(this.game);if(!this.active)this.game.pause();this.previous=0;}
 }
 private async loginWithPrivacy(){if(this.wx.requirePrivacyAuthorize)await new Promise<void>((r,j)=>this.wx.requirePrivacyAuthorize!({success:r,fail:()=>j(Error('未获得隐私授权，可继续单机'))}));await this.api.login();this.cloud.resume();}
 private modal(title:string,content:string,confirmText='确定',cancelText='取消',editable=false,initialValue=''){// wx.showModal fails outright on button texts over 4 characters.
  const four=(s:string)=>[...s].slice(0,4).join('');return new Promise<{confirm:boolean;content?:string}>(resolve=>this.wx.showModal({title,content:editable?initialValue:content,placeholderText:editable?content:undefined,confirmText:four(confirmText),cancelText:four(cancelText),editable,success:resolve,fail:()=>resolve({confirm:false})}));}
 private toast(message:string){this.wx.showToast({title:message,icon:'none'});}
 private async task(work:()=>Promise<void>){if(this.busy)return;this.busy=true;try{await work();}catch(error){this.wx.showModal({title:'操作未完成',content:(error as Error).message,showCancel:false});}finally{this.busy=false;}}
 /** Pause menu: resume, restart, home and the rewarded skip. Settings, skins and the leaderboard have their own top-bar keys. */
 private menu(fromUser=true){const g=this.game;g.pause();if(fromUser)this.maybeInterstitial();
  const a=g.audio,inRun=g.journal.events.length>0&&g.state!=='gameOver'&&g.state!=='victory';
  const where=g.mode==='endless'?`无尽模式 · 第${g.reachedLevel}阶段`:`闯关模式 · 第${g.levels.current.number}关`;
  const actions:Action[]=[{label:inRun?'继续游戏':'返回游戏',icon:'play',primary:true,run:()=>{this.panel.close();if(g.state==='paused')g.start();this.previous=0;}},
   {label:'重新开始',icon:'restart',half:true,run:()=>void this.confirmRestart()},{label:'回到主界面',icon:'menu',half:true,run:()=>void this.confirmHome()}];
  if(g.canSkip&&this.ads.rewardedAvailable&&(!this.online||this.sync.skipSupported))actions.push({label:`▶ 看视频跳过本关（还可 ${MAX_SKIPS-g.skipsUsed} 次）`,run:()=>void this.watchReward('skip')});
  this.panel.show(inRun?'游戏暂停':'菜单',[`${where} · 得分 ${g.score.total}`],actions);
 }
 /** Back to the mode picker; asks first if a run is in progress (the run is not submitted). */
 private confirmHome(){const g=this.game;if(this.busy)return;
  const home=()=>{this.panel.close();g.reset();this.previous=0;this.modePicker();};
  if(!this.inRun()){home();return;}
  g.pause();this.confirmSheet('回到主界面','确定放弃本局并回到主界面吗？当前分数不会保留。','回到主界面','menu',home);
 }
 /** Mode switch always starts a fresh run, so confirm if one is in progress; the choice is remembered. */
 /** True until the player picks a mode: on launch, and again after every finished run. */
 picking=true;
 /** Start a fresh run in the chosen mode (the only way to change modes). */
 chooseMode(mode:GameMode,confirmed=false){
  const g=this.game;if(this.busy||this.boardLoading)return;
  if(!confirmed&&g.journal.events.length>0&&g.state!=='gameOver'&&g.state!=='victory'){this.toast('本局结束后可切换模式');return;}
  this.online=false;this.lastEnd=-1;this.picking=false;if(mode===g.mode)g.reset();else g.setMode(mode);
  // Switching fields can reuse generation/revision numbers: invalidate the visual brick cache.
  this.renderer.resize();
  this.rankingBoard=mode==='endless'?'endless':'global';this.platform.write(MODE_KEY,mode);this.panel.close();
  this.toast(mode==='endless'?'无尽模式：砖墙会不断下沉，3条命':'闯关模式：12关挑战');
 }
 /** The permanent tabs share the existing chooseMode reset path. No score submission is triggered. */
 private async requestMode(mode:GameMode){
  if(this.busy||this.boardLoading)return;const g=this.game;
  if(mode===g.mode){if(g.state==='gameOver'||g.state==='victory'){this.chooseMode(mode);return;}if(this.picking&&g.state==='ready'&&!g.journal.events.length){this.picking=false;this.panel.close();}return;}
  const generation=g.journal.generation,inProgress=g.journal.events.length>0&&g.state!=='gameOver'&&g.state!=='victory';
  if(!inProgress){this.chooseMode(mode);return;}
  const running=g.state==='running';if(running)g.pause();this.busy=true;let switched=false;
  try{const answer=await this.modal('切换游戏模式','切换将结束当前对局，未提交的本局成绩不会自动上传。是否切换？','确认切换','继续本局');
   if(answer.confirm&&g.journal.generation===generation){this.busy=false;this.chooseMode(mode,true);switched=true;}
  }catch(error){this.toast((error as Error).message);}
  finally{this.busy=false;if(!switched&&running&&this.active&&g.journal.generation===generation&&g.state==='paused')g.start();this.previous=0;}
 }
 /** The mode picker panel; it has no close button, so a mode must be chosen to play. */
 /** Full-screen pages (mode picker and result page) cover the game, HUD and top bar. */
 private get titleOpen(){return this.panel.title==='选择游戏模式'||!!this.panel.resultView||!!this.panel.mapView;}
 private modePicker(){this.picking=true;const last=this.game.mode;this.panel.show('选择游戏模式',['闯关模式：12 关逐关突破 · 3 条命 · 闯关榜','无尽模式：砖墙不断下沉 · 3 条命 · 无尽榜','每局结束后可重新选择模式'],[
  {label:(last==='campaign'?'▶ ':'')+'闯关模式',run:()=>this.chooseMode('campaign')},{label:(last==='endless'?'▶ ':'')+'无尽模式',run:()=>this.chooseMode('endless')},
  {label:'关卡地图',run:()=>this.levelMap()},{label:'设置',run:()=>this.settings()},{label:'皮肤',run:()=>this.skins()},{label:'排行榜',run:()=>void this.board()}]);}
 /** Level map: open levels start a single-level practice run (unranked, never uploaded). */
 private levelMap(){const p=this.progress;this.panel.mapStars=`${p.total}/${MAX_STARS}`;
  this.panel.showMap([{label:'关闭',run:()=>this.modePicker()},...LEVELS.map(l=>({label:`第${l.number}关`,run:()=>{if(!p.unlocked(l.number))return;this.picking=false;this.online=false;this.lastEnd=-1;this.panel.close();this.game.startPractice(l.number);this.renderer.resize();}}))],
   {names:LEVELS.map(l=>l.name),stars:p.stars,open:LEVELS.map(l=>p.unlocked(l.number)),boss:LEVELS.map(l=>!!l.pattern?.boss),total:p.total,max:MAX_STARS});}
 /** End of a practice level: stars, then next level / retry / back to the map. */
 private practicePanel(){const g=this.game,n=g.levels.current.number,cleared=g.state==='levelComplete',actions:Action[]=[];
  if(cleared&&!g.levels.isFinal)actions.push({label:'下一关',icon:'play',primary:true,run:()=>{this.panel.close();g.nextLevel();this.renderer.resize();}});
  actions.push({label:'再来一次',icon:'restart',primary:!cleared||g.levels.isFinal,run:()=>{this.panel.close();g.startPractice(n);this.renderer.resize();}},{label:'关卡地图',icon:'flag',run:()=>{g.reset();this.levelMap();}});
  this.panel.show(cleared?`第${n}关 · ${g.levels.current.name}  ${'★'.repeat(g.lastStars)}`:`第${n}关 · 练习失败`,[cleared?(g.lastStars===3?'完美！3 星，没有丢命':g.lastStars===2?'2 星：丢了 1 条命，不丢命可得 3 星':'1 星：少丢命可以拿更多星'):'生命耗尽，再试一次吧',`单关练习不计排行榜 · 总星数 ${this.progress.total}/${MAX_STARS}`],actions);}
 private async history(){return this.task(async()=>{
  this.me=await this.api.me();const lines=scoreHistoryLines(this.me.historicalBests,this.me.historicalBest);
  this.panel.show('个人历史记录',lines.length?[...lines,'历史有效成绩已参与所属模式永久统一排行榜。']:['暂无旧版有效记录'],[{label:'返回设置',run:()=>this.settings()}]);
 });}
 private result(){const runs=(Number(this.platform.read(SETTING.runs))||0)+1;this.platform.write(SETTING.runs,runs);if(runs>=2&&this.platform.read(SETTING.guide)!==true){this.platform.write(SETTING.guide,true);this.guide=true;}this.scoreShareImage=undefined;const g=this.game,generation=g.journal.generation;void scoreShare(this.wx,{mode:g.mode,score:g.score.total}).then(r=>{if(g.journal.generation===generation&&(g.state==='gameOver'||g.state==='victory'))this.scoreShareImage=r.imageUrl;}).catch(()=>{});this.resultPage();}
 /** Full-screen result page; it stays up (also after the leaderboard or a dialog closes) until a mode is chosen. */
 private resultPage(){const g=this.game,endless=g.mode==='endless',field=g.physics.endless,s=g.journal.summary(g.score.total,g.reachedLevel,g.state==='victory');
  const view={mode:g.mode,title:g.state==='victory'?'全部关卡突破！':endless?'挑战结束':'生命耗尽',score:g.score.total,
   stats:[[endless?'到达阶段':'到达关卡',endless?`第${g.reachedLevel}阶段`:`第${g.levels.current.number}关`],['消除砖块',g.journal.bricksDestroyed.toLocaleString('zh-CN')],endless?['砖墙下沉',`${field?.descents??0} 行`]:['挑战用时',`${Math.round(s.durationMs/1000)} 秒`]] as [string,string][],
   submitLabel:this.online?'提交成绩':'单机局 · 不上传',note:this.online?'成绩经服务端回放验证后上榜':'本轮为单机挑战，下一局开始时可选择联网',canSubmit:this.online};
  this.panel.showResult(GAME_NAME+' · '+(g.state==='victory'?'十二关突破成功':'挑战结束'),[`本次总分 ${g.score.total}`,(endless?`无尽模式 · 第${g.reachedLevel}阶段`:`到达第${g.levels.current.number}关`)+` · 消除 ${g.journal.bricksDestroyed} 块`,view.note],[
  {label:'提交本次成绩',run:()=>void this.scoreEntry()}, {label:'查看全球排行榜',half:true,run:()=>void this.board()}, {label:'分享成绩',half:true,run:()=>void this.shareScore()},
  {label:'闯关模式',half:true,run:()=>this.chooseMode('campaign')},{label:'无尽模式',half:true,run:()=>this.chooseMode('endless')}
 ],view);}
 private async scoreEntry(){return this.task(async()=>{
  if(!this.online)throw Error('本轮单机成绩无法登记；下一轮开始时可选择联网');
  this.me=await this.api.me();const p=this.me.player;
  this.panel.show('提交挑战成绩',[p?'当前昵称：'+p.nickname:'首次登记昵称不消耗修改额度',p&&this.me.nicknameChange?nicknameQuotaText(this.me.nicknameChange):'昵称额度由服务器统一记录；可直接提交成绩'],[
   {label:'提交成绩',run:()=>void this.submit()},...(p?[{label:'修改昵称',run:()=>void this.changeNickname()}]:[]),{label:'返回结算',run:()=>this.resultPage()}
  ]);
 });}
 private async changeNickname(){await this.task(async()=>{
  this.me=await this.api.me();if(!this.me.player)return;const r=await this.modal('修改排行榜昵称',this.me.nicknameChange?nicknameQuotaText(this.me.nicknameChange):'每周最多2次，每年最多6次（北京时间）','保存','取消',true,this.me.player.nickname);if(!r.confirm)return;
  try{await this.api.request('/players/nickname',{nickname:r.content||''});this.me=await this.api.me();this.toast('排行榜昵称已同步');}
  catch(e){this.toast((e as Error).message+'；仍可提交成绩');}
 });if(this.panel.title==='提交挑战成绩')await this.scoreEntry();}
 private async submit(){return this.task(async()=>{if(!this.online)throw Error('本轮单机成绩无法登记；下一轮开始时可选择联网');
  this.me=await this.api.me();if(!this.me.player){const name=await this.modal('登记玩家昵称','允许中文、英文、数字及安全字符，2～12个字符。','下一步','取消',true,this.nicknameDraft);if(!name.confirm)return;const nickname=name.content||'';this.nicknameDraft=nickname;
   const check=await this.api.request<{message:string;available:boolean}>('/players/availability?nickname='+encodeURIComponent(nickname)+'&region='+encodeURIComponent(this.region.code));
   if(!check.available){const change=await this.modal('昵称查重',check.message,'换地区','换昵称');if(change.confirm)await this.regions(undefined,()=>void this.submit());return;}
   const ok=await this.modal('确认登记',`昵称：${nickname}\n地区：${this.region.prefix}\n${check.message}\n点击取消可重新选择地区。`,'登记','选地区');
   if(!ok.confirm){await this.regions(undefined,()=>void this.submit());return;}
   await this.api.request('/players',{nickname,regionCode:this.region.code});this.me=await this.api.me();
  }
  const result=await this.sync.submit();if(result.verificationStatus==='verified')void this.cloud.retry();let refreshed=true;try{this.me=await this.api.me();}catch{this.me=undefined;refreshed=false;}this.toast((result.verificationStatus==='verified'?'成绩已登记':'成绩待复核')+(refreshed?'':'，个人记录暂无法刷新'));await this.board();
 });}
 /** Which board the ranking panel shows; follows the mode just played unless the player toggles it. */
 private rankingBoard:'global'|'endless'='global';
 private async board(offset=0,board:'global'|'endless'=this.rankingBoard){this.rankingBoard=board;const endless=board==='endless';
  this.game.pause();const pageSize=20,revision=++this.boardRevision;this.boardLoading=true;
  const show=(state:'loading'|'ready'|'error',items:RankingScore[]=[],nextOffset:number|null=null,best?:RankingScore|null,note='',personalAvailable=true,error?:string)=>{
   if(revision!==this.boardRevision)return;
   this.panel.showRanking({board,state,items,nextOffset,offset,best,note,personalAvailable,personalSignedOut:!this.api.authenticated,error},[
    {label:'全球榜',tab:true,disabled:true,run:()=>{}},{label:'好友榜',tab:true,run:()=>this.friends()},
    {label:'我的资料',run:()=>this.myProfile()},
    {label:'上一页',disabled:offset===0||state==='loading',run:()=>void this.board(Math.max(0,offset-pageSize))},
    {label:'刷新',run:()=>void this.board(offset)},
    {label:'下一页',disabled:nextOffset===null||state==='loading',run:()=>{if(nextOffset!==null)void this.board(nextOffset);}},
    {label:endless?'闯关榜':'无尽榜',disabled:state==='loading',run:()=>void this.board(0,endless?'global':'endless')},
    {label:'关闭',run:()=>{this.boardRevision++;this.boardLoading=false;this.panel.close();}}
   ],row=>{const card=rankingCard(row,endless);this.wx.showModal({title:card.name,content:`${card.rankLabel}\n最高总分 ${card.score}\n${endless?'最高阶段':'最高关卡'} ${card.level}\n消除砖块 ${card.bricks}\n最佳时间 ${card.time}`,showCancel:false});});
  };
  show('loading',[],null,undefined,'正在连接星际榜单',false);
  try{const result=await this.api.request<{items:BestScore[];nextOffset:number|null}&LeaderboardMetadata>(`/leaderboard?offset=${offset}&limit=${pageSize}&board=${board}`);if(endless){assertEndlessBoard(result);}else assertGlobalBoard(result);
   let me:Me|undefined,identityError='';try{if(this.api.authenticated)me=await this.api.me();}catch{this.me=undefined;identityError='个人记录暂不可用，请重新登录；全球榜单仍可查看';}if(revision!==this.boardRevision)return;if(me)this.me=me;
   let best=me?.best;if(endless&&me){try{const personal=await this.api.request<{best:BestScore|null}&LeaderboardMetadata>('/me/best?board=endless');assertEndlessBoard(personal);best=personal.best;}catch{best=null;}if(revision!==this.boardRevision)return;}
   show('ready',result.items,result.nextOffset,best,identityError||'每一份荣耀，都来自真实挑战',!identityError&&me?.rankingAvailable!==false);
  }catch(error){if(revision===this.boardRevision){show('error',[],null,undefined,'全球 TOP100',false,(error as Error).message);this.toast((error as Error).message);}}
  finally{if(revision===this.boardRevision)this.boardLoading=false;}
 }
 private async regions(parent:Region|undefined,done:()=>void,query='',offset=0){
  try{const q=`q=${encodeURIComponent(query)}&offset=${offset}${parent?'&parent='+encodeURIComponent(parent.code):''}`;const result=await this.api.request<{items:Region[];nextOffset:number|null}>('/regions?'+q);this.regionPage(result.items,0,parent,done,query,offset,result.nextOffset);}catch(error){this.toast((error as Error).message);}
 }
 private regionPage(items:Region[],page:number,parent:Region|undefined,done:()=>void,query:string,offset:number,nextOffset:number|null){const count=2,part=items.slice(page*count,page*count+count);const actions:Action[]=part.map(item=>({label:item.name,run:()=>{this.region=item;if(item.hasChildren)void this.regions(item,done);else{this.panel.close();done();}}}));
  if(parent)actions.push({label:'选择当前地区：'+parent.prefix,run:()=>{this.region=parent;this.panel.close();done();}});
  actions.push({label:'搜索',half:true,run:()=>void this.modal('搜索地区','输入地区名称或标准代码','搜索','取消',true).then(r=>{if(r.confirm)void this.regions(parent,done,r.content||'');})},{label:'国家/地区',half:true,run:()=>void this.regions(undefined,done)});
  actions.push({label:'上一页',half:true,run:()=>this.regionPage(items,Math.max(0,page-1),parent,done,query,offset,nextOffset)},{label:'下一页',half:true,run:()=>{if((page+1)*count<items.length)this.regionPage(items,page+1,parent,done,query,offset,nextOffset);else if(nextOffset!==null)void this.regions(parent,done,query,nextOffset);}});
  actions.push({label:'取消选择',run:()=>this.panel.close()});this.panel.show('选择地区',[parent?parent.path+' / '+parent.name:'国家/地区 → 省级 → 地级 → 县级','可在任意一级确认，榜单只显示末级地区'],actions);
 }
 private async bind(){return this.task(async()=>{const consent=await this.modal('绑定说明','仅使用你本人网页账号生成的五分钟一次性绑定码。已在微信登记的玩家不能自动合并历史。','继续','取消');if(!consent.confirm)return;
  const agree=await this.modal('隐私保护说明',privacy,'同意登录','取消');if(!agree.confirm)return;await this.loginWithPrivacy();
  const ticket=await this.modal('输入网页绑定码','请在已登录的网页排行榜生成；不要使用他人的绑定码。','绑定','取消',true);if(!ticket.confirm)return;
  await this.api.request('/wechat/bind',{ticket:ticket.content?.trim()});this.me=await this.api.me();this.toast('已绑定原网页玩家');this.settings();});}
 private async appeal(){return this.task(async()=>{if(!this.api.authenticated)throw Error('请先在开始挑战时选择联网登录');const r=await this.modal('账号与隐私申诉','请说明更正、注销或删除请求，不要填写密码。','提交','取消',true);if(r.confirm){await this.api.request('/appeals',{message:r.content||''});this.toast('申诉已提交');}});}
 private async shareScore(){if(this.sharing||(this.game.state!=='gameOver'&&this.game.state!=='victory'))return;this.sharing=true;try{const data=await scoreShare(this.wx,{mode:this.game.mode,score:this.game.score.total});this.wx.shareAppMessage(data);}catch{this.toast('分享暂不可用，可继续游戏');}finally{this.sharing=false;}}
 private friends(){
  this.game.pause();this.boardRevision++;this.boardLoading=false;const mode=this.rankingBoard==='endless'?'endless':'campaign';
  const friend=new FriendBoard(this.wx,mode,{global:()=>void this.board(),change:()=>{this.rankingBoard=mode==='campaign'?'endless':'global';this.friends();},close:()=>this.panel.close(),invite:()=>this.wx.shareAppMessage(this.shareData()),retry:()=>{void this.cloud.retry();},status:()=>this.cloud.status,permissions:()=>{if(this.wx.openSetting)this.wx.openSetting({success:()=>{if(this.panel.friend===friend){friend.resume();void this.cloud.retry();}},fail:()=>this.toast('未更改授权，可继续全球榜或单机')});else this.toast('请在微信右上角设置中管理朋友信息授权');}});
  this.panel.showFriends(friend);void this.cloud.retry();
  if(this.wx.authorize)this.wx.authorize({scope:'scope.WxFriendInteraction',success:()=>{if(this.panel.friend===friend)friend.resume();},fail:()=>this.toast('未获得朋友信息授权，可在好友榜的授权设置中管理')});
 }
 private myProfile(){this.game.pause();this.boardRevision++;this.boardLoading=false;this.profile.clearButton();this.panel.show('我的资料',['展示昵称：'+this.profile.data.nickname,'榜单昵称：'+(this.me?.player?.display_name||'登记后由服务器管理'),'展示资料仅存本机，不修改身份；好友榜使用微信返回资料'],[
  {label:'填写昵称',half:true,run:()=>void this.task(async()=>{const r=await this.modal('本机展示昵称','2～12个中文、字母或数字','保存','取消',true,this.profile.data.nickname);if(r.confirm)this.profile.nickname(r.content||'');this.myProfile();})},
  {label:'选择头像',half:true,run:()=>void this.task(async()=>{await this.profile.chooseAvatar();this.myProfile();})},
  {label:'主动获取微信资料（可拒绝）',run:()=>void this.task(async()=>{if(this.wx.requirePrivacyAuthorize)await new Promise<void>((resolve,reject)=>this.wx.requirePrivacyAuthorize!({success:resolve,fail:()=>reject(Error('未同意资料隐私授权，默认资料保持不变'))}));if(this.panel.title!=='我的资料'||!this.active)return;const target=this.panel.hits[2]?.rect;if(!target)throw Error('界面已更新，请再次点击资料按钮');this.profile.authorize(target,message=>{this.toast(message);this.myProfile();});})},
  {label:'默认资料',half:true,run:()=>{this.profile.nickname('球球玩家');this.profile.data.avatar='';this.profile.image=undefined;this.platform.write('qiulegeqiu:local-profile:v1',{...this.profile.data});this.myProfile();}},
  {label:'返回排行榜',half:true,run:()=>void this.board()},{label:'关闭',run:()=>{this.profile.clearButton();this.panel.close();}}
 ]);}
 private shareData(){if(this.game.state==='gameOver'||this.game.state==='victory')return {title:shareTitle({mode:this.game.mode,score:this.game.score.total}),imageUrl:this.scoreShareImage,query:'source=score&mode='+this.game.mode};return {title:this.me?.best?`${GAME_NAME}：我的最高纪录 ${this.me.best.score} 分，一起突破！`:`${GAME_NAME}：十二关弹球挑战，一起突破！`,imageUrl:this.shareImage,query:'source=friend'};}
 private makeShareImage(){const card=this.wx.createCanvas();card.width=500;card.height=400;const c=context(card);c.fillStyle=OCEAN.colors.background;c.fillRect(0,0,500,400);c.strokeStyle=OCEAN.colors.border;c.lineWidth=2;c.beginPath();c.arc(250,190,145,0,Math.PI*2);c.stroke();for(let y=90;y<220;y+=18)for(let x=155;x<350;x+=18)if(Math.hypot(x-250,y-190)<130){c.fillStyle=brickColor(Math.floor((y-90)/18),40);c.fillRect(x,y,14,14);}c.fillStyle=OCEAN.paddle.body;c.fillRect(195,310,110,8);c.fillStyle=OCEAN.ball.body;c.beginPath();c.arc(245,270,6,0,Math.PI*2);c.fill();c.font='bold 30px sans-serif';c.textAlign='center';c.fillText(GAME_NAME,250,375);card.toTempFilePath?.({success:r=>{this.shareImage=r.tempFilePath;}});}
}
