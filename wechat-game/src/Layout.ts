import {VIEW} from '../../src/Viewport';
export interface Rect {x:number;y:number;width:number;height:number}
/**
 * Capsule row: menu, sound and ranking stay to the left of the native menu. A title/action row and
 * the web-style two-tier HUD follow. Fit the unchanged camera aspect ratio into the remaining height;
 * all space below it belongs to the steering strip, including while the mode picker is open.
 */
export function layout(width:number,height:number,safeTop=0,safeBottom=height,menuBottom=safeTop,menuTop?:number,menuLeft=width){
 const barHeight=32,barY=menuTop!==undefined?menuTop+Math.max(0,(menuBottom-menuTop-barHeight)/2):Math.max(safeTop,menuBottom)+4;
 const top=barY,barRight=Math.min(width-6,menuLeft-8);
 const titleY=Math.max(barY+barHeight,menuBottom)+4,titleHeight=48,hudY=titleY+titleHeight+6,hudHeight=82,arenaTop=hudY+hudHeight+4,bottom=Math.min(height,safeBottom)-4;
 const padMin=46;
 const scale=Math.max(.01,Math.min((width-8)/VIEW.width,(bottom-arenaTop-padMin)/VIEW.height));
 const arena:Rect={x:(width-VIEW.width*scale)/2,y:arenaTop,width:VIEW.width*scale,height:VIEW.height*scale};
 const padY=arena.y+arena.height,pad:Rect={x:arena.x,y:padY,width:arena.width,height:Math.max(0,bottom-padY)};
 const modeTabs=[{mode:'campaign' as const,x:6,y:titleY+4,width:56,height:44},{mode:'endless' as const,x:64,y:titleY+4,width:56,height:44}];
 return {modeTabs,width,height,top,barHeight,barRight,titleY,titleHeight,hudY,hudHeight,arena,scale,pad,buttonsY:padY,bottom};
}
export function inside(r:Rect,x:number,y:number){return x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height;}
