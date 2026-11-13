import {OCEAN,levelBandColors} from '../../shared/VisualTheme';
import {canvasText} from '../../shared/CanvasUI';
import {drawIcon,type IconName} from '../../shared/Icons';
import {GAME_NAME,MINIGAME_VERSION} from '../../shared/Brand';
import type {Rect} from './Layout';

/**
 * Full-screen title page (mirrors src/style.css .title-screen): it covers the whole game until a mode is chosen.
 * `top` is the first row below the capsule menu, `bottom` the safe bottom edge; coordinates are CSS pixels.
 */
export function modePickerLayout(width:number,height:number,top:number,bottom:number){
 const side=width<=360?12:18,w=Math.min(420,width-side*2),x=(width-w)/2,room=bottom-top;
 const tight=room<560,cardH=tight?80:92,gap=tight?12:14,toolH=38,logoH=tight?46:58,tagH=tight?0:22;
 const hero=Math.max(70,Math.min(width*.5,200,room*(tight?.2:.26)));
 const content=hero+logoH+tagH+cardH*2+gap+toolH+18;
 const free=Math.max(0,room-content),step=free/6;// space-evenly over the six gaps around five blocks + footer
 let y=top+step;
 const heroRect={x:(width-hero)/2,y,width:hero,height:hero};y+=hero+step;
 const logoY=y+logoH/2;y+=logoH;const tagY=y+tagH/2;y+=tagH+step;
 const rows=[0,1].map(i=>({x,y:y+i*(cardH+gap),width:w,height:cardH}));y+=cardH*2+gap+step;
 const toolW=Math.min(130,(w-12)/2),tools=[0,1].map(i=>({x:width/2+(i?6:-6-toolW),y,width:toolW,height:toolH}));y+=toolH+step;
 return {hero:heroRect,logoY,tagY:tagH?tagY:undefined,rows,tools,footY:Math.min(bottom-8,y+6),tight,compact:false};
}

/**
 * Result page after a finished run (mirrors .title-screen.result on the web): a score card with a gold medal,
 * the submit button, then the two mode cards (compact) to play again, and the leaderboard / share shortcuts.
 */
export function resultLayout(width:number,height:number,top:number,bottom:number){
 const side=width<=360?12:18,w=Math.min(420,width-side*2),x=(width-w)/2,room=bottom-top;
 const tight=room<700,small=room<640;
 const base={pad:small?24:30,mode:22,title:small?24:28,label:small?0:16,score:small?38:tight?42:48,stats:small?44:52,submit:small?42:46,note:small?0:20,bottom:14};
 const box=(p:typeof base)=>p.pad+p.mode+6+p.title+4+p.label+p.score+8+p.stats+12+p.submit+p.note+p.bottom;
 const foot=small?0:18,scalable=box(base)+(small?28:32)+(small?58:tight?64:70)*2+(small?10:12)+(small?34:38);
 // Squeeze proportionally (down to 78%) when even the compact sizes do not fit the safe area.
 const fit=Math.min(1,Math.max(.78,(room-26-foot)/scalable));
 const parts=Object.fromEntries(Object.entries(base).map(([key,value])=>[key,Math.round(value*fit)])) as typeof base;
 const cardBox=box(parts);
 const cardH=Math.round((small?58:tight?64:70)*fit),gap=Math.round((small?10:12)*fit),toolH=Math.max(30,Math.round((small?34:38)*fit)),again=Math.round((small?28:32)*fit),medal=26;
 const content=medal+cardBox+again+cardH*2+gap+10+toolH+foot;
 const free=Math.max(0,room-content),step=free/5;
 let y=top+step+medal;
 const card={x,y,width:w,height:cardBox};let cy=y+parts.pad;
 const modeY=cy+parts.mode/2;cy+=parts.mode+6;const titleY=cy+parts.title/2;cy+=parts.title+4;const labelY=parts.label?cy+parts.label/2:undefined;cy+=parts.label;
 const scoreY=cy+parts.score/2;cy+=parts.score+8;const stats=[0,1,2].map(i=>{const sw=(w-28-16)/3;return {x:x+14+i*(sw+8),y:cy,width:sw,height:parts.stats};});cy+=parts.stats+12;
 const submit={x:x+14,y:cy,width:w-28,height:parts.submit};cy+=parts.submit;const noteY=parts.note?cy+parts.note/2+2:undefined;
 y+=cardBox+step;const againY=y+again/2+2;y+=again;
 const rows=[0,1].map(i=>({x,y:y+i*(cardH+gap),width:w,height:cardH}));y+=cardH*2+gap+step+10;// clear the cards' 6px bottom edge
 const toolW=Math.min(130,(w-12)/2),tools=[0,1].map(i=>({x:width/2+(i?6:-6-toolW),y,width:toolW,height:toolH}));y+=toolH+step;
 return {card,medalY:card.y,modeY,titleY,labelY,scoreY,scoreSize:parts.score,stats,submit,noteY,againY,rows,tools,footY:small?undefined:Math.min(bottom-8,y+4),tight:true,compact:true};
}
export interface ResultView {mode:'campaign'|'endless';title:string;score:number;stats:[string,string][];submitLabel:string;note:string;canSubmit:boolean}

