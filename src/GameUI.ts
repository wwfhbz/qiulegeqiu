import {OCEAN,OCEAN_CSS} from '../shared/VisualTheme';
import {createWebHost,createWebAudio} from './platform/WebPlatform';
import {AudioSystem} from './Audio';
import { LeaderboardUI } from './online/LeaderboardUI';
import { GAME_NAME } from '../shared/Brand';
import { iconSvg } from '../shared/Icons';
import { Game, type GameMode } from './Game';
import { ENDLESS } from './endless/EndlessRules';
import { C } from './GameConfig';
import { activateCentralAction, centralActionFor } from './CentralAction';
import { START_HINT } from './PlayfieldStart';
import { STATE_LABELS } from './GameState';
import { ARCADE } from './ArcadeRules';
import { fitGamePanel } from './ViewportLayout';

/** DOM presentation and inputs only; scoring, lives and levels are owned by Game. */
export function mountGame(root: HTMLElement) {
  for(const [key,value] of Object.entries(OCEAN_CSS))document.documentElement.style.setProperty(key,value);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content',OCEAN.colors.background);
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
        <section id="mode-picker" class="mode-picker" aria-label="选择游戏模式">
          <div class="picker-logo">${GAME_NAME}</div>
          <h2>选择游戏模式</h2>
          <button type="button" data-pick="campaign"><i class="pick-icon">${iconSvg('flag')}</i><span class="pick-text"><strong>闯关模式</strong><span>12 关逐关突破 · 5 条命</span></span><b class="pick-go">${iconSvg('play')}</b></button>
          <button type="button" data-pick="endless"><i class="pick-icon">${iconSvg('infinity')}</i><span class="pick-text"><strong>无尽模式</strong><span>砖墙不断下沉 · 3 条命</span></span><b class="pick-go">${iconSvg('play')}</b></button>
          <p>每局结束后可重新选择模式</p>
        </section>
        <div id="central-layer" class="central-layer" hidden><button id="start" class="central-start" type="button" aria-controls="arena-canvas">开始游戏</button></div>
      </div>
      <div class="touch-pad" id="touch-pad" role="presentation"><div class="power-info"><span id="wide"></span><span id="combo"></span></div><div class="pad-track"><i id="pad-knob"></i></div><span class="pad-hint">左右滑动控制挡板</span></div>
    </section></div>
    <button id="stress" class="debug" hidden>百球压力测试</button>
  </main>`;
  const el = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
  const button = (id: string) => el(id) as HTMLButtonElement;
  let online: LeaderboardUI | undefined;
  let picking = true;
  const update = (g: Game) => {
    online?.observe(g);
    const blocks = g.physics.blocks, level = g.levels.current;
    const field = g.physics.endless;
    el('level-label').textContent = field ? '无尽阶段' : '关卡';
    el('level').textContent = field ? `第${g.reachedLevel}阶段` : `${String(level.number).padStart(2, '0')}/${String(g.levels.count).padStart(2, '0')}`;
    if (el('hearts').children.length !== g.maxLives) el('hearts').innerHTML = Array.from({ length: g.maxLives }, () => '<span aria-hidden="true">♥</span>').join('');
    el('hearts').setAttribute('aria-label', `剩余${g.lives}条生命`);
    el('hearts').querySelectorAll('span').forEach((heart, i) => {const lost=i>=g.lives;heart.classList.toggle('lost',lost);heart.textContent=lost?'♡':'♥';});
    el('remaining').textContent = String(blocks.remaining);
    el('lives').textContent = String(g.lives); el('score').textContent = String(g.score.total);
    el('removed').textContent = String(blocks.removed); el('total').textContent = String(blocks.total);
    el('balls').textContent = String(g.physics.balls.length);
    // Endless shows the countdown to the next descent instead of a clear percentage.
    const pressed = field && field.variant.crush && field.pressure > 0 ? Math.max(0, (ENDLESS.crushTicks - field.pressure) * C.step) : undefined;
    el('progress-label').textContent = field ? (pressed !== undefined ? `压线 ${pressed.toFixed(1)}秒` : field.blocked ? '压到底线' : '下沉') : '进度';
    const percent=field?Math.round(field.descentProgress*100):Math.round(blocks.removed/Math.max(1,blocks.total)*100);el('progress-value').textContent=field?`已下沉${field.descents}行`:percent+'%';el('progress-meter').setAttribute('aria-valuenow',String(percent));el('progress-meter').style.setProperty('--fill',percent+'%');
    wrap.dataset.state=g.state;
    // The strip's knob follows the paddle so the strip reads as part of the arena.
    el('pad-knob').style.left=`${g.physics.paddleX/C.width*100}%`;
    // Header switch: usable before a run starts and after it ends; locked while a run is in progress.
    const locked = g.journal.events.length > 0 && g.state !== 'gameOver' && g.state !== 'victory';
    for(const b of Array.from(root.querySelectorAll<HTMLButtonElement>('[data-mode]'))){b.setAttribute('aria-pressed',String(b.dataset.mode===g.mode));b.disabled=locked&&b.dataset.mode!==g.mode;b.title=locked?'本局结束后可切换模式':'';}
    // The mode picker owns the screen before the first run and after every finished run.
    const ended = g.state === 'gameOver' || g.state === 'victory';
    el('mode-picker').hidden = !(picking || ended);
    for(const b of Array.from(root.querySelectorAll<HTMLElement>('[data-pick]')))b.classList.toggle('last',b.dataset.pick===g.mode);
    el('status').textContent = STATE_LABELS[g.state];
    const timers=[[g.physics.wideRemaining,'加宽'],[g.physics.pierceRemaining,'穿透'],[g.physics.fireRemaining,'火焰']] as const;
    el('wide').textContent = timers.filter(([t])=>t>0).map(([t,name])=>`${name} ${t.toFixed(1)}秒`).join(' · ');
    el('combo').textContent = g.score.combo > 1 ? `${g.score.combo} 连击 ×${g.score.multiplier}` : '';
    const action = centralActionFor(g);
    const showAction = action !== null && !picking && !ended;
    el('central-layer').hidden = !showAction;
    button('start').classList.toggle('sr-only',g.state==='ready');
    button('start').hidden = !showAction;
    button('start').disabled = action === null;
    if (action) button('start').textContent = g.state==='ready'?START_HINT:action.label;
    button('pause').disabled = g.state !== 'running' && g.state !== 'paused';
    const pauseIcon = g.state === 'paused' ? 'play' : 'pause';
    if (button('pause').dataset.icon !== pauseIcon) { button('pause').dataset.icon = pauseIcon; button('pause').innerHTML = iconSvg(pauseIcon); button('pause').setAttribute('aria-label', g.state === 'paused' ? '继续' : '暂停'); }
    const completed = g.state === 'levelComplete' || g.state === 'victory';
    el('settlement').hidden = !completed && g.state !== 'gameOver';
    if (completed || g.state === 'gameOver') {
      el('result-title').textContent = GAME_NAME+' · '+(g.state === 'gameOver' ? '游戏结束' : g.state === 'victory' ? '全部关卡突破！' : `第${level.number}关突破成功`);
      el('result-tip').textContent = g.state === 'gameOver' ? (field ? `坚持到第${g.reachedLevel}阶段，砖墙共下沉${field.descents}行。` : '生命已耗尽。在下方选择模式，开始新一局。') : g.state === 'victory' ? '最终核心已击碎，你完成了这次挑战。可在下方选择模式再来一局。' : `保留 ${g.lives} 条生命和累计分数，迎接下一关。`;
      el('result-label').textContent = g.state === 'levelComplete' ? '本关得分' : '最终分数';
      el('result-score').textContent = String(g.state === 'levelComplete' ? g.result!.levelTotal : g.score.total);
      el('score-details').textContent = completed ? `本关得分 ${g.result!.blockScore} + 通关 ${g.result!.clearBonus} + 生命 ${g.result!.lifeBonus}　累计 ${g.score.total}` : (field ? `无尽模式 · 第${g.reachedLevel}阶段 · 消除 ${g.journal.bricksDestroyed} 块` : `本次到达第${level.number}关 · 累计 ${g.score.total} 分`);
    }
  };
  el('central-layer').style.setProperty('--arena-x', `${C.arena.x / C.width * 100}%`);
  el('central-layer').style.setProperty('--arena-y', `${C.arena.y / C.height * 100}%`);
  el('hearts').innerHTML = Array.from({ length: ARCADE.initialLives }, () => '<span aria-hidden="true">♥</span>').join('');
  const wrap = root.querySelector<HTMLElement>('.canvas-wrap')!;
  wrap.style.setProperty('--arena-x', `${C.arena.x / C.width * 100}%`);
  wrap.style.setProperty('--arena-y', `${C.arena.y / C.height * 100}%`);
  fitGamePanel(root.querySelector('.stage-room')!, root.querySelector('.game-panel')!, wrap);
  // The strip under the arena steers the paddle too, so a thumb never has to cover it.
  const game = new Game(createWebHost(root.querySelector('canvas')!,()=>!picking&&!document.hidden&&!online?.submitting&&!root.querySelector('dialog[open]'),[el('touch-pad')]),update,undefined,new AudioSystem(createWebAudio));
  button('start').onclick = () => activateCentralAction(game);
  button('pause').onclick = () => game.state === 'paused' ? game.start() : game.pause();
  button('reset').onclick = () => game.reset();
  button('mute').onclick = () => {
    game.audio.unlock(); const muted = game.audio.toggle();
    button('mute').innerHTML = iconSvg(muted ? 'soundOff' : 'soundOn'); button('mute').setAttribute('aria-pressed', String(muted)); button('mute').setAttribute('aria-label', muted ? '开启音效' : '静音');
  };
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
  online = new LeaderboardUI(root,game);
  update(game); return game;
}
