export type PowerKind='halve'|'triple'|'wide'|'life'|'bomb';
export const POWER_WEIGHTS={
  first:[{kind:'triple',weight:50},{kind:'wide',weight:50}],
  later:[{kind:'halve',weight:30},{kind:'triple',weight:30},{kind:'wide',weight:30},{kind:'life',weight:5},{kind:'bomb',weight:5}],
} as const;
export function weightedPower(level:number,random:()=>number=Math.random):PowerKind{const rows=level===1?POWER_WEIGHTS.first:POWER_WEIGHTS.later;let value=random()*rows.reduce((sum,row)=>sum+row.weight,0);for(const row of rows){value-=row.weight;if(value<0)return row.kind;}return rows[rows.length-1].kind;}
/** A deterministic gameplay RNG, not a cryptographic signature or a secret. */
export function seededRandom(seed:number){let state=seed>>>0;return ()=>{state+=0x6D2B79F5;let value=state;value=Math.imul(value^value>>>15,value|1);value^=value+Math.imul(value^value>>>7,value|61);return ((value^value>>>14)>>>0)/4294967296;};}
export function newSeed(){if(typeof crypto!=='undefined'&&crypto.getRandomValues)return crypto.getRandomValues(new Uint32Array(1))[0];return Math.floor(Math.random()*4294967296);}

export const POWER_LABELS:Record<PowerKind,string>={halve:'÷2',triple:'×3',wide:'加宽',life:'生命＋1',bomb:'爆炸炸弹'};
export const POWER_COLORS:Record<PowerKind,string>={halve:'#ff7880',triple:'#ffc28b',wide:'#91e9d4',life:'#f4a1bc',bomb:'#ffb365'};