// Deterministic stars (fractions of the screen), so the page never flickers between frames.
const STARS=[[.12,.18,1.5],[.78,.12,1],[.64,.34,1.5],[.28,.46,1],[.88,.52,1],[.08,.72,1.5],[.46,.84,1],[.92,.88,1],[.36,.06,1],[.56,.62,1],[.18,.94,1],[.72,.76,1.5]];
const CARDS=[
 {title:'闯关模式',desc:'12 关逐关突破，冲击闯关榜',chips:['5 条命','12 关','闯关榜'],icon:'flag' as const,from:'#4FD8FF',mid:'#3A8CFF',to:'#4B5BFF',edge:'#2443B8',go:'#2D6BFF'},
 {title:'无尽模式',desc:'砖墙不断下沉，坚持越久分越高',chips:['3 条命','无限阶段','无尽榜'],icon:'infinity' as const,from:'#FF8CC6',mid:'#C25CFF',to:'#7A4BFF',edge:'#5A2AB8',go:'#A040FF'},
];

function backdrop(c:CanvasRenderingContext2D,width:number,height:number,now:number){
 // Deep-space gradient, soft nebula glows and fixed twinkling stars.
 const sky=c.createLinearGradient(0,0,0,height);sky?.addColorStop(0,'#0B1030');sky?.addColorStop(.55,'#070A1E');sky?.addColorStop(1,'#04060F');c.fillStyle=sky||'#070A1E';c.fillRect(0,0,width,height);
 const glow=(x:number,y:number,r:number,color:string)=>{const g=c.createRadialGradient?.(x,y,0,x,y,r);if(!g)return;g.addColorStop(0,color);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);};
 glow(width*.2,height*.1,width*.6,'rgba(255,111,177,.18)');glow(width*.9,height*.3,width*.55,'rgba(79,227,255,.14)');glow(width*.5,height*1.02,width*.8,'rgba(122,92,255,.26)');
 c.fillStyle='#FFFFFF';for(const [sx,sy,r] of STARS){c.globalAlpha=.55+.45*Math.sin(now/700+sx*20);c.beginPath();c.arc(sx*width,sy*height,r,0,Math.PI*2);c.fill();}c.globalAlpha=1;
}
const gold=(c:CanvasRenderingContext2D,y0:number,y1:number)=>{const g=c.createLinearGradient(0,y0,0,y1);g?.addColorStop(0,'#FFFFFF');g?.addColorStop(.5,'#FFE27A');g?.addColorStop(1,'#FFB31F');return g||'#FFE27A';};
function goldButton(c:CanvasRenderingContext2D,r:Rect,radius=16,dim=false){
 c.globalAlpha=dim?.55:1;c.fillStyle='#C9770A';c.beginPath();c.roundRect(r.x,r.y+5,r.width,r.height,radius);c.fill();
 const g=c.createLinearGradient(0,r.y,0,r.y+r.height);g?.addColorStop(0,'#FFE27A');g?.addColorStop(1,'#FFB31F');c.fillStyle=g||'#FFD24D';c.beginPath();c.roundRect(r.x,r.y,r.width,r.height,radius);c.fill();c.globalAlpha=1;
}
function modeChip(c:CanvasRenderingContext2D,label:string,endless:boolean,cx:number,cy:number){
 c.font=`800 12px ${OCEAN.fonts.body}`;const w=c.measureText(label).width+26,g=c.createLinearGradient(cx-w/2,0,cx+w/2,0);g?.addColorStop(0,endless?'#FF8CC6':'#4FD8FF');g?.addColorStop(1,endless?'#7A4BFF':'#4B5BFF');
 c.fillStyle=g||(endless?'#C25CFF':'#3A8CFF');c.beginPath();c.roundRect(cx-w/2,cy-11,w,22,11);c.fill();c.fillStyle='#FFFFFF';c.textAlign='center';c.textBaseline='middle';c.fillText(label,cx,cy+.5);
}
function modeCards(c:CanvasRenderingContext2D,rows:Rect[],selected:number,tight:boolean,compact:boolean,badge:string){
 rows.forEach((rect,i)=>{const card=CARDS[i],rad=compact?18:20;
  c.fillStyle=card.edge;c.beginPath();c.roundRect(rect.x,rect.y+6,rect.width,rect.height,rad);c.fill();
  const fill=c.createLinearGradient(rect.x,rect.y,rect.x+rect.width,rect.y+rect.height);fill?.addColorStop(0,card.from);fill?.addColorStop(.55,card.mid);fill?.addColorStop(1,card.to);
  c.fillStyle=fill||card.mid;c.beginPath();c.roundRect(rect.x,rect.y,rect.width,rect.height,rad);c.fill();
  const shine=c.createLinearGradient(0,rect.y,0,rect.y+rect.height*.5);shine?.addColorStop(0,'rgba(255,255,255,.24)');shine?.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=shine||'rgba(255,255,255,.1)';c.beginPath();c.roundRect(rect.x,rect.y,rect.width,rect.height,rad);c.fill();
  const icon=compact?Math.min(44,rect.height-16):tight?46:54,ix=rect.x+14,iy=rect.y+(rect.height-icon)/2;c.fillStyle='rgba(255,255,255,.22)';c.beginPath();c.roundRect(ix,iy,icon,icon,compact?14:16);c.fill();drawIcon(c,card.icon,ix+icon/2,iy+icon/2,icon*.56,'#FFFFFF');
  const go=compact||tight?32:38,gx=rect.x+rect.width-14-go,gy=rect.y+(rect.height-go)/2;c.fillStyle='rgba(0,0,0,.18)';c.beginPath();c.arc(gx+go/2,gy+go/2+3,go/2,0,Math.PI*2);c.fill();c.fillStyle='#FFFFFF';c.beginPath();c.arc(gx+go/2,gy+go/2,go/2,0,Math.PI*2);c.fill();drawIcon(c,'play',gx+go/2+1,gy+go/2,go*.48,card.go);
  const tx=ix+icon+12,tw=gx-tx-8,titleY=rect.y+rect.height*(compact?.36:.28);
  c.font=`900 ${compact?19:tight?19:22}px ${OCEAN.fonts.body}`;c.textAlign='left';c.textBaseline='middle';c.fillStyle='rgba(0,0,0,.18)';c.fillText(card.title,tx,titleY+2,tw);c.fillStyle='#FFFFFF';c.fillText(card.title,tx,titleY,tw);
  canvasText(c,card.desc,tx,rect.y+rect.height*(compact?.68:.53),tw,tight||compact?11:12,'rgba(255,255,255,.92)');
  if(!compact){let cx2=tx;const chipY=rect.y+rect.height*.78;c.font=`700 ${tight?10:11}px ${OCEAN.fonts.body}`;
   for(const chip of card.chips){const cw=c.measureText(chip).width+14;if(cx2+cw>tx+tw)break;c.fillStyle='rgba(0,0,0,.18)';c.beginPath();c.roundRect(cx2,chipY-9,cw,18,9);c.fill();c.fillStyle='#FFFFFF';c.textAlign='center';c.fillText(chip,cx2+cw/2,chipY,cw);cx2+=cw+5;}}
  if(i===selected){c.font=`800 11px ${OCEAN.fonts.body}`;const lw=c.measureText(badge).width+18,lx=rect.x+rect.width-14-lw,ly=rect.y-9;
   c.fillStyle='#C9770A';c.beginPath();c.roundRect(lx,ly+2,lw,20,10);c.fill();const lg=c.createLinearGradient(0,ly,0,ly+20);lg?.addColorStop(0,'#FFE27A');lg?.addColorStop(1,'#FFB31F');c.fillStyle=lg||'#FFD24D';c.beginPath();c.roundRect(lx,ly,lw,20,10);c.fill();
   c.fillStyle='#5A2C00';c.textAlign='center';c.textBaseline='middle';c.fillText(badge,lx+lw/2,ly+10);}
 });
}
function pillTools(c:CanvasRenderingContext2D,rects:Rect[],items:{label:string;icon:IconName;color:string}[]){
 rects.forEach((rect,i)=>{const item=items[i];c.fillStyle='rgba(255,255,255,.08)';c.strokeStyle='rgba(255,255,255,.18)';c.lineWidth=1;c.beginPath();c.roundRect(rect.x,rect.y,rect.width,rect.height,rect.height/2);c.fill();c.stroke();
  c.font=`700 13px ${OCEAN.fonts.body}`;const lw=c.measureText(item.label).width,total=18+6+lw,sx=rect.x+(rect.width-total)/2;
  drawIcon(c,item.icon,sx+9,rect.y+rect.height/2,18,item.color);c.fillStyle='#EAF6FF';c.textAlign='left';c.textBaseline='middle';c.fillText(item.label,sx+24,rect.y+rect.height/2);});
}

