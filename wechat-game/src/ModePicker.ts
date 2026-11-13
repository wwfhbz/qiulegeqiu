import {OCEAN,levelBandColors} from '../../shared/VisualTheme';
import {canvasText} from '../../shared/CanvasUI';
import {drawIcon} from '../../shared/Icons';
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
 return {hero:heroRect,logoY,tagY:tagH?tagY:undefined,rows,tools,footY:Math.min(bottom-8,y+6),tight};
}

// Deterministic stars (fractions of the screen), so the page never flickers between frames.
const STARS=[[.12,.18,1.5],[.78,.12,1],[.64,.34,1.5],[.28,.46,1],[.88,.52,1],[.08,.72,1.5],[.46,.84,1],[.92,.88,1],[.36,.06,1],[.56,.62,1],[.18,.94,1],[.72,.76,1.5]];
const CARDS=[
 {title:'闯关模式',desc:'12 关逐关突破，冲击闯关榜',chips:['5 条命','12 关','闯关榜'],icon:'flag' as const,from:'#4FD8FF',mid:'#3A8CFF',to:'#4B5BFF',edge:'#2443B8',go:'#2D6BFF'},
 {title:'无尽模式',desc:'砖墙不断下沉，坚持越久分越高',chips:['3 条命','无限阶段','无尽榜'],icon:'infinity' as const,from:'#FF8CC6',mid:'#C25CFF',to:'#7A4BFF',edge:'#5A2AB8',go:'#A040FF'},
];

