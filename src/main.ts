import './style.css';
import { Game } from './Game';
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
<main class="shell"><header><div class="brand"><span class="mark">◉</span><span>球了个球<span class="version">多球版本 0.2</span></span></div><span class="online"><i></i> 核心已就绪</span></header>
<section class="heading"><div class="eyebrow">圆形竞技场 / 核心突破</div><h1>每一次反弹，<br class="mobile">都离突破更近。</h1><p>一颗球，一块挡板，击碎整片核心。</p></section>
<section class="game-panel" aria-label="游戏区域"><div class="dashboard"><div><span class="label">当前任务</span><strong>核心突破 · 第1关</strong></div><div class="counter"><span class="label">已消除</span><strong><span id="removed">0</span><small> / <span id="total">0</span></small></strong></div><div><span class="label">弹球</span><strong id="balls">1</strong></div></div>
<div class="canvas-wrap"><canvas aria-label="圆形弹球竞技场，移动鼠标或拖动控制挡板"></canvas><span class="arena-tag">第一关 · 核心层</span><span class="status" id="status" role="status">准备发射</span></div>
<div class="power-info"><span id="wide">接住道具：三倍弹球 · 挡板加宽</span><span id="combo"></span><button id="mute" aria-pressed="false">静音</button></div><div class="progress"><div id="progress"></div></div><div class="controls"><button id="start" class="primary">开始游戏 <span>↗</span></button><button id="pause">暂停</button><button id="reset">重新开始</button></div>
<div class="instructions"><span>↔ 移动鼠标或拖动屏幕控制挡板</span><span>球落出底部后可再次发射</span></div></section><footer><span>保持专注，让反弹发生。</span><button id="stress">百球压力测试</button></footer></main>`;
const el = (id: string) => document.getElementById(id)!;
const game = new Game(document.querySelector('canvas')!, g => {
  const b = g.physics.blocks;
  el('wide').textContent = g.physics.wideRemaining > 0 ? `挡板加宽：${g.physics.wideRemaining.toFixed(1)} 秒` : '接住道具：三倍弹球 · 挡板加宽';
  el('combo').textContent = g.physics.effects.combo > 1 ? `${g.physics.effects.combo} 连击` : '';
  el('removed').textContent = String(b.removed); el('total').textContent = String(b.total);
  el('balls').textContent = String(g.physics.balls.filter(b => b.alive).length);
  el('progress').style.width = `${b.removed / b.total * 100}%`;
  el('status').textContent = { ready: '准备发射', running: '突破进行中', paused: '已暂停', won: '核心已突破！' }[g.state];
  el('start').innerHTML = (g.state === 'paused' ? '继续游戏' : '开始游戏') + ' <span>↗</span>';
  (el('start') as HTMLButtonElement).disabled = g.state === 'running' || g.state === 'won';
  (el('pause') as HTMLButtonElement).disabled = g.state !== 'running';
});
el('start').onclick = () => game.start(); el('pause').onclick = () => game.pause(); el('reset').onclick = () => game.reset(); el('stress').onclick = () => game.stress();
el('mute').onclick = () => { game.audio.unlock(); const muted=game.audio.toggle(); el('mute').textContent=muted?'开启音效':'静音';el('mute').setAttribute('aria-pressed',String(muted)); };
// Debug access for automated browser verification and performance measurements.
Object.assign(window, { ballCore: game });
