import {LEGACY_LEVELS} from './LegacyLevels';
export type ObstacleKind = 'fixed'|'moving'|'rotating';
export interface ObstacleConfig {
  readonly id:string;readonly kind:ObstacleKind;readonly x:number;readonly y:number;readonly length:number;readonly thickness:number;readonly angle:number;
  readonly amplitude?:number;readonly speed?:number;readonly phase?:number;readonly angularSpeed?:number;
}
export interface LevelConfig {readonly number:number;readonly name:string;readonly speedScale:number;readonly obstacles?:readonly ObstacleConfig[];readonly legacyNumber?:number;readonly brickCount?:number;readonly gridStep?:number;readonly gridSize?:number;readonly exitWidth?:number;readonly paddleScale?:number;readonly powerProfile?:'first'|'later';readonly powerDropMultiplier?:number;readonly autoAdvance?:boolean}

/** Explicit gameplay profiles ensure a renumber never changes the legacy ten levels. */
export const LEVELS:readonly LevelConfig[]=[
 {number:1,name:'轻松出击',speedScale:.85,brickCount:600,gridStep:22,gridSize:20,exitWidth:200,paddleScale:1.3,powerProfile:'first',powerDropMultiplier:1,autoAdvance:true,obstacles:[]},
 {number:2,name:'渐入佳境',speedScale:.92,brickCount:1200,gridStep:16,gridSize:14,exitWidth:160,paddleScale:1.15,powerProfile:'first',powerDropMultiplier:1,autoAdvance:true,obstacles:[]},
 ...LEGACY_LEVELS.map(level=>({...level,number:level.number+2,legacyNumber:level.number,powerProfile:(level.number===1?'first':'later') as 'first'|'later',powerDropMultiplier:level.number===1?1:.5})),
];
export function dropMultiplier(level:LevelConfig){return level.powerDropMultiplier??((level.legacyNumber??level.number)===1?1:.5);}
export function powerProfile(level:LevelConfig){return level.powerProfile??((level.legacyNumber??level.number)===1?'first':'later');}
