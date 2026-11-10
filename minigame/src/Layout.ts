import {C} from '../../src/GameConfig';
export interface Rect {x:number;y:number;width:number;height:number}
export function layout(width:number,height:number,safeTop=0,safeBottom=height,menuBottom=safeTop){
 const top=Math.max(safeTop,menuBottom)+6,hudY=top+20,arenaTop=hudY+38,bottom=Math.min(height,safeBottom)-8;
 const scale=Math.max(.01,Math.min((width-16)/C.width,(bottom-arenaTop-56)/C.height));
 const arena:Rect={x:(width-C.width*scale)/2,y:arenaTop,width:C.width*scale,height:C.height*scale};
 return {width,height,top,hudY,arena,scale,buttonsY:arena.y+arena.height+6,bottom};
}
export function inside(r:Rect,x:number,y:number){return x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height;}
