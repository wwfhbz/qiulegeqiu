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
  /** V1.11 picture levels 3–7: lightning, pierce and fire at 2% each to help crack hard bricks. */
  patterns:[{kind:'halve',weight:300},{kind:'triple',weight:300},{kind:'wide',weight:330},{kind:'life',weight:5},{kind:'bomb',weight:5},{kind:'lightning',weight:20},{kind:'pierce',weight:20},{kind:'fire',weight:20}],
  /** V1.11 levels 9–11: fewer ×3 so a ball storm no longer clears the wall on its own. */
  patternsLate:[{kind:'halve',weight:360},{kind:'triple',weight:240},{kind:'wide',weight:330},{kind:'life',weight:5},{kind:'bomb',weight:5},{kind:'lightning',weight:20},{kind:'pierce',weight:20},{kind:'fire',weight:20}],
  /** V1.11 boss levels 8 and 12: generous lightning, pierce and fire. */
  boss:[{kind:'halve',weight:200},{kind:'triple',weight:250},{kind:'wide',weight:300},{kind:'life',weight:10},{kind:'bomb',weight:0},{kind:'lightning',weight:80},{kind:'pierce',weight:80},{kind:'fire',weight:80}],
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

/** Campaign practice drop director (client only; ranked replays never set it). */
export const ASSIST={
 /** At most this many drops fall at once; the rest wait in a (tier-sized) queue instead of vanishing. */
 onScreen:6,releaseGap:.5,
 /** A rescue drop is ×3 at this many balls or fewer, otherwise one of `rescue`. */
 rescueTripleBelow:5,
 /** Endgame starts at this many bricks left (or the tier's share, whichever is larger). */
 endgameBricks:30,
 /** One drop per N bricks: steel-heavy 7 and 10 a little more often, bosses 8 and 12 less often (they are the peaks). */
 dropEvery:{7:20,10:28,8:28,12:34} as Readonly<Record<number,number>>,
 rescue:['pierce','lightning','fire','wide','triple'] as readonly PowerKind[],
} as const;
/** How much the director helps; it fades as the campaign gets harder and is off on boss levels. */
export interface AssistTier{readonly name:string;readonly queue:number;
 /** ÷2 becomes a wide paddle at this many balls or fewer (0: never). */
 readonly halveMinBalls:number;
 /** Seconds without any drop before a rescue power falls (Infinity: never). */
 readonly rescueAfter:number;
 /** At most `lowBalls` balls for `lowBallsAfter` seconds in a row → a ×3 falls (0: never). */
 readonly lowBalls:number;readonly lowBallsAfter:number;
 /** Share of bricks left that counts as the endgame, and seconds between endgame lightning (0: never). */
 readonly endgameShare:number;readonly endgameAfter:number;}
const INFINITE=Number.POSITIVE_INFINITY;
export const ASSIST_TIERS={
 rookie:{name:'新手',queue:40,halveMinBalls:8,rescueAfter:10,lowBalls:3,lowBallsAfter:8,endgameShare:.06,endgameAfter:4},
 rising:{name:'进阶',queue:20,halveMinBalls:4,rescueAfter:18,lowBalls:2,lowBallsAfter:12,endgameShare:.04,endgameAfter:6},
 hard:{name:'挑战',queue:10,halveMinBalls:0,rescueAfter:25,lowBalls:2,lowBallsAfter:15,endgameShare:.06,endgameAfter:6},
 boss:{name:'Boss',queue:10,halveMinBalls:0,rescueAfter:INFINITE,lowBalls:0,lowBallsAfter:INFINITE,endgameShare:0,endgameAfter:0},
} as const satisfies Record<string,AssistTier>;
/** Levels 1–3 rookie, 4–6 rising, 7 and 9–11 hard, 8 and 12 boss. */
export function assistTier(level:number):AssistTier{
 if(level===8||level===12)return ASSIST_TIERS.boss;
 return level<=3?ASSIST_TIERS.rookie:level<=6?ASSIST_TIERS.rising:ASSIST_TIERS.hard;
}
