import {seededRandom} from './Random';
import type {PowerKind} from './PowerRules';
/** Only ordinary, destructible cells in the generated grid participate. */
export interface BrickPowerConfig {readonly fraction:number;readonly tripleShare:number;readonly stratumSize:number}
export const TUTORIAL_POWERS={
 /** V1.6: 20% of level 1 (96 X3 + 24 wide) and 12% of level 2 (86 X3 + 58 wide). */
 first:{fraction:.2,tripleShare:.8,stratumSize:10},
 second:{fraction:.12,tripleShare:.6,stratumSize:10},
 /** Frozen quotas, used only to verify and replay their seasons. */
 firstV15:{fraction:.35,tripleShare:1,stratumSize:10},
 firstV13:{fraction:.8,tripleShare:1,stratumSize:10},
 secondV13:{fraction:.5,tripleShare:.6,stratumSize:10},
} as const satisfies Record<string,BrickPowerConfig>;
export type BrickPowerVersion=1|2;
export const BRICK_POWER_VERSION:BrickPowerVersion=2;
const kinds:readonly (PowerKind|undefined)[]=[undefined,'triple','wide'];
export function brickPowerKind(code:number){return kinds[code];}
export function brickPowerCounts(total:number,config:BrickPowerConfig){
 const drops=Math.round(total*config.fraction),triple=Math.round(drops*config.tripleShare);
 return {drops,triple,wide:drops-triple,none:total-drops};
}
/** Seeded stratified allocation: every small spatial group receives its exact quota.
 * Independent RNG leaves the legacy drop-type stream for levels 3–12 unchanged. */
export function allocateBrickPowers(alive:Uint8Array,config:BrickPowerConfig|undefined,seed:number,level:number){
 const result=new Uint8Array(alive.length);if(!config)return result;
 const cells:number[]=[];for(let i=0;i<alive.length;i++)if(alive[i])cells.push(i);
 const count=brickPowerCounts(cells.length,config),random=seededRandom((seed^Math.imul(level,0x9e3779b9))>>>0);
 let allocated=0,triples=0;
 for(let start=0;start<cells.length;start+=config.stratumSize){
  const end=Math.min(cells.length,start+config.stratumSize);
  const nextDrops=Math.round(end*count.drops/cells.length),nextTriples=count.drops?Math.round(nextDrops*count.triple/count.drops):0;
  const values:number[]=Array(end-start).fill(0);
  for(let n=0;n<nextDrops-allocated;n++)values[n]=n<nextTriples-triples?1:2;
  for(let n=values.length-1;n>0;n--){const j=Math.floor(random()*(n+1));[values[n],values[j]]=[values[j],values[n]];}
  for(let n=start;n<end;n++)result[cells[n]]=values[n-start];
  allocated=nextDrops;triples=nextTriples;
 }
 return result;
}
