import {OCEAN} from '../../shared/VisualTheme';
import {panel,canvasText} from '../../shared/CanvasUI';
import {drawIcon} from '../../shared/Icons';
import {GAME_NAME} from '../../shared/Brand';
import type {Rect} from './Layout';
/** Mirrors src/style.css .mode-picker; coordinates are CSS pixels, never physics coordinates. */
export function modePickerLayout(width:number,top:number,bottom:number,centerY:number){
 const w=Math.min(320,width*.82),height=242,y=Math.max(top,Math.min(bottom-height,centerY-height/2)),x=(width-w)/2;
 return {card:{x,y,width:w,height},rows:[0,1].map(i=>({x:x+14,y:y+78+i*66,width:w-28,height:58}))};
}
export function drawModePicker(c:CanvasRenderingContext2D,card:Rect,rows:Rect[],selected:number){
 c.save();panel(c,card,'rgba(6,10,24,.94)','rgba(79,227,255,.35)',14);
 c.font=`800 24px ${OCEAN.fonts.body}`;c.textAlign='center';c.textBaseline='middle';c.fillStyle='#FFFFFF';c.fillText([...GAME_NAME].join(' '),card.x+card.width/2,card.y+29,card.width-28);
 canvasText(c,'选择游戏模式',card.x+card.width/2,card.y+57,card.width-28,11,OCEAN.colors.muted,'center');
 rows.forEach((r,i)=>{const color=i?OCEAN.colors.pink:OCEAN.colors.accent;panel(c,r,'rgba(14,24,52,.90)',i===selected?'rgba(79,227,255,.35)':'rgba(120,200,255,.18)',10);c.fillStyle=color;c.fillRect(r.x,r.y+8,3,r.height-16);panel(c,{x:r.x+12,y:r.y+12,width:34,height:34},i?'rgba(255,111,177,.12)':'rgba(79,227,255,.10)',undefined,8);drawIcon(c,i?'infinity':'flag',r.x+29,r.y+29,20,color);
 c.font=`700 16px ${OCEAN.fonts.body}`;c.fillStyle=OCEAN.colors.text;c.textAlign='left';c.fillText(i?'无尽模式':'闯关模式',r.x+56,r.y+21,r.width-84);canvasText(c,i?'砖墙不断下沉 · 3 条命':'12 关逐关突破 · 5 条命',r.x+56,r.y+40,r.width-84,10,OCEAN.colors.muted);drawIcon(c,'play',r.x+r.width-16,r.y+29,14,OCEAN.colors.muted);});
 canvasText(c,'每局结束后可重新选择模式',card.x+card.width/2,card.y+225,card.width-24,10,OCEAN.colors.muted,'center');c.restore();
}