export function drawModePicker(c:CanvasRenderingContext2D,width:number,height:number,v:ReturnType<typeof modePickerLayout>,selected:number,muted:boolean,now=0){
 c.save();
 // Backdrop: deep-space gradient, two soft nebula glows and fixed stars.
 const sky=c.createLinearGradient(0,0,0,height);sky?.addColorStop(0,'#0B1030');sky?.addColorStop(.55,'#070A1E');sky?.addColorStop(1,'#04060F');c.fillStyle=sky||'#070A1E';c.fillRect(0,0,width,height);
 const glow=(x:number,y:number,r:number,color:string)=>{const g=c.createRadialGradient?.(x,y,0,x,y,r);if(!g)return;g.addColorStop(0,color);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);};
 glow(width*.2,height*.1,width*.6,'rgba(255,111,177,.18)');glow(width*.9,height*.3,width*.55,'rgba(79,227,255,.14)');glow(width*.5,height*1.02,width*.8,'rgba(122,92,255,.26)');
 c.fillStyle='#FFFFFF';for(const [sx,sy,r] of STARS){c.globalAlpha=.55+.45*Math.sin(now/700+sx*20);c.beginPath();c.arc(sx*width,sy*height,r,0,Math.PI*2);c.fill();}c.globalAlpha=1;

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

 // Mode cards: candy gradients with a darker bottom edge, an icon tile, chips and a round play button.
 v.rows.forEach((rect,i)=>{const card=CARDS[i],rad=20;
  c.fillStyle=card.edge;c.beginPath();c.roundRect(rect.x,rect.y+6,rect.width,rect.height,rad);c.fill();
  const fill=c.createLinearGradient(rect.x,rect.y,rect.x+rect.width,rect.y+rect.height);fill?.addColorStop(0,card.from);fill?.addColorStop(.55,card.mid);fill?.addColorStop(1,card.to);
  c.fillStyle=fill||card.mid;c.beginPath();c.roundRect(rect.x,rect.y,rect.width,rect.height,rad);c.fill();
  const shine=c.createLinearGradient(0,rect.y,0,rect.y+rect.height*.5);shine?.addColorStop(0,'rgba(255,255,255,.24)');shine?.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=shine||'rgba(255,255,255,.1)';c.beginPath();c.roundRect(rect.x,rect.y,rect.width,rect.height,rad);c.fill();
  const icon=v.tight?46:54,ix=rect.x+14,iy=rect.y+(rect.height-icon)/2;c.fillStyle='rgba(255,255,255,.22)';c.beginPath();c.roundRect(ix,iy,icon,icon,16);c.fill();drawIcon(c,card.icon,ix+icon/2,iy+icon/2,icon*.56,'#FFFFFF');
  const go=v.tight?32:38,gx=rect.x+rect.width-14-go,gy=rect.y+(rect.height-go)/2;c.fillStyle='rgba(0,0,0,.18)';c.beginPath();c.arc(gx+go/2,gy+go/2+3,go/2,0,Math.PI*2);c.fill();c.fillStyle='#FFFFFF';c.beginPath();c.arc(gx+go/2,gy+go/2,go/2,0,Math.PI*2);c.fill();drawIcon(c,'play',gx+go/2+1,gy+go/2,go*.48,card.go);
  const tx=ix+icon+12,tw=gx-tx-8;
  c.font=`900 ${v.tight?19:22}px ${OCEAN.fonts.body}`;c.textAlign='left';c.textBaseline='middle';c.fillStyle='rgba(0,0,0,.18)';c.fillText(card.title,tx,rect.y+rect.height*.28+2,tw);c.fillStyle='#FFFFFF';c.fillText(card.title,tx,rect.y+rect.height*.28,tw);
  canvasText(c,card.desc,tx,rect.y+rect.height*.53,tw,v.tight?11:12,'rgba(255,255,255,.92)');
  let cx2=tx;const chipY=rect.y+rect.height*.78;c.font=`700 ${v.tight?10:11}px ${OCEAN.fonts.body}`;
  for(const chip of card.chips){const cw=c.measureText(chip).width+14;if(cx2+cw>tx+tw)break;c.fillStyle='rgba(0,0,0,.18)';c.beginPath();c.roundRect(cx2,chipY-9,cw,18,9);c.fill();c.fillStyle='#FFFFFF';c.textAlign='center';c.fillText(chip,cx2+cw/2,chipY,cw);cx2+=cw+5;}
  if(i===selected){const label='上次玩过';c.font=`800 11px ${OCEAN.fonts.body}`;const lw=c.measureText(label).width+18,lx=rect.x+rect.width-14-lw,ly=rect.y-9;
   c.fillStyle='#C9770A';c.beginPath();c.roundRect(lx,ly+2,lw,20,10);c.fill();const lg=c.createLinearGradient(0,ly,0,ly+20);lg?.addColorStop(0,'#FFE27A');lg?.addColorStop(1,'#FFB31F');c.fillStyle=lg||'#FFD24D';c.beginPath();c.roundRect(lx,ly,lw,20,10);c.fill();
   c.fillStyle='#5A2C00';c.textAlign='center';c.fillText(label,lx+lw/2,ly+10);}
 });

 // Leaderboard and sound shortcuts, then the footer.
 v.tools.forEach((rect,i)=>{c.fillStyle='rgba(255,255,255,.08)';c.strokeStyle='rgba(255,255,255,.18)';c.lineWidth=1;c.beginPath();c.roundRect(rect.x,rect.y,rect.width,rect.height,rect.height/2);c.fill();c.stroke();
  const label=i?(muted?'音效关':'音效开'):'排行榜';c.font=`700 13px ${OCEAN.fonts.body}`;const lw=c.measureText(label).width,total=18+6+lw,sx=rect.x+(rect.width-total)/2;
  drawIcon(c,i?(muted?'soundOff':'soundOn'):'trophy',sx+9,rect.y+rect.height/2,18,i?'#EAF6FF':'#FFD24D');c.fillStyle='#EAF6FF';c.textAlign='left';c.textBaseline='middle';c.fillText(label,sx+24,rect.y+rect.height/2);});
 canvasText(c,`每局结束后可重新选择模式 · V${MINIGAME_VERSION}`,width/2,v.footY,width-40,11,OCEAN.colors.muted,'center');
 c.restore();
}
