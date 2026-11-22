/**
 * Campaign stars and the level map (local only, never part of scoring or the leaderboard).
 * ★ for clearing a level, ★★ with at most one life lost in it, ★★★ without losing a life.
 */
export const LEVEL_COUNT = 12, MAX_STARS = LEVEL_COUNT * 3;
export function levelStars(livesLost: number) { return livesLost <= 0 ? 3 : livesLost === 1 ? 2 : 1; }
export function starText(stars: number) { return '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars)); }
export interface ProgressStore { read(): string | null; write(value: string): void }
/** Best stars per level; a level is open once the one before it has been cleared (level 1 always). */
export class CampaignProgress {
  readonly stars = new Array<number>(LEVEL_COUNT).fill(0);
  constructor(private readonly store?: ProgressStore) {
    try { const data = JSON.parse(store?.read() ?? 'null'); if (Array.isArray(data?.stars)) data.stars.slice(0, LEVEL_COUNT).forEach((s: unknown, i: number) => { if (Number.isInteger(s)) this.stars[i] = Math.max(0, Math.min(3, s as number)); }); } catch { /* Corrupt or missing: start fresh. */ }
  }
  get total() { return this.stars.reduce((a, b) => a + b, 0); }
  unlocked(level: number) { return level === 1 || (level >= 2 && level <= LEVEL_COUNT && this.stars[level - 2] > 0); }
  /** Highest open level. */
  get frontier() { let n = 1; while (n < LEVEL_COUNT && this.unlocked(n + 1)) n++; return n; }
  /** Keep the best result; returns true when this improved the record. */
  record(level: number, stars: number) {
    if (level < 1 || level > LEVEL_COUNT || stars <= this.stars[level - 1]) return false;
    this.stars[level - 1] = Math.min(3, stars);
    try { this.store?.write(JSON.stringify({ stars: this.stars })); } catch { /* Preference only. */ }
    return true;
  }
}
/** WeChat: star totals that also unlock each skin (the alternative to a rewarded video). */
export const STAR_SKIN_UNLOCKS: Readonly<Record<string, number>> = { 'trail:comet': 6, 'paddle:neon': 12, 'trail:heart': 18, 'paddle:flame': 24, 'trail:rainbow': 30, 'paddle:gold': 36 };
