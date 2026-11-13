import {TUTORIAL_POWERS,type BrickPowerConfig} from './BrickPowerRules';
import {LEGACY_LEVELS} from './LegacyLevels';
export type ObstacleKind = 'fixed'|'moving'|'rotating';
export interface ObstacleConfig {
  readonly id:string;readonly kind:ObstacleKind;readonly x:number;readonly y:number;readonly length:number;readonly thickness:number;readonly angle:number;
  readonly amplitude?:number;readonly speed?:number;readonly phase?:number;readonly angularSpeed?:number;
}
export interface LevelConfig {readonly brickPowers?:BrickPowerConfig;readonly number:number;readonly name:string;readonly speedScale:number;readonly obstacles?:readonly ObstacleConfig[];readonly legacyNumber?:number;readonly brickCount?:number;readonly gridStep?:number;readonly gridSize?:number;readonly exitWidth?:number;readonly paddleScale?:number;readonly powerProfile?:'first'|'later';readonly powerDropMultiplier?:number;readonly autoAdvance?:boolean}

/** Frozen V1.3 twelve levels (rules 1.3.0): full ~4100-brick grids for levels 3–12. */
export const V13_LEVELS:readonly LevelConfig[]=[
 {brickPowers:TUTORIAL_POWERS.firstV13,number:1,name:'轻松出击',speedScale:.85,brickCount:600,gridStep:22,gridSize:20,exitWidth:200,paddleScale:1.3,powerProfile:'first',powerDropMultiplier:1,autoAdvance:true,obstacles:[]},
 {brickPowers:TUTORIAL_POWERS.secondV13,number:2,name:'渐入佳境',speedScale:.92,brickCount:1200,gridStep:16,gridSize:14,exitWidth:160,paddleScale:1.15,powerProfile:'first',powerDropMultiplier:1,autoAdvance:true,obstacles:[]},
 ...LEGACY_LEVELS.map(level=>({...level,number:level.number+2,legacyNumber:level.number,powerProfile:(level.number===1?'first':'later') as 'first'|'later',powerDropMultiplier:level.number===1?1:.5})),
];
/** Frozen V1.5 brick counts for levels 3–12 on the original 9px grid (a small central disc). */
export const V15_LATER_BRICK_COUNTS=[1500,1600,1700,1800,1900,2000,2150,2300,2400,2500] as const;
/** Frozen V1.5 twelve levels (rules 1.5.0). */
export const V15_LEVELS:readonly LevelConfig[]=V13_LEVELS.map(level=>level.number===1?{...level,brickPowers:TUTORIAL_POWERS.firstV15}:level.number>=3?{...level,brickCount:V15_LATER_BRICK_COUNTS[level.number-3]}:level);

/**
 * V1.6 later levels fill the arena like the tutorials: each uses a coarser grid sized so the count
 * covers ~86–94% of the brick region (levels 1/2 cover ~89%/92%). Bricks shrink and counts grow gently.
 * Each entry: [gridStep, brickCount]; brick size keeps the tutorials' 2px gap.
 */
export const LATER_LAYOUTS=[[15,1320],[14,1500],[13,1700],[13,1800],[12,2000],[12,2100],[12,2150],[11,2400],[11,2480],[11,2560]] as const;
export const LATER_BRICK_COUNTS=LATER_LAYOUTS.map(([,count])=>count);
/** Drop rate ramps down instead of falling off a cliff: L1 20% → L2 12% → L3/L4 1 in 14 → L5+ 1 in 28. */
const laterDrop=(number:number)=>number<=4?1:.5;
/** Current twelve levels (rules 1.6.0). Obstacles, speeds, exits and paddles are unchanged. */
export const LEVELS:readonly LevelConfig[]=V13_LEVELS.map(level=>{
 if(level.number===1)return {...level,brickPowers:TUTORIAL_POWERS.first};
 if(level.number===2)return {...level,brickPowers:TUTORIAL_POWERS.second};
 const [gridStep,brickCount]=LATER_LAYOUTS[level.number-3];
 return {...level,gridStep,gridSize:gridStep-2,brickCount,powerDropMultiplier:laterDrop(level.number)};
});
export function dropMultiplier(level:LevelConfig){return level.powerDropMultiplier??((level.legacyNumber??level.number)===1?1:.5);}
export function powerProfile(level:LevelConfig){return level.powerProfile??((level.legacyNumber??level.number)===1?'first':'later');}

/** Immutable twelve-level baseline before the fixed tutorial quotas. */
export const PREVIOUS_LEVELS:readonly LevelConfig[]=V13_LEVELS.map(({brickPowers:_removed,...level})=>level);
