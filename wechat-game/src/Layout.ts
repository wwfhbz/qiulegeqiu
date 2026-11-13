import {VIEW} from '../../src/Viewport';
export interface Rect {x:number;y:number;width:number;height:number}
/**
 * Game-first layout. The small tool buttons share the row of WeChat's capsule menu (to its left), so no
 * extra row is spent on them; a two-line HUD follows, then the arena takes every remaining pixel of width,
 * with a slim touch strip under it for steering.
 */
export function layout(width:number,height:number,safeTop=0,safeBottom=height,menuBottom=safeTop,menuTop?:number,menuLeft=width){
 const barHeight=32,barY=menuTop!==undefined?menuTop+Math.max(0,(menuBottom-menuTop-barHeight)/2):Math.max(safeTop,menuBottom)+4;
 const top=barY,barRight=Math.min(width-6,menuLeft-8);
 const hudY=Math.max(barY+barHeight,menuBottom)+4,hudHeight=40,arenaTop=hudY+hudHeight+4,bottom=Math.min(height,safeBottom)-4;
 const padMin=46;
 const scale=Math.max(.01,Math.min((width-8)/VIEW.width,(bottom-arenaTop-padMin)/VIEW.height));
 const arena:Rect={x:(width-VIEW.width*scale)/2,y:arenaTop,width:VIEW.width*scale,height:VIEW.height*scale};
 const padY=arena.y+arena.height,pad:Rect={x:arena.x,y:padY,width:arena.width,height:Math.max(0,bottom-padY)};
 return {width,height,top,barHeight,barRight,hudY,hudHeight,arena,scale,pad,buttonsY:padY,bottom};
}
export function inside(r:Rect,x:number,y:number){return x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height;}
