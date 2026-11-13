import {ENDLESS_RULES_VERSION,ENDLESS_V1_RULES_VERSION,ENDLESS_V2_RULES_VERSION,ENDLESS_V3_RULES_VERSION,ENDLESS_V4_RULES_VERSION,ENDLESS_V5_RULES_VERSION,ENDLESS_V6_RULES_VERSION} from '../../shared/Challenge';
import type {LevelConfig} from '../Levels';
import type {PowerKind} from '../PowerRules';
/**
 * Endless mode ("压迫下沉") rules. Shared by the client and the server verifier, so everything here
 * is a pure, deterministic function of the seed and tick count.
 */
/** Shared geometry plus frozen legacy defaults. New balance values belong in versioned settings below. */
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
 /** 'raised' floor: clear band kept above the bowl bottom; the exit endpoints sit ~9px above the bottom. */
 floorGap:64,
 /** Pressure death (1.3+): 10s with the wall on the floor costs a life; the next launch clears 5 rows and grants a bonus. */
 crushTicks:1200,reliefRows:5,
} as const;

/** Endless drop table (weights sum to 1000): +1 life stays rare at 0.3%; no ×3 and no bomb. */
export const ENDLESS_POWER_WEIGHTS:readonly {kind:PowerKind;weight:number}[]=[
 {kind:'plus3',weight:270},{kind:'wide',weight:200},{kind:'halve',weight:130},
 {kind:'pierce',weight:130},{kind:'fire',weight:120},{kind:'lightning',weight:147},{kind:'life',weight:3},
];
export function endlessPower(random:()=>number,variant:EndlessVariant=ENDLESS_CURRENT):PowerKind{
 const weights=endlessSettings(variant).weights;
 let value=random()*1000;for(const row of weights){value-=row.weight;if(value<0)return row.kind;}
 return weights[weights.length-1].kind;
}
export function descentInterval(descents:number,variant:EndlessVariant=ENDLESS_CURRENT){const d=endlessSettings(variant).descent;return Math.max(d.minTicks,Math.round(d.startTicks*d.decay**descents));}
export function endlessSpeed(descents:number){const s=ENDLESS.speed;return Math.min(s.max,s.start+s.perRow*descents);}
/**
 * The rules that changed between endless versions. Each released version stays frozen so its
 * scores still verify; all verified endless scores share the permanent mode-wide board.
 */
