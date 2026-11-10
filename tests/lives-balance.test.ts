import { describe, it, expect, vi } from 'vitest';
import { Game } from '../src/Game';
import { LevelManager } from '../src/LevelManager';
import { C } from '../src/GameConfig';
import { ARCADE } from '../src/ArcadeRules';
import { FRAME } from '../src/WorldGeometry';
import { activateCentralAction, centralActionFor } from '../src/CentralAction';

const lose = (g: Game) => {
  g.start();
  for (const ball of g.physics.balls) Object.assign(ball, { x: 400, y: FRAME.deathY + ball.radius + 1, vx: 0, vy: 760, outsideArena: true });
  g.update(C.step);
};
const hit = (g: Game, count: number) => {
  let remaining = count;
  for (let i = 0; i < g.physics.blocks.alive.length && remaining; i++) if (g.physics.blocks.alive[i]) { g.physics.blocks.hit(i); remaining--; }
};
const clear = (g: Game) => { g.start(); hit(g, g.physics.blocks.remaining); g.update(0); };
const levels = Array.from({ length: 5 }, (_, i) => ({ number: i + 1, name: `测试关卡${i + 1}`, speedScale: 1 }));
const fifth = () => {
  const g = new Game(undefined, undefined, new LevelManager(levels));
  for (let i = 0; i < 4; i++) { clear(g); g.nextLevel(); }
  g.start(); hit(g, 2000); return g;
};

describe('五命、当前关卡续玩与立即通知', () => {
  it('统一初始5命，连续完整漏球为5→4→3', () => { const g = new Game(); expect(g.lives).toBe(5); lose(g); expect(g.lives).toBe(4); lose(g); expect(g.lives).toBe(3); });
  it('update返回前发布完整扣命状态，无需等待下一动画帧', () => {
    const changed = vi.fn(); const g = new Game(undefined, changed); g.start(); changed.mockClear(); lose(g);
    expect(changed).toHaveBeenCalledTimes(1); expect(changed.mock.calls[0][0]).toBe(g);
    expect(g.lives).toBe(4); expect(g.state).toBe('ready'); expect(g.readyReason).toBe('lifeLost');
  });
  it('多球剩1颗不扣命，最后死亡才扣一次，同帧100球仅扣一次', () => {
    const g = new Game(); g.start(); g.physics.triple();
    for (const b of g.physics.balls.slice(0, 2)) Object.assign(b, { y: 1080, vx: 0, vy: 760 });
    g.update(C.step); expect(g.lives).toBe(5); expect(g.physics.balls.length).toBe(1);
    lose(g); expect(g.lives).toBe(4); g.start(); for(let i=0;i<5;i++)g.physics.triple(); expect(g.physics.balls.length).toBe(100);
    lose(g); expect(g.lives).toBe(3); for(let i=0;i<100;i++)g.update(C.step); expect(g.lives).toBe(3);
  });
  it('第5关消除2000块后丢命，保留关卡、原网格对象、完整消除状态与总分', () => {
    const g = fifth(); const blocks = g.physics.blocks, alive = blocks.alive.slice(), score = g.score.total, level = g.levels.current;
    lose(g); expect(g.lives).toBe(4); expect(g.levels.current).toBe(level); expect(g.levels.current.number).toBe(5);
    expect(g.physics.blocks).toBe(blocks); expect(blocks.alive).toEqual(alive); expect(blocks.removed).toBe(2000); expect(g.score.total).toBe(score);
    expect(g.physics.balls.length).toBe(1); expect(centralActionFor(g)?.label).toBe('▶ 继续挑战');
    activateCentralAction(g); expect(g.state).toBe('running'); expect(g.levels.current.number).toBe(5); expect(blocks.removed).toBe(2000); expect(g.score.total).toBe(score);
  });
  it('丢命清理旧道具、加宽和旧球，不继承上一轮拾取', () => {
    const g = fifth(); g.physics.triple(); g.physics.collect('wide'); g.physics.powers.spawn(400, C.paddle.y, 'triple'); lose(g);
    expect(g.physics.balls.length).toBe(1); expect(g.physics.powers.items.some(x=>x.alive)).toBe(false); expect(g.physics.wideRemaining).toBe(0);
    activateCentralAction(g); g.update(C.step); expect(g.physics.balls.length).toBe(1); expect(g.physics.wideRemaining).toBe(0);
  });
  it('切关保留剩余生命与积分，主动重开才回到第1关5命0分', () => {
    const g = new Game(); lose(g); clear(g); const total = g.score.total; g.nextLevel();
    expect(g.levels.current.number).toBe(2); expect(g.lives).toBe(4); expect(g.score.total).toBe(total);
    lose(g); g.reset(); expect(g.levels.current.number).toBe(1); expect(g.lives).toBe(5); expect(g.score.total).toBe(0); expect(g.physics.blocks.remaining).toBe(4203);
  });
  it('五次丢命Game Over，重复发射/更新不负命；中央重试第一关5命', () => {
    const g = new Game(); for(let i=0;i<5;i++)lose(g); expect(g.state).toBe('gameOver'); expect(g.lives).toBe(0);
    for(let i=0;i<10;i++){ g.start(); g.update(C.step); } expect(g.lives).toBe(0); expect(g.physics.balls.length).toBe(0);
    activateCentralAction(g); expect(g.lives).toBe(5); expect(g.levels.current.number).toBe(1); expect(g.state).toBe('running');
  });
  it('暂停/恢复不重置生命，不提前结算死亡，等待不重复扣命', () => {
    const g = new Game(); lose(g); g.start(); g.pause(); const y = g.physics.balls[0].y; g.update(1); expect(g.physics.balls[0].y).toBe(y); expect(g.lives).toBe(4);
    activateCentralAction(g); expect(g.lives).toBe(4); lose(g); expect(g.lives).toBe(3); g.update(1); expect(g.lives).toBe(3);
  });
  it('同帧通关与最后死亡优先通关，不扣命', () => { const g=new Game(); g.start(); hit(g,4203); lose(g); expect(g.state).toBe('levelComplete'); expect(g.lives).toBe(5); });
});

