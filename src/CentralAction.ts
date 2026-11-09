import type { Game } from './Game';

export type CentralAction = Readonly<{ kind: 'start' | 'resume' | 'next' | 'retry'; label: string }>;
/** View labels use the existing engine states (levelComplete = levelCleared, victory = finalWon). */
export function centralActionFor(game: Pick<Game, 'state' | 'readyReason'>): CentralAction | null {
  switch (game.state) {
    case 'ready': return { kind: 'start', label: game.readyReason === 'lifeLost' ? '▶ 继续挑战' : '▶ 开始游戏' };
    case 'paused': return { kind: 'resume', label: '▶ 继续游戏' };
    case 'levelComplete': return { kind: 'next', label: '下一关' };
    case 'gameOver': case 'victory': return { kind: 'retry', label: '重新挑战' };
    case 'running': return null;
  }
}
/** All launch/resume paths share Game.start, whose state guard rejects repeated activation. */
export function activateCentralAction(game: Game) {
  const action = centralActionFor(game);
  if (!action) return;
  if (action.kind === 'next') game.nextLevel();
  else if (action.kind === 'retry') game.reset();
  game.start();
}
