import {ball,crown,star,cup} from '../../src/online/ranking/Artwork';
import {RankingMotion,RANKING_THEME,rankingCard,personalRanking,motionQuality,type RankingScore,type BoardState} from '../../src/online/ranking/Presentation';
import {inside,type Rect} from './Layout';
export interface RankingView {state:BoardState;items:RankingScore[];best?:RankingScore|null;personalAvailable?:boolean;personalSignedOut?:boolean;error?:string;note?:string;offset:number;nextOffset:number|null}
export interface RankingAction {label:string;run:()=>void;disabled?:boolean}
export function rankingLayout(width:number,top:number,bottom:number){return {body:{x:12,y:top+94,width:width-24,height:Math.max(24,bottom-top-270)},navY:bottom-168,my:{x:12,y:bottom-112,width:width-24,height:102}};}
function rounded(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,fill:string,stroke?:string){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}}
function label(c:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,size:number,color:string,align:CanvasTextAlign='left'){c.textAlign=align;c.font=`${size}px "PingFang SC",sans-serif`;let value=text;const characters=[...text];while(characters.length>1&&c.measureText(value).width>width){characters.pop();value=characters.join('')+'…';}c.fillStyle=color;c.fillText(value,x,y,width);}
/** Native Canvas view: no DOM, timer, network, authentication or score calculations. */
export class RankingCanvas {
 scrollY=0;body:Rect={x:0,y:0,width:0,height:0};hits:{rect:Rect;run:()=>void}[]=[];readonly motion=new RankingMotion();private contentHeight=0;
 constructor(readonly view:RankingView,private actions:RankingAction[],private inspect?:(row:RankingScore)=>void){}
 scroll(dy:number){this.scrollY=Math.max(0,Math.min(Math.max(0,this.contentHeight-this.body.height),this.scrollY-dy));}
 tap(x:number,y:number){this.hits.find(h=>inside(h.rect,x,y))?.run();}
 draw(c:CanvasRenderingContext2D,width:number,top:number,bottom:number,now:number,animate:boolean,lowDevice:boolean){
  this.hits=[];const quality=motionQuality(true,!animate,false,lowDevice||this.motion.low),phase=this.motion.update(now,quality!=='off')/1000;
  const v=rankingLayout(width,top,bottom);this.body=v.body;const x=8,w=width-16;
  rounded(c,x,top,w,bottom-top,22,RANKING_THEME.purple,'#a78bfa');
  const count=quality==='full'?24:6;
  for(let i=0;i<count;i++){const sx=x+14+(i*97)%Math.max(1,w-28),sy=top+12+(i*67)%Math.max(1,bottom-top-24);c.save();c.globalAlpha=.15+(quality==='off'?.12:.18*(1+Math.sin(phase*1.4+i)));star(c,sx,sy,i%3===0?3:1.5,'#d5baff');c.restore();}
  cup(c,35,top+38,36);star(c,width-35,top+58,6,'#ffe8a2');crown(c,width/2,top+18,22);label(c,'全球历史排行榜',width/2,top+49,w-28,23,'#ffecb4','center');label(c,'星际荣誉殿堂 · 全球 TOP100',width/2,top+70,w-28,10,'#bba4e3','center');
  label(c,this.view.note||'每一份荣耀，都来自真实挑战',width/2,top+86,w-28,9,'#baabd7','center');
  c.save();c.beginPath();c.rect(this.body.x,this.body.y,this.body.width,this.body.height);c.clip();
  let y=this.body.y-this.scrollY;
  this.contentHeight=this.view.items.reduce((sum,row)=>sum+(row.rank===1?RANKING_THEME.firstHeight:RANKING_THEME.cardHeight)+10,0);
  if(this.view.state!=='ready'||!this.view.items.length){const message=this.view.state==='loading'?'正在加载排行榜…':this.view.state==='error'?'排行榜暂时无法加载':'暂时还没有上榜成绩';star(c,width/2,this.body.y+42,20,'#ffe3a1');label(c,message,width/2,this.body.y+88,w-48,14,'#e4d6ff','center');label(c,this.view.error||'点击刷新，重新连接星际榜单',width/2,this.body.y+111,w-48,10,'#baa9d5','center');}
  else for(const row of this.view.items){const h=row.rank===1?RANKING_THEME.firstHeight:RANKING_THEME.cardHeight;if(y+h>=this.body.y&&y<=this.body.y+this.body.height){this.card(c,row,this.body.x+2,y,this.body.width-4,h,phase,quality);if(this.inspect){const visible={x:this.body.x,y:Math.max(y,this.body.y),width:this.body.width,height:Math.min(y+h,this.body.y+this.body.height)-Math.max(y,this.body.y)};this.hits.push({rect:visible,run:()=>this.inspect?.(row)});}}y+=h+10;}
  c.restore();
  this.actions.forEach((a,i)=>{const rect={x:12+i*(width-24)/this.actions.length,y:v.navY,width:(width-24)/this.actions.length-5,height:44};rounded(c,rect.x,rect.y,rect.width,rect.height,10,a.disabled?'#35254c':'#6342a2',a.disabled?'#5f4e77':'#c29be8');label(c,a.label,rect.x+rect.width/2,rect.y+27,rect.width-12,11,a.disabled?'#867897':'#f2e7ff','center');if(!a.disabled)this.hits.push({rect,run:a.run});});
  const close={x:width-49,y:top+6,width:40,height:40};label(c,'×',close.x+20,close.y+26,36,25,'#d9c7f2','center');const exit=this.actions.find(a=>a.label==='关闭');if(exit)this.hits.push({rect:close,run:exit.run});
  const me=personalRanking(this.view.best,this.view.personalAvailable!==false,this.view.personalSignedOut);rounded(c,v.my.x,v.my.y,v.my.width,v.my.height,16,'#4b347a','#b78bec');ball(c,v.my.x+31,v.my.y+32,18);
  label(c,me.title,v.my.x+60,v.my.y+24,v.my.width-73,12,'#ffe7a6');
  if(me.card){label(c,`${me.card.score} 分`,v.my.x+60,v.my.y+46,v.my.width-73,17,'#fff0c7');label(c,me.card.name,v.my.x+13,v.my.y+68,v.my.width-26,10,'#e7dcf5');label(c,`${me.card.level}   消除 ${me.card.bricks}   ${me.card.time}`,v.my.x+13,v.my.y+88,v.my.width-26,10,'#bdb1d9');}
  else label(c,me.message,v.my.x+13,v.my.y+76,v.my.width-26,10,'#cbbbe3');
 }
 private card(c:CanvasRenderingContext2D,row:RankingScore,x:number,y:number,w:number,h:number,phase:number,quality:string){const d=rankingCard(row);
  c.save();if(d.honor){c.shadowColor='#ffcb64';c.shadowBlur=quality==='full'?(d.champion?10:4):d.champion?3:0;}rounded(c,x,y,w,h,17,d.champion?RANKING_THEME.champion:d.honor?RANKING_THEME.honor:RANKING_THEME.card,d.honor?RANKING_THEME.borderGold:RANKING_THEME.borderBlue);c.shadowBlur=0;
  if(d.honor){c.save();c.beginPath();c.roundRect(x,y,w,h,17);c.clip();if(quality==='full'){c.globalAlpha=.11;const sweep=(phase%6)/6*(w+100)-100;c.fillStyle='#fff3b3';c.translate(x+sweep,y-h);c.rotate(-.35);c.fillRect(0,0,38,h*3);c.restore();c.save();}c.globalAlpha=quality==='off'?.4:.35+.25*Math.sin(phase*1.5);c.strokeStyle='#fff1b0';c.lineWidth=3;c.beginPath();c.roundRect(x+3,y+3,w-6,h-6,14);c.stroke();c.restore();star(c,x+w-15,y+17,5+(quality==='off'?0:Math.sin(phase*2)*1.5),'#ffe4a0');}
  rounded(c,x+14,y,w*.24,21,7,d.honor?'#ffdf89':'#537bc3');label(c,d.champion?'♛ 冠军':d.rankLabel,x+21,y+15,w*.24-10,10,d.honor?'#704422':'#e4f4ff');
  const centerY=y+(d.champion?61:51);ball(c,x+31,centerY,d.champion?21:18);if(d.champion)crown(c,x+31,centerY-27,19);
  const scoreWidth=w<340?100:125,nameWidth=Math.max(35,w-scoreWidth-85);label(c,d.name,x+62,centerY-1,nameWidth,d.champion?13:12,'#fff2ff');label(c,d.honor?'星际荣耀':'星际挑战者',x+62,centerY+17,nameWidth,9,d.honor?'#edc4e0':'#a7c5ec');
  label(c,'最高总分',x+w-13,y+37,scoreWidth,9,d.honor?'#e0b4d3':'#a8bde4','right');label(c,d.score,x+w-13,y+61,scoreWidth,d.champion?25:22,d.honor?'#ffe7a3':'#b4f1ff','right');
  c.strokeStyle=d.honor?'#a782a4':'#5474a6';c.lineWidth=.6;c.beginPath();c.moveTo(x+12,y+h-48);c.lineTo(x+w-12,y+h-48);c.stroke();
  const stats=[['最高关卡',d.level],['消除砖块',d.bricks],['最佳时间',d.time]];stats.forEach(([title,value],i)=>{const sx=x+13+i*(w-20)/3;label(c,title,sx,y+h-31,(w-30)/3,8,'#bfb0d6');label(c,value,sx,y+h-13,(w-30)/3,11,'#eee9ff');});c.restore();
 }
}
