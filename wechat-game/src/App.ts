import {HapticTracker} from '../../src/Haptics';
const MODE_KEY='qiulegeqiu:wechat-mode:v1';
import {OCEAN,brickColor} from '../../shared/VisualTheme';
import {panel,canvasText} from '../../shared/CanvasUI';
import {scoreHistoryLines} from '../../shared/ScoreHistory';
import {assertGlobalBoard,ENDLESS_BOARD,ENDLESS_RULES_VERSION,type LeaderboardMetadata} from '../../shared/Challenge';
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
import {privacy,agreement} from './Policies';
import type {Wx,Canvas,Config,TouchEvent} from './Platform';
interface Region {code:string;prefix:string;name:string;hasChildren:boolean;path:string}
// This ID is only an idempotency key, never an authentication credential.
function clientId(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const n=Math.floor(Math.random()*16);return (c==='x'?n:(n&3)|8).toString(16);});}
export class MiniGameApp {
 readonly game:Game;readonly api:WechatApi;readonly panel=new Panel();readonly canvas:Canvas;
 readonly platform:WechatPlatform;
 private rankingArt?:CanvasImageSource;
 private backgroundFill?:CanvasGradient|string;
 private arena:Canvas;private renderer:Renderer;private ctx:CanvasRenderingContext2D;private sync:ChallengeSync;
 private view=layout(375,667);private dpr=1;private previous=0;private active=true;private online=false;private offlinePreference=false;private busy=false;private lastEnd=-1;
 private touch?:{id:number;x:number;y:number;moved:boolean;drag:boolean;lastY:number};private actions:{rect:Rect;run:()=>void}[]=[];
 private lowDevice=false;private boardLoading=false;private boardRevision=0;private me?:Me;private nicknameDraft='';private region:Region={code:'ISO:CN',prefix:'中国',name:'中国',hasChildren:true,path:''};private shareImage?:string;
 constructor(private wx:Wx,config:Config){
  try{this.lowDevice=(wx.getDeviceInfo?.().benchmarkLevel??30)<20;}catch{/* Old runtimes use viewport/frame-time fallback. */}
  this.platform=new WechatPlatform(wx);this.canvas=this.platform.createCanvas();this.arena=this.platform.createCanvas();const cache=this.platform.createCanvas();
  this.panel.configureRankingCache(()=>this.platform.createCanvas());

  const rankingImage=wx.createImage?.();if(rankingImage){rankingImage.onload=()=>{this.rankingArt=rankingImage as unknown as CanvasImageSource;};rankingImage.src="assets/ranking-scene.png";}
  this.ctx=context(this.canvas);context(this.arena);context(cache);
  this.api=new WechatApi(wx,config);
  this.game=new Game(undefined,()=>{},undefined,this.platform.createAudio());
  this.game.audio.muted=this.platform.read('qiulegeqiu:wechat-muted:v1')===true;
  if(this.platform.read(MODE_KEY)==='endless'){this.game.setMode('endless');this.rankingBoard='endless';}
  const renderHost=this.platform.rendererHost(cache,()=>({width:this.view.arena.width,height:this.view.arena.height}),()=>this.dpr);renderHost.lowPerformance=()=>this.lowDevice||this.view.width<360;this.renderer=new Renderer(this.arena,renderHost);
  this.sync=new ChallengeSync(this.api,this.game,()=>Date.now(),clientId);this.resize();
  wx.onTouchStart(e=>this.down(e));wx.onTouchMove(e=>this.move(e));wx.onTouchEnd(e=>this.up(e));wx.onTouchCancel(()=>{this.touch=undefined;});
  wx.onHide(()=>this.hide());wx.onShow(()=>{this.active=true;this.previous=0;this.resize();this.platform.resume();});wx.onWindowResize?.(()=>this.resize());
  wx.showShareMenu({menus:['shareAppMessage']});wx.onShareAppMessage(()=>this.shareData());this.makeShareImage();
 }
 resize(){const w=this.wx.getWindowInfo();const menu=this.wx.getMenuButtonBoundingClientRect?.();this.view=layout(w.windowWidth,w.windowHeight,w.safeArea?.top,w.safeArea?.bottom,menu?.bottom);this.dpr=Math.min(w.pixelRatio||1,2);
  this.canvas.width=Math.round(w.windowWidth*this.dpr);this.canvas.height=Math.round(w.windowHeight*this.dpr);this.backgroundFill=undefined;this.renderer.resize();}
 run(){this.platform.start(now=>this.frame(now));}
 dispose(){this.platform.dispose();this.renderer.dispose();this.game.dispose();}
 hide(){this.platform.suspend();this.game.audio.suspend();this.active=false;this.previous=0;this.touch=undefined;this.game.pause();if(this.online)void this.sync.flush().catch(()=>{});}
 frame(now:number){if(!this.active)return;const dt=this.previous?Math.min(.1,Math.max(0,(now-this.previous)/1000)):0;this.previous=now;
  this.game.update(dt);this.haptics();if(this.online)this.sync.observe();if(!this.panel.ranking)this.renderer.draw(this.game.physics,this.game.state==='ready',now);this.draw(now);
  if((this.game.state==='gameOver'||this.game.state==='victory')&&this.lastEnd!==this.game.journal.generation){this.lastEnd=this.game.journal.generation;this.result();}
 }
 private draw(now:number){const c=this.ctx,v=this.view;c.setTransform(this.dpr,0,0,this.dpr,0,0);
  if(!this.backgroundFill){const gradient=c.createLinearGradient(0,0,0,v.height);gradient?.addColorStop(0,OCEAN.colors.background);gradient?.addColorStop(1,OCEAN.colors.gradientEnd);this.backgroundFill=gradient||OCEAN.colors.background;}
  c.fillStyle=this.backgroundFill;c.fillRect(0,0,v.width,v.height);canvasText(c,GAME_NAME,v.width/2,v.top+24,v.width-120,15,OCEAN.colors.text,'center');
  const g=this.game,b=g.physics.blocks,hud={x:8,y:v.hudY-4,width:v.width-16,height:56};panel(c,hud,OCEAN.colors.arena,OCEAN.colors.line,10);
  const field=g.physics.endless,progress=field?Math.round(field.descentProgress*100):Math.round(b.removed/Math.max(1,b.total)*100);
  const cells=[field?['无尽阶段',`第${g.reachedLevel}阶段`]:['关卡',`${String(g.levels.current.number).padStart(2,'0')}/${g.levels.count}`],['生命',`♥×${g.lives}`],['得分',String(g.score.total)],['弹球',`球×${g.physics.balls.length}`],['剩余砖块',String(b.remaining)],field?[field.blocked?'压到底线':'下沉',`已下沉${field.descents}行`]:['进度',`${progress}%`]];
  cells.forEach(([label,value],i)=>{const x=hud.x+10+(i%3)*(hud.width-12)/3,y=hud.y+8+Math.floor(i/3)*26,w=(hud.width-24)/3;canvasText(c,label,x,y,w,8,OCEAN.colors.muted);canvasText(c,value,x,y+12,w,12,i===1?OCEAN.colors.heart:i===5?OCEAN.colors.positive:OCEAN.colors.number);});
  const meterX=hud.x+10+2*(hud.width-12)/3,meterWidth=(hud.width-24)/3;c.fillStyle=OCEAN.colors.line;c.fillRect(meterX,hud.y+53,meterWidth,2);c.fillStyle=OCEAN.colors.positive;c.fillRect(meterX,hud.y+53,meterWidth*progress/100,2);
  if(!this.panel.ranking)c.drawImage(this.arena as CanvasImageSource,v.arena.x,v.arena.y,v.arena.width,v.arena.height);this.actions=[];
  const button=(rect:Rect,label:string,run:()=>void)=>{panel(c,rect,OCEAN.colors.panel,OCEAN.colors.border,9);canvasText(c,label,rect.x+rect.width/2,rect.y+rect.height/2,rect.width-8,13,OCEAN.colors.text,'center');this.actions.push({rect,run});};
  if(g.physics.wideRemaining>0||g.score.multiplier>1)canvasText(c,`${g.physics.wideRemaining>0?'加宽 '+g.physics.wideRemaining.toFixed(1)+' 秒 ':''}${g.score.multiplier>1?'连击 ×'+g.score.multiplier:''}`,v.width/2,v.buttonsY-6,v.width-16,10,OCEAN.colors.positive,'center');
  const action=centralActionFor(g);
  if(g.state==='levelComplete'&&g.result){c.fillStyle=OCEAN.colors.text;c.font='14px sans-serif';c.fillText(`第${g.levels.current.number}关突破！本关 ${g.result.levelTotal} 分`,v.width/2,v.arena.y+C.arena.y*v.scale-38);}
  if(g.state==='paused'){c.fillStyle=OCEAN.alpha.veil;c.fillRect(v.arena.x,v.arena.y,v.arena.width,v.arena.height);}
  if(action&&g.state!=='ready'&&!this.busy){const centerY=v.arena.y+C.arena.y*v.scale;button({x:v.width/2-78,y:centerY-22,width:156,height:44},action.label,()=>void this.activate());}
  button({x:v.width/2-116,y:v.buttonsY,width:108,height:44},g.state==='paused'?'继续':'暂停',()=>{if(g.state==='paused')g.start();else g.pause();});
  button({x:v.width/2+8,y:v.buttonsY,width:108,height:44},'重新开始',()=>{this.panel.close();g.reset();});
  // Compact native-style utility controls stay below the capsule safe area.
  button({x:8,y:v.top,width:44,height:44},'菜单',()=>this.menu());button({x:v.width-52,y:v.top,width:44,height:44},'排行',()=>void this.board());
  this.panel.draw(c,v.width,v.top,v.bottom,now,g.state!=='paused',this.lowDevice||v.width<360,this.rankingArt,this.dpr);
 }
 private down(e:TouchEvent){if(this.touch)return;const t=e.changedTouches[0];if(!t)return;this.game.audio.unlock();this.touch={id:t.identifier,x:t.clientX,y:t.clientY,moved:false,lastY:t.clientY,drag:!this.panel.open&&inside(this.view.arena,t.clientX,t.clientY)&&!this.actions.some(a=>inside(a.rect,t.clientX,t.clientY))};if(this.touch.drag){this.target(t.clientX);if(!this.busy&&!this.boardLoading)startFromPlayfield(this.game,()=>void this.activate());}}
 private move(e:TouchEvent){const active=this.touch;if(!active)return;const t=e.touches.find(t=>t.identifier===active.id);if(!t)return;if(Math.hypot(t.clientX-active.x,t.clientY-active.y)>8)active.moved=true;if(this.panel.open)this.panel.scroll(t.clientY-active.lastY,active.x,active.y);else if(active.drag)this.target(t.clientX);active.lastY=t.clientY;}
 private up(e:TouchEvent){const active=this.touch;if(!active||!e.changedTouches.some(t=>t.identifier===active.id))return;this.touch=undefined;if(active.moved||active.drag)return;if(this.panel.open){this.panel.tap(active.x,active.y);return;}this.actions.find(a=>inside(a.rect,active.x,active.y))?.run();}
 private hapticTracker=new HapticTracker();
 /** Short vibration on decisive moments only (shared policy with Web); silent when muted. */
 private haptics(){const type=this.hapticTracker.next(this.game.physics.effects,this.game.state!=='running',Date.now());if(type&&!this.game.audio.muted){try{this.wx.vibrateShort?.({type,fail:()=>{}});}catch{/* Optional device capability. */}}}
 private target(x:number){this.game.physics.setTarget((x-this.view.arena.x)/this.view.arena.width*C.width);}
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
 private async loginWithPrivacy(){if(this.wx.requirePrivacyAuthorize)await new Promise<void>((r,j)=>this.wx.requirePrivacyAuthorize!({success:r,fail:()=>j(Error('未获得隐私授权，可继续单机'))}));await this.api.login();}
 private modal(title:string,content:string,confirmText='确定',cancelText='取消',editable=false,initialValue=''){return new Promise<{confirm:boolean;content?:string}>(resolve=>this.wx.showModal({title,content:editable?initialValue:content,placeholderText:editable?content:undefined,confirmText,cancelText,editable,success:resolve,fail:()=>resolve({confirm:false})}));}
 private toast(message:string){this.wx.showToast({title:message,icon:'none'});}
 private async task(work:()=>Promise<void>){if(this.busy)return;this.busy=true;try{await work();}catch(error){this.wx.showModal({title:'操作未完成',content:(error as Error).message,showCancel:false});}finally{this.busy=false;}}
 private menu(){this.game.pause();this.panel.show('游戏菜单',[this.me?.best?`我的历史最高：${this.me.best.score}，排名 ${this.me.best.rank}`:'可随时单机挑战，联网异常不影响游戏'],[
  {label:'分享小游戏',run:()=>this.wx.shareAppMessage(this.shareData()),half:true},{label:this.game.audio.muted?'开启音效':'静音',run:()=>{this.game.audio.toggle();this.platform.write('qiulegeqiu:wechat-muted:v1',this.game.audio.muted);this.menu();},half:true},
  {label:'个人历史记录',run:()=>void this.history(),half:true},
  {label:'绑定已有网页账号',run:()=>void this.bind(),half:true},
  {label:this.game.mode==='endless'?'切换到闯关模式':'切换到无尽模式',run:()=>void this.switchMode(this.game.mode==='endless'?'campaign':'endless')},
  {label:'单机重新挑战',run:()=>{this.offlinePreference=true;this.online=false;this.panel.close();this.game.reset();},half:true},{label:'联网重新挑战',run:()=>{this.offlinePreference=false;this.panel.close();this.game.reset();},half:true},
  {label:'隐私保护说明',run:()=>this.wx.showModal({title:'隐私保护说明',content:privacy,showCancel:false}),half:true},{label:'用户协议',run:()=>this.wx.showModal({title:'用户协议',content:agreement,showCancel:false}),half:true},
  {label:'账号及隐私申诉',run:()=>void this.appeal()}, {label:'关闭菜单',run:()=>this.panel.close()}
 ]);}
 /** Mode switch always starts a fresh run, so confirm if one is in progress; the choice is remembered. */
 private async switchMode(mode:GameMode){
  const g=this.game,inProgress=g.journal.events.length>0&&g.state!=='gameOver'&&g.state!=='victory';
  if(inProgress&&!(await this.modal('切换模式','切换模式会结束当前这一局，确定切换吗？','切换','取消')).confirm)return;
  g.setMode(mode);this.rankingBoard=mode==='endless'?'endless':'global';this.platform.write(MODE_KEY,mode);this.panel.close();
  this.toast(mode==='endless'?'无尽模式：砖墙会不断下沉，3条命':'闯关模式：12关挑战');
 }
 private async history(){return this.task(async()=>{
  this.me=await this.api.me();const lines=scoreHistoryLines(this.me.historicalBests,this.me.historicalBest);
  this.panel.show('个人历史记录',lines.length?[...lines,'旧成绩完整保留，全球榜需按新版规则重新挑战。']:['暂无旧版有效记录'],[{label:'返回菜单',run:()=>this.menu()}]);
 });}
 private result(){const g=this.game;this.panel.show(GAME_NAME+' · '+(g.state==='victory'?'十二关突破成功':'挑战结束'),[`本次总分 ${g.score.total}`,(g.mode==='endless'?`无尽模式 · 第${g.reachedLevel}阶段`:`到达第${g.levels.current.number}关`)+` · 消除 ${g.journal.bricksDestroyed} 块`,this.online?'成绩仍需服务端记录验证':'本轮为单机挑战，不上传成绩'],[
  ...(this.online&&!this.me?.player?[{label:'登记地区：'+this.region.prefix,run:()=>void this.regions(undefined,()=>this.result())}]:[]),
  {label:'提交本次成绩',run:()=>void this.submit()}, {label:'查看全球排行榜',run:()=>void this.board()},
  {label:'跳过提交，重新挑战',run:()=>{this.panel.close();g.reset();}}, {label:'关闭结算',run:()=>this.panel.close()}
 ]);}
 private async submit(){return this.task(async()=>{if(!this.online)throw Error('本轮单机成绩无法登记；下一轮开始时可选择联网');
  this.me=await this.api.me();if(!this.me.player){const name=await this.modal('登记玩家昵称','允许中文、英文、数字及安全字符，2～12个字符。','下一步','取消',true,this.nicknameDraft);if(!name.confirm)return;const nickname=name.content||'';this.nicknameDraft=nickname;
   const check=await this.api.request<{message:string;available:boolean}>('/players/availability?nickname='+encodeURIComponent(nickname)+'&region='+encodeURIComponent(this.region.code));
   if(!check.available){const change=await this.modal('昵称查重',check.message,'换地区','换昵称');if(change.confirm)await this.regions(undefined,()=>void this.submit());return;}
   const ok=await this.modal('确认登记',`昵称：${nickname}\n地区：${this.region.prefix}\n${check.message}\n点击取消可重新选择地区。`,'登记','选地区');
   if(!ok.confirm){await this.regions(undefined,()=>void this.submit());return;}
   await this.api.request('/players',{nickname,regionCode:this.region.code});this.me=await this.api.me();
  }
  const result=await this.sync.submit();let refreshed=true;try{this.me=await this.api.me();}catch{this.me=undefined;refreshed=false;}this.toast((result.verificationStatus==='verified'?'成绩已登记':'成绩待复核')+(refreshed?'':'，个人记录暂无法刷新'));await this.board();
 });}
 /** Which board the ranking panel shows; follows the mode just played unless the player toggles it. */
 private rankingBoard:'global'|'endless'='global';
 private async board(offset=0,board:'global'|'endless'=this.rankingBoard){this.rankingBoard=board;const endless=board==='endless';
  this.game.pause();const pageSize=20,revision=++this.boardRevision;this.boardLoading=true;
  const show=(state:'loading'|'ready'|'error',items:RankingScore[]=[],nextOffset:number|null=null,best?:RankingScore|null,note='',personalAvailable=true,error?:string)=>{
   if(revision!==this.boardRevision)return;
   this.panel.showRanking({board,state,items,nextOffset,offset,best,note,personalAvailable,personalSignedOut:!this.api.authenticated,error},[
    {label:'上一页',disabled:offset===0||state==='loading',run:()=>void this.board(Math.max(0,offset-pageSize))},
    {label:'刷新',run:()=>void this.board(offset)},
    {label:'下一页',disabled:nextOffset===null||state==='loading',run:()=>{if(nextOffset!==null)void this.board(nextOffset);}},
    {label:endless?'闯关榜':'无尽榜',disabled:state==='loading',run:()=>void this.board(0,endless?'global':'endless')},
    {label:'关闭',run:()=>{this.boardRevision++;this.boardLoading=false;this.panel.close();}}
   ],row=>{const card=rankingCard(row,endless);this.wx.showModal({title:card.name,content:`${card.rankLabel}\n最高总分 ${card.score}\n${endless?'最高阶段':'最高关卡'} ${card.level}\n消除砖块 ${card.bricks}\n最佳时间 ${card.time}`,showCancel:false});});
  };
  show('loading',[],null,undefined,'正在连接星际榜单',false);
  try{const result=await this.api.request<{items:BestScore[];nextOffset:number|null}&LeaderboardMetadata>(`/leaderboard?offset=${offset}&limit=${pageSize}&board=${board}`);if(endless){if(result.board!==ENDLESS_BOARD||result.rankingRulesVersion!==ENDLESS_RULES_VERSION)throw Error('排行榜后端尚未支持无尽榜，请等待服务器更新');}else assertGlobalBoard(result);
   let me:Me|undefined,identityError='';try{if(this.api.authenticated)me=await this.api.me();}catch{this.me=undefined;identityError='个人记录暂不可用，请重新登录；全球榜单仍可查看';}if(revision!==this.boardRevision)return;if(me)this.me=me;
   let best=me?.best;if(endless&&me){try{best=(await this.api.request<{best:BestScore|null}>('/me/best?board=endless')).best;}catch{best=null;}if(revision!==this.boardRevision)return;}
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
  await this.api.request('/wechat/bind',{ticket:ticket.content?.trim()});this.me=await this.api.me();this.toast('已绑定原网页玩家');this.menu();});}
 private async appeal(){return this.task(async()=>{if(!this.api.authenticated)throw Error('请先在开始挑战时选择联网登录');const r=await this.modal('账号与隐私申诉','请说明更正、注销或删除请求，不要填写密码。','提交','取消',true);if(r.confirm){await this.api.request('/appeals',{message:r.content||''});this.toast('申诉已提交');}});}
 private shareData(){return {title:this.me?.best?`${GAME_NAME}：我的最高纪录 ${this.me.best.score} 分，一起突破！`:`${GAME_NAME}：十二关弹球挑战，一起突破！`,imageUrl:this.shareImage,query:'source=friend'};}
 private makeShareImage(){const card=this.wx.createCanvas();card.width=500;card.height=400;const c=context(card);c.fillStyle=OCEAN.colors.background;c.fillRect(0,0,500,400);c.strokeStyle=OCEAN.colors.border;c.lineWidth=2;c.beginPath();c.arc(250,190,145,0,Math.PI*2);c.stroke();for(let y=90;y<220;y+=18)for(let x=155;x<350;x+=18)if(Math.hypot(x-250,y-190)<130){c.fillStyle=brickColor(Math.floor((y-90)/18),40);c.fillRect(x,y,14,14);}c.fillStyle=OCEAN.paddle.body;c.fillRect(195,310,110,8);c.fillStyle=OCEAN.ball.body;c.beginPath();c.arc(245,270,6,0,Math.PI*2);c.fill();c.font='bold 30px sans-serif';c.textAlign='center';c.fillText(GAME_NAME,250,375);card.toTempFilePath?.({success:r=>{this.shareImage=r.tempFilePath;}});}
}
