import {C} from './GameConfig';
export type PowerKind='halve'|'triple'|'wide'|'life'|'bomb';
export const POWER_WEIGHTS={
  first:[{kind:'triple',weight:50},{kind:'wide',weight:50}],
  /** Frozen for 1.6.0 and earlier: +1 life and bomb are each 5% of random drops. */
  later:[{kind:'halve',weight:30},{kind:'triple',weight:30},{kind:'wide',weight:30},{kind:'life',weight:5},{kind:'bomb',weight:5}],
  /** V1.7 levels 4–12: +1 life and bomb are each 0.3% of random drops; the rest split ÷2/×3/wide. */
  scarce:[{kind:'halve',weight:330},{kind:'triple',weight:330},{kind:'wide',weight:334},{kind:'life',weight:3},{kind:'bomb',weight:3}],
} as const;
export type PowerProfile=keyof typeof POWER_WEIGHTS;
export function weightedPower(level:number|PowerProfile,random:()=>number=Math.random):PowerKind{const rows:readonly {kind:PowerKind;weight:number}[]=(level===1||level==='first')?POWER_WEIGHTS.first:level==='scarce'?POWER_WEIGHTS.scarce:POWER_WEIGHTS.later;let value=random()*rows.reduce((sum,row)=>sum+row.weight,0);for(const row of rows){value-=row.weight;if(value<0)return row.kind;}return rows[rows.length-1].kind;}
export {seededRandom} from './Random';
export function newSeed(){if(typeof crypto!=='undefined'&&crypto.getRandomValues)return crypto.getRandomValues(new Uint32Array(1))[0];return Math.floor(Math.random()*4294967296);}

export const POWER_LABELS:Record<PowerKind,string>={halve:'÷2',triple:'×3',wide:'加宽',life:'生命＋1',bomb:'爆炸炸弹'};
export const POWER_COLORS:Record<PowerKind,string>={halve:'#ff7880',triple:'#ffc28b',wide:'#91e9d4',life:'#f4a1bc',bomb:'#ffb365'};

/** Version 1 is retained only for replaying pre-threshold clients. */
export type TripleRuleVersion=1|2;
export const TRIPLE_RULE_VERSION:TripleRuleVersion=2;
export const TRIPLE_THRESHOLD=20;
export function tripleTarget(count:number,version:TripleRuleVersion=TRIPLE_RULE_VERSION){
 if(version!==1&&version!==2)throw new RangeError('未知X3规则');
 if(!Number.isSafeInteger(count)||count<0||count>C.maxBalls)throw new RangeError('有效球数超出范围');
 return Math.min(C.maxBalls,version===1||count<=TRIPLE_THRESHOLD?count*3:count+3);
}
