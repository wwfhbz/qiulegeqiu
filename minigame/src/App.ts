import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {Renderer} from '../../src/Renderer';
import {AudioSystem} from '../../src/Audio';
import {centralActionFor,activateCentralAction} from '../../src/CentralAction';
import {ChallengeSync} from '../../src/online/ChallengeSync';
import type {Me,BestScore} from '../../src/online/ApiClient';
import {WechatApi} from './Api';
import {layout,inside,type Rect} from './Layout';
import {context} from './CanvasAdapter';
import {Panel,type Action} from './Panel';
import {privacy,agreement} from './Policies';
import type {Wx,Canvas,Config,TouchEvent} from './Platform';
interface Region {code:string;prefix:string;name:string;hasChildren:boolean;path:string}
// This ID is only an idempotency key, never an authentication credential.
function clientId(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const n=Math.floor(Math.random()*16);return (c==='x'?n:(n&3)|8).toString(16);});}
export class MiniGameApp {
 readonly game:Game;readonly api:WechatApi;readonly panel=new Panel();readonly canvas:Canvas;
 private arena:Canvas;private renderer:Renderer;private ctx:CanvasRenderingContext2D;private sync:ChallengeSync;
 private view=layout(375,667);private dpr=1;private previous=0;private active=true;private online=false;private offlinePreference=false;private busy=false;private lastEnd=-1;
 private touch?:{id:number;x:number;y:number;moved:boolean;drag:boolean};private actions:{rect:Rect;run:()=>void}[]=[];
 private me?:Me;private nicknameDraft='';private region:Region={code:'ISO:CN',prefix:'中国',name:'中国',hasChildren:true,path:''};private shareImage?:string;
 constructor(private wx:Wx,config:Config){
  this.canvas=wx.createCanvas();this.arena=wx.createCanvas();const cache=wx.createCanvas();
  this.ctx=context(this.canvas);context(this.arena);context(cache);
  this.api=new WechatApi(wx,config);
  this.game=new Game(undefined,()=>{},undefined,new AudioSystem(()=>{if(!wx.createWebAudioContext)throw Error('音频不可用');return wx.createWebAudioContext();}));
  this.renderer=new Renderer(this.arena as HTMLCanvasElement,{cache:cache as HTMLCanvasElement,viewport:()=>({width:this.view.arena.width,height:this.view.arena.height}),pixelRatio:()=>this.dpr});
  this.sync=new ChallengeSync(this.api,this.game,()=>Date.now(),clientId);this.resize();
  wx.onTouchStart(e=>this.down(e));wx.onTouchMove(e=>this.move(e));wx.onTouchEnd(e=>this.up(e));wx.onTouchCancel(()=>{this.touch=undefined;});
  wx.onHide(()=>this.hide());wx.onShow(()=>{this.active=true;this.previous=0;this.resize();});wx.onWindowResize?.(()=>this.resize());
  wx.showShareMenu({menus:['shareAppMessage']});wx.onShareAppMessage(()=>this.shareData());this.makeShareImage();
 }
 resize(){const w=this.wx.getWindowInfo();const menu=this.wx.getMenuButtonBoundingClientRect?.();this.view=layout(w.windowWidth,w.windowHeight,w.safeArea?.top,w.safeArea?.bottom,menu?.bottom);this.dpr=Math.min(w.pixelRatio||1,2);
  this.canvas.width=Math.round(w.windowWidth*this.dpr);this.canvas.height=Math.round(w.windowHeight*this.dpr);this.renderer.resize();}
 hide(){this.active=false;this.previous=0;this.touch=undefined;this.game.pause();if(this.online)void this.sync.flush().catch(()=>{});}
 frame(now:number){if(!this.active)return;const dt=this.previous?Math.min(.1,Math.max(0,(now-this.previous)/1000)):0;this.previous=now;
  this.game.update(dt);if(this.online)this.sync.observe();this.renderer.draw(this.game.physics,this.game.state==='ready');this.draw();
  if((this.game.state==='gameOver'||this.game.state==='victory')&&this.lastEnd!==this.game.journal.generation){this.lastEnd=this.game.journal.generation;this.result();}
 }
 private draw(){const c=this.ctx,v=this.view;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#050c18';c.fillRect(0,0,v.width,v.height);c.fillStyle='#c7deec';c.textAlign='center';c.font='bold 15px sans-serif';c.fillText('球了个球',v.width/2,v.top+14);
  const g=this.game;c.font='12px sans-serif';c.fillStyle='#9bb1c8';c.fillText(`关卡 ${String(g.levels.current.number).padStart(2,'0')}/${g.levels.count}　生命 ♥×${g.lives}　分数 ${g.score.total}`,v.width/2,v.hudY+12);
  c.fillText(`剩余 ${g.physics.blocks.remaining}　球×${g.physics.balls.length}${g.physics.wideRemaining>0?'　加宽 '+g.physics.wideRemaining.toFixed(1)+'秒':''}${g.score.multiplier>1?'　连击×'+g.score.multiplier:''}`,v.width/2,v.hudY+30);
  c.drawImage(this.arena as CanvasImageSource,v.arena.x,v.arena.y,v.arena.width,v.arena.height);this.actions=[];
  const button=(rect:Rect,label:string,run:()=>void)=>{c.fillStyle='#153047';c.fillRect(rect.x,rect.y,rect.width,rect.height);c.fillStyle='#bfedff';c.font='14px sans-serif';c.fillText(label,rect.x+rect.width/2,rect.y+28);this.actions.push({rect,run});};
  const action=centralActionFor(g);
  if(g.state==='levelComplete'&&g.result){c.fillStyle='#ffd0a0';c.font='14px sans-serif';c.fillText(`第${g.levels.current.number}关突破！本关 ${g.result.levelTotal} 分`,v.width/2,v.arena.y+C.arena.y*v.scale-38);}
  if(action&&!this.busy){const centerY=v.arena.y+C.arena.y*v.scale;button({x:v.width/2-78,y:centerY-22,width:156,height:44},action.label,()=>void this.activate());}
  button({x:v.width/2-116,y:v.buttonsY,width:108,height:44},g.state==='paused'?'继续':'暂停',()=>{if(g.state==='paused')g.start();else g.pause();});
  button({x:v.width/2+8,y:v.buttonsY,width:108,height:44},'重新开始',()=>{this.panel.close();g.reset();});
  // Compact native-style utility controls stay below the capsule safe area.
  button({x:8,y:v.top-8,width:44,height:44},'菜单',()=>this.menu());button({x:v.width-52,y:v.top-8,width:44,height:44},'排行',()=>void this.board());
  this.panel.draw(c,v.width,v.top,v.bottom);
 }
 private down(e:TouchEvent){if(this.touch)return;const t=e.changedTouches[0];if(!t)return;this.touch={id:t.identifier,x:t.clientX,y:t.clientY,moved:false,drag:!this.panel.open&&inside(this.view.arena,t.clientX,t.clientY)&&!this.actions.some(a=>inside(a.rect,t.clientX,t.clientY))};if(this.touch.drag)this.target(t.clientX);}
 private move(e:TouchEvent){const active=this.touch;if(!active)return;const t=e.touches.find(t=>t.identifier===active.id);if(!t)return;if(Math.hypot(t.clientX-active.x,t.clientY-active.y)>8)active.moved=true;if(active.drag)this.target(t.clientX);}
 private up(e:TouchEvent){const active=this.touch;if(!active||!e.changedTouches.some(t=>t.identifier===active.id))return;this.touch=undefined;if(active.moved||active.drag)return;if(this.panel.open){this.panel.tap(active.x,active.y);return;}this.actions.find(a=>inside(a.rect,active.x,active.y))?.run();}
 private target(x:number){this.game.physics.setTarget((x-this.view.arena.x)/this.view.arena.width*C.width);}
 private async activate(){if(this.busy)return;this.busy=true;
  try{if(this.game.state==='ready'&&this.game.readyReason==='initial'){
    this.online=false;
    if(this.offlinePreference){}else if(this.api.authenticated){this.me=await this.api.me();this.online=true;}
    else{const network=await this.modal('开始挑战','联网挑战需要微信登录，昵称与地区可在结束后自行登记。也可选择单机，不上传成绩。','联网挑战','单机游玩');
     if(network.confirm){const consent=await this.modal('隐私说明',privacy,'同意登录','单机游玩');if(consent.confirm){await this.loginWithPrivacy();this.me=await this.api.me();this.online=true;}}
    }
   }
  }catch(error){this.online=false;this.toast((error as Error).message);}finally{this.busy=false;activateCentralAction(this.game);if(!this.active)this.game.pause();this.previous=0;}
 }
 private async loginWithPrivacy(){if(this.wx.requirePrivacyAuthorize)await new Promise<void>((r,j)=>this.wx.requirePrivacyAuthorize!({success:r,fail:()=>j(Error('未获得隐私授权，可继续单机'))}));await this.api.login();}
 private modal(title:string,content:string,confirmText='确定',cancelText='取消',editable=false,initialValue=''){return new Promise<{confirm:boolean;content?:string}>(resolve=>this.wx.showModal({title,content:editable?initialValue:content,placeholderText:editable?content:undefined,confirmText,cancelText,editable,success:resolve,fail:()=>resolve({confirm:false})}));}
 private toast(message:string){this.wx.showToast({title:message,icon:'none'});}
 private async task(work:()=>Promise<void>){if(this.busy)return;this.busy=true;try{await work();}catch(error){this.toast((error as Error).message);}finally{this.busy=false;}}
 private menu(){this.game.pause();this.panel.show('游戏菜单',[this.me?.best?`我的历史最高：${this.me.best.score}，排名 ${this.me.best.rank}`:'可随时单机挑战，联网异常不影响游戏'],[
  {label:'分享小游戏',run:()=>this.wx.shareAppMessage(this.shareData()),half:true},{label:this.game.audio.muted?'开启音效':'静音',run:()=>{this.game.audio.toggle();this.menu();},half:true},
  {label:'绑定已有网页账号',run:()=>void this.bind()},
  {label:'单机重新挑战',run:()=>{this.offlinePreference=true;this.online=false;this.panel.close();this.game.reset();},half:true},{label:'联网重新挑战',run:()=>{this.offlinePreference=false;this.panel.close();this.game.reset();},half:true},
  {label:'隐私保护说明',run:()=>this.wx.showModal({title:'隐私保护说明',content:privacy,showCancel:false}),half:true},{label:'用户协议',run:()=>this.wx.showModal({title:'用户协议',content:agreement,showCancel:false}),half:true},
  {label:'账号及隐私申诉',run:()=>void this.appeal()}, {label:'关闭菜单',run:()=>this.panel.close()}
 ]);}
 private result(){const g=this.game;this.panel.show(g.state==='victory'?'十关突破成功':'挑战结束',[`本次总分 ${g.score.total}　到达第${g.levels.current.number}关`,`消除 ${g.journal.bricksDestroyed} 块`,this.online?'成绩仍需服务端记录验证':'本轮为单机挑战，不上传成绩'],[
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
  const result=await this.sync.submit();this.me=await this.api.me();this.toast(result.verificationStatus==='verified'?'成绩已登记':'成绩待复核');await this.board();
 });}
 private async board(offset=0){this.game.pause();const pageSize=this.view.height<650?3:5;try{const result=await this.api.request<{items:BestScore[];nextOffset:number|null}>(`/leaderboard?offset=${offset}&limit=${pageSize}`);
  if(this.api.authenticated)this.me=await this.api.me();
  const lines=[this.me?.best?`我的排名 ${this.me.best.rank}　最高分 ${this.me.best.score}`:'个人最高分：暂无已验证记录',...result.items.map(r=>`${r.rank}. ${r.display_name}　${r.score}分　${r.reached_level}关`)];
  this.panel.show('全球历史最高分',lines,[{label:'上一页',run:()=>void this.board(Math.max(0,offset-pageSize)),half:true},{label:'下一页',run:()=>{if(result.nextOffset!==null)void this.board(result.nextOffset);},half:true},{label:'关闭排行榜',run:()=>this.panel.close()}]);
 }catch(error){this.toast((error as Error).message);}}
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
 private shareData(){return {title:this.me?.best?`球了个球：我的最高纪录 ${this.me.best.score} 分，一起突破！`:'球了个球：十关弹球挑战，一起突破！',imageUrl:this.shareImage,query:'source=friend'};}
 private makeShareImage(){const card=this.wx.createCanvas();card.width=500;card.height=400;const c=context(card);c.fillStyle='#081321';c.fillRect(0,0,500,400);c.strokeStyle='#87abc3';c.lineWidth=2;c.beginPath();c.arc(250,190,145,0,Math.PI*2);c.stroke();c.fillStyle='#ff884e';for(let y=90;y<220;y+=18)for(let x=155;x<350;x+=18)if(Math.hypot(x-250,y-190)<130)c.fillRect(x,y,14,14);c.fillStyle='#c8f2ff';c.fillRect(195,310,110,8);c.fillStyle='#fff';c.beginPath();c.arc(245,270,6,0,Math.PI*2);c.fill();c.font='bold 30px sans-serif';c.textAlign='center';c.fillText('球了个球',250,375);card.toTempFilePath?.({success:r=>{this.shareImage=r.tempFilePath;}});}
}
