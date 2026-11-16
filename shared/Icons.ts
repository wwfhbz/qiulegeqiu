/**
 * One small, consistent icon set for the casual UI. Web uses the SVG strings; WeChat draws the same
 * shapes on canvas with `drawIcon` so both clients look alike. All icons sit in a 24×24 box.
 */
export type IconName='pause'|'play'|'restart'|'soundOn'|'soundOff'|'trophy'|'menu'|'flag'|'infinity'|'share'|'music'|'film'|'gear';

const stroke=(d:string)=>`<path d="${d}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
const fill=(d:string)=>`<path d="${d}" fill="currentColor"/>`;
const SVG_BODY:Record<IconName,string>={
 pause:fill('M7 5h3.4v14H7zM13.6 5H17v14h-3.4z'),
 play:fill('M8 5.2v13.6a1 1 0 0 0 1.5.86l10.6-6.8a1 1 0 0 0 0-1.72L9.5 4.34A1 1 0 0 0 8 5.2z'),
 restart:stroke('M19 12a7 7 0 1 1-2.05-4.95')+fill('M20.5 3.5v6h-6z'),
 soundOn:fill('M4 9.5h3.5L12 5.5v13l-4.5-4H4z')+stroke('M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.5a8 8 0 0 1 0 11'),
 soundOff:fill('M4 9.5h3.5L12 5.5v13l-4.5-4H4z')+stroke('M15.5 9.5l5 5M20.5 9.5l-5 5'),
 trophy:fill('M7 4h10v5.5a5 5 0 0 1-10 0z')+stroke('M7 6.5H4.5a3 3 0 0 0 3 3.5M17 6.5h2.5a3 3 0 0 1-3 3.5M12 14.5v3.5M8.5 20h7'),
 menu:stroke('M5 7h14M5 12h14M5 17h14'),
 flag:stroke('M6 21V4')+fill('M6 4.5h11l-2.4 3.7L17 12H6z'),
 infinity:stroke('M12 12c-2-2.6-3.6-4-5.6-4a4 4 0 0 0 0 8c2 0 3.6-1.4 5.6-4s3.6-4 5.6-4a4 4 0 0 1 0 8c-2 0-3.6-1.4-5.6-4z'),
 music:fill('M9 17.5a2.8 2.8 0 1 1-1.6-2.53V5.5l10-2v11a2.8 2.8 0 1 1-1.6-2.53V7.3L9 8.6z'),
 film:fill('M4 6.5A1.5 1.5 0 0 1 5.5 5h9A1.5 1.5 0 0 1 16 6.5v2.1l3.6-2.2A.9.9 0 0 1 21 7.2v9.6a.9.9 0 0 1-1.4.8L16 15.4v2.1a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 17.5z'),
 gear:stroke('M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM12 3v2.3M12 18.7V21M3 12h2.3M18.7 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7'),
 share:stroke('M12 15V4M7.5 8.5 12 4l4.5 4.5M5 12.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6.5'),
};
export function iconSvg(name:IconName){return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">${SVG_BODY[name]}</svg>`;}

/** Canvas version of the same icons (WeChat); (x,y) is the icon centre, `size` its box size. */
export function drawIcon(c:CanvasRenderingContext2D,name:IconName,x:number,y:number,size:number,color:string){
 c.save();c.translate(x-size/2,y-size/2);const k=size/24;c.scale(k,k);c.fillStyle=color;c.strokeStyle=color;c.lineWidth=2.6;c.lineCap='round';c.lineJoin='round';
 const line=(pts:number[][])=>{c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(const p of pts.slice(1))c.lineTo(p[0],p[1]);c.stroke();};
 const poly=(pts:number[][])=>{c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(const p of pts.slice(1))c.lineTo(p[0],p[1]);c.closePath();c.fill();};
 const speaker=()=>poly([[4,9.5],[7.5,9.5],[12,5.5],[12,18.5],[7.5,14.5],[4,14.5]]);
 switch(name){
  case 'pause':c.fillRect(7,5,3.4,14);c.fillRect(13.6,5,3.4,14);break;
  case 'play':poly([[8,5],[20,12],[8,19]]);break;
  case 'restart':c.beginPath();c.arc(12,12,7,-Math.PI*.25,Math.PI*1.55);c.stroke();poly([[20.5,3.5],[20.5,9.5],[14.5,9.5]]);break;
  case 'soundOn':speaker();c.beginPath();c.arc(12.5,12,4,-.85,.85);c.stroke();c.beginPath();c.arc(12.5,12,7.5,-.85,.85);c.stroke();break;
  case 'soundOff':speaker();line([[15.5,9.5],[20.5,14.5]]);line([[20.5,9.5],[15.5,14.5]]);break;
  case 'trophy':c.beginPath();c.moveTo(7,4);c.lineTo(17,4);c.lineTo(17,9.5);c.arc(12,9.5,5,0,Math.PI);c.closePath();c.fill();line([[12,14.5],[12,18]]);line([[8.5,20],[15.5,20]]);
   c.beginPath();c.moveTo(7,6.5);c.lineTo(4.5,6.5);c.quadraticCurveTo(4.5,10,7.5,10);c.stroke();c.beginPath();c.moveTo(17,6.5);c.lineTo(19.5,6.5);c.quadraticCurveTo(19.5,10,16.5,10);c.stroke();break;
  case 'menu':line([[5,7],[19,7]]);line([[5,12],[19,12]]);line([[5,17],[19,17]]);break;
  case 'flag':line([[6,21],[6,4]]);poly([[6,4.5],[17,4.5],[14.6,8.2],[17,12],[6,12]]);break;
  case 'music':c.beginPath();c.arc(6.6,17.5,2.8,0,Math.PI*2);c.fill();c.beginPath();c.arc(14.8,14.5,2.8,0,Math.PI*2);c.fill();c.fillRect(7.8,5.5,1.6,12);c.fillRect(16,3.5,1.6,11);poly([[7.8,5.5],[17.6,3.5],[17.6,7.3],[7.8,9.2]]);break;
  case 'film':c.beginPath();c.roundRect(4,5,12,14,1.5);c.fill();poly([[16,9],[21,6.4],[21,17.6],[16,15]]);break;
  case 'gear':c.beginPath();c.arc(12,12,3.2,0,Math.PI*2);c.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;line([[12+Math.cos(a)*6.2,12+Math.sin(a)*6.2],[12+Math.cos(a)*8.8,12+Math.sin(a)*8.8]]);}break;
  case 'share':line([[12,15],[12,4]]);line([[7.5,8.5],[12,4],[16.5,8.5]]);line([[5,12.5],[5,20],[19,20],[19,12.5]]);break;
  case 'infinity':c.beginPath();c.ellipse(7.5,12,3.6,3.2,0,0,Math.PI*2);c.stroke();c.beginPath();c.ellipse(16.5,12,3.6,3.2,0,0,Math.PI*2);c.stroke();break;
 }
 c.restore();
}
