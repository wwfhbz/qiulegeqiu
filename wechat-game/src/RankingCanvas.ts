import {ball,badge} from '../../src/online/ranking/Artwork';
import {OCEAN,rankColor} from '../../shared/VisualTheme';
import {panel,canvasText} from '../../shared/CanvasUI';
import {RankingMotion,rankingCard,personalRanking,motionQuality,type RankingScore,type BoardState} from '../../src/online/ranking/Presentation';
import {REFERENCE as BASE,rankingFlowGeometry,referenceSeconds} from '../../src/online/ranking/ReferenceLayout';
import type {CanvasSurface} from '../../src/platform/Contracts';
import {inside,type Rect} from './Layout';
export interface RankingView {state:BoardState;items:RankingScore[];best?:RankingScore|null;personalAvailable?:boolean;personalSignedOut?:boolean;error?:string;note?:string;offset:number;nextOffset:number|null}
export interface RankingAction {label:string;run:()=>void;disabled?:boolean}
export function rankingLayout(width:number,top:number,bottom:number,items:readonly {rank:number}[]=Array.from({length:20},(_,i)=>({rank:i+1}))){const s=rankingFlowGeometry(width,top,bottom,items),R=s.reference;return {body:{x:s.x+R.body.x*s.scale,y:s.y+R.body.y*s.scale,width:R.body.width*s.scale,height:R.body.height*s.scale},navY:s.y+R.navY*s.scale,my:{x:s.x+R.personal.x*s.scale,y:s.y+R.personal.y*s.scale,width:R.personal.width*s.scale,height:R.personal.height*s.scale},scale:s.scale};}
function label(c:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,size:number,color:string=OCEAN.colors.text,align:CanvasTextAlign='center',truncate=false){
 let value=text;c.font=`500 ${size}px ${OCEAN.fonts.body}`;if(truncate){const chars=[...text];while(chars.length>1&&c.measureText(value).width>width){chars.pop();value=chars.join('')+'…';}}canvasText(c,value,x,y,width,size,color,align);
}
function wrap(c:CanvasRenderingContext2D,text:string,width:number,size:number){c.font=`500 ${size}px ${OCEAN.fonts.body}`;const lines:string[]=[];let line='';for(const ch of [...text]){if(c.measureText(line+ch).width>width&&line){lines.push(line);line='';}line+=ch;}if(line)lines.push(line);return lines;}
export class RankingCanvas {
 scrollY=0;body:Rect={x:0,y:0,width:0,height:0};hits:{rect:Rect;run:()=>void}[]=[];readonly motion=new RankingMotion();
 private contentHeight=0;private scale=1;private viewportHeight=0;private surface?:CanvasSurface;private cacheKey='';private cachedArt?:CanvasImageSource;private accents:{x:number;y:number;width:number;color:string}[]=[];
 constructor(readonly view:RankingView,private actions:RankingAction[],private inspect?:(row:RankingScore)=>void,private cacheFactory?:()=>CanvasSurface){}
 scroll(dy:number){this.scrollY=Math.max(0,Math.min(Math.max(0,this.contentHeight-this.viewportHeight),this.scrollY-dy/this.scale));}
 tap(x:number,y:number){this.hits.find(h=>inside(h.rect,x,y))?.run();}
 draw(c:CanvasRenderingContext2D,width:number,top:number,bottom:number,now:number,animate:boolean,lowDevice:boolean,art?:CanvasImageSource,pixelRatio=1){
  const quality=motionQuality(true,!animate,false,lowDevice||this.motion.low),phase=this.motion.update(now,quality!=='off')/1000;
  if(!this.cacheFactory)this.paint(c,width,top,bottom);
  else{
   const ratio=lowDevice||this.motion.low?1:Math.min(2,pixelRatio),key=[width,top,bottom,this.scrollY,ratio].join(':');
   if(!this.surface)this.surface=this.cacheFactory();
   if(key!==this.cacheKey||this.cachedArt!==art){this.surface.width=Math.ceil(width*ratio);this.surface.height=Math.ceil((bottom-top)*ratio);const cache=this.surface.getContext('2d')!;cache.setTransform(ratio,0,0,ratio,0,-top*ratio);this.paint(cache,width,top,bottom);this.cacheKey=key;this.cachedArt=art;}
   c.drawImage(this.surface as CanvasImageSource,0,top,width,bottom-top);
  }
  // Only three tiny static-edge highlights breathe; no stars, glow or scrolling overlay.
  if(quality==='full'&&this.view.state==='ready'){c.save();c.beginPath();c.rect(this.body.x,this.body.y,this.body.width,this.body.height);c.clip();c.globalAlpha=.06+.025*Math.sin(phase*.6);c.lineWidth=1;for(const edge of this.accents){c.strokeStyle=edge.color;c.beginPath();c.moveTo(edge.x,edge.y);c.lineTo(edge.x+edge.width,edge.y);c.stroke();}c.restore();}
 }
 private paint(c:CanvasRenderingContext2D,width:number,top:number,bottom:number){
  this.hits=[];this.accents=[];const s=rankingFlowGeometry(width,top,bottom,this.view.items),R=s.reference,u=1/s.scale;
  this.scale=s.scale;this.viewportHeight=R.body.height;this.body=rankingLayout(width,top,bottom,this.view.items).body;
  const screen=(r:Rect):Rect=>({x:s.x+r.x*s.scale,y:s.y+r.y*s.scale,width:r.width*s.scale,height:r.height*s.scale});
  c.fillStyle=OCEAN.colors.background;c.fillRect(0,top,width,bottom-top);c.save();c.translate(s.x,s.y);c.scale(s.scale,s.scale);
  panel(c,{x:0,y:0,width:R.width,height:R.height},OCEAN.colors.background,OCEAN.colors.border,14*u);
  label(c,'球球出击 · 挑战记录',16*u,19*u,R.width-64*u,10*u,OCEAN.colors.muted,'left');label(c,'全球历史排行榜',16*u,42*u,R.width-64*u,18*u,OCEAN.colors.text,'left');
  panel(c,R.header,OCEAN.colors.arena,undefined,6*u);
  if(width<480){label(c,'排名',R.header.x+15*u,R.header.y+R.header.height/2,34*u,9*u,OCEAN.colors.muted);label(c,'玩家 / 地区',R.header.x+42*u,R.header.y+R.header.height/2,R.header.width-126*u,9*u,OCEAN.colors.muted,'left');label(c,'最高总分',R.header.x+R.header.width-8*u,R.header.y+R.header.height/2,78*u,9*u,OCEAN.colors.muted,'right');}
  else{let x=R.header.x;R.labels.forEach((text,i)=>{const w=BASE.columns[i]*R.header.width;label(c,text,x+w/2,R.header.y+R.header.height/2,w-8,10*u,OCEAN.colors.muted);x+=w;});}
  c.save();c.beginPath();c.rect(R.body.x,R.body.y,R.body.width,R.body.height);c.clip();let y=R.body.y-this.scrollY;
  this.contentHeight=Math.max(0,this.view.items.reduce((sum,row)=>sum+s.rowHeight(row.rank)+6*u,0)-6*u);
  if(this.view.state!=='ready'||!this.view.items.length){
   const message=this.view.state==='loading'?'正在加载排行榜…':this.view.state==='error'?'排行榜暂时无法加载':'暂时还没有上榜成绩';
   const lines=wrap(c,this.view.error||'完成真实挑战，或点击刷新重新读取',R.body.width-24*u,11*u);this.contentHeight=Math.max(R.body.height,(lines.length*18+62)*u);
   label(c,message,R.body.x+12*u,y+30*u,R.body.width-24*u,14*u,OCEAN.colors.text,'left');lines.forEach((line,i)=>label(c,line,R.body.x+12*u,y+(58+i*18)*u,R.body.width-24*u,11*u,OCEAN.colors.secondary,'left'));
  }else for(const row of this.view.items){const h=s.rowHeight(row.rank);if(y+h>=R.body.y&&y<=R.body.y+R.body.height){const rect={x:R.body.x,y,width:R.body.width,height:h};this.row(c,row,rect,width<480);if(row.rank<=3){const edge=screen({x:rect.x+10*u,y:rect.y+1*u,width:rect.width-20*u,height:0});this.accents.push({...edge,color:rankColor(row.rank)});}if(this.inspect){const visible={x:rect.x,y:Math.max(y,R.body.y),width:rect.width,height:Math.min(y+h,R.body.y+R.body.height)-Math.max(y,R.body.y)};this.hits.push({rect:screen(visible),run:()=>this.inspect?.(row)});}}y+=h+6*u;}
  c.restore();
  const my=R.personal,me=personalRanking(this.view.best,this.view.personalAvailable!==false,this.view.personalSignedOut);
  panel(c,my,OCEAN.rank.mine,OCEAN.colors.border,10*u);ball(c,my.x+19*u,my.y+25*u,12*u);label(c,me.title,my.x+40*u,my.y+16*u,my.width-50*u,12*u,OCEAN.colors.text,'left');
  if(this.view.best){const d=rankingCard(this.view.best);label(c,d.name,my.x+40*u,my.y+33*u,my.width-50*u,11*u,OCEAN.colors.secondary,'left',true);[d.score,d.level,d.bricks,referenceSeconds(this.view.best.duration_ms)].forEach((value,i)=>{const w=my.width/4,x=my.x+w*i+6*u;label(c,R.labels[i+2],x,my.y+53*u,w-10*u,8*u,OCEAN.colors.muted,'left');label(c,value,x,my.y+73*u,w-10*u,10*u,OCEAN.colors.number,'left');});}
  else label(c,me.message,my.x+8*u,my.y+65*u,my.width-16*u,11*u,OCEAN.colors.secondary,'left');
  const navWidth=R.width-24*u,navX=12*u;this.actions.filter(a=>a.label!=='关闭').forEach((a,i)=>{const rect={x:navX+i*navWidth/3,y:R.navY,width:navWidth/3-8*u,height:44*u};panel(c,rect,OCEAN.colors.panel,OCEAN.colors.border,8*u);label(c,a.label,rect.x+rect.width/2,rect.y+22*u,rect.width-12*u,12*u,a.disabled?OCEAN.colors.muted:OCEAN.colors.text);if(!a.disabled)this.hits.push({rect:screen(rect),run:a.run});});
  const exit=this.actions.find(a=>a.label==='关闭');if(exit){const rect={x:R.width-48*u,y:8*u,width:40*u,height:44*u};label(c,'×',rect.x+20*u,rect.y+20*u,32*u,24*u,OCEAN.colors.secondary);this.hits.push({rect:screen(rect),run:exit.run});}
  c.restore();
 }
 private row(c:CanvasRenderingContext2D,row:RankingScore,r:Rect,mobile:boolean){const d=rankingCard(row),u=1/this.scale;
  panel(c,r,d.honor?OCEAN.colors.panel:OCEAN.colors.arena,d.honor?rankColor(row.rank):OCEAN.colors.line,10*u);
  if(mobile){badge(c,row.rank,r.x+17*u,r.y+r.height/2,30*u,30*u);ball(c,r.x+47*u,r.y+20*u,11*u);label(c,d.name,r.x+64*u,r.y+20*u,r.width-150*u,12*u,OCEAN.colors.text,'left',true);label(c,d.score,r.x+r.width-8*u,r.y+20*u,80*u,14*u,row.rank===1?OCEAN.rank.gold:OCEAN.colors.number,'right');const w=(r.width-44*u)/3;[d.level,'砖块 '+d.bricks,referenceSeconds(row.duration_ms)].forEach((value,i)=>label(c,value,r.x+42*u+w*i,r.y+50*u,w-5*u,10*u,OCEAN.colors.secondary,'left'));return;}
  let x=r.x;const centers=BASE.columns.map(part=>{const w=r.width*part,center=x+w/2;x+=w;return center;});badge(c,row.rank,centers[0],r.y+r.height/2,34*u,34*u);
  const identityX=r.x+r.width*BASE.columns[0];ball(c,identityX+14*u,r.y+r.height/2,12*u);label(c,d.name,identityX+32*u,r.y+r.height/2,r.width*BASE.columns[1]-36*u,13*u,OCEAN.colors.text,'left',true);
  [d.score,d.level,d.bricks,referenceSeconds(row.duration_ms)].forEach((value,i)=>label(c,value,centers[i+2],r.y+r.height/2,r.width*BASE.columns[i+2]-8*u,(i===0?17:11)*u,i===0?OCEAN.colors.number:OCEAN.colors.secondary));
 }
}
