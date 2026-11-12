import {OCEAN} from './VisualTheme';
export interface VisualRect{x:number;y:number;width:number;height:number}
export function panel(c:CanvasRenderingContext2D,r:VisualRect,fill:string|CanvasGradient=OCEAN.colors.panel,border?:string,radius=10){c.beginPath();c.roundRect(r.x,r.y,r.width,r.height,radius);c.fillStyle=fill;c.fill();if(border){c.lineWidth=1;c.strokeStyle=border;c.stroke();}}
export function canvasText(c:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,size=12,color:string=OCEAN.colors.text,align:CanvasTextAlign='left'){c.font=`500 ${size}px ${OCEAN.fonts.body}`;c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.fillText(text,x,y,Math.max(1,width));}
