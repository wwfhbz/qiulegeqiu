import {C} from '../../src/GameConfig';
export interface Rect {x:number;y:number;width:number;height:number}
export function layout(width:number,height:number,safeTop=0,safeBottom=height,menuBottom=safeTop){
 const top=Math.max(safeTop,menuBottom)+6,hudY=top+50,arenaTop=hudY+60,bottom=Math.min(height,safeBottom)-8;
 // Pause/restart live in the top bar now; the space under the arena is a touch strip for steering the
 // paddle, so a thumb never covers the paddle. Keep at least 72px for it.
 const scale=Math.max(.01,Math.min((width-16)/C.width,(bottom-arenaTop-72)/C.height));
 const arena:Rect={x:(width-C.width*scale)/2,y:arenaTop,width:C.width*scale,height:C.height*scale};
 const padY=arena.y+arena.height,pad:Rect={x:8,y:padY,width:width-16,height:Math.max(0,bottom-padY)};
 return {width,height,top,hudY,arena,scale,pad,buttonsY:padY,bottom};
}
export function inside(r:Rect,x:number,y:number){return x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height;}
