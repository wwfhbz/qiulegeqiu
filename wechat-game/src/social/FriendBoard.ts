import {OCEAN} from '../../../shared/VisualTheme';
import {canvasText,neonButton} from '../../../shared/CanvasUI';
import type {CanvasSurface} from '../../../src/platform/Contracts';
import type {Wx,OpenContext} from '../Platform';
import {inside,type Rect} from '../Layout';
import type {SocialMode} from './Protocol';
export class FriendBoard {
 body:Rect={x:0,y:0,width:0,height:0};private hits:{rect:Rect;run:()=>void}[]=[];private open?:OpenContext;private key='';private active=true;
 constructor(private wx:Wx,readonly mode:SocialMode,private actions:{global:()=>void;change:()=>void;close:()=>void;invite:()=>void;retry:()=>void;status:()=>string;permissions:()=>void}){try{this.open=wx.getOpenDataContext?.();}catch{/* Unsupported/denied capability remains a usable empty shell. */}}
 private send(message:Record<string,unknown>){try{this.open?.postMessage(message);}catch{this.open=undefined;this.key='';}}
 hide(){this.active=false;this.send({type:'hide'});}
 resume(){this.active=true;this.key='';}
 scroll(dy:number,x:number,y:number){if(this.active&&inside(this.body,x,y))this.send({type:'scroll',dy});}
 tap(x:number,y:number){this.hits.find(h=>inside(h.rect,x,y))?.run();}
 draw(c:CanvasRenderingContext2D,width:number,top:number,bottom:number,ratio=1){if(!this.active)return;this.hits=[];c.fillStyle=OCEAN.colors.background;c.fillRect(0,top,width,bottom-top);canvasText(c,'好友排行榜 · '+(this.mode==='campaign'?'闯关':'无尽'),16,top+22,width-76,18,OCEAN.colors.gold);canvasText(c,'微信托管展示 · 正式成绩以全球榜为准',16,top+40,width-32,9,OCEAN.colors.muted);
  const button=(r:Rect,label:string,run:()=>void,selected=false)=>{neonButton(c,r,selected?'gold':'cyan',10);canvasText(c,label,r.x+r.width/2,r.y+r.height/2,r.width-8,12,selected?OCEAN.colors.gold:OCEAN.colors.text,'center');this.hits.push({rect:r,run});};
  button({x:12,y:top+48,width:90,height:44},'全球榜',this.actions.global);button({x:110,y:top+48,width:90,height:44},'好友榜',()=>{},true);button({x:width-56,y:top,width:44,height:44},'关闭',this.actions.close);
  this.body={x:8,y:top+100,width:width-16,height:Math.max(60,bottom-top-178)};const key=[width,top,bottom,ratio].join(':');if(this.open&&key!==this.key){this.key=key;try{this.open.canvas.width=Math.ceil(this.body.width*ratio);this.open.canvas.height=Math.ceil(this.body.height*ratio);this.send({type:'show',mode:this.mode,width:this.body.width,height:this.body.height,ratio});}catch{this.open=undefined;}}
  if(this.open){try{c.drawImage(this.open.canvas as unknown as CanvasSurface as CanvasImageSource,this.body.x,this.body.y,this.body.width,this.body.height);}catch{this.open=undefined;}}if(!this.open){canvasText(c,'当前微信环境暂不支持好友榜',16,this.body.y+32,width-32,14);canvasText(c,'可继续查看全球榜和单机游玩',16,this.body.y+58,width-32,11,OCEAN.colors.muted);}
  canvasText(c,this.actions.status(),12,bottom-70,width-24,9,OCEAN.colors.muted);
  const y=bottom-60,w=(width-40)/4;button({x:8,y,width:w,height:44},'邀请好友',this.actions.invite);button({x:16+w,y,width:w,height:44},'刷新',()=>{this.send({type:'refresh'});this.actions.retry();});button({x:24+w*2,y,width:w,height:44},this.mode==='campaign'?'无尽好友榜':'闯关好友榜',this.actions.change);button({x:32+w*3,y,width:w,height:44},'授权设置',this.actions.permissions);
 }
}
