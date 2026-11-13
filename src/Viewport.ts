import { C } from './GameConfig';
/**
 * The part of the logical playfield the camera shows. Physics, scoring and replays keep using the full
 * 800×1120 coordinates; only the view is cropped: the empty band above the arena frame and the slivers
 * beside it are dropped, so the arena fills more of the screen. The frame, paddle and death line stay visible.
 */
export const VIEW = Object.freeze({ x: 14, y: 98, width: 772, height: 982 });
/** Logical x for a horizontal fraction (0–1) across the visible view. */
export function viewX(fraction: number) { return VIEW.x + fraction * VIEW.width; }
/** Position of a logical point as fractions of the visible view (for overlay placement). */
export function viewFraction(x: number, y: number) { return { x: (x - VIEW.x) / VIEW.width, y: (y - VIEW.y) / VIEW.height }; }
/** The arena centre as fractions of the view, used to place the start button and result card. */
export const ARENA_IN_VIEW = viewFraction(C.arena.x, C.arena.y);
