import {OCEAN,OCEAN_CSS,levelBandColors} from '../shared/VisualTheme';
import {createWebHost,createWebAudio} from './platform/WebPlatform';
import {AudioSystem} from './Audio';
import { LeaderboardUI } from './online/LeaderboardUI';
import { GAME_NAME, MINIGAME_VERSION } from '../shared/Brand';
import { iconSvg } from '../shared/Icons';
import { Game, type GameMode } from './Game';
import { ENDLESS } from './endless/EndlessRules';
import { C } from './GameConfig';
import { VIEW, ARENA_IN_VIEW } from './Viewport';
import { activateCentralAction, centralActionFor } from './CentralAction';
import { START_HINT, startFromPlayfield } from './PlayfieldStart';
import { STATE_LABELS } from './GameState';
import { ARCADE } from './ArcadeRules';
import { fitGamePanel } from './ViewportLayout';

/** DOM presentation and inputs only; scoring, lives and levels are owned by Game. */
export function mountGame(root: HTMLElement) {
  for(const [key,value] of Object.entries(OCEAN_CSS))document.documentElement.style.setProperty(key,value);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content',OCEAN.colors.background);
  // Title-screen illustration: a small dome of bricks in the level-1 band colours.
  const bands=levelBandColors(1),heroBricks=[3,5,7,7,7,5].map((n,row)=>Array.from({length:n},()=>`<i style="background:${bands[row]}"></i>`).join('')).map(r=>`<span>${r}</span>`).join('');
  root.innerHTML = `
  <main class="shell">
    <header><div class="mode-switch" role="group" aria-label="游戏模式"><button type="button" data-mode="campaign" aria-pressed="true">闯关</button><button type="button" data-mode="endless" aria-pressed="false">无尽</button></div><h1>${GAME_NAME}</h1><div class="top-actions"><button id="mute" class="icon-btn" type="button" aria-label="静音" aria-pressed="false">${iconSvg('soundOn')}</button><button id="pause" class="icon-btn" type="button" aria-label="暂停">${iconSvg('pause')}</button><button id="reset" class="icon-btn" type="button" aria-label="重新开始">${iconSvg('restart')}</button></div></header>
    <div class="stage-room"><section class="game-panel" aria-label="游戏区域">
      <div class="hud" aria-label="游戏状态">
        <div class="hud-chip hud-level"><span class="label" id="level-label">关卡</span><strong id="level"></strong></div>
        <div class="hud-score"><span class="label">分数</span><strong id="score">0</strong></div>
        <div class="hud-chip hud-lives"><span class="label">生命</span><span id="hearts" role="img" aria-live="polite"></span><span id="lives" class="sr-only"></span></div>
        <div class="hud-row">
          <span class="hud-stat"><span class="label">弹球</span><strong id="ball-badge">×<span id="balls">1</span></strong></span>
          <span class="hud-stat"><span class="label">剩余</span><strong id="remaining">0</strong></span>
          <div class="hud-progress"><span class="label"><span id="progress-label">进度</span><span id="progress-value">0%</span></span><span id="progress-meter" role="progressbar" aria-label="本关消除进度" aria-valuemin="0" aria-valuemax="100"><i></i></span></div>
        </div>
      </div>
      <div class="canvas-wrap"><canvas id="arena-canvas" aria-label="圆形弹球竞技场，移动鼠标或拖动控制挡板"></canvas>
        <span id="status" class="sr-only" role="status"></span><span id="removed" class="sr-only"></span><span id="total" class="sr-only"></span>
        <section id="settlement" class="settlement" aria-live="polite" hidden>
          <h2 id="result-title"></h2><p id="result-tip"></p>
          <div class="result-total"><span id="result-label"></span><strong id="result-score">0</strong></div><p id="score-details"></p>
        </section>
        <div id="central-layer" class="central-layer" hidden><button id="start" class="central-start" type="button" aria-controls="arena-canvas">开始游戏</button></div>
      </div>
      <div class="touch-pad" id="touch-pad" role="presentation" data-fill><div class="power-info"><span id="wide"></span><span id="combo"></span><span id="limit-warn"></span></div><div class="pad-swipe" aria-hidden="true"><i class="chev left"><b></b><b></b><b></b></i><span class="pad-hint">左右滑动控制挡板</span><i class="chev right"><b></b><b></b><b></b></i></div></div>
    </section></div>
    <button id="stress" class="debug" hidden>百球压力测试</button>
    <section id="title-screen" class="title-screen" aria-label="选择游戏模式">
      <div class="ts-inner">
        <div class="ts-hero" aria-hidden="true"><div class="ts-ring"><div class="ts-bricks">${heroBricks}</div><i class="ts-orbit"><b></b></i><span class="ts-ball"></span><span class="ts-paddle"></span></div></div>
        <div class="ts-logo" role="heading" aria-level="1">${GAME_NAME}</div>
        <p class="ts-tag">圆形弹球 · 击碎星际砖墙</p>
        <div class="ts-result" aria-live="polite">
          <div class="tr-medal" aria-hidden="true">${iconSvg('trophy')}</div>
          <span class="tr-mode" id="tr-mode"></span>
          <div class="tr-title" id="tr-title" role="heading" aria-level="2">挑战结束</div>
          <div class="tr-score-label">本次总分</div>
          <div class="tr-score" id="tr-score">0</div>
          <div class="tr-stats"><span><i id="tr-level-label">关卡</i><b id="tr-level"></b></span><span><i>消除砖块</i><b id="tr-bricks"></b></span><span><i id="tr-extra-label">用时</i><b id="tr-extra"></b></span></div>
          <button type="button" id="tr-submit" class="tr-submit">${iconSvg('trophy')}<span>提交成绩</span></button>
        </div>
        <div class="ts-again">再来一局 · 选择模式</div>
        <div class="ts-cards">
          <button type="button" class="ts-card ts-campaign" data-pick="campaign"><span class="ts-icon">${iconSvg('flag')}</span><span class="ts-text"><strong>闯关模式</strong><span class="ts-desc">12 关逐关突破，冲击闯关榜</span><span class="ts-chips"><em>5 条命</em><em>12 关</em><em>闯关榜</em></span></span><span class="ts-go">${iconSvg('play')}</span><span class="ts-last">上次玩过</span></button>
          <button type="button" class="ts-card ts-endless" data-pick="endless"><span class="ts-icon">${iconSvg('infinity')}</span><span class="ts-text"><strong>无尽模式</strong><span class="ts-desc">砖墙不断下沉，坚持越久分越高</span><span class="ts-chips"><em>3 条命</em><em>无限阶段</em><em>无尽榜</em></span></span><span class="ts-go">${iconSvg('play')}</span><span class="ts-last">上次玩过</span></button>
        </div>
        <div class="ts-tools"><button type="button" id="ts-board" class="ts-tool">${iconSvg('trophy')}<span>排行榜</span></button><button type="button" id="ts-sound" class="ts-tool" aria-pressed="false">${iconSvg('soundOn')}<span>音效开</span></button></div>
        <p class="ts-foot">每局结束后可重新选择模式 · V${MINIGAME_VERSION}</p>
      </div>
    </section>
  </main>`;
  // Lookups and text writes are cached: update() runs every frame, so only real changes touch the DOM.
  const found = new Map<string, HTMLElement>();
  const el = (id: string) => { let node = found.get(id); if (!node) { node = root.querySelector<HTMLElement>(`#${id}`)!; found.set(id, node); } return node; };
  const shown = new Map<string, string>();
  const text = (id: string, value: string) => { if (shown.get(id) !== value) { shown.set(id, value); el(id).textContent = value; } };
  const button = (id: string) => el(id) as HTMLButtonElement;
  let online: LeaderboardUI | undefined;
  let picking = true;
  // Desktop keyboard: ←/→ or A/D steer while held; Space/Enter launches, pauses or resumes; Esc/P pauses.
  const held = new Set<string>(); let keyFrame = 0;
  const steerWithKeys = (g: Game) => {
    const now = performance.now(), dt = keyFrame ? Math.min(.05, (now - keyFrame) / 1000) : 0; keyFrame = now;
    const dir = (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0) - (held.has('ArrowLeft') || held.has('KeyA') ? 1 : 0);
    if (dir && !picking) g.physics.setTarget(g.physics.targetX + dir * C.paddle.speed * dt);
  };
  const modeButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-mode]')), pickButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-pick]'));
  // Fill the result page once per finished run (update runs every frame).
  let resultKey='';
  const showResult=(g:Game)=>{
    const key=`${g.journal.generation}:${g.state}:${g.score.total}`;if(key===resultKey)return;resultKey=key;
    const endless=g.mode==='endless',s=g.journal.summary(g.score.total,g.reachedLevel,g.state==='victory');
    el('tr-mode').textContent=endless?'无尽模式':'闯关模式';el('tr-mode').dataset.mode=g.mode;
    el('tr-title').textContent=g.state==='victory'?'全部关卡突破！':endless?'挑战结束':'生命耗尽';
    el('tr-score').textContent=g.score.total.toLocaleString('zh-CN');
    el('tr-level-label').textContent=endless?'到达阶段':'到达关卡';el('tr-level').textContent=endless?`第${g.reachedLevel}阶段`:`第${s.reachedLevel}关`;
    el('tr-bricks').textContent=s.bricksDestroyed.toLocaleString('zh-CN');
    const field=g.physics.endless;el('tr-extra-label').textContent=endless?'砖墙下沉':'挑战用时';el('tr-extra').textContent=endless?`${field?.descents??0} 行`:`${Math.round(s.durationMs/1000)} 秒`;
  };
  const update = (g: Game) => {
    online?.observe(g);
    const blocks = g.physics.blocks, level = g.levels.current;
    const field = g.physics.endless;
    text('level-label', field ? '无尽阶段' : '关卡');
    text('level', field ? `第${g.reachedLevel}阶段` : `${String(level.number).padStart(2, '0')}/${String(g.levels.count).padStart(2, '0')}`);
    if (el('hearts').children.length !== g.maxLives) { shown.delete('hearts:lives'); el('hearts').innerHTML = Array.from({ length: g.maxLives }, () => '<span aria-hidden="true">♥</span>').join(''); }
    el('hearts').setAttribute('aria-label', `剩余${g.lives}条生命`);
    if (shown.get('hearts:lives') !== `${g.lives}/${g.maxLives}`) { shown.set('hearts:lives', `${g.lives}/${g.maxLives}`); el('hearts').querySelectorAll('span').forEach((heart, i) => {const lost=i>=g.lives;heart.classList.toggle('lost',lost);heart.textContent=lost?'♡':'♥';}); }
    text('remaining', String(blocks.remaining));
    text('lives', String(g.lives)); text('score', String(g.score.total));
    text('removed', String(blocks.removed)); text('total', String(blocks.total));
    text('balls', String(g.physics.balls.length));
    // Endless shows the countdown to the next descent instead of a clear percentage.
    const pressed = field && field.variant.crush && field.pressure > 0 ? Math.max(0, (ENDLESS.crushTicks - field.pressure) * C.step) : undefined;
    text('progress-label', field ? (pressed !== undefined ? `压线 ${pressed.toFixed(1)}秒` : field.blocked ? '压到底线' : '下沉') : '进度');
    const percent=field?Math.round(field.descentProgress*100):Math.round(blocks.removed/Math.max(1,blocks.total)*100);text('progress-value', field?`已下沉${field.descents}行`:percent+'%');el('progress-meter').setAttribute('aria-valuenow',String(percent));el('progress-meter').style.setProperty('--fill',percent+'%');
    wrap.dataset.state=g.state;
    // Header switch: usable before a run starts and after it ends; locked while a run is in progress.
    const locked = g.journal.events.length > 0 && g.state !== 'gameOver' && g.state !== 'victory';
    for(const b of modeButtons){b.setAttribute('aria-pressed',String(b.dataset.mode===g.mode));b.disabled=locked&&b.dataset.mode!==g.mode;b.title=locked?'本局结束后可切换模式':'';}
    // The mode picker owns the screen before the first run and after every finished run.
    const ended = g.state === 'gameOver' || g.state === 'victory';
    // The same full-screen page doubles as the result page after every finished run.
    el('title-screen').hidden = !picking && !ended;
    el('title-screen').classList.toggle('result', ended && !picking);
    if (ended && !picking) showResult(g);
    const muted=g.audio.muted;if(el('ts-sound').getAttribute('aria-pressed')!==String(muted)){el('ts-sound').setAttribute('aria-pressed',String(muted));el('ts-sound').innerHTML=`${iconSvg(muted?'soundOff':'soundOn')}<span>${muted?'音效关':'音效开'}</span>`;}
    for(const b of pickButtons)b.classList.toggle('last',b.dataset.pick===g.mode);
    text('status', STATE_LABELS[g.state]);
    const timers=[[g.physics.wideRemaining,'加宽'],[g.physics.pierceRemaining,'穿透'],[g.physics.fireRemaining,'火焰']] as const;
    text('wide', timers.filter(([t])=>t>0).map(([t,name])=>`${name} ${t.toFixed(1)}秒`).join(' · '));
    text('combo', g.score.combo > 1 ? `${g.score.combo} 连击 ×${g.score.multiplier}` : '');
    // Long endless runs: warn before the record limit makes the run impossible to submit.
    text('limit-warn', g.journal.truncated ? '记录已满，本局无法上榜' : g.journal.nearLimit ? '记录即将满额，请尽快结束本局' : '');
    steerWithKeys(g);
    const action = centralActionFor(g);
    const showAction = action !== null && !picking && !ended;
    el('central-layer').hidden = !showAction;
    button('start').classList.toggle('sr-only',g.state==='ready');
    button('start').hidden = !showAction;
    button('start').disabled = action === null;
    if (action) text('start', g.state==='ready'?START_HINT:action.label);
    button('pause').disabled = g.state !== 'running' && g.state !== 'paused';
    const pauseIcon = g.state === 'paused' ? 'play' : 'pause';
    if (button('pause').dataset.icon !== pauseIcon) { button('pause').dataset.icon = pauseIcon; button('pause').innerHTML = iconSvg(pauseIcon); button('pause').setAttribute('aria-label', g.state === 'paused' ? '继续' : '暂停'); }
    const completed = g.state === 'levelComplete' || g.state === 'victory';
    el('settlement').hidden = !completed && g.state !== 'gameOver';
    if (completed || g.state === 'gameOver') {
      text('result-title', GAME_NAME+' · '+(g.state === 'gameOver' ? '游戏结束' : g.state === 'victory' ? '全部关卡突破！' : `第${level.number}关突破成功`));
      text('result-tip', g.state === 'gameOver' ? (field ? `坚持到第${g.reachedLevel}阶段，砖墙共下沉${field.descents}行。` : '生命已耗尽。在下方选择模式，开始新一局。') : g.state === 'victory' ? '最终核心已击碎，你完成了这次挑战。可在下方选择模式再来一局。' : `保留 ${g.lives} 条生命和累计分数，迎接下一关。`);
      text('result-label', g.state === 'levelComplete' ? '本关得分' : '最终分数');
      text('result-score', String(g.state === 'levelComplete' ? g.result!.levelTotal : g.score.total));
      text('score-details', completed ? `本关得分 ${g.result!.blockScore} + 通关 ${g.result!.clearBonus} + 生命 ${g.result!.lifeBonus}　累计 ${g.score.total}` : (field ? `无尽模式 · 第${g.reachedLevel}阶段 · 消除 ${g.journal.bricksDestroyed} 块` : `本次到达第${level.number}关 · 累计 ${g.score.total} 分`));
    }
  };
  el('central-layer').style.setProperty('--arena-x', `${ARENA_IN_VIEW.x * 100}%`);
  el('central-layer').style.setProperty('--arena-y', `${ARENA_IN_VIEW.y * 100}%`);
  el('hearts').innerHTML = Array.from({ length: ARCADE.initialLives }, () => '<span aria-hidden="true">♥</span>').join('');
  const wrap = root.querySelector<HTMLElement>('.canvas-wrap')!;
  wrap.style.setProperty('--arena-x', `${ARENA_IN_VIEW.x * 100}%`);
  wrap.style.setProperty('--arena-y', `${ARENA_IN_VIEW.y * 100}%`);
  wrap.style.aspectRatio = `${VIEW.width} / ${VIEW.height}`;
  fitGamePanel(root.querySelector('.stage-room')!, root.querySelector('.game-panel')!, wrap);
  // The strip under the arena steers the paddle too, so a thumb never has to cover it.
  const game = new Game(createWebHost(root.querySelector('canvas')!,()=>!picking&&!document.hidden&&!online?.submitting&&!root.querySelector('dialog[open]'),[el('touch-pad')]),update,undefined,new AudioSystem(createWebAudio));
  button('start').onclick = () => activateCentralAction(game);
  button('pause').onclick = () => game.state === 'paused' ? game.start() : game.pause();
  const inProgress = () => game.journal.events.length > 0 && game.state !== 'gameOver' && game.state !== 'victory';
  // Restart sits next to pause: confirm before throwing away a run in progress.
  button('reset').onclick = () => {
    if (inProgress()) { const wasRunning = game.state === 'running'; game.pause(); if (!window.confirm('确定放弃本局，重新开始吗？当前分数不会保留。')) { if (wasRunning) game.start(); return; } }
    game.reset();
  };
  const MUTE_KEY='qiulegeqiu:muted';
  const showMute = (muted: boolean) => { button('mute').innerHTML = iconSvg(muted ? 'soundOff' : 'soundOn'); button('mute').setAttribute('aria-pressed', String(muted)); button('mute').setAttribute('aria-label', muted ? '开启音效' : '静音'); };
  button('mute').onclick = () => {
    game.audio.unlock(); const muted = game.audio.toggle(); showMute(muted);
    try{localStorage.setItem(MUTE_KEY,muted?'1':'0');}catch{/* Preference only. */}
  };
  // The sound setting survives a reload, like the WeChat build.
  try{if(localStorage.getItem(MUTE_KEY)==='1'){game.audio.toggle();showMute(true);}}catch{/* Preference only. */}
  button('stress').hidden = new URLSearchParams(location.search).get('debug') !== '1';
  button('stress').onclick = () => game.stress();
  // Mode is chosen once when the game opens, and again only after a run ends (game over or victory).
  const MODE_KEY='qiulegeqiu:mode';
  for(const b of Array.from(root.querySelectorAll<HTMLButtonElement>('[data-pick]')))b.onclick=()=>{
    const mode=b.dataset.pick as GameMode;picking=false;
    if(mode===game.mode)game.reset();else game.setMode(mode);
    try{localStorage.setItem(MODE_KEY,mode);}catch{/* Preference only. */}
    update(game);
  };
  // The header switch picks a mode exactly like the picker (only allowed while no run is in progress).
  for(const b of Array.from(root.querySelectorAll<HTMLButtonElement>('[data-mode]')))b.onclick=()=>{
    const mode=b.dataset.mode as GameMode,locked=game.journal.events.length>0&&game.state!=='gameOver'&&game.state!=='victory';
    if(locked)return;root.querySelector<HTMLButtonElement>(`[data-pick=${mode}]`)?.click();
  };
  // Pre-select the last mode played so it is highlighted in the picker.
  try{if(localStorage.getItem(MODE_KEY)==='endless')game.setMode('endless');}catch{/* Preference only. */}
  // Guard the play screen against accidental selection, long-press menus and pinch zoom (some in-app browsers
  // ignore the CSS alone; double-tap zoom is off via the viewport and touch-action). Form fields behave normally.
  const editable=(t:EventTarget|null)=>t instanceof HTMLElement&&!!t.closest('input,textarea,select,[contenteditable]');
  for(const type of ['selectstart','contextmenu','gesturestart','dragstart'])document.addEventListener(type,e=>{if(!editable(e.target))e.preventDefault();});
  online = new LeaderboardUI(root,game);
  const playable = () => !picking && !document.hidden && !online?.submitting && !root.querySelector('dialog[open]');
  document.addEventListener('keydown', e => {
    if (editable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(e.code)) { if (playable()) { held.add(e.code); e.preventDefault(); } return; }
    // Space/Enter on a focused button keeps its normal click.
    if ((e.code === 'Space' || e.code === 'Enter') && !(e.target instanceof HTMLButtonElement) && playable()) {
      e.preventDefault(); if (e.repeat) return; game.audio.unlock();
      if (game.state === 'running') game.pause(); else if (game.state === 'paused') game.start(); else if (game.state === 'ready') startFromPlayfield(game); else activateCentralAction(game);
      return;
    }
    if ((e.code === 'Escape' || e.code === 'KeyP') && game.state === 'running') game.pause();
  });
  document.addEventListener('keyup', e => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());
  // Title-screen shortcuts reuse the real controls (leaderboard trophy and mute).
  button('tr-submit').onclick=()=>online?.showResult();
  button('ts-board').onclick=()=>root.querySelector<HTMLButtonElement>('header .trophy')?.click();
  button('ts-sound').onclick=()=>{button('mute').click();update(game);};
  update(game); return game;
}
