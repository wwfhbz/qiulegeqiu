import { Game } from './Game';
import { C } from './GameConfig';
import { activateCentralAction, centralActionFor } from './CentralAction';
import { STATE_LABELS } from './GameState';

/** DOM presentation and inputs only; scoring, lives and levels are owned by Game. */
export function mountGame(root: HTMLElement) {
  root.innerHTML = `
  <main class="shell arcade-shell">
    <header><div class="brand"><span class="mark" aria-hidden="true">◉</span><span>球了个球<span class="version">经典街机 0.5.1</span></span></div><span class="online"><i></i> 三关 · 一次突破</span></header>
    <section class="game-panel" aria-label="游戏区域">
      <div class="level-heading"><div><span class="eyebrow">经典街机模式</span><h1 id="level">第1关 · 核心初探</h1></div><span id="level-count" class="level-chip">1 / 3</span></div>
      <div class="dashboard">
        <div><span class="label">剩余生命</span><strong class="lives-value"><span aria-hidden="true">♥</span> <span id="lives">3</span></strong></div>
        <div><span class="label">累计分数</span><strong id="score">0</strong></div>
        <div class="counter"><span class="label">已消除</span><strong><span id="removed">0</span><small> / <span id="total">4203</span></small></strong></div>
        <div><span class="label">弹球</span><strong id="balls">1</strong></div>
      </div>
      <div class="canvas-wrap"><canvas id="arena-canvas" aria-label="圆形弹球竞技场，移动鼠标或拖动控制挡板"></canvas><span class="arena-tag" id="arena-tag">第一关 · 核心层</span><span class="status" id="status" role="status">等待发射</span><div id="central-layer" class="central-layer" hidden><button id="start" class="central-start" type="button" aria-controls="arena-canvas">▶ 开始游戏</button></div></div>
      <section id="settlement" class="settlement" aria-live="polite" hidden>
        <span class="eyebrow">本次挑战</span><h2 id="result-title"></h2><p id="result-tip"></p>
        <div class="result-total"><span id="result-label">本关得分</span><strong id="result-score">0</strong></div>
        <p id="score-details"></p>
      </section>
      <div class="power-info"><span id="wide">接住道具：三倍弹球 · 挡板加宽</span><span id="combo">连击倍率 ×1</span><button id="mute" aria-pressed="false">静音</button></div>
      <div class="progress"><div id="progress"></div></div>
      <div class="controls bottom-controls" aria-label="游戏操作"><button id="pause">暂停</button><button id="reset">重新开始</button></div>
      <div class="instructions"><span>↔ 移动鼠标或拖动屏幕控制挡板</span><span>全部弹球漏接消耗一条生命</span></div>
    </section>
    <footer><span>三条生命，挑战全部核心。</span><button id="stress" hidden>百球压力测试</button></footer>
  </main>`;
  const el = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
  const button = (id: string) => el(id) as HTMLButtonElement;
  const update = (g: Game) => {
    const blocks = g.physics.blocks, level = g.levels.current;
    el('level').textContent = `第${level.number}关 · ${level.name}`;
    el('level-count').textContent = `${level.number} / ${g.levels.count}`;
    el('arena-tag').textContent = `第${level.number}关 · 球速 ${level.speedScale.toFixed(1)} 倍`;
    el('lives').textContent = String(g.lives); el('score').textContent = String(g.score.total);
    el('removed').textContent = String(blocks.removed); el('total').textContent = String(blocks.total);
    el('balls').textContent = String(g.physics.balls.length);
    el('progress').style.width = `${blocks.removed / blocks.total * 100}%`;
    el('status').textContent = STATE_LABELS[g.state];
    el('wide').textContent = g.physics.wideRemaining > 0 ? `挡板加宽：${g.physics.wideRemaining.toFixed(1)} 秒` : '接住道具：三倍弹球 · 挡板加宽';
    el('combo').textContent = `${g.score.combo > 1 ? `${g.score.combo} 连击 · ` : '连击倍率 '}×${g.score.multiplier}`;
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
      el('result-title').textContent = g.state === 'gameOver' ? '游戏结束' : g.state === 'victory' ? '三关全部突破！' : `第${level.number}关突破成功`;
      el('result-tip').textContent = g.state === 'gameOver' ? '生命已耗尽。重新开始，再挑战一次。' : g.state === 'victory' ? '最终核心已击碎，你完成了这次挑战。' : `保留 ${g.lives} 条生命和累计分数，迎接下一关。`;
      el('result-label').textContent = g.state === 'levelComplete' ? '本关得分' : '最终分数';
      el('result-score').textContent = String(g.state === 'levelComplete' ? g.result!.levelTotal : g.score.total);
      el('score-details').textContent = completed ? `方块 ${g.result!.blockScore} + 通关 ${g.result!.clearBonus} + 生命 ${g.result!.lifeBonus}　累计 ${g.score.total}` : `本次到达第${level.number}关 · 累计 ${g.score.total} 分`;
    }
  };
  el('central-layer').style.setProperty('--arena-x', `${C.arena.x / C.width * 100}%`);
  el('central-layer').style.setProperty('--arena-y', `${C.arena.y / C.height * 100}%`);
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
  update(game); return game;
}
