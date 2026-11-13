import type {WechatApi} from '../Api';
import type {Wx} from '../Platform';
import {assertGlobalBoard,assertEndlessBoard,ENDLESS_RANKING_SCOPE,isEndlessRules,type LeaderboardMetadata} from '../../../shared/Challenge';
import type {BestScore} from '../../../src/online/ApiClient';
import {rulesFor,type SocialMode} from './Protocol';
/** Only authenticated server bests enter the cloud-write path; never accept a caller-supplied score. */
export class CloudSync {
 private pending?:Promise<void>;private lastAttempt=0;
 resume(){if(Date.now()-this.lastAttempt>30000)void this.retry();}
 status='尚未同步好友成绩';
 constructor(private wx:Wx,private api:WechatApi){}
 retry(){if(this.pending)return this.pending;this.pending=this.run().finally(()=>{this.pending=undefined;});return this.pending;}
 private async run(){this.lastAttempt=Date.now();
  if(!this.api.authenticated||!this.wx.getOpenDataContext){this.status='登录后可同步已校验最佳成绩';return;}
  try{const me=await this.api.me();if(!me.player){this.status='登记玩家后可同步';return;}const player=me.player.id;
   // Both requests are authenticated and carry the server's board/rules metadata.
   for(const mode of ['campaign','endless'] as SocialMode[]){const board=mode==='campaign'?'global':'endless',result=await this.api.request<{best:BestScore|null}&LeaderboardMetadata>('/me/best?board='+board);
    if(mode==='campaign')assertGlobalBoard(result);else assertEndlessBoard(result);
    const current=await this.api.me();if(current.player?.id!==player)throw Error('身份已变化，请重新同步');
    if(result.best){const score=result.best.score;if(!Number.isSafeInteger(score)||score<0)throw Error('服务器最佳成绩格式无效');if(mode==='endless'&&(!result.best.rules_version||!isEndlessRules(result.best.rules_version)))throw Error('服务器最佳成绩缺少真实无尽规则审计字段');this.wx.getOpenDataContext().postMessage({type:'sync-best',mode,score,rulesVersion:mode==='endless'?result.best.rules_version!:rulesFor(mode),...(mode==='endless'?{rankingScope:ENDLESS_RANKING_SCOPE}:{})});}
   }this.status='已送交微信同步；云存储失败可刷新重试';
  }catch{this.status='好友成绩同步暂不可用，稍后刷新重试；全球记录不受影响';}
 }
}
