import type {FriendBoard} from './social/FriendBoard';
import {drawModePicker,modePickerLayout,drawResultPage,resultLayout,drawReviveCard,type ResultView,type ReviveView} from './ModePicker';
import {OCEAN} from '../../shared/VisualTheme';
import {neonButton,glowText,NEON,type NeonAccent} from '../../shared/CanvasUI';
import {GAME_NAME} from '../../shared/Brand';
import type {CanvasSurface} from '../../src/platform/Contracts';
import {RankingCanvas,type RankingView,type RankingAction} from './RankingCanvas';
import {inside,type Rect} from './Layout';
export interface Action {label:string;run:()=>void;half?:boolean;primary?:boolean;/** 'outline': gold-edged secondary button (e.g. several rewarded unlocks in one list). */tone?:'outline'}
export class Panel {
 friend?:FriendBoard;
 ranking?:RankingCanvas;private rankSurface?:CanvasSurface;private canvasFactory?:()=>CanvasSurface;
 configureRankingCache(factory:()=>CanvasSurface){this.canvasFactory=factory;}
 /** Full-screen title page geometry: screen height, first row under the capsule, and the sound state. */
 screen?:{height:number;top:number;muted:boolean;resultTop?:number};
 title='';lines:string[]=[];actions:Action[]=[];hits:{rect:Rect;run:()=>void}[]=[];
 get open(){return !!this.title;}
 /** Set by showResult: the full-screen result page replaces the generic sheet. */
 resultView?:ResultView;
 /** Set by showRevive: the revive card (actions[0] = watch, actions[1] = give up). */
 reviveView?:ReviveView;
 showRevive(title:string,lines:string[],actions:Action[],view:ReviveView){this.show(title,lines,actions);this.reviveView=view;}
 showResult(title:string,lines:string[],actions:Action[],view:ResultView){this.show(title,lines,actions);this.resultView=view;}
 show(title:string,lines:string[],actions:Action[]){this.friend?.hide();this.friend=undefined;this.hits=[];this.ranking=undefined;this.resultView=undefined;this.reviveView=undefined;this.title=title;this.lines=lines;this.actions=actions;}
 close(){this.friend?.hide();this.friend=undefined;this.title='';this.hits=[];this.ranking=undefined;this.resultView=undefined;this.reviveView=undefined;}
 showRanking(view:RankingView,actions:RankingAction[],inspect?:(row:import('../../src/online/ranking/Presentation').RankingScore)=>void){this.show('全球历史排行榜',[view.note||'',...view.items.map(row=>`${row.rank}. ${row.display_name} ${row.score}`)],actions);this.ranking=new RankingCanvas(view,actions,inspect,this.canvasFactory?()=>this.rankSurface??=this.canvasFactory!():undefined);}
 showFriends(friend:FriendBoard){this.show('好友排行榜',[],[]);this.friend=friend;}
 scroll(dy:number,x:number,startY:number){if(this.friend){this.friend.scroll(dy,x,startY);return;}if(this.ranking&&inside(this.ranking.body,x,startY))this.ranking.scroll(dy);}
 tap(x:number,y:number,endX=x,endY=y){if(this.friend){this.friend.tap(endX,endY);return;}if(this.ranking){this.ranking.tap(x,y);return;}const hit=this.hits.find(h=>inside(h.rect,x,y)&&inside(h.rect,endX,endY));hit?.run();}
 /** Accent per action, from its label: campaign cyan, endless pink, submitting gold, closing dim. */
 private accentFor(label:string):NeonAccent{const text=label.replace('▶ ','');return text.includes('闯关')?'cyan':text.includes('无尽')?'pink':text.startsWith('提交')?'gold':text.startsWith('关闭')||text.startsWith('取消')?'dim':'cyan';}
 draw(c:CanvasRenderingContext2D,width:number,top:number,bottom:number,now=0,animate=true,lowDevice=false,art?:CanvasImageSource,pixelRatio=1){
  if(!this.open)return;if(this.friend){this.friend.draw(c,width,top,bottom,pixelRatio);return;}if(this.ranking){this.ranking.draw(c,width,top,bottom,now,animate,lowDevice,art,pixelRatio);return;}this.hits=[];c.textBaseline='alphabetic';
  if(this.reviveView){const r=drawReviveCard(c,width,this.screen?.height??bottom,this.reviveView,now);if(this.actions[0])this.hits.push({rect:r.watch,run:this.actions[0].run});if(this.actions[1])this.hits.push({rect:r.skip,run:this.actions[1].run});return;}
  if(this.resultView){const sc=this.screen??{height:bottom,top,muted:false},v=resultLayout(width,sc.height,sc.resultTop??sc.top,bottom);drawResultPage(c,width,sc.height,v,this.resultView,now);
   const by=(label:string)=>this.actions.find(a=>a.label.replace('▶ ','')===label);
   ([[v.submit,'提交本次成绩'],[v.rows[0],'闯关模式'],[v.rows[1],'无尽模式'],[v.tools[0],'查看全球排行榜'],[v.tools[1],'分享成绩']] as const).forEach(([rect,label])=>{const a=by(label);if(a)this.hits.push({rect,run:a.run});});return;}
  if(this.title==='选择游戏模式'){const sc=this.screen??{height:bottom,top,muted:false},v=modePickerLayout(width,sc.height,sc.top,bottom);
   drawModePicker(c,width,sc.height,v,this.actions[1]?.label.startsWith('▶')?1:0,sc.muted,now);
   [...v.rows,...v.tools].forEach((rect,i)=>{const a=this.actions[i];if(a)this.hits.push({rect,run:a.run});});return;}
  // Candy card (same family as the revive and result pages): dimmed game, rounded card, gold primary buttons.
  const screenH=this.screen?.height??bottom;c.fillStyle='rgba(3,5,12,.8)';c.fillRect(0,0,width,screenH);
  const w=Math.min(360,width-28),x=(width-w)/2,pad=16,inner=w-pad*2;
  const lines:{text:string;big:boolean}[]=[];c.font='500 12px '+OCEAN.fonts.body;
  for(const [index,line] of this.lines.entries()){const big=index===0&&(this.title.endsWith('挑战结束')||this.title.endsWith('十二关突破成功'));if(big){lines.push({text:line,big});continue;}
   let text='';for(const ch of [...line]){if(c.measureText(text+ch).width>inner){lines.push({text,big:false});text='';}text+=ch;}if(text)lines.push({text,big:false});}
  const rows:Action[][]=[];for(let i=0;i<this.actions.length;i++){const a=this.actions[i];rows.push(a.half&&this.actions[i+1]?.half?[a,this.actions[++i]]:[a]);}
  const linesH=lines.reduce((h,l)=>h+(l.big?34:18),0),h=22+30+(lines.length?linesH+12:4)+rows.length*50+8;
  let y=Math.max(top+6,top+(bottom-top-h)/2);
  c.fillStyle='#5A2AB8';c.beginPath();c.roundRect(x,y+6,w,h,24);c.fill();
  const bg=c.createLinearGradient(0,y,0,y+h);bg?.addColorStop(0,'#2A2266');bg?.addColorStop(.6,'#151A46');bg?.addColorStop(1,'#0E1236');c.fillStyle=bg||'#151A46';c.beginPath();c.roundRect(x,y,w,h,24);c.fill();
  c.strokeStyle='rgba(255,255,255,.14)';c.lineWidth=1;c.stroke();
  c.font=`900 21px ${OCEAN.fonts.body}`;c.textAlign='center';c.textBaseline='middle';c.fillStyle='#FFFFFF';c.fillText(this.title,width/2,y+34,inner);y+=56;
  for(const l of lines){if(l.big){glowText(c,l.text,width/2,y+14,inner,24,'#FFE27A');y+=34;continue;}c.font='500 12px '+OCEAN.fonts.body;c.fillStyle='#C9D6EE';c.textAlign='center';c.textBaseline='middle';c.fillText(l.text,width/2,y+8,inner);y+=18;}
  y+=lines.length?10:0;
  for(const row of rows){
   row.forEach((a,index)=>{const half=row.length===2,rect={x:x+pad+(half?index*(inner/2+5):0),y,width:half?inner/2-5:inner,height:42};
    const outline=a.tone==='outline',gold=!outline&&(!!a.primary||a.label.startsWith('▶')),dim=/^(返回|关闭|取消)/.test(a.label);
    if(gold){c.fillStyle='#C9770A';c.beginPath();c.roundRect(rect.x,rect.y+4,rect.width,rect.height,14);c.fill();const g=c.createLinearGradient(0,rect.y,0,rect.y+rect.height);g?.addColorStop(0,'#FFE27A');g?.addColorStop(1,'#FFB31F');c.fillStyle=g||'#FFD24D';c.beginPath();c.roundRect(rect.x,rect.y,rect.width,rect.height,14);c.fill();}
    else{c.fillStyle=outline?'rgba(255,210,77,.08)':'rgba(255,255,255,.08)';c.strokeStyle=outline?'rgba(255,210,77,.6)':'rgba(255,255,255,.18)';c.lineWidth=1;c.beginPath();c.roundRect(rect.x,rect.y,rect.width,rect.height,14);c.fill();c.stroke();}
    c.font=`${gold?900:700} ${gold?15:14}px ${OCEAN.fonts.body}`;c.textAlign='center';c.textBaseline='middle';c.fillStyle=gold?'#5A2C00':outline?'#FFD98A':dim?'#8FA6C8':'#EAF6FF';c.fillText(a.label,rect.x+rect.width/2,rect.y+rect.height/2,rect.width-16);c.textBaseline='alphabetic';this.hits.push({rect,run:a.run});});
   y+=50;
  }
 }
}
