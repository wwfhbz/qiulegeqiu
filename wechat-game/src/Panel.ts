import {OCEAN} from '../../shared/VisualTheme';
import {candyButton,chunkyText,goldText,CANDY,type CandyStyle} from '../../shared/CanvasUI';
import {GAME_NAME} from '../../shared/Brand';
import type {CanvasSurface} from '../../src/platform/Contracts';
import {RankingCanvas,type RankingView,type RankingAction} from './RankingCanvas';
import {inside,type Rect} from './Layout';
export interface Action {label:string;run:()=>void;half?:boolean}
export class Panel {
 ranking?:RankingCanvas;private rankSurface?:CanvasSurface;private canvasFactory?:()=>CanvasSurface;
 configureRankingCache(factory:()=>CanvasSurface){this.canvasFactory=factory;}
 title='';lines:string[]=[];actions:Action[]=[];hits:{rect:Rect;run:()=>void}[]=[];
 get open(){return !!this.title;}
 show(title:string,lines:string[],actions:Action[]){this.ranking=undefined;this.title=title;this.lines=lines;this.actions=actions;}
 close(){this.title='';this.hits=[];this.ranking=undefined;}
 showRanking(view:RankingView,actions:RankingAction[],inspect?:(row:import('../../src/online/ranking/Presentation').RankingScore)=>void){this.show('全球历史排行榜',[view.note||'',...view.items.map(row=>`${row.rank}. ${row.display_name} ${row.score}`)],actions);this.ranking=new RankingCanvas(view,actions,inspect,this.canvasFactory?()=>this.rankSurface??=this.canvasFactory!():undefined);}
 scroll(dy:number,x:number,startY:number){if(this.ranking&&inside(this.ranking.body,x,startY))this.ranking.scroll(dy);}
 tap(x:number,y:number){if(this.ranking){this.ranking.tap(x,y);return;}const hit=this.hits.find(h=>inside(h.rect,x,y));hit?.run();}
 /** Candy colour per action, from its label: modes get their mode colours, submitting is gold, closing is dim. */
 private styleFor(label:string):CandyStyle{const text=label.replace('▶ ','');return text.includes('闯关')?'sky':text.includes('无尽')?'pink':text.startsWith('提交')?'gold':text.startsWith('关闭')||text.startsWith('取消')?'dim':'violet';}
 draw(c:CanvasRenderingContext2D,width:number,top:number,bottom:number,now=0,animate=true,lowDevice=false,art?:CanvasImageSource,pixelRatio=1){
  if(!this.open)return;if(this.ranking){this.ranking.draw(c,width,top,bottom,now,animate,lowDevice,art,pixelRatio);return;}this.hits=[];c.textBaseline='alphabetic';
  // Candy-night sheet over the game, with a frosted card holding the content.
  const sky=c.createLinearGradient(0,top,0,bottom);sky?.addColorStop(0,'rgba(43,30,110,.97)');sky?.addColorStop(1,'rgba(19,14,54,.98)');c.fillStyle=sky||OCEAN.colors.background;c.fillRect(0,top,width,bottom-top);
  let y=top+18;
  // The mode picker carries the game's logo.
  if(this.title==='选择游戏模式'){goldText(c,GAME_NAME,width/2,y+26,width-40,40);y+=60;}
  chunkyText(c,this.title,width/2,y+14,width-32,this.title==='选择游戏模式'?16:20,this.title==='选择游戏模式'?OCEAN.colors.secondary:'#FFE27A');y+=40;
  for(const [index,line] of this.lines.entries()){const emphasized=index===0&&(this.title.endsWith('挑战结束')||this.title.endsWith('十二关突破成功'));
   if(emphasized){goldText(c,line,width/2,y+10,width-32,26);y+=38;continue;}
   c.font='600 13px '+OCEAN.fonts.body;c.fillStyle=OCEAN.colors.secondary;c.textAlign='center';let text='';for(const ch of [...line]){if(c.measureText(text+ch).width>width-40){c.fillText(text,width/2,y);y+=18;text='';}text+=ch;}c.fillText(text,width/2,y);y+=22;}
  y+=10;
  for(let i=0;i<this.actions.length;i++){
   const action=this.actions[i];const paired=action.half&&this.actions[i+1]?.half;
   const row=paired?[action,this.actions[++i]]:[action];
   row.forEach((a,index)=>{const rect={x:16+index*(width/2-8),y,width:paired?width/2-24:width-32,height:48},style=this.styleFor(a.label);
    candyButton(c,rect,style,16);chunkyText(c,a.label,rect.x+rect.width/2,rect.y+rect.height/2-2,rect.width-16,15,CANDY[style][3],'center','rgba(0,0,0,0)');this.hits.push({rect,run:a.run});});
   y+=58;
  }
 }
}
