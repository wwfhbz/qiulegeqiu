export type GameState = 'ready' | 'running' | 'paused' | 'levelComplete' | 'gameOver' | 'victory';
export const STATE_LABELS: Record<GameState, string> = {
  ready: '等待发射', running: '突破进行中', paused: '已暂停',
  levelComplete: '本关突破成功', gameOver: '游戏结束', victory: '最终胜利',
};
