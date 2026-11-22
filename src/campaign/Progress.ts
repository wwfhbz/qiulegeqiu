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
/** WeChat paddles unlock by the lifetime star total alone. */
export const STAR_SKIN_UNLOCKS: Readonly<Record<string, number>> = { 'paddle:neon': 12, 'paddle:flame': 24, 'paddle:gold': 36 };
/** V2.15 thresholds at which trails unlocked by stars alone (kept for players who earned them then). */
export const LEGACY_TRAIL_STAR_UNLOCKS: Readonly<Record<string, number>> = { comet: 6, heart: 18, rainbow: 30 };
/**
 * WeChat trails need 12 lifetime stars first. Then a rewarded video unlocks one for good; while no rewarded video
 * is available, 3 stars buy 24 hours of use instead (spent stars come off the balance, never off the lifetime total).
 */
export const TRAIL_STAR_GATE = 12, TRAIL_TRIAL_COST = 3, TRAIL_TRIAL_MS = 24 * 3600 * 1000;
/** Stars left to spend: lifetime total minus what trials have used. */
export function starBalance(total: number, spent: number) { return Math.max(0, total - Math.max(0, spent)); }
/** Hours (rounded up) left on a trial, 0 when expired or never bought. */
export function trialHoursLeft(expiresAt: number | undefined, now: number) { return expiresAt && expiresAt > now ? Math.ceil((expiresAt - now) / 3600000) : 0; }
