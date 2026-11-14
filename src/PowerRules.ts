import {C} from './GameConfig';
/** Classic kinds plus endless-only +3 balls, pierce, fire and lightning. */
export type PowerKind='halve'|'triple'|'wide'|'life'|'bomb'|'plus3'|'pierce'|'fire'|'lightning';
export const POWER_KINDS=['halve','triple','wide','life','bomb','plus3','pierce','fire','lightning'] as const satisfies readonly PowerKind[];
export const POWER_WEIGHTS={
  first:[{kind:'triple',weight:50},{kind:'wide',weight:50}],
  /** Frozen for 1.6.0 and earlier: +1 life and bomb are each 5% of random drops. */
  later:[{kind:'halve',weight:30},{kind:'triple',weight:30},{kind:'wide',weight:30},{kind:'life',weight:5},{kind:'bomb',weight:5}],
  /** V1.7 levels 4–12: +1 life and bomb are each 0.3% of random drops; the rest split ÷2/×3/wide. */
  scarce:[{kind:'halve',weight:330},{kind:'triple',weight:330},{kind:'wide',weight:334},{kind:'life',weight:3},{kind:'bomb',weight:3}],
  /** V1.9 level 3: ×3/wide, plus lightning, pierce and fire at 1% of drops each. */
  firstSkills:[{kind:'triple',weight:485},{kind:'wide',weight:485},{kind:'lightning',weight:10},{kind:'pierce',weight:10},{kind:'fire',weight:10}],
  /** V1.9 levels 4–12: the V1.7 mix with lightning, pierce and fire at 1% of drops each (taken evenly from ÷2/×3/wide). */
  scarceSkills:[{kind:'halve',weight:320},{kind:'triple',weight:320},{kind:'wide',weight:324},{kind:'life',weight:3},{kind:'bomb',weight:3},{kind:'lightning',weight:10},{kind:'pierce',weight:10},{kind:'fire',weight:10}],
} as const;
export type PowerProfile=keyof typeof POWER_WEIGHTS;
export function weightedPower(level:number|PowerProfile,random:()=>number=Math.random):PowerKind{const rows:readonly {kind:PowerKind;weight:number}[]=typeof level==='number'?(level===1?POWER_WEIGHTS.first:POWER_WEIGHTS.later):POWER_WEIGHTS[level];let value=random()*rows.reduce((sum,row)=>sum+row.weight,0);for(const row of rows){value-=row.weight;if(value<0)return row.kind;}return rows[rows.length-1].kind;}
export {seededRandom} from './Random';
export function newSeed(){if(typeof crypto!=='undefined'&&crypto.getRandomValues)return crypto.getRandomValues(new Uint32Array(1))[0];return Math.floor(Math.random()*4294967296);}

export const POWER_LABELS:Record<PowerKind,string>={halve:'÷2',triple:'×3',wide:'加宽',life:'生命＋1',bomb:'爆炸炸弹',plus3:'+3球',pierce:'穿透球',fire:'火焰球',lightning:'闪电链'};
export const POWER_COLORS:Record<PowerKind,string>={halve:'#ff7880',triple:'#ffc28b',wide:'#91e9d4',life:'#f4a1bc',bomb:'#ffb365',plus3:'#ffc28b',pierce:'#7fe8ff',fire:'#ff8a4c',lightning:'#ffe45c'};

/** Version 1 is retained only for replaying pre-threshold clients. */
export type TripleRuleVersion=1|2;
export const TRIPLE_RULE_VERSION:TripleRuleVersion=2;
export const TRIPLE_THRESHOLD=20;
export function tripleTarget(count:number,version:TripleRuleVersion=TRIPLE_RULE_VERSION){
 if(version!==1&&version!==2)throw new RangeError('未知X3规则');
 if(!Number.isSafeInteger(count)||count<0||count>C.maxBalls)throw new RangeError('有效球数超出范围');
 return Math.min(C.maxBalls,version===1||count<=TRIPLE_THRESHOLD?count*3:count+3);
}
