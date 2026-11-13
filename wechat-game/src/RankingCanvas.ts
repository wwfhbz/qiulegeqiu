import {ball,badge,star} from '../../src/online/ranking/Artwork';
import {RankingMotion,rankingCard,personalRanking,motionQuality,type RankingScore,type BoardState} from '../../src/online/ranking/Presentation';
import {REFERENCE as BASE,rankingFlowGeometry,referenceSeconds} from '../../src/online/ranking/ReferenceLayout';
import type {CanvasSurface} from '../../src/platform/Contracts';
import {inside,type Rect} from './Layout';
export interface RankingView {board?:'global'|'endless';state:BoardState;items:RankingScore[];best?:RankingScore|null;personalAvailable?:boolean;personalSignedOut?:boolean;error?:string;note?:string;offset:number;nextOffset:number|null}
export interface RankingAction {label:string;run:()=>void;disabled?:boolean}
export function rankingLayout(width:number,top:number,bottom:number,items:readonly {rank:number}[]=Array.from({length:20},(_,i)=>({rank:i+1}))){const s=rankingFlowGeometry(width,top,bottom,items),R=s.reference;return {body:{x:s.x+R.body.x*s.scale,y:s.y+R.body.y*s.scale,width:R.body.width*s.scale,height:R.body.height*s.scale},navY:s.y+R.navY*s.scale,my:{x:s.x+R.personal.x*s.scale,y:s.y+R.personal.y*s.scale,width:R.personal.width*s.scale,height:R.personal.height*s.scale},scale:s.scale};}