export interface EndlessVariant {
 /** Absent on frozen variants: use the original skill, weight and descent settings. */
 readonly settings?:EndlessSettings;
 /** One random drop every N destroyed bricks; N starts at `start`, +1 every `growEvery` bricks, up to `max`. */
 readonly drops:{readonly start:number;readonly growEvery:number;readonly max:number};
 /**
  * Lowest brick edge: 'legacy' = the campaign brick floor (80% down the bowl); 'bowl' = the bottom of the
  * circle (1.1 — bricks could seal the exit so balls never fell out); 'raised' = `ENDLESS.floorGap` above it.
  */
 readonly floor:'legacy'|'bowl'|'raised';
 /** 1.3+: pressing the floor for `ENDLESS.crushTicks` costs a life (earlier versions just paused the wall). */
 readonly crush?:boolean;
 /** 1.3+: +100 points for every power-up caught. */
 readonly powerPoints?:boolean;
 /** 1.6+: losing a life (all balls gone) restarts the pressure timer, so a relaunch never inherits a nearly full countdown. */
 readonly pressureReset?:boolean;
}
/** endless-1.0.0: drops every 8 → 30 bricks; the wall stopped 80% down the bowl. */
export const ENDLESS_V1:EndlessVariant={drops:{start:8,growEvery:250,max:30},floor:'legacy'};
/** endless-1.1.0: half the drops (every 16 → 60 bricks); the wall can sink to the bottom of the circle. */
export const ENDLESS_V2:EndlessVariant={drops:{start:16,growEvery:125,max:60},floor:'bowl'};
/** endless-1.2.0: same drops; the floor sits 64px above the bowl bottom so the exit always stays open. */
export const ENDLESS_V3:EndlessVariant={drops:{start:16,growEvery:125,max:60},floor:'raised'};
/** endless-1.3.0: same field; 10s on the death line costs a life, then 5-row relief plus a random effect ball. */
export const ENDLESS_V4:EndlessVariant={drops:{start:16,growEvery:125,max:60},floor:'raised',crush:true,powerPoints:true};
/** Frozen offsets keep their original row-major burn event order. */
export const FIRE_OFFSETS_LEGACY:readonly (readonly [number,number])[]=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
export const FIRE_OFFSETS_V14:readonly (readonly [number,number])[]=[[-2,0],[-1,0],[1,0],[2,0],[0,-2],[0,-1],[0,1],[0,2],[-1,-1],[-1,1],[1,-1],[1,1]];
export const ENDLESS_V14_POWER_WEIGHTS:readonly {kind:PowerKind;weight:number}[]=[
 {kind:'plus3',weight:300},{kind:'wide',weight:130},{kind:'halve',weight:130},
 {kind:'pierce',weight:130},{kind:'fire',weight:140},{kind:'lightning',weight:167},{kind:'life',weight:3},
];
export interface EndlessSettings {
 readonly initialRows:number;readonly pierceSeconds:number;readonly fireSeconds:number;
 readonly weights:readonly {kind:PowerKind;weight:number}[];
 readonly descent:{readonly startTicks:number;readonly decay:number;readonly minTicks:number};
 readonly wideScale:number;readonly wideSeconds:number;readonly lightningBricks:number;
 readonly fireOffsets:readonly (readonly [number,number])[];
}
export const ENDLESS_LEGACY_SETTINGS:EndlessSettings={initialRows:18,pierceSeconds:4,fireSeconds:6,weights:ENDLESS_POWER_WEIGHTS,descent:ENDLESS.descent,wideScale:1.8,wideSeconds:5,lightningBricks:12,fireOffsets:FIRE_OFFSETS_LEGACY};
export const ENDLESS_V14_SETTINGS:EndlessSettings={initialRows:18,pierceSeconds:4,fireSeconds:6,weights:ENDLESS_V14_POWER_WEIGHTS,descent:{startTicks:540,decay:.98,minTicks:180},wideScale:2,wideSeconds:8,lightningBricks:15,fireOffsets:FIRE_OFFSETS_V14};
export const ENDLESS_V5:EndlessVariant={drops:{start:10,growEvery:200,max:40},floor:'raised',crush:true,powerPoints:true,settings:ENDLESS_V14_SETTINGS};
/** V1.5 deliberately preserves the fixed V1.4 fire event order. */
export const FIRE_OFFSETS_V15=FIRE_OFFSETS_V14;
export const ENDLESS_V15_POWER_WEIGHTS:readonly {kind:PowerKind;weight:number}[]=[
 {kind:'plus3',weight:280},{kind:'wide',weight:150},{kind:'halve',weight:130},
 {kind:'pierce',weight:130},{kind:'fire',weight:140},{kind:'lightning',weight:167},{kind:'life',weight:3},
];
export const ENDLESS_V15_SETTINGS:EndlessSettings={initialRows:20,pierceSeconds:4,fireSeconds:6,weights:ENDLESS_V15_POWER_WEIGHTS,descent:{startTicks:600,decay:.985,minTicks:240},wideScale:1.8,wideSeconds:8,lightningBricks:12,fireOffsets:FIRE_OFFSETS_V15};
export const ENDLESS_V6:EndlessVariant={drops:{start:12,growEvery:100,max:50},floor:'raised',crush:true,powerPoints:true,settings:ENDLESS_V15_SETTINGS};
/** endless-1.6.0: V1.5 balance; a lost life restarts the pressure timer. */
export const ENDLESS_V7:EndlessVariant={...ENDLESS_V6,pressureReset:true};
export const ENDLESS_CURRENT=ENDLESS_V7;
export function endlessSettings(variant:EndlessVariant=ENDLESS_CURRENT):EndlessSettings{return variant.settings??ENDLESS_LEGACY_SETTINGS;}
/** Relief reward: one of the four ball effects, equally likely, from its own seeded stream. */
export const BONUS_KINDS=['plus3','pierce','fire','lightning'] as const;
export type BonusKind=typeof BONUS_KINDS[number];
export function endlessBonus(random:()=>number):BonusKind{return BONUS_KINDS[Math.min(BONUS_KINDS.length-1,Math.floor(random()*BONUS_KINDS.length))];}
/** Seed salts for the independent drop and bonus streams (shared by client and verifier). */
export const DROP_SALT=0x5bd1e995,BONUS_SALT=0x2545f491;
export function dropEvery(destroyed:number,variant:EndlessVariant=ENDLESS_CURRENT){const d=variant.drops;return Math.min(d.max,d.start+Math.floor(destroyed/d.growEvery));}
export function endlessStage(descents:number){return Math.min(100,1+Math.floor(descents/ENDLESS.rowsPerStage));}

/** The single pseudo-level used for arena geometry, paddle and exit. */
export const ENDLESS_LEVEL:LevelConfig={number:1,name:'无尽模式',speedScale:ENDLESS.speed.start,obstacles:[],gridStep:ENDLESS.gridStep,gridSize:ENDLESS.gridSize,exitWidth:160,paddleScale:1.15,autoAdvance:false};

/** One reviewed version registry shared by Game and API replay dispatch. Unknown versions never fall back. */
export const ENDLESS_VARIANTS:Readonly<Record<string,EndlessVariant>>={
 [ENDLESS_V1_RULES_VERSION]:ENDLESS_V1,[ENDLESS_V2_RULES_VERSION]:ENDLESS_V2,[ENDLESS_V3_RULES_VERSION]:ENDLESS_V3,[ENDLESS_V4_RULES_VERSION]:ENDLESS_V4,[ENDLESS_V5_RULES_VERSION]:ENDLESS_V5,[ENDLESS_V6_RULES_VERSION]:ENDLESS_V6,[ENDLESS_RULES_VERSION]:ENDLESS_V7,
};
export function endlessVersion(variant:EndlessVariant){const version=Object.keys(ENDLESS_VARIANTS).find(key=>ENDLESS_VARIANTS[key]===variant);if(!version)throw Error('未知无尽规则配置');return version;}
