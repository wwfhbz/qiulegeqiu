import type {Canvas} from './Platform';
export function context(canvas:Canvas){
 const c=canvas.getContext('2d');
 if(!c.roundRect)c.roundRect=function(this:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number|DOMPointInit|Iterable<number|DOMPointInit>=0){
  const radius=typeof r==='number'?Math.min(r,w/2,h/2):4;
  this.moveTo(x+radius,y);this.lineTo(x+w-radius,y);this.quadraticCurveTo(x+w,y,x+w,y+radius);this.lineTo(x+w,y+h-radius);this.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);this.lineTo(x+radius,y+h);this.quadraticCurveTo(x,y+h,x,y+h-radius);this.lineTo(x,y+radius);this.quadraticCurveTo(x,y,x+radius,y);this.closePath();
 } as CanvasRenderingContext2D['roundRect'];
 return c;
}
