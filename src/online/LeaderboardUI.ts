import {scoreHistoryLines} from '../../shared/ScoreHistory';
import "./ranking/ranking.css";
import "./ranking/reference.css";
import "./ranking/legacy.css";
import {REFERENCE,referenceSeconds} from './ranking/ReferenceLayout';
import {assertGlobalBoard,assertEndlessBoard,type LeaderboardMetadata} from '../../shared/Challenge';
import {CUP_SVG,BALL_SVG} from './ranking/Artwork';
import {iconSvg} from '../../shared/Icons';
import {rankingElement,boardStatus} from './ranking/WebCards';
import {motionQuality,personalRanking,RANKING_THEME,RankingMotion,type RankingScore} from './ranking/Presentation';
import { GAME_NAME } from '../../shared/Brand';
import type { Game } from '../Game';
import { ApiClient,type Me } from './ApiClient';
import { ChallengeSync } from './ChallengeSync';
import { RegionPicker } from './RegionPicker';
export class LeaderboardUI {
  private qualityMotion=new RankingMotion();
  private motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
  private board:'global'|'endless'='global';
  private boardRevision=0;private offset=0;private api=new ApiClient();private sync:ChallengeSync;private dialog:HTMLDialogElement;private me?:Me;private picker:RegionPicker;private lastEnd=-1;private checking=0;private busy=false;
  constructor(private root:HTMLElement,private game:Game){
    this.sync=new ChallengeSync(this.api,game);
    this.sync.onProgress=(uploaded,total)=>{if(this.busy)this.message(`正在校验挑战记录… 已上传 ${uploaded}/${total} 条`);};
    const trophy=document.createElement('button');trophy.className='trophy icon-btn';trophy.type='button';trophy.innerHTML=iconSvg('trophy');trophy.setAttribute('aria-label','全球排行榜');root.querySelector('header')!.append(trophy);
    this.dialog=document.createElement('dialog');this.dialog.className='ranking-dialog';this.dialog.setAttribute('aria-label','全球历史排行榜');this.dialog.innerHTML=`
      <div class="ranking-title"><span class="stellar-cup">${CUP_SVG}</span><div><small>${GAME_NAME} · 挑战记录</small><h2>全球历史排行榜</h2><p>同一个榜单，每一次真实突破</p></div><button type="button" data-online-close aria-label="关闭排行榜">×</button></div>
      <div class="ranking-scroll">
      <section id="challenge-entry" hidden><h3>挑战成绩</h3><div id="challenge-stats"><div class="challenge-total"><span>本次总分</span><strong id="challenge-score">0</strong></div><div class="challenge-metrics"><span>关卡<strong id="challenge-level"></strong></span><span>消除砖块<strong id="challenge-bricks"></strong></span><span>挑战时间<strong id="challenge-time"></strong></span></div></div>
        <form id="score-form"><label>玩家昵称<input id="nickname" maxlength="24" autocomplete="nickname" placeholder="2～12个字符" required></label>
        <details id="region-details"><summary id="region-label">地区：中国</summary><div id="region-picker"></div></details>
        <p id="bound-region" hidden></p><p id="nickname-check" role="status"></p><p class="identity-note">身份由本浏览器安全会话保留。清除浏览器数据后，不能仅凭昵称找回。</p>
        <button type="submit" id="submit-score">提交成绩</button></form>
        <div class="ranking-actions"><button type="button" id="view-board">查看排行榜</button><button type="button" id="skip-score">跳过提交，选择模式</button></div>
      </section>
      <section id="board-content"><div class="board-tabs" role="tablist" aria-label="榜单"><button type="button" role="tab" data-board="global" aria-selected="true">闯关榜</button><button type="button" role="tab" data-board="endless" aria-selected="false">无尽榜</button></div><p class="ranking-caption"><span id="board-caption">★ 全球 TOP100</span><span>历史最高有效成绩</span></p><div class="reference-head">${REFERENCE.labels.map(label=>`<span>${label}</span>`).join('')}</div><div id="ranking-rows" role="list" aria-label="全球排名"></div><div class="ranking-actions ranking-pagination"><button type="button" id="previous-page">上一页</button><button type="button" id="refresh-board">↻ 刷新</button><button type="button" id="next-page">下一页</button></div><button type="button" id="return-score" hidden>本次挑战成绩</button><details class="ranking-account"><summary>账号与历史记录</summary><button type="button" id="wechat-link">生成微信账号绑定码</button><p id="historical-best"></p></details></section>
      <p id="online-message" role="status"></p><details class="appeal"><summary>昵称或账号申诉</summary><label>申诉说明<textarea id="appeal-text" maxlength="500" placeholder="请说明问题，不要填写密码或联系方式"></textarea></label><button id="appeal-send" type="button">提交申诉</button></details></div><aside class="my-ranking"><span class="ball-avatar" role="img" aria-label="统一球球默认头像">${BALL_SVG}</span><div class="my-ranking-content"><p id="my-best">我的排名：正在读取</p><span id="my-name"></span><div id="my-stats"></div></div></aside>`;
    for(const key of ['champion','honor','card','borderGold','borderBlue','gold'] as const)this.dialog.style.setProperty('--rank-'+key,RANKING_THEME[key]);
    this.dialog.dataset.quality='low';
    this.motionPreference.addEventListener('change',()=>this.syncMotion());document.addEventListener('visibilitychange',()=>this.syncMotion());this.dialog.addEventListener('close',()=>this.syncMotion());
    root.append(this.dialog);this.picker=new RegionPicker(this.el('region-picker'),this.api,()=>{this.el('region-label').textContent=`地区：${this.picker.prefix}`;void this.checkNickname();});
    this.button('refresh-board').onclick=()=>{this.message('');void this.loadBoard(this.offset);void this.api.me(true).then(me=>this.applyMe(me)).catch(error=>{this.personalUnavailable();this.message(error.message);});};
    this.button('submit-score').disabled=false;
    for(const tab of Array.from(this.dialog.querySelectorAll<HTMLButtonElement>('[data-board]')))tab.onclick=()=>{this.selectBoard(tab.dataset.board as 'global'|'endless');this.message('');void this.loadBoard(0);};
    trophy.onclick=()=>{if(game.state==='running')game.pause();this.open(false);};
    this.dialog.querySelector<HTMLButtonElement>('[data-online-close]')!.onclick=()=>this.dialog.close();
    this.el('score-form').onsubmit=e=>{e.preventDefault();void this.submit();};
    // Closing returns to the mode picker shown after every finished run.
    this.button('skip-score').onclick=()=>this.dialog.close();
    this.button('return-score').onclick=()=>this.open(true);
    this.button('view-board').onclick=()=>{this.dialog.classList.remove('submission-view');this.selectBoard(this.board);this.el('challenge-entry').hidden=true;this.button('return-score').hidden=false;this.el('board-content').hidden=false;void this.loadBoard(0);};
    this.input('nickname').oninput=()=>{const revision=++this.checking;window.setTimeout(()=>{if(revision===this.checking)void this.checkNickname();},350);};
    this.button('wechat-link').onclick=()=>void this.linkWechat();
    this.button('appeal-send').onclick=()=>void this.appeal();
    void this.api.me().then(me=>this.applyMe(me)).catch(()=>{});
  }
  private syncMotion(){
    const device=navigator as Navigator&{deviceMemory?:number};
    this.qualityMotion.update(performance.now(),this.dialog.open&&!document.hidden&&this.game.state!=='paused');
    const quality=this.dialog.open?motionQuality(!document.hidden,this.game.state==='paused',this.motionPreference.matches,this.qualityMotion.low||(device.hardwareConcurrency??4)<=4||(device.deviceMemory??4)<=4||innerWidth<360):'off';
    const animate=String(quality!=='off');if(this.dialog.dataset.animate!==animate)this.dialog.dataset.animate=animate;if(this.dialog.dataset.quality!==quality)this.dialog.dataset.quality=quality;
  }
  private personalUnavailable(){this.el('my-best').textContent='我的排名：暂不可用';this.el('my-name').textContent='';this.el('my-stats').textContent='个人记录读取失败，请稍后刷新';}
  get submitting(){return this.busy;}
  private el(id:string){return this.dialog.querySelector<HTMLElement>(`#${id}`)!;}
  private input(id:string){return this.el(id) as HTMLInputElement;}
  private button(id:string){return this.el(id) as HTMLButtonElement;}
  private message(text:string){this.el('online-message').textContent=text;}
  private applyMe(me:Me){
    const previouslyBound=!!this.me?.player;this.me=me;
    if(me.player){this.checking++;this.input('nickname').value=me.player.nickname;this.input('nickname').disabled=true;this.el('region-details').hidden=true;this.el('bound-region').hidden=false;this.el('bound-region').textContent=`地区：${me.player.prefix}`;this.el('nickname-check').textContent='已绑定当前玩家';this.el('region-label').textContent=me.player.display_name;}
    else{this.input('nickname').disabled=false;this.el('region-details').hidden=false;this.el('bound-region').hidden=true;if(previouslyBound){this.checking++;this.input('nickname').value='';this.el('nickname-check').textContent='当前身份已失效，请重新登记；不能仅凭昵称找回旧账号。';}this.el('region-label').textContent=`地区：${this.picker.prefix}`;}
    if(this.board==='global')this.applyBest(me.best,me.rankingAvailable!==false);else void this.loadEndlessBest();
    const history=scoreHistoryLines(me.historicalBests,me.historicalBest);
    this.el('historical-best').textContent=history.length?history.join('；')+'（已完整保留，需新版重赛上榜）':'';
  }
  private applyBest(best:Me['best'],available:boolean){
    const endless=this.board==='endless',mine=personalRanking(best,available);
    this.el('my-best').textContent=mine.card?mine.title:!available?'个人排名暂不可用，排行榜后端需要更新':endless?'我的排名：未上榜 · 完成无尽模式并提交成绩后登记':'我的排名：未上榜 · 完成十二关规则挑战后登记成绩';
    this.el('my-name').textContent=best?.display_name??this.me?.player?.display_name??'';
    const myStats=this.el('my-stats');myStats.replaceChildren();if(best){for(const [label,value] of [['最高总分',mine.card!.score],[endless?'最高阶段':'最高关卡',endless?`第${best.reached_level}阶段`:mine.card!.level],['消除砖块',mine.card!.bricks],['最佳时间',referenceSeconds(best.duration_ms)]]){const item=document.createElement('span'),caption=document.createElement('small'),number=document.createElement('strong');caption.textContent=label;number.textContent=value;item.append(caption,number);myStats.append(item);}}else myStats.textContent=!available?'个人排名暂不可用，排行榜后端需要更新':'完成挑战并提交有效成绩后上榜';
  }
  /** Endless tab: the player's own endless best, fetched separately from the campaign identity call. */
  private async loadEndlessBest(){try{const result=await this.api.request<{best:Me['best']}&LeaderboardMetadata>('/me/best?board=endless');if(this.board!=='endless')return;assertEndlessBoard(result);this.applyBest(result.best,true);}catch{if(this.board==='endless')this.applyBest(null,false);}}
  /** Switch the dialog between the campaign board and the endless board. */
  private selectBoard(board:'global'|'endless'){
    this.board=board;const endless=board==='endless';
    for(const tab of Array.from(this.dialog.querySelectorAll<HTMLButtonElement>('[data-board]')))tab.setAttribute('aria-selected',String(tab.dataset.board===board));
    this.dialog.querySelector('.reference-head')!.children[3].textContent=endless?'最高阶段':'最高关卡';
    this.el('board-caption').textContent=endless?'★ 无尽 TOP100':'★ 全球 TOP100';
    if(!this.dialog.classList.contains('submission-view')){const title=endless?'无尽模式排行榜':'全球历史排行榜';this.dialog.querySelector('h2')!.textContent=title;this.dialog.setAttribute('aria-label',title);}
    if(this.me){if(endless)void this.loadEndlessBest();else this.applyBest(this.me.best,this.me.rankingAvailable!==false);}
  }
  observe(game:Game){this.syncMotion();this.sync.observe();if((game.state==='gameOver'||game.state==='victory')&&this.lastEnd!==game.journal.generation){this.lastEnd=game.journal.generation;this.open(true);}}
  private open(ended:boolean){this.dialog.querySelector('h2')!.textContent=ended?'本次挑战成绩':'全球历史排行榜';this.dialog.setAttribute('aria-label',ended?'本次挑战成绩':'全球历史排行榜');this.dialog.classList.toggle('submission-view',ended);this.button('return-score').hidden=ended||(this.game.state!=='gameOver'&&this.game.state!=='victory');this.el('challenge-entry').hidden=!ended;this.el('board-content').hidden=ended;this.message('');if(ended){const s=this.game.journal.summary(this.game.score.total,this.game.reachedLevel,this.game.state==='victory');this.el('challenge-score').textContent=s.score.toLocaleString('zh-CN');this.el('challenge-level').textContent=`到达第${s.reachedLevel}关`;this.el('challenge-bricks').textContent=s.bricksDestroyed.toLocaleString('zh-CN');this.el('challenge-time').textContent=`${(s.durationMs/1000).toFixed(1)} 秒`;}
    if(!this.dialog.open)this.dialog.showModal();this.syncMotion();void this.api.me(true).then(me=>this.applyMe(me)).catch(error=>{this.personalUnavailable();this.message(error.message);});if(!ended)void this.loadBoard(0);
  }
  private async checkNickname(){if(this.me?.player)return;const name=this.input('nickname').value;if(!name.trim()){this.el('nickname-check').textContent='';return;}const revision=++this.checking;try{const result=await this.api.request<{message:string;available:boolean}>(`/players/availability?${new URLSearchParams({nickname:name,region:this.picker.code})}`);if(revision===this.checking)this.el('nickname-check').textContent=result.message;}catch(error){if(revision===this.checking)this.el('nickname-check').textContent=(error as Error).message;}}
  private async submit(){
    if(this.busy)return;this.busy=true;this.button('submit-score').disabled=true;
    try{
      this.message('正在校验挑战记录…');const me=await this.api.me(true);
      if(!me.player){await this.api.request('/players',{nickname:this.input('nickname').value,regionCode:this.picker.code});this.applyMe(await this.api.me(true));}
      const result=await this.sync.submit();let refreshed:Me|undefined;
      try{refreshed=await this.api.me(true);this.applyMe(refreshed);}catch{/* The score is already saved; a refresh failure must not claim submission failed. */}
      this.dialog.classList.remove('submission-view');this.el('challenge-entry').hidden=true;this.button('return-score').hidden=false;this.el('board-content').hidden=false;this.selectBoard(this.game.mode==='endless'?'endless':'global');const loaded=await this.loadBoard(0,false);
      const saved=result.verificationStatus==='verified'?'成绩已登记':'成绩已登记，异常记录待复核后参与排名';
      this.message(saved+(refreshed?.rankingAvailable===false?'；统一排行榜后端需要更新，记录未丢失。':!loaded||!refreshed?'；榜单或个人记录暂无法刷新，请稍后重试。':'，排行榜显示个人最高有效成绩。'));
    }catch(error){const detail=(error as Error).message;this.message(detail+'；挑战记录仍保留在本页面。'+(!this.sync.canRetry?'本轮无法继续登记，请先解决接口或身份问题，再重新挑战。':'修复接口或网络问题后可重试提交，也可跳过重新挑战。'));}
    finally{this.busy=false;this.button('submit-score').disabled=false;}
  }
  private async loadBoard(offset:number,showError=true){
    const revision=++this.boardRevision;this.offset=offset;this.button('previous-page').disabled=offset===0;this.button('next-page').disabled=true;
    const body=this.el('ranking-rows');body.setAttribute('aria-busy','true');boardStatus(body,'正在加载排行榜','loading');
    try{const result=await this.api.request<{items:RankingScore[];nextOffset:number|null}&LeaderboardMetadata>(`/leaderboard?offset=${offset}&limit=20&board=${this.board}`);const endless=this.board==='endless';if(endless){assertEndlessBoard(result);}else assertGlobalBoard(result);if(revision!==this.boardRevision)return;
      body.replaceChildren(...result.items.map(row=>rankingElement(row,endless)));if(!result.items.length)boardStatus(body,offset===0?'暂时还没有上榜成绩':'这一页暂无成绩','empty');
      this.button('previous-page').onclick=()=>void this.loadBoard(Math.max(0,offset-20));this.button('next-page').disabled=result.nextOffset===null;this.button('next-page').onclick=()=>void this.loadBoard(result.nextOffset!);return true;
    }catch(error){if(revision===this.boardRevision){boardStatus(body,'排行榜暂时无法加载','error',(error as Error).message);if(showError)this.message((error as Error).message);}return false;}
    finally{if(revision===this.boardRevision)body.setAttribute('aria-busy','false');}
  }
  private async linkWechat(){try{const me=await this.api.me(true);if(!me.player)throw Error('请先在网页登记自己的玩家昵称');const result=await this.api.request<{ticket:string}>('/account/link-ticket',{});this.message('请仅在你自己的微信小游戏中输入此绑定码，五分钟有效、仅限使用一次，切勿向他人透露：'+result.ticket);}catch(error){this.message((error as Error).message);}}
  private async appeal(){try{await this.api.request('/appeals',{message:(this.el('appeal-text') as HTMLTextAreaElement).value});this.message('申诉已提交，请保留当前浏览器身份等待处理。');}catch(error){this.message((error as Error).message);}}
}
