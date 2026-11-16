import { C } from './GameConfig';
/**
 * The part of the logical playfield the camera shows. Physics, scoring and replays keep using the full
 * 800×1120 coordinates; only the view is cropped. The view's left, right and top edges sit exactly on the walls
 * the ball bounces off, and its bottom edge just below the death line, so the ball appears to hit the edge of the
 * screen and to drop out of the bottom of it. No frame lines are drawn: the screen edge is the wall.
 */
const WALL_LEFT = C.arena.x - C.arena.radius - C.frame.sideGap, WALL_RIGHT = C.arena.x + C.arena.radius + C.frame.sideGap;
const WALL_TOP = C.arena.y - C.arena.radius - C.frame.topGap, VIEW_BOTTOM = C.paddle.y + C.paddle.height / 2 + C.frame.deathGap + 2;
export const VIEW = Object.freeze({ x: WALL_LEFT, y: WALL_TOP, width: WALL_RIGHT - WALL_LEFT, height: VIEW_BOTTOM - WALL_TOP });
/** Logical x for a horizontal fraction (0–1) across the visible view. */
export function viewX(fraction: number) { return VIEW.x + fraction * VIEW.width; }
/** Position of a logical point as fractions of the visible view (for overlay placement). */
export function viewFraction(x: number, y: number) { return { x: (x - VIEW.x) / VIEW.width, y: (y - VIEW.y) / VIEW.height }; }
/** The arena centre as fractions of the view, used to place the start button and result card. */
export const ARENA_IN_VIEW = viewFraction(C.arena.x, C.arena.y);
