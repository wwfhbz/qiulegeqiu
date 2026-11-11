/** Read-only presentation: server order, rank and score are never recalculated here. */
export interface RankingScore {rank:number;display_name:string;score:number;reached_level:number;bricks_destroyed?:number;duration_ms?:number}
export const RANKING_THEME={champion:'#79547f',honor:'#513570',card:'#203d7c',borderGold:'#ffe18a',borderBlue:'#7ba9ed',purple:'#291650',blue:'#142c72',cyan:'#73e6ff',gold:'#ffe185',ink:'#f4efff',muted:'#c0b6e2',firstHeight:156,cardHeight:136} as const;
export const RANKING_TITLE='全球历史排行榜';
export function numberText(value:number|undefined){return value!==undefined&&Number.isFinite(value)?Math.trunc(value).toLocaleString('en-US'):'—';}
/** Keep milliseconds visible when otherwise tied scores differ only by duration. */
export function timeText(ms:number|undefined){if(ms===undefined||!Number.isFinite(ms)||ms<0)return '—';const value=Math.trunc(ms);return `${Math.floor(value/60000)}:${String(Math.floor(value/1000)%60).padStart(2,'0')}.${String(value%1000).padStart(3,'0')}`;}

export function rankingCard(row:RankingScore){return {rank:row.rank,rankLabel:`第${numberText(row.rank)}名`,name:row.display_name,honor:row.rank>=1&&row.rank<=5,champion:row.rank===1,score:numberText(row.score),level:`第${numberText(row.reached_level)}关`,bricks:numberText(row.bricks_destroyed),time:timeText(row.duration_ms)};}
export function personalRanking(best:RankingScore|null|undefined,available=true,signedOut=false){
 if(best)return {title:`我的排名：${numberText(best.rank)}`,card:rankingCard(best),message:''};
 return {title:!available?'我的排名：暂不可用':signedOut?'我的排名：未登录':'我的排名：未上榜',card:null,message:!available?'个人记录读取失败，请稍后刷新':signedOut?'完成微信登录后查看个人记录':'完成挑战并提交有效成绩后上榜'};
}

export type BoardState='loading'|'ready'|'error';
export type MotionQuality='off'|'low'|'full';
export function motionQuality(visible:boolean,paused:boolean,reduced:boolean,lowDevice:boolean):MotionQuality{return !visible||paused||reduced?'off':lowDevice?'low':'full';}
/** Bounded decorative clock. Pausing freezes phase instead of advancing hidden time. */
export class RankingMotion {
 private last?:number;time=0;private samples=0;private elapsed=0;low=false;
 update(now:number,active:boolean){
  if(this.last!==undefined&&active){const dt=Math.max(0,now-this.last);if(dt>0&&dt<250){this.samples++;this.elapsed+=dt;if(this.samples>=12){if(this.elapsed/this.samples>21)this.low=true;this.samples=0;this.elapsed=0;}}this.time+=Math.min(dt,50);}
  this.last=now;return this.time;
 }
}