function rounded(c:CanvasRenderingContext2D,r:Rect,radius:number,fill:string|CanvasGradient,stroke?:string){c.beginPath();c.roundRect(r.x,r.y,r.width,r.height,radius);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}}
function gradient(c:CanvasRenderingContext2D,y:number,h:number,stops:string[]){const g=c.createLinearGradient(0,y,0,y+h);stops.forEach((color,i)=>g?.addColorStop(i/(stops.length-1),color));return g||stops[1];}
function label(c:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,size:number,color:string,align:CanvasTextAlign='center',truncate=false){c.textAlign=align;c.textBaseline='middle';c.font=`900 ${size}px "Microsoft YaHei",sans-serif`;let value=text;const chars=[...text];while(truncate&&chars.length>1&&c.measureText(value).width>width){chars.pop();value=chars.join('')+'…';}c.strokeStyle='#32162d';c.lineWidth=3;c.strokeText(value,x,y,width);c.fillStyle=color;c.fillText(value,x,y,width);}
function wrap(c:CanvasRenderingContext2D,text:string,width:number,size:number){c.font=`500 ${size}px ${'Microsoft YaHei,sans-serif'}`;const lines:string[]=[];let line='';for(const ch of [...text]){if(c.measureText(line+ch).width>width&&line){lines.push(line);line='';}line+=ch;}if(line)lines.push(line);return lines;}
export class RankingCanvas {
 scrollY=0;body:Rect={x:0,y:0,width:0,height:0};hits:{rect:Rect;run:()=>void}[]=[];readonly motion=new RankingMotion();private contentHeight=0;private scale=1;private viewportHeight=0;private surface?:CanvasSurface;private cacheKey='';private cachedArt?:CanvasImageSource;
 constructor(readonly view:RankingView,private actions:RankingAction[],private inspect?:(row:RankingScore)=>void,private cacheFactory?:()=>CanvasSurface){}
 scroll(dy:number){this.scrollY=Math.max(0,Math.min(Math.max(0,this.contentHeight-this.viewportHeight),this.scrollY-dy/this.scale));}
 tap(x:number,y:number){this.hits.find(h=>inside(h.rect,x,y))?.run();}
 draw(c:CanvasRenderingContext2D,width:number,top:number,bottom:number,now:number,animate:boolean,lowDevice:boolean,art?:CanvasImageSource,pixelRatio=1){
  const quality=motionQuality(true,!animate,false,lowDevice||this.motion.low),phase=this.motion.update(now,quality!=='off')/1000;
  if(!this.cacheFactory){this.paint(c,width,top,bottom,phase,quality,art);return;}
  const ratio=lowDevice||this.motion.low?1:Math.min(2,pixelRatio),key=[width,top,bottom,this.scrollY,ratio].join(':');
  if(!this.surface)this.surface=this.cacheFactory();
  if(key!==this.cacheKey||this.cachedArt!==art){this.surface.width=Math.ceil(width*ratio);this.surface.height=Math.ceil((bottom-top)*ratio);const cache=this.surface.getContext('2d')!;cache.setTransform(ratio,0,0,ratio,0,-top*ratio);this.paint(cache,width,top,bottom,0,'off',art);this.cacheKey=key;this.cachedArt=art;}
  c.drawImage(this.surface as CanvasImageSource,0,top,width,bottom-top);
  if(quality==='off'||this.view.state!=='ready')return;
  const stage=rankingFlowGeometry(width,top,bottom,this.view.items),R=stage.reference;c.save();c.translate(stage.x,stage.y);c.scale(stage.scale,stage.scale);c.beginPath();c.rect(R.body.x-5,R.body.y-5,R.body.width+10,R.body.height+10);c.clip();let y=R.body.y-this.scrollY;
  for(const row of this.view.items){const h=stage.rowHeight(row.rank);if(row.rank<=5&&y+h>=R.body.y&&y<=R.body.y+R.body.height){if(quality==='full'){c.save();c.beginPath();c.roundRect(R.body.x,y,R.body.width,h,26);c.clip();c.globalAlpha=.14;c.fillStyle='#fffed2';c.fillRect(R.body.x+(phase%5)/5*(R.body.width+180)-180,y,90,h);c.restore();}c.save();c.globalAlpha=.5+.4*Math.sin(phase*1.5);star(c,R.body.x+R.body.width-5,y+h,17,'#fff9d2');c.restore();}y+=h+6/stage.scale;}
  c.restore();
 }
 private paint(c:CanvasRenderingContext2D,width:number,top:number,bottom:number,phase:number,quality:string,art?:CanvasImageSource){
  this.hits=[];const s=rankingFlowGeometry(width,top,bottom,this.view.items),R=s.reference,u=1/s.scale;this.scale=s.scale;this.viewportHeight=R.body.height;this.body=rankingLayout(width,top,bottom,this.view.items).body;
  const screen=(r:Rect):Rect=>({x:s.x+r.x*s.scale,y:s.y+r.y*s.scale,width:r.width*s.scale,height:r.height*s.scale});
  c.fillStyle='#020628';c.fillRect(0,top,width,bottom-top);c.save();c.translate(s.x,s.y);c.scale(s.scale,s.scale);
  rounded(c,{x:0,y:0,width:R.width,height:R.height},28/s.scale,'#101b43','#e2bc76');if(art){const source=art as unknown as {width?:number;height?:number};c.drawImage(art,0,0,source.width||1105,(source.height||1424)*.18,0,0,R.width,s.headerPixels/s.scale);}else{label(c,'球球出击',600,55,700,62,'#b2edff');label(c,this.view.board==='endless'?'无尽模式排行榜':'全球历史排行榜',600,145,930,70,'#fff382');}
  rounded(c,R.header,28,gradient(c,R.header.y,R.header.height,['#302665','#141b4f']),'#5f53b1');let column=R.header.x;
  R.labels.forEach((text,i)=>{const w=BASE.columns[i]*R.header.width;label(c,i===3&&this.view.board==='endless'?'最高阶段':text,column+w/2,R.header.y+R.header.height/2,w-8,Math.max(28,9/s.scale),'#c8d6ff');column+=w;});
  c.save();c.beginPath();c.rect(R.body.x-5,R.body.y-5,R.body.width+10,R.body.height+10);c.clip();let y=R.body.y-this.scrollY;
  this.contentHeight=this.view.items.reduce((sum,row)=>sum+s.rowHeight(row.rank)+6/s.scale,0);
  if(this.view.state!=='ready'||!this.view.items.length){
   const message=this.view.state==='loading'?'正在加载排行榜…':this.view.state==='error'?'排行榜暂时无法加载':'暂时还没有上榜成绩';
   const lines=wrap(c,this.view.error||'完成真实挑战，或点击刷新重新读取',R.body.width-24*u,11*u);this.contentHeight=Math.max(R.body.height,(lines.length*18+62)*u);
   label(c,message,R.body.x+12*u,y+30*u,R.body.width-24*u,14*u,'#fff0ac','left');lines.forEach((line,i)=>label(c,line,R.body.x+12*u,y+(58+i*18)*u,R.body.width-24*u,11*u,'#c6c5ed','left'));
  }

  else for(const row of this.view.items){const h=s.rowHeight(row.rank);if(y+h>=R.body.y&&y<=R.body.y+R.body.height){this.row(c,row,{x:R.body.x,y,width:R.body.width,height:h},phase,quality);if(this.inspect){const visible={x:R.body.x,y:Math.max(y,R.body.y),width:R.body.width,height:Math.min(y+h,R.body.y+R.body.height)-Math.max(y,R.body.y)};this.hits.push({rect:screen(visible),run:()=>this.inspect?.(row)});}}y+=h+6/s.scale;}
  c.restore();
  const my=R.personal,me=personalRanking(this.view.best,this.view.personalAvailable!==false,this.view.personalSignedOut);
  rounded(c,my,14*u,gradient(c,my.y,my.height,['#553783','#37255f']),'#a78acb');ball(c,my.x+18*u,my.y+24*u,12*u);
  label(c,me.title,my.x+40*u,my.y+16*u,my.width-50*u,12*u,'#ffe6ac','left');
  if(this.view.best){const d=rankingCard(this.view.best,this.view.board==='endless');label(c,d.name,my.x+40*u,my.y+33*u,my.width-50*u,11*u,'#d8c5ef','left',true);const values=[d.score,d.level,d.bricks,referenceSeconds(this.view.best.duration_ms)];values.forEach((value,i)=>{const w=my.width/4,x=my.x+w*i+6*u;label(c,R.labels[i+2],x,my.y+53*u,w-10*u,9*u,'#b9add2','left');label(c,value,x,my.y+73*u,w-10*u,(width<450?10:12)*u,'#fff0bd','left');});}
  else label(c,me.message,my.x+8*u,my.y+65*u,my.width-16*u,11*u,'#d1c1e5','left');
  const navWidth=R.width-24*u,navX=12*u,nav=this.actions.filter(a=>a.label!=='关闭'),slots=Math.max(3,nav.length);nav.forEach((a,i)=>{const rect={x:navX+i*navWidth/slots,y:R.navY,width:navWidth/slots-8*u,height:44*u};rounded(c,rect,12,a.disabled?'#192253':'#263c85','#7792e5');label(c,a.label,rect.x+rect.width/2,rect.y+22*u,rect.width-12*u,12*u,a.disabled?'#6f75a0':'#e7f0ff');if(!a.disabled){const hit=screen(rect);hit.y-=Math.max(0,(44-hit.height)/2);hit.height=Math.max(44,hit.height);this.hits.push({rect:hit,run:a.run});}});
  const exit=this.actions.find(a=>a.label==='关闭');if(exit){const cx=R.width-23*u,cy=23*u;c.beginPath();c.arc(cx,cy,18*u,0,Math.PI*2);c.fillStyle='#344b8b';c.fill();c.lineWidth=1.5*u;c.strokeStyle='#c6d9ff';c.stroke();label(c,'×',cx,cy,34*u,28*u,'#e8fcff');this.hits.push({rect:screen({x:cx-22*u,y:cy-22*u,width:44*u,height:44*u}),run:exit.run});}
  c.restore();
 }
 private row(c:CanvasRenderingContext2D,row:RankingScore,r:Rect,phase:number,quality:string){const d=rankingCard(row,this.view.board==='endless'),u=1/this.scale;c.save();c.shadowColor='#ffd520';c.shadowBlur=d.honor?2:0;
  const fill=d.honor?gradient(c,r.y,r.height,['#ffc56f','#bb4c1c','#a34321','#ffdf59']):gradient(c,r.y,r.height,['#285a95','#143466','#214c82']);rounded(c,r,26,fill,d.honor?'#fff5a2':'#4e99d4');c.shadowBlur=0;
  if(d.honor&&quality==='full'){c.save();c.beginPath();c.roundRect(r.x,r.y,r.width,r.height,26);c.clip();c.globalAlpha=.08;c.fillStyle='#fffcca';const sx=r.x+((phase%5)/5)*(r.width+180)-180;c.fillRect(sx,r.y,100,r.height);c.restore();}
  let x=r.x;const centers=BASE.columns.map(part=>{const w=r.width*part,center=x+w/2;x+=w;return center;});badge(c,d.rank,centers[0],r.y+r.height/2,135,d.honor?88:68);
  const identityX=r.x+r.width*BASE.columns[0];ball(c,identityX+40,r.y+r.height/2,d.honor?34:30);label(c,d.name,identityX+83,r.y+r.height/2,r.width*BASE.columns[1]-90,Math.max(30,10*u),'#fff5e6','left',true);
  label(c,d.score,centers[2],r.y+r.height/2,r.width*BASE.columns[2]-10,d.honor?Math.max(44,13*u):Math.max(36,12*u),d.honor?'#fff37d':'#f0f6ff');label(c,d.level,centers[3],r.y+r.height/2,r.width*BASE.columns[3]-8,Math.max(34,10*u),'#fff6e5');label(c,d.bricks,centers[4],r.y+r.height/2,r.width*BASE.columns[4]-8,Math.max(34,10*u),'#fff6e5');label(c,referenceSeconds(row.duration_ms),centers[5],r.y+r.height/2,r.width*BASE.columns[5]-12,Math.max(34,10*u),'#fff6e5');
  if(d.honor){const amount=quality==='full'?3:1;for(let i=0;i<amount;i++)star(c,i===0?r.x+5:i===1?r.x+r.width-5:r.x+r.width*.55,r.y+(i===1?r.height:1),i===2?6:10,quality==='off'?'#fff3a9':Math.sin(phase*1.5+i)>0?'#fff9d2':'#ffe48b');}c.restore();
 }
}