export function drawResultPage(c:CanvasRenderingContext2D,width:number,height:number,v:ReturnType<typeof resultLayout>,view:ResultView,now=0){
 c.save();backdrop(c,width,height,now);
 const k=v.card,cx=width/2,endless=view.mode==='endless';
 // Score card: frosted panel with a warm glow at the top.
 c.fillStyle='rgba(255,255,255,.06)';c.strokeStyle='rgba(255,255,255,.12)';c.lineWidth=1;c.beginPath();c.roundRect(k.x,k.y,k.width,k.height,24);c.fill();c.stroke();
 const warm=c.createRadialGradient?.(cx,k.y,0,cx,k.y,k.width*.6);if(warm){warm.addColorStop(0,'rgba(255,190,60,.16)');warm.addColorStop(1,'rgba(255,190,60,0)');c.fillStyle=warm;c.beginPath();c.roundRect(k.x,k.y,k.width,k.height,24);c.fill();}
 // Gold medal straddling the top edge.
 const mr=27;c.fillStyle='#C9770A';c.beginPath();c.arc(cx,v.medalY+4,mr,0,Math.PI*2);c.fill();const mg=c.createLinearGradient(0,v.medalY-mr,0,v.medalY+mr);mg?.addColorStop(0,'#FFE27A');mg?.addColorStop(1,'#FFB31F');c.fillStyle=mg||'#FFD24D';c.beginPath();c.arc(cx,v.medalY,mr,0,Math.PI*2);c.fill();drawIcon(c,'trophy',cx,v.medalY,28,'#6A3A00');
 modeChip(c,endless?'无尽模式':'闯关模式',endless,cx,v.modeY);
 c.font=`900 ${v.scoreSize>40?24:21}px ${OCEAN.fonts.body}`;c.textAlign='center';c.textBaseline='middle';c.fillStyle='rgba(0,0,0,.25)';c.fillText(view.title,cx,v.titleY+2,k.width-40);c.fillStyle='#FFFFFF';c.fillText(view.title,cx,v.titleY,k.width-40);
 if(v.labelY!==undefined)canvasText(c,'本次总分',cx,v.labelY,k.width-40,12,'#A9C1DE','center');
 const score=view.score.toLocaleString('zh-CN');c.font=`900 ${v.scoreSize}px ${OCEAN.fonts.numbers}`;c.fillStyle='rgba(140,60,0,.7)';c.fillText(score,cx,v.scoreY+3,k.width-32);c.fillStyle=gold(c,v.scoreY-v.scoreSize/2,v.scoreY+v.scoreSize/2);c.fillText(score,cx,v.scoreY,k.width-32);
 v.stats.forEach((r,i)=>{const [label,value]=view.stats[i]??['',''];c.fillStyle='rgba(0,0,0,.22)';c.beginPath();c.roundRect(r.x,r.y,r.width,r.height,12);c.fill();
  canvasText(c,label,r.x+r.width/2,r.y+r.height*.32,r.width-8,11,'#8FA6C8','center');c.font=`800 15px ${OCEAN.fonts.body}`;c.fillStyle='#FFFFFF';c.textAlign='center';c.textBaseline='middle';c.fillText(value,r.x+r.width/2,r.y+r.height*.68,r.width-8);});
 goldButton(c,v.submit,16,!view.canSubmit);c.globalAlpha=view.canSubmit?1:.7;c.font=`900 16px ${OCEAN.fonts.body}`;const sw=c.measureText(view.submitLabel).width,sx=cx-(sw+26)/2;drawIcon(c,'trophy',sx+10,v.submit.y+v.submit.height/2,20,'#5A2C00');c.fillStyle='#5A2C00';c.textAlign='left';c.textBaseline='middle';c.fillText(view.submitLabel,sx+26,v.submit.y+v.submit.height/2);c.globalAlpha=1;
 if(v.noteY!==undefined&&view.note)canvasText(c,view.note,cx,v.noteY,k.width-32,11,'#7E93B5','center');
 c.font=`700 13px ${OCEAN.fonts.body}`;c.fillStyle='#A9C1DE';c.textAlign='center';c.textBaseline='middle';c.fillText('再来一局 · 选择模式',cx,v.againY,width-40);
 modeCards(c,v.rows,endless?1:0,true,true,'刚刚玩过');
 pillTools(c,v.tools,[{label:'排行榜',icon:'trophy',color:'#FFD24D'},{label:'分享成绩',icon:'share',color:'#EAF6FF'}]);
 if(v.footY!==undefined)canvasText(c,`${GAME_NAME} · V${MINIGAME_VERSION}`,cx,v.footY,width-40,11,OCEAN.colors.muted,'center');
 c.restore();
}

