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
 draw(c:CanvasRenderingContext2D,width:number,top:number,bottom:number,now=0,animate=true,lowDevice=false,art?:CanvasImageSource,pixelRatio=1){
  if(!this.open)return;if(this.ranking){this.ranking.draw(c,width,top,bottom,now,animate,lowDevice,art,pixelRatio);return;}this.hits=[];c.fillStyle='rgba(3,9,18,.97)';c.fillRect(0,top,width,bottom-top);
  c.textAlign='left';c.fillStyle='#def5ff';c.font='bold 19px sans-serif';c.fillText(this.title,16,top+30);
  c.font='13px sans-serif';c.fillStyle='#9baec4';let y=top+55;
  for(const line of this.lines){let text='';for(const ch of [...line]){if(c.measureText(text+ch).width>width-32){c.fillText(text,16,y);y+=18;text='';}text+=ch;}c.fillText(text,16,y);y+=22;}
  y+=8;
  for(let i=0;i<this.actions.length;i++){
   const action=this.actions[i];const paired=action.half&&this.actions[i+1]?.half;
   const row=paired?[action,this.actions[++i]]:[action];
   row.forEach((a,index)=>{const rect={x:12+index*(width/2-6),y,width:paired?width/2-18:width-24,height:44};
    c.fillStyle='#14283b';c.fillRect(rect.x,rect.y,rect.width,rect.height);c.fillStyle='#b9eafa';c.textAlign='center';c.font='14px sans-serif';c.fillText(a.label,rect.x+rect.width/2,y+28);this.hits.push({rect,run:a.run});});
   y+=49;
  }
 }
}
