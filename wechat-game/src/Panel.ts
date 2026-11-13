import type {FriendBoard} from './social/FriendBoard';
import {drawModePicker,modePickerLayout} from './ModePicker';
import {OCEAN} from '../../shared/VisualTheme';
import {neonButton,glowText,NEON,type NeonAccent} from '../../shared/CanvasUI';
import {GAME_NAME} from '../../shared/Brand';
import type {CanvasSurface} from '../../src/platform/Contracts';
import {RankingCanvas,type RankingView,type RankingAction} from './RankingCanvas';
import {inside,type Rect} from './Layout';
export interface Action {label:string;run:()=>void;half?:boolean}
export class Panel {
 friend?:FriendBoard;
 ranking?:RankingCanvas;private rankSurface?:CanvasSurface;private canvasFactory?:()=>CanvasSurface;
 configureRankingCache(factory:()=>CanvasSurface){this.canvasFactory=factory;}
 /** Full-screen title page geometry: screen height, first row under the capsule, and the sound state. */
 screen?:{height:number;top:number;muted:boolean};
 title='';lines:string[]=[];actions:Action[]=[];hits:{rect:Rect;run:()=>void}[]=[];
 get open(){return !!this.title;}
 show(title:string,lines:string[],actions:Action[]){this.friend?.hide();this.friend=undefined;this.hits=[];this.ranking=undefined;this.title=title;this.lines=lines;this.actions=actions;}
 close(){this.friend?.hide();this.friend=undefined;this.title='';this.hits=[];this.ranking=undefined;}
 showRanking(view:RankingView,actions:RankingAction[],inspect?:(row:import('../../src/online/ranking/Presentation').RankingScore)=>void){this.show('全球历史排行榜',[view.note||'',...view.items.map(row=>`${row.rank}. ${row.display_name} ${row.score}`)],actions);this.ranking=new RankingCanvas(view,actions,inspect,this.canvasFactory?()=>this.rankSurface??=this.canvasFactory!():undefined);}
 showFriends(friend:FriendBoard){this.show('好友排行榜',[],[]);this.friend=friend;}
 scroll(dy:number,x:number,startY:number){if(this.friend){this.friend.scroll(dy,x,startY);return;}if(this.ranking&&inside(this.ranking.body,x,startY))this.ranking.scroll(dy);}
 tap(x:number,y:number,endX=x,endY=y){if(this.friend){this.friend.tap(endX,endY);return;}if(this.ranking){this.ranking.tap(x,y);return;}const hit=this.hits.find(h=>inside(h.rect,x,y)&&inside(h.rect,endX,endY));hit?.run();}
 /** Accent per action, from its label: campaign cyan, endless pink, submitting gold, closing dim. */
 private accentFor(label:string):NeonAccent{const text=label.replace('▶ ','');return text.includes('闯关')?'cyan':text.includes('无尽')?'pink':text.startsWith('提交')?'gold':text.startsWith('关闭')||text.startsWith('取消')?'dim':'cyan';}
 draw(c:CanvasRenderingContext2D,width:number,top:number,bottom:number,now=0,animate=true,lowDevice=false,art?:CanvasImageSource,pixelRatio=1){
  if(!this.open)return;if(this.friend){this.friend.draw(c,width,top,bottom,pixelRatio);return;}if(this.ranking){this.ranking.draw(c,width,top,bottom,now,animate,lowDevice,art,pixelRatio);return;}this.hits=[];c.textBaseline='alphabetic';
  if(this.title==='选择游戏模式'){const sc=this.screen??{height:bottom,top,muted:false},v=modePickerLayout(width,sc.height,sc.top,bottom);
   drawModePicker(c,width,sc.height,v,this.actions[1]?.label.startsWith('▶')?1:0,sc.muted,now);
   [...v.rows,...v.tools].forEach((rect,i)=>{const a=this.actions[i];if(a)this.hits.push({rect,run:a.run});});return;}
  // Deep-space sheet: dark glass over the game, cyan title, thin-edged rows.
  c.fillStyle='rgba(3,5,12,.94)';c.fillRect(0,top,width,bottom-top);
  let y=top+16;const picker=this.title==='选择游戏模式';
  if(picker){glowText(c,GAME_NAME,width/2,y+22,width-40,30,'#FFFFFF','center',OCEAN.fonts.body,800);y+=52;}
  glowText(c,this.title,width/2,y+12,width-32,picker?13:17,picker?OCEAN.colors.muted:NEON.cyan,'center',OCEAN.fonts.body,700);y+=36;
  for(const [index,line] of this.lines.entries()){const emphasized=index===0&&(this.title.endsWith('挑战结束')||this.title.endsWith('十二关突破成功'));
   if(emphasized){glowText(c,line,width/2,y+10,width-32,24,'#FFFFFF');y+=36;continue;}
   c.font='500 12px '+OCEAN.fonts.body;c.fillStyle=OCEAN.colors.secondary;c.textAlign='center';let text='';for(const ch of [...line]){if(c.measureText(text+ch).width>width-40){c.fillText(text,width/2,y);y+=17;text='';}text+=ch;}c.fillText(text,width/2,y);y+=20;}
  y+=8;
  for(let i=0;i<this.actions.length;i++){
   const action=this.actions[i];const paired=action.half&&this.actions[i+1]?.half;
   const row=paired?[action,this.actions[++i]]:[action];
   row.forEach((a,index)=>{const rect={x:16+index*(width/2-8),y,width:paired?width/2-24:width-32,height:42},accent=this.accentFor(a.label);
    neonButton(c,rect,accent,10,true);c.font='600 14px '+OCEAN.fonts.body;c.textAlign='center';c.textBaseline='middle';c.fillStyle=accent==='dim'?OCEAN.colors.muted:OCEAN.colors.text;c.fillText(a.label,rect.x+rect.width/2,rect.y+rect.height/2,rect.width-20);c.textBaseline='alphabetic';this.hits.push({rect,run:a.run});});
   y+=50;
  }
 }
}
