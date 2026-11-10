import { C } from './GameConfig';
/** The visible U-shaped frame and the unique open death region share these coordinates. */
export const FRAME = Object.freeze({
  left: C.arena.x - C.arena.radius - C.frame.sideGap,
  right: C.arena.x + C.arena.radius + C.frame.sideGap,
  top: C.arena.y - C.arena.radius - C.frame.topGap,
  deathY: C.paddle.y + C.paddle.height / 2 + C.frame.deathGap,
  width: C.arena.wallWidth,
  halfWidth: C.arena.wallWidth / 2,
});
/** Strictly below means the complete ball, including its top edge, has passed the line. */
export function isBallInDeathZone(ball: Readonly<{ y: number; radius: number }>) {
  return ball.y - ball.radius > FRAME.deathY;
}
