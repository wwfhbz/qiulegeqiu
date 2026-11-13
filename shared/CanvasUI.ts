import {OCEAN} from './VisualTheme';
export interface VisualRect{x:number;y:number;width:number;height:number}
export function panel(c:CanvasRenderingContext2D,r:VisualRect,fill:string|CanvasGradient=OCEAN.colors.panel,border?:string,radius=10){c.beginPath();c.roundRect(r.x,r.y,r.width,r.height,radius);c.fillStyle=fill;c.fill();if(border){c.lineWidth=1;c.strokeStyle=border;c.stroke();}}
export function canvasText(c:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,size=12,color:string=OCEAN.colors.text,align:CanvasTextAlign='left'){c.font=`500 ${size}px ${OCEAN.fonts.body}`;c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.fillText(text,x,y,Math.max(1,width));}

/** Candy button styles shared by the WeChat UI: top colour, bottom colour, 3D edge, text colour. */
export const CANDY={
 violet:['#8B78FF','#5641D8','#3A2A9C','#FFFFFF'],gold:['#FFE27A','#FFB31F','#C9770A','#5A2C00'],
 sky:['#8EE6FF','#3AA6FF','#2165C2','#FFFFFF'],pink:['#FF9BCB','#FF4F98','#B8246A','#FFFFFF'],
 mint:['#7FF5D6','#20C79A','#118063','#0B3D30'],dim:['#7D74B8','#564D92','#3B3470','#E8E4FF'],
} as const;
export type CandyStyle=keyof typeof CANDY;
/** Chunky casual-game button: vertical gradient, darker 3D edge underneath and a glossy top line. */
export function candyButton(c:CanvasRenderingContext2D,r:VisualRect,style:CandyStyle='violet',radius=14,pressed=false){
 const [top,bottom,edge]=CANDY[style],lift=pressed?1:4;
 c.save();c.beginPath();c.roundRect(r.x,r.y+lift,r.width,r.height-lift,radius);c.fillStyle=edge;c.fill();
 const g=c.createLinearGradient(0,r.y,0,r.y+r.height-lift);g?.addColorStop(0,top);g?.addColorStop(1,bottom);
 c.beginPath();c.roundRect(r.x,r.y+(pressed?3:0),r.width,r.height-lift,radius);c.fillStyle=g||bottom;c.fill();
 c.globalAlpha=.55;c.strokeStyle='#FFFFFF';c.lineWidth=1.5;c.beginPath();c.moveTo(r.x+radius,r.y+1.5);c.lineTo(r.x+r.width-radius,r.y+1.5);c.stroke();c.restore();
}
/** Bold label with a soft dark outline, for text on candy buttons and headings. */
export function chunkyText(c:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,size:number,color:string,align:CanvasTextAlign='center',outline='rgba(40,16,90,.45)'){
 c.save();c.font=`900 ${size}px ${OCEAN.fonts.body}`;c.textAlign=align;c.textBaseline='middle';c.lineJoin='round';c.lineWidth=Math.max(2,size/6);c.strokeStyle=outline;c.strokeText(text,x,y,Math.max(1,width));c.fillStyle=color;c.fillText(text,x,y,Math.max(1,width));c.restore();
}
/** Gold gradient hero text (scores, titles). */
export function goldText(c:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,size:number,align:CanvasTextAlign='center'){
 c.save();c.font=`900 ${size}px ${OCEAN.fonts.numbers}`;c.textAlign=align;c.textBaseline='middle';c.lineJoin='round';
 c.lineWidth=Math.max(3,size/7);c.strokeStyle='rgba(120,50,0,.75)';c.strokeText(text,x,y+2,Math.max(1,width));
 const g=c.createLinearGradient(0,y-size/2,0,y+size/2);g?.addColorStop(0,'#FFFFFF');g?.addColorStop(.45,'#FFE27A');g?.addColorStop(1,'#FFB31F');c.fillStyle=g||'#FFD24D';c.fillText(text,x,y,Math.max(1,width));c.restore();
}
/** Frosted glass card. */
export function glassCard(c:CanvasRenderingContext2D,r:VisualRect,radius=18){
 // Solid translucent fill plus a highlight line: as frosted as a gradient, but much cheaper to paint every frame.
 c.save();c.beginPath();c.roundRect(r.x,r.y,r.width,r.height,radius);c.fillStyle='rgba(255,255,255,.10)';c.fill();c.strokeStyle='rgba(255,255,255,.16)';c.lineWidth=1;c.stroke();
 c.globalAlpha=.35;c.strokeStyle='#FFFFFF';c.beginPath();c.moveTo(r.x+radius,r.y+1);c.lineTo(r.x+r.width-radius,r.y+1);c.stroke();c.restore();
}

/** Deep-space neon styles (V2.2): a dark glass fill, a thin edge and an optional accent bar on the left. */
export const NEON={cyan:'#4FE3FF',pink:'#FF6FB1',gold:'#FFD24D',dim:'#6F86A8'} as const;
export type NeonAccent=keyof typeof NEON;
export function neonButton(c:CanvasRenderingContext2D,r:VisualRect,accent:NeonAccent='cyan',radius=8,bar=false){
 c.save();c.beginPath();c.roundRect(r.x,r.y,r.width,r.height,radius);c.fillStyle='rgba(10,18,40,.82)';c.fill();
 c.strokeStyle=accent==='dim'?'rgba(120,200,255,.18)':NEON[accent]+'66';c.lineWidth=1;c.stroke();
 if(bar){c.fillStyle=NEON[accent];c.fillRect(r.x,r.y+4,3,r.height-8);}c.restore();
}
/** Text with a soft neon glow. Uses shadowBlur, so keep it to screens that are not redrawn every game frame (panels). */
export function glowText(c:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,size:number,color:string,align:CanvasTextAlign='center',font:string=OCEAN.fonts.numbers,weight=800){
 c.save();c.font=`${weight} ${size}px ${font}`;c.textAlign=align;c.textBaseline='middle';c.shadowColor=color;c.shadowBlur=size/2;c.fillStyle=color;c.fillText(text,x,y,Math.max(1,width));c.restore();
}
