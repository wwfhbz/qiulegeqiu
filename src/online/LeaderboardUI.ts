import type { Game } from '../Game';
import { activateCentralAction } from '../CentralAction';
import { ApiClient,type Me,type BestScore } from './ApiClient';
import { ChallengeSync } from './ChallengeSync';
import { RegionPicker } from './RegionPicker';
export class LeaderboardUI {
  private api=new ApiClient();private sync:ChallengeSync;private dialog:HTMLDialogElement;private me?:Me;private picker:RegionPicker;private lastEnd=-1;private checking=0;private busy=false;
  constructor(private root:HTMLElement,private game:Game){
    this.sync=new ChallengeSync(this.api,game);
    const trophy=document.createElement('button');trophy.className='trophy';trophy.type='button';trophy.textContent='🏆';trophy.setAttribute('aria-label','全球排行榜');root.querySelector('header')!.append(trophy);
    this.dialog=document.createElement('dialog');this.dialog.className='ranking-dialog';this.dialog.setAttribute('aria-label','全球挑战排行榜');this.dialog.innerHTML=`
      <div class="ranking-title"><h2>全球挑战</h2><button type="button" data-online-close aria-label="关闭排行榜">关闭</button></div>
      <section id="challenge-entry" hidden><h3>挑战成绩</h3><p id="challenge-stats"></p>
        <form id="score-form"><label>玩家昵称<input id="nickname" maxlength="24" autocomplete="nickname" placeholder="2～12个字符" required></label>
        <details id="region-details"><summary id="region-label">地区：中国</summary><div id="region-picker"></div></details>
        <p id="bound-region" hidden></p><p id="nickname-check" role="status"></p><p class="identity-note">身份由本浏览器安全会话保留。清除浏览器数据后，不能仅凭昵称找回。</p>
        <button type="submit" id="submit-score">提交成绩</button></form>
        <div class="ranking-actions"><button type="button" id="view-board">查看排行榜</button><button type="button" id="skip-score">跳过提交，重新挑战</button></div>
      </section>
      <section id="board-content"><p id="my-best">个人最高分：尚未登记</p><p class="ranking-caption">全服历史最佳 · 全球前100名</p><div class="ranking-table-wrap"><table><thead><tr><th>排名</th><th>玩家</th><th>分数</th><th>关卡</th></tr></thead><tbody id="ranking-rows"></tbody></table></div><div class="ranking-actions"><button type="button" id="previous-page">上一页</button><button type="button" id="next-page">下一页</button></div></section>
      <p id="online-message" role="status"></p><details class="appeal"><summary>昵称或账号申诉</summary><label>申诉说明<textarea id="appeal-text" maxlength="500" placeholder="请说明问题，不要填写密码或联系方式"></textarea></label><button id="appeal-send" type="button">提交申诉</button></details>`;
    root.append(this.dialog);this.picker=new RegionPicker(this.el('region-picker'),this.api,()=>{this.el('region-label').textContent=`地区：${this.picker.prefix}`;void this.checkNickname();});
    this.button('submit-score').disabled=false;
    trophy.onclick=()=>{if(game.state==='running')game.pause();this.open(false);};
    this.dialog.querySelector<HTMLButtonElement>('[data-online-close]')!.onclick=()=>this.dialog.close();
    this.el('score-form').onsubmit=e=>{e.preventDefault();void this.submit();};
    this.button('skip-score').onclick=()=>{this.dialog.close();activateCentralAction(game);};
    this.button('view-board').onclick=()=>{this.el('board-content').hidden=false;void this.loadBoard(0);};
    this.input('nickname').oninput=()=>{const revision=++this.checking;window.setTimeout(()=>{if(revision===this.checking)void this.checkNickname();},350);};
    this.button('appeal-send').onclick=()=>void this.appeal();
    void this.api.me().then(me=>this.applyMe(me)).catch(()=>{});
  }
  private el(id:string){return this.dialog.querySelector<HTMLElement>(`#${id}`)!;}
  private input(id:string){return this.el(id) as HTMLInputElement;}
  private button(id:string){return this.el(id) as HTMLButtonElement;}
  private message(text:string){this.el('online-message').textContent=text;}
  private applyMe(me:Me){this.me=me;if(me.player){this.input('nickname').value=me.player.nickname;this.input('nickname').disabled=true;this.el('region-details').hidden=true;this.el('bound-region').hidden=false;this.el('bound-region').textContent=`地区：${me.player.prefix}`;this.el('nickname-check').textContent='已绑定当前玩家';this.el('region-label').textContent=me.player.display_name;}this.el('my-best').textContent=me.best?`我的排名：${me.best.rank} · 历史最高：${me.best.score} 分`:'个人最高分：暂无已验证成绩';}
  observe(game:Game){this.sync.observe();if((game.state==='gameOver'||game.state==='victory')&&this.lastEnd!==game.journal.generation){this.lastEnd=game.journal.generation;this.open(true);}}
  private open(ended:boolean){this.el('challenge-entry').hidden=!ended;this.el('board-content').hidden=ended;this.message('');if(ended){const s=this.game.journal.summary(this.game.score.total,this.game.levels.current.number,this.game.state==='victory');this.el('challenge-stats').textContent=`总分 ${s.score} · 到达第${s.reachedLevel}关 · 消除 ${s.bricksDestroyed} 块 · ${(s.durationMs/1000).toFixed(1)} 秒`;}
    if(!this.dialog.open)this.dialog.showModal();void this.api.me(true).then(me=>this.applyMe(me)).catch(error=>this.message(error.message));if(!ended)void this.loadBoard(0);
  }
  private async checkNickname(){if(this.me?.player)return;const name=this.input('nickname').value;if(!name.trim()){this.el('nickname-check').textContent='';return;}const revision=++this.checking;try{const result=await this.api.request<{message:string;available:boolean}>(`/players/availability?${new URLSearchParams({nickname:name,region:this.picker.code})}`);if(revision===this.checking)this.el('nickname-check').textContent=result.message;}catch(error){if(revision===this.checking)this.el('nickname-check').textContent=(error as Error).message;}}
  private async submit(){if(this.busy)return;this.busy=true;this.button('submit-score').disabled=true;try{this.message('正在校验挑战记录…');const me=await this.api.me(true);if(!me.player){await this.api.request('/players',{nickname:this.input('nickname').value,regionCode:this.picker.code});this.applyMe(await this.api.me(true));}const result=await this.sync.submit();this.applyMe(await this.api.me(true));this.message(result.verificationStatus==='verified'?'成绩已登记，排行榜显示个人历史最佳。':'成绩已登记，异常记录待复核后参与排名。');this.el('board-content').hidden=false;await this.loadBoard(0,false);}catch(error){this.message((error as Error).message+'；您可以跳过提交直接重新挑战。');}finally{this.busy=false;this.button('submit-score').disabled=false;}}
  private async loadBoard(offset:number,showError=true){this.button('previous-page').disabled=offset===0;this.button('next-page').disabled=true;const body=this.el('ranking-rows');body.replaceChildren();try{const result=await this.api.request<{items:(BestScore&{nickname:string})[];nextOffset:number|null}>(`/leaderboard?offset=${offset}&limit=20`);for(const row of result.items){const tr=document.createElement('tr');for(const text of [String(row.rank),row.display_name,String(row.score),String(row.reached_level)]){const cell=document.createElement('td');cell.textContent=text;cell.title=text;tr.append(cell);}body.append(tr);}if(!result.items.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=4;cell.textContent='还没有已验证成绩，来留下你的记录。';row.append(cell);body.append(row);}this.button('previous-page').onclick=()=>void this.loadBoard(Math.max(0,offset-20));this.button('next-page').disabled=result.nextOffset===null;this.button('next-page').onclick=()=>void this.loadBoard(result.nextOffset!);}catch(error){if(showError)this.message((error as Error).message);}}
  private async appeal(){try{await this.api.request('/appeals',{message:(this.el('appeal-text') as HTMLTextAreaElement).value});this.message('申诉已提交，请保留当前浏览器身份等待处理。');}catch(error){this.message((error as Error).message);}}
}
