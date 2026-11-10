import { LeaderboardUI } from './online/LeaderboardUI';
import { GAME_NAME } from '../shared/Brand';
import { Game } from './Game';
import { C } from './GameConfig';
import { activateCentralAction, centralActionFor } from './CentralAction';
import { STATE_LABELS } from './GameState';
import { ARCADE } from './ArcadeRules';
import { fitGamePanel } from './ViewportLayout';

/** DOM presentation and inputs only; scoring, lives and levels are owned by Game. */
export function mountGame(root: HTMLElement) {
  root.innerHTML = `
  <main class="shell">
    <header><h1>${GAME_NAME}</h1></header>
    <div class="stage-room"><section class="game-panel" aria-label="游戏区域">
      <div class="hud" aria-label="游戏状态">
        <div class="hud-item"><span class="label">关卡</span><strong id="level"></strong><span id="ball-badge" hidden>球×<span id="balls">1</span></span></div>
        <div class="hud-item"><span class="label">生命</span><span id="hearts" role="img" aria-live="polite"></span><span id="lives" class="sr-only"></span></div>
        <div class="hud-item"><span class="label">分数</span><strong id="score">0</strong></div>
        <div class="hud-item"><span class="label">剩余方块</span><strong id="remaining">4203</strong></div>
      </div>
      <div class="canvas-wrap"><canvas id="arena-canvas" aria-label="圆形弹球竞技场，移动鼠标或拖动控制挡板"></canvas>
        <span id="status" class="sr-only" role="status"></span><span id="removed" class="sr-only"></span><span id="total" class="sr-only"></span>
        <section id="settlement" class="settlement" aria-live="polite" hidden>
          <h2 id="result-title"></h2><p id="result-tip"></p>
          <div class="result-total"><span id="result-label"></span><strong id="result-score">0</strong></div><p id="score-details"></p>
        </section>
        <div id="central-layer" class="central-layer" hidden><button id="start" class="central-start" type="button" aria-controls="arena-canvas">▶ 开始游戏</button></div>
      </div>
      <div class="power-info"><span id="wide"></span><span id="combo"></span><button id="mute" aria-pressed="false">静音</button></div>
      <div class="bottom-controls" aria-label="游戏操作"><button id="pause">暂停</button><button id="reset">重新开始</button></div>
    </section></div>
    <button id="stress" class="debug" hidden>百球压力测试</button>
  </main>`;
  const el = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
  const button = (id: string) => el(id) as HTMLButtonElement;
  let online: LeaderboardUI | undefined;
  const update = (g: Game) => {
    online?.observe(g);
    const blocks = g.physics.blocks, level = g.levels.current;
    el('level').textContent = `${String(level.number).padStart(2, '0')}/${String(g.levels.count).padStart(2, '0')}`;
    el('hearts').setAttribute('aria-label', `剩余${g.lives}条生命`);
    el('hearts').querySelectorAll('span').forEach((heart, i) => {const lost=i>=g.lives;heart.classList.toggle('lost',lost);heart.textContent=lost?'♡':'♥';});
    el('remaining').textContent = String(blocks.remaining);
    el('lives').textContent = String(g.lives); el('score').textContent = String(g.score.total);
    el('removed').textContent = String(blocks.removed); el('total').textContent = String(blocks.total);
    el('balls').textContent = String(g.physics.balls.length);
    el('ball-badge').hidden = g.physics.balls.length <= 1;
    el('status').textContent = STATE_LABELS[g.state];
    el('wide').textContent = g.physics.wideRemaining > 0 ? `挡板加宽：${g.physics.wideRemaining.toFixed(1)} 秒` : '';
    el('combo').textContent = g.score.combo > 1 ? `${g.score.combo} 连击 ×${g.score.multiplier}` : '';
    const action = centralActionFor(g);
    el('central-layer').hidden = action === null;
    button('start').hidden = action === null;
    button('start').disabled = action === null;
    if (action) button('start').textContent = action.label;
    button('pause').disabled = g.state !== 'running' && g.state !== 'paused';
    button('pause').textContent = g.state === 'paused' ? '继续' : '暂停';
    const completed = g.state === 'levelComplete' || g.state === 'victory';
    el('settlement').hidden = !completed && g.state !== 'gameOver';
    if (completed || g.state === 'gameOver') {
      el('result-title').textContent = GAME_NAME+' · '+(g.state === 'gameOver' ? '游戏结束' : g.state === 'victory' ? '全部关卡突破！' : `第${level.number}关突破成功`);
      el('result-tip').textContent = g.state === 'gameOver' ? '生命已耗尽。重新开始，再挑战一次。' : g.state === 'victory' ? '最终核心已击碎，你完成了这次挑战。' : `保留 ${g.lives} 条生命和累计分数，迎接下一关。`;
      el('result-label').textContent = g.state === 'levelComplete' ? '本关得分' : '最终分数';
      el('result-score').textContent = String(g.state === 'levelComplete' ? g.result!.levelTotal : g.score.total);
      el('score-details').textContent = completed ? `本关得分 ${g.result!.blockScore} + 通关 ${g.result!.clearBonus} + 生命 ${g.result!.lifeBonus}　累计 ${g.score.total}` : `本次到达第${level.number}关 · 累计 ${g.score.total} 分`;
    }
  };
  el('central-layer').style.setProperty('--arena-x', `${C.arena.x / C.width * 100}%`);
  el('central-layer').style.setProperty('--arena-y', `${C.arena.y / C.height * 100}%`);
  el('hearts').innerHTML = Array.from({ length: ARCADE.initialLives }, () => '<span aria-hidden="true">♥</span>').join('');
  const wrap = root.querySelector<HTMLElement>('.canvas-wrap')!;
  wrap.style.setProperty('--arena-x', `${C.arena.x / C.width * 100}%`);
  wrap.style.setProperty('--arena-y', `${C.arena.y / C.height * 100}%`);
  fitGamePanel(root.querySelector('.stage-room')!, root.querySelector('.game-panel')!, wrap);
  const game = new Game(root.querySelector('canvas')!, update);
  button('start').onclick = () => activateCentralAction(game);
  button('pause').onclick = () => game.state === 'paused' ? game.start() : game.pause();
  button('reset').onclick = () => game.reset();
  button('mute').onclick = () => {
    game.audio.unlock(); const muted = game.audio.toggle();
    button('mute').textContent = muted ? '开启音效' : '静音'; button('mute').setAttribute('aria-pressed', String(muted));
  };
  button('stress').hidden = new URLSearchParams(location.search).get('debug') !== '1';
  button('stress').onclick = () => game.stress();
  online = new LeaderboardUI(root,game);
  update(game); return game;
}
