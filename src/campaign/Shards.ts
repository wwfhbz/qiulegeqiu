/**
 * WeChat skin shards (2.17). Stars are only a gate (never spent); shards are the currency that buys a skin for good.
 * Every source is once-only or capped, so replaying a level can never farm shards.
 */
export const SKIN_SHARD_PRICE = 10;
/** Lifetime stars needed before a skin can be redeemed (stars are never spent). */
export const SKIN_STAR_GATES: Readonly<Record<string, number>> = { 'trail:comet': 3, 'paddle:neon': 6, 'trail:heart': 9, 'paddle:flame': 12, 'trail:rainbow': 15, 'paddle:gold': 18 };
export const SHARD_RULES = {
  /** First time a level is cleared with three stars (once per level, never again). */
  firstThreeStars: 2,
  /** Endless: one shard each time a run reaches stage 10, 20, 30 … */
  endlessStageStep: 10, endlessShards: 1,
  /** First run of the day (local date). */
  dailyFirstGame: 1,
  /** Rewarded video: shards per view and views per day. */
  video: 3, videosPerDay: 5,
} as const;
export interface ShardStore { read(): unknown; write(value: unknown): void }
interface State { balance: number; threeStars: number[]; videoDay: string; videos: number; dailyDay: string }
/** Local calendar day, e.g. 2026-11-23 (the player's own clock; this is cosmetic only). */
export function dayKey(now: number = Date.now()) { const d = new Date(now); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export class ShardWallet {
  private state: State = { balance: 0, threeStars: [], videoDay: '', videos: 0, dailyDay: '' };
  constructor(private readonly store?: ShardStore) {
    const v = store?.read() as Partial<State> | null | undefined;
    if (v && typeof v === 'object') this.state = {
      balance: Number.isInteger(v.balance) && v.balance! > 0 ? v.balance! : 0,
      threeStars: Array.isArray(v.threeStars) ? v.threeStars.filter(n => Number.isInteger(n)) : [],
      videoDay: typeof v.videoDay === 'string' ? v.videoDay : '', videos: Number.isInteger(v.videos) ? v.videos! : 0,
      dailyDay: typeof v.dailyDay === 'string' ? v.dailyDay : '',
    };
  }
  get balance() { return this.state.balance; }
  private save() { try { this.store?.write({ ...this.state }); } catch { /* Preference only. */ } }
  private add(n: number) { if (n > 0) { this.state.balance += n; this.save(); } return n; }
  /** First three-star clear of a level: shards once per level; 0 if this level already paid out. */
  earnThreeStars(level: number) { if (this.state.threeStars.includes(level)) return 0; this.state.threeStars.push(level); return this.add(SHARD_RULES.firstThreeStars); }
  /** First run of the day. */
  earnDaily(day: string = dayKey()) { if (this.state.dailyDay === day) return 0; this.state.dailyDay = day; return this.add(SHARD_RULES.dailyFirstGame); }
  videosLeft(day: string = dayKey()) { return SHARD_RULES.videosPerDay - (this.state.videoDay === day ? this.state.videos : 0); }
  earnVideo(day: string = dayKey()) { if (this.videosLeft(day) <= 0) return 0; if (this.state.videoDay !== day) { this.state.videoDay = day; this.state.videos = 0; } this.state.videos++; return this.add(SHARD_RULES.video); }
  /** Endless milestones of one run: shards for each new multiple of 10 stages beyond what the run already paid. */
  static endlessMilestones(stage: number) { return Math.floor(Math.max(0, stage) / SHARD_RULES.endlessStageStep); }
  earnEndless(milestones: number) { return this.add(Math.max(0, milestones) * SHARD_RULES.endlessShards); }
  spend(n: number) { if (n <= 0 || this.state.balance < n) return false; this.state.balance -= n; this.save(); return true; }
}