describe('统一道具掉落平衡', () => {
  for (const number of [1, 2, 3, 5, 10]) {
    it(`第${number}关4200次有效销毁，间隔和两种道具长期数量正确`, () => {
      const g = new Game(undefined, undefined, new LevelManager([{ number, name: '掉落测试', speedScale: 1 }]));
      const originalSpawn = g.physics.powers.spawn.bind(g.physics.powers);
      const generated: string[] = [];
      const spawn = vi.spyOn(g.physics.powers, 'spawn').mockImplementation((x, y, kind) => {
        originalSpawn(x, y, kind);
        const item = g.physics.powers.items.find(item => item.alive);
        expect(item?.kind).toBe(kind); generated.push(item!.kind);
        // Simulate prompt collection so the same unchanged pool has room in both runs.
        g.physics.powers.reset();
      });
      hit(g, 4200);
      const expected = number === 1 ? 300 : 150;
      expect(g.physics.powerDropEvery).toBe(number === 1 ? 14 : 28); expect(spawn).toHaveBeenCalledTimes(expected); expect(generated.length).toBe(expected);
      expect(spawn.mock.calls.filter(call=>call[2]==='triple').length).toBe(expected/2);
      expect(spawn.mock.calls.filter(call=>call[2]==='wide').length).toBe(expected/2);
    });
  }
  it('切关从新网格计数，无立即重复掉落', () => {
    const g = new Game(); clear(g); g.nextLevel(); const spawn = vi.spyOn(g.physics.powers, 'spawn');
    hit(g,27); expect(spawn).not.toHaveBeenCalled(); hit(g,1); expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn.mock.calls[0][2]).toBe('triple');
  });
  it('丢命保留消块触发进度，已消除块不重复掉落，重开恢复首关频率', () => {
    const g = new Game(); g.start(); hit(g,13); const spawn = vi.spyOn(g.physics.powers, 'spawn'); lose(g); activateCentralAction(g);
    hit(g,1); expect(spawn).toHaveBeenCalledTimes(1); const index=g.physics.blocks.destroyed.at(-1)!;
    g.physics.blocks.hit(index); expect(spawn).toHaveBeenCalledTimes(1);
    clear(g); g.nextLevel(); expect(g.physics.powerDropEvery).toBe(28); g.reset(); expect(g.physics.powerDropEvery).toBe(14);
  });
  it('加宽持续5秒、三倍球上限100与原掉落基数保持不变', () => {
    const g=new Game(); expect(ARCADE.initialLives).toBe(5); expect(C.power.dropEvery).toBe(14); expect(C.power.duration).toBe(5);
    g.physics.collect('wide'); expect(g.physics.wideRemaining).toBe(5); for(let i=0;i<5;i++)g.physics.collect('triple'); expect(g.physics.balls.length).toBe(100);
  });
});
