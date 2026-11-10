import { C } from './GameConfig';
const { x, y, radius, exitHalfWidth, wallWidth } = C.arena;
const endY = Math.sqrt(radius * radius - exitHalfWidth * exitHalfWidth);
const gapAngle = Math.asin(exitHalfWidth / radius);
/** One centerline and round-cap stroke shared by rendering and disk collision. */
export const ARENA_WALL = Object.freeze({
  startAngle: Math.PI / 2 + gapAngle,
  endAngle: Math.PI * 2 + Math.PI / 2 - gapAngle,
  endY, leftX: x - exitHalfWidth, rightX: x + exitHalfWidth, endpointY: y + endY,
  width: wallWidth, halfWidth: wallWidth / 2,
  nominalExitWidth: 2 * exitHalfWidth,
  visibleExitWidth: 2 * exitHalfWidth - wallWidth,
});
export function inExitSector(dx: number, dy: number) {
  return dy > 0 && Math.abs(dx) * ARENA_WALL.endY < dy * C.arena.exitHalfWidth;
}