export function drawModePicker(c:CanvasRenderingContext2D,width:number,height:number,v:ReturnType<typeof modePickerLayout>,selected:number,muted:boolean,now=0){
 c.save();backdrop(c,width,height,now);
 // Hero: a little arena with a brick dome, a bouncing ball, a sliding paddle and an orbiting spark.
 const h=v.hero,cx=h.x+h.width/2,cy=h.y+h.height/2,r=h.width/2;
 const inner=c.createRadialGradient?.(cx,cy-r*.2,0,cx,cy,r);inner?.addColorStop(0,'rgba(30,50,110,.6)');inner?.addColorStop(1,'rgba(6,10,28,.95)');
 c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fillStyle=inner||'#0B1224';c.fill();
 c.strokeStyle='rgba(79,227,255,.25)';c.lineWidth=8;c.stroke();c.strokeStyle='rgba(120,220,255,.85)';c.lineWidth=2;c.stroke();
 c.setLineDash?.([3,4]);c.strokeStyle='rgba(255,210,77,.35)';c.lineWidth=1;c.beginPath();c.arc(cx,cy,r*1.14,0,Math.PI*2);c.stroke();c.setLineDash?.([]);
 const orbit=now/9000*Math.PI*2-Math.PI/2;c.fillStyle='#FFD24D';c.beginPath();c.arc(cx+Math.cos(orbit)*r*1.14,cy+Math.sin(orbit)*r*1.14,4,0,Math.PI*2);c.fill();
 const bands=levelBandColors(1),cell=r*.15,step=cell*1.2;
 [3,5,7,7,7,5].forEach((n,row)=>{c.fillStyle=bands[row];for(let i=0;i<n;i++){const bx=cx+(i-(n-1)/2)*step-cell/2,by=h.y+h.height*.15+row*step;c.beginPath();c.roundRect(bx,by,cell,cell,2);c.fill();}});
 const t=(Math.sin(now/2400*Math.PI*2)+1)/2,px=cx+(t-.5)*r*.6;
 c.fillStyle='#8EE6FF';c.beginPath();c.roundRect(px-r*.3,cy+r*.6,r*.6,Math.max(3,r*.08),3);c.fill();
 const bt=(now%2400)/2400,bx=cx+(bt-.5)*r*.8,by=cy+r*.55-Math.abs(Math.sin(bt*Math.PI*2))*r*.1;
 c.fillStyle='rgba(79,227,255,.35)';c.beginPath();c.arc(bx,by,r*.1,0,Math.PI*2);c.fill();c.fillStyle='#FFFFFF';c.beginPath();c.arc(bx,by,r*.055,0,Math.PI*2);c.fill();

 // Logo: chunky gold lettering with a brown drop edge (no shadowBlur: it is costly every frame).
 const size=v.tight?36:46;c.font=`900 ${size}px ${OCEAN.fonts.body}`;c.textAlign='center';c.textBaseline='middle';
 const name=GAME_NAME,spaced=c as CanvasRenderingContext2D&{letterSpacing?:string};spaced.letterSpacing=`${Math.round(size*.12)}px`;c.fillStyle='rgba(140,60,0,.75)';c.fillText(name,width/2,v.logoY+3,width-32);
 const gold=c.createLinearGradient(0,v.logoY-size/2,0,v.logoY+size/2);gold?.addColorStop(0,'#FFFFFF');gold?.addColorStop(.55,'#FFE27A');gold?.addColorStop(1,'#FFB31F');c.fillStyle=gold||'#FFE27A';c.fillText(name,width/2,v.logoY,width-32);spaced.letterSpacing='0px';
 if(v.tagY!==undefined)canvasText(c,'圆形弹球 · 击碎星际砖墙',width/2,v.tagY,width-40,13,'#A9C1DE','center');

 modeCards(c,v.rows,selected,v.tight,false,'上次玩过');
 pillTools(c,v.tools,[{label:'排行榜',icon:'trophy',color:'#FFD24D'},{label:muted?'音效关':'音效开',icon:muted?'soundOff':'soundOn',color:'#EAF6FF'}]);
 canvasText(c,`每局结束后可重新选择模式 · V${MINIGAME_VERSION}`,width/2,v.footY,width-40,11,OCEAN.colors.muted,'center');
 c.restore();
}
