import type {LevelConfig} from '../Levels';
import type {PowerKind} from '../PowerRules';
/**
 * Endless mode ("压迫下沉") rules. Shared by the client and the server verifier, so everything here
 * is a pure, deterministic function of the seed and tick count.
 */
export const ENDLESS={
 lives:3,
 /** Grid matches level 2's 16px pitch; 45×45 cells over the arena. */
 gridStep:16,gridSize:14,
 /** Rows prefilled at the start (top of the bowl down to roughly its middle). */
 initialRows:18,
 /** Each new row: every cell is a brick with this probability (seeded per row). */
 rowFill:.88,
 /** Descent interval in ticks (120/s): 6s, ×0.985 per row, never faster than 2.5s. */
 descent:{startTicks:720,decay:.985,minTicks:300},
 /** Ball speed scale: 0.90, +0.0035 per descended row, capped at 1.25. */
 speed:{start:.9,perRow:.0035,max:1.25},
 /** Timed power durations (seconds) and instant lightning size. */
 pierceSeconds:4,fireSeconds:6,lightningBricks:12,plusBalls:3,
 /** Stage shown to players and stored as the score's reached level: +1 every 10 descended rows. */
 rowsPerStage:10,
} as const;

/** Endless drop table (weights sum to 1000): +1 life stays rare at 0.3%; no ×3 and no bomb. */
export const ENDLESS_POWER_WEIGHTS:readonly {kind:PowerKind;weight:number}[]=[
 {kind:'plus3',weight:270},{kind:'wide',weight:200},{kind:'halve',weight:130},
 {kind:'pierce',weight:130},{kind:'fire',weight:120},{kind:'lightning',weight:147},{kind:'life',weight:3},
];
export function endlessPower(random:()=>number):PowerKind{
 let value=random()*1000;for(const row of ENDLESS_POWER_WEIGHTS){value-=row.weight;if(value<0)return row.kind;}
 return ENDLESS_POWER_WEIGHTS[ENDLESS_POWER_WEIGHTS.length-1].kind;
}
export function descentInterval(descents:number){const d=ENDLESS.descent;return Math.max(d.minTicks,Math.round(d.startTicks*d.decay**descents));}
export function endlessSpeed(descents:number){const s=ENDLESS.speed;return Math.min(s.max,s.start+s.perRow*descents);}
/**
 * The rules that changed between endless versions. Each released version stays frozen so its
 * scores still verify and stay on the endless board.
 */
export interface EndlessVariant {
 /** One random drop every N destroyed bricks; N starts at `start`, +1 every `growEvery` bricks, up to `max`. */
 readonly drops:{readonly start:number;readonly growEvery:number;readonly max:number};
 /** Lowest brick edge: 'legacy' = the campaign brick floor (80% down the bowl); 'bowl' = the bottom of the circle. */
 readonly floor:'legacy'|'bowl';
}
/** endless-1.0.0: drops every 8 → 30 bricks; the wall stopped 80% down the bowl. */
export const ENDLESS_V1:EndlessVariant={drops:{start:8,growEvery:250,max:30},floor:'legacy'};
/** endless-1.1.0: half the drops (every 16 → 60 bricks); the wall can sink to the bottom of the circle. */
export const ENDLESS_V2:EndlessVariant={drops:{start:16,growEvery:125,max:60},floor:'bowl'};
export const ENDLESS_CURRENT=ENDLESS_V2;
export function dropEvery(destroyed:number,variant:EndlessVariant=ENDLESS_CURRENT){const d=variant.drops;return Math.min(d.max,d.start+Math.floor(destroyed/d.growEvery));}
export function endlessStage(descents:number){return Math.min(100,1+Math.floor(descents/ENDLESS.rowsPerStage));}

/** The single pseudo-level used for arena geometry, paddle and exit. */
export const ENDLESS_LEVEL:LevelConfig={number:1,name:'无尽模式',speedScale:ENDLESS.speed.start,obstacles:[],gridStep:ENDLESS.gridStep,gridSize:ENDLESS.gridSize,exitWidth:160,paddleScale:1.15,autoAdvance:false};
