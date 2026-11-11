import {ball,badge,star} from '../../src/online/ranking/Artwork';
import {RankingMotion,rankingCard,personalRanking,motionQuality,type RankingScore,type BoardState} from '../../src/online/ranking/Presentation';
import {REFERENCE as R,referenceRowHeight,referenceStage,referenceSeconds} from '../../src/online/ranking/ReferenceLayout';
import type {CanvasSurface} from '../../src/platform/Contracts';
import {inside,type Rect} from './Layout';
export interface RankingView {state:BoardState;items:RankingScore[];best?:RankingScore|null;personalAvailable?:boolean;personalSignedOut?:boolean;error?:string;note?:string;offset:number;nextOffset:number|null}
export interface RankingAction {label:string;run:()=>void;disabled?:boolean}
export function rankingLayout(width:number,top:number,bottom:number){const s=referenceStage(width,top,bottom);return {body:{x:s.x+R.body.x*s.scale,y:s.y+R.body.y*s.scale,width:R.body.width*s.scale,height:R.body.height*s.scale},navY:s.y+R.navY*s.scale,my:{x:s.x+R.personal.x*s.scale,y:s.y+R.personal.y*s.scale,width:R.personal.width*s.scale,height:R.personal.height*s.scale},scale:s.scale};}
function rounded(c:CanvasRenderingContext2D,r:Rect,radius:number,fill:string|CanvasGradient,stroke?:string){c.beginPath();c.roundRect(r.x,r.y,r.width,r.height,radius);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}}
function gradient(c:CanvasRenderingContext2D,y:number,h:number,stops:string[]){const g=c.createLinearGradient(0,y,0,y+h);stops.forEach((color,i)=>g?.addColorStop(i/(stops.length-1),color));return g||stops[1];}
function label(c:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,size:number,color:string,align:CanvasTextAlign='center',truncate=false){c.textAlign=align;c.textBaseline='middle';c.font=`900 ${size}px "Microsoft YaHei",sans-serif`;let value=text;const chars=[...text];while(truncate&&chars.length>1&&c.measureText(value).width>width){chars.pop();value=chars.join('')+'…';}c.strokeStyle='#32162d';c.lineWidth=3;c.strokeText(value,x,y,width);c.fillStyle=color;c.fillText(value,x,y,width);}
export class RankingCanvas {
 scrollY=0;body:Rect={x:0,y:0,width:0,height:0};hits:{rect:Rect;run:()=>void}[]=[];readonly motion=new RankingMotion();private contentHeight=0;private scale=1;private surface?:CanvasSurface;private cacheKey='';private cachedArt?:CanvasImageSource;
 constructor(readonly view:RankingView,private actions:RankingAction[],private inspect?:(row:RankingScore)=>void,private cacheFactory?:()=>CanvasSurface){}
 scroll(dy:number){this.scrollY=Math.max(0,Math.min(Math.max(0,this.contentHeight-R.body.height),this.scrollY-dy/this.scale));}
 tap(x:number,y:number){this.hits.find(h=>inside(h.rect,x,y))?.run();}
 draw(c:CanvasRenderingContext2D,width:number,top:number,bottom:number,now:number,animate:boolean,lowDevice:boolean,art?:CanvasImageSource,pixelRatio=1){
  const quality=motionQuality(true,!animate,false,lowDevice||this.motion.low),phase=this.motion.update(now,quality!=='off')/1000;
  if(!this.cacheFactory){this.paint(c,width,top,bottom,phase,quality,art);return;}
  const ratio=lowDevice||this.motion.low?1:Math.min(2,pixelRatio),key=[width,top,bottom,this.scrollY,ratio].join(':');
  if(!this.surface)this.surface=this.cacheFactory();
  if(key!==this.cacheKey||this.cachedArt!==art){this.surface.width=Math.ceil(width*ratio);this.surface.height=Math.ceil((bottom-top)*ratio);const cache=this.surface.getContext('2d')!;cache.setTransform(ratio,0,0,ratio,0,-top*ratio);this.paint(cache,width,top,bottom,0,'off',art);this.cacheKey=key;this.cachedArt=art;}
  c.drawImage(this.surface as CanvasImageSource,0,top,width,bottom-top);
  if(quality==='off'||this.view.state!=='ready')return;
  const stage=referenceStage(width,top,bottom);c.save();c.translate(stage.x,stage.y);c.scale(stage.scale,stage.scale);c.beginPath();c.rect(R.body.x-5,R.body.y-5,R.body.width+10,R.body.height+10);c.clip();let y=R.body.y-this.scrollY;
  for(const row of this.view.items){const h=referenceRowHeight(row.rank);if(row.rank<=5&&y+h>=R.body.y&&y<=R.body.y+R.body.height){if(quality==='full'){c.save();c.beginPath();c.roundRect(R.body.x,y,R.body.width,h,26);c.clip();c.globalAlpha=.14;c.fillStyle='#fffed2';c.fillRect(R.body.x+(phase%5)/5*(R.body.width+180)-180,y,90,h);c.restore();}c.save();c.globalAlpha=.5+.4*Math.sin(phase*1.5);star(c,R.body.x+R.body.width-5,y+h,17,'#fff9d2');c.restore();}y+=h+6;}
  c.restore();
 }
 private paint(c:CanvasRenderingContext2D,width:number,top:number,bottom:number,phase:number,quality:string,art?:CanvasImageSource){
  this.hits=[];const s=referenceStage(width,top,bottom);this.scale=s.scale;this.body=rankingLayout(width,top,bottom).body;
  const screen=(r:Rect):Rect=>({x:s.x+r.x*s.scale,y:s.y+r.y*s.scale,width:r.width*s.scale,height:r.height*s.scale});
  c.fillStyle='#020628';c.fillRect(0,top,width,bottom-top);c.save();c.translate(s.x,s.y);c.scale(s.scale,s.scale);
  if(art)c.drawImage(art,0,0,R.width,R.artHeight);else{rounded(c,{x:42,y:164,width:1116,height:1030},58,'#051248','#ffd253');label(c,'球球出击',600,55,700,62,'#b2edff');label(c,'全球历史排行榜',600,145,930,70,'#fff382');}
  rounded(c,R.header,28,gradient(c,R.header.y,R.header.height,['#302665','#141b4f']),'#5f53b1');let column=R.header.x;
  R.labels.forEach((text,i)=>{const w=R.columns[i]*R.header.width;label(c,text,column+w/2,R.header.y+28,w-8,28,'#c8d6ff');column+=w;});
  c.save();c.beginPath();c.rect(R.body.x-5,R.body.y-5,R.body.width+10,R.body.height+10);c.clip();let y=R.body.y-this.scrollY;
  this.contentHeight=this.view.items.reduce((sum,row)=>sum+referenceRowHeight(row.rank)+6,0);
  if(this.view.state!=='ready'||!this.view.items.length){const message=this.view.state==='loading'?'正在加载排行榜…':this.view.state==='error'?'排行榜暂时无法加载':'暂时还没有上榜成绩';star(c,600,530,35,'#ffe3a1');label(c,message,600,630,950,38,'#fff0ac');label(c,this.view.error||'点击刷新，重新连接排行榜',600,695,960,25,'#c6c5ed');}
  else for(const row of this.view.items){const h=referenceRowHeight(row.rank);if(y+h>=R.body.y&&y<=R.body.y+R.body.height){this.row(c,row,{x:R.body.x,y,width:R.body.width,height:h},phase,quality);if(this.inspect){const visible={x:R.body.x,y:Math.max(y,R.body.y),width:R.body.width,height:Math.min(y+h,R.body.y+R.body.height)-Math.max(y,R.body.y)};this.hits.push({rect:screen(visible),run:()=>this.inspect?.(row)});}}y+=h+6;}
  c.restore();
  const my=R.personal,me=personalRanking(this.view.best,this.view.personalAvailable!==false,this.view.personalSignedOut);
  c.save();c.shadowColor='#ffdb40';c.shadowBlur=10;rounded(c,my,34,gradient(c,my.y,my.height,['#b546eb','#50199d','#8134d0']),'#fff392');c.shadowBlur=0;label(c,'我的排名',my.x+85,my.y+26,162,30,'#fff3e1');
  if(this.view.best){const d=rankingCard(this.view.best);badge(c,d.rank,my.x+85,my.y+82,142,80);ball(c,my.x+220,my.y+63,42);label(c,d.name,my.x+300,my.y+64,185,31,'#fff0ff','left',true);const values=[d.score,d.level,d.bricks,referenceSeconds(this.view.best.duration_ms)];let x=my.x+475;values.forEach((value,i)=>{const w=(my.width-480)/4;label(c,R.labels[i+2],x+w/2,my.y+37,w-4,26,'#ead6ff');label(c,value,x+w/2,my.y+83,w-4,35,'#ffed80');x+=w;});}
  else{ball(c,my.x+220,my.y+63,42);label(c,me.title,my.x+600,my.y+45,680,34,'#ffe7a6');label(c,me.message,my.x+600,my.y+86,680,26,'#d9c8f4');}
  c.restore();
  const navWidth=520,navX=(R.width-navWidth)/2;this.actions.filter(a=>a.label!=='关闭').forEach((a,i)=>{const rect={x:navX+i*navWidth/3,y:R.navY,width:navWidth/3-12,height:50};rounded(c,rect,12,a.disabled?'#192253':'#263c85','#7792e5');label(c,a.label,rect.x+rect.width/2,rect.y+26,rect.width-12,26,a.disabled?'#6f75a0':'#e7f0ff');if(!a.disabled){const hit=screen(rect);hit.y-=Math.max(0,(44-hit.height)/2);hit.height=Math.max(44,hit.height);this.hits.push({rect:hit,run:a.run});}});
  const exit=this.actions.find(a=>a.label==='关闭');if(exit){c.beginPath();c.arc(1144,56,36,0,Math.PI*2);c.fillStyle=gradient(c,20,72,['#6372da','#202b78']);c.fill();c.lineWidth=3;c.strokeStyle='#d2e4ff';c.stroke();label(c,'×',1144,58,60,62,'#e8fcff');const hit=screen({x:1105,y:16,width:78,height:80});hit.width=Math.max(44,hit.width);hit.height=Math.max(44,hit.height);this.hits.push({rect:hit,run:exit.run});}
  c.restore();
 }
 private row(c:CanvasRenderingContext2D,row:RankingScore,r:Rect,phase:number,quality:string){const d=rankingCard(row);c.save();c.shadowColor='#ffd520';c.shadowBlur=d.honor?8:0;
  const fill=d.honor?gradient(c,r.y,r.height,['#ffc56f','#bb4c1c','#a34321','#ffdf59']):gradient(c,r.y,r.height,['#285a95','#143466','#214c82']);rounded(c,r,26,fill,d.honor?'#fff5a2':'#4e99d4');c.shadowBlur=0;
  if(d.honor&&quality==='full'){c.save();c.beginPath();c.roundRect(r.x,r.y,r.width,r.height,26);c.clip();c.globalAlpha=.16;c.fillStyle='#fffcca';const sx=r.x+((phase%5)/5)*(r.width+180)-180;c.fillRect(sx,r.y,100,r.height);c.restore();}
  let x=r.x;const centers=R.columns.map(part=>{const w=r.width*part,center=x+w/2;x+=w;return center;});badge(c,d.rank,centers[0],r.y+r.height/2,135,d.honor?88:68);
  const identityX=r.x+r.width*R.columns[0];ball(c,identityX+40,r.y+r.height/2,d.honor?34:30);label(c,d.name,identityX+83,r.y+r.height/2,r.width*R.columns[1]-90,32,'#fff5e6','left',true);
  label(c,d.score,centers[2],r.y+r.height/2,r.width*R.columns[2]-10,d.honor?44:36,d.honor?'#fff37d':'#f0f6ff');label(c,d.level,centers[3],r.y+r.height/2,r.width*R.columns[3]-8,34,'#fff6e5');label(c,d.bricks,centers[4],r.y+r.height/2,r.width*R.columns[4]-8,34,'#fff6e5');label(c,referenceSeconds(row.duration_ms),centers[5],r.y+r.height/2,r.width*R.columns[5]-12,34,'#fff6e5');
  if(d.honor){const amount=quality==='full'?3:1;for(let i=0;i<amount;i++)star(c,i===0?r.x+5:i===1?r.x+r.width-5:r.x+r.width*.55,r.y+(i===1?r.height:1),i===2?9:17,quality==='off'?'#fff3a9':Math.sin(phase*1.5+i)>0?'#fff9d2':'#ffe48b');}c.restore();
 }
}
