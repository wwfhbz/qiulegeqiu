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
 {brickPowers:TUTORIAL_POWERS.second,number:2,name:'渐入佳境',speedScale:.92,brickCount:1200,gridStep:16,gridSize:14,exitWidth:160,paddleScale:1.15,powerProfile:'first',powerDropMultiplier:1,autoAdvance:true,obstacles:[]},
 ...LEGACY_LEVELS.map(level=>({...level,number:level.number+2,legacyNumber:level.number,powerProfile:(level.number===1?'first':'later') as 'first'|'later',powerDropMultiplier:level.number===1?1:.5})),
];
/** V1.5 brick counts for levels 3–12: a gentle ramp instead of ~4100 bricks on every level. */
export const LATER_BRICK_COUNTS=[1500,1600,1700,1800,1900,2000,2150,2300,2400,2500] as const;
/** Current twelve levels (rules 1.5.0). Obstacles, speeds, exits and drop profiles are unchanged. */
export const LEVELS:readonly LevelConfig[]=V13_LEVELS.map(level=>level.number===1?{...level,brickPowers:TUTORIAL_POWERS.first}:level.number>=3?{...level,brickCount:LATER_BRICK_COUNTS[level.number-3]}:level);
export function dropMultiplier(level:LevelConfig){return level.powerDropMultiplier??((level.legacyNumber??level.number)===1?1:.5);}
export function powerProfile(level:LevelConfig){return level.powerProfile??((level.legacyNumber??level.number)===1?'first':'later');}

/** Immutable twelve-level baseline before the fixed tutorial quotas. */
export const PREVIOUS_LEVELS:readonly LevelConfig[]=V13_LEVELS.map(({brickPowers:_removed,...level})=>level);
