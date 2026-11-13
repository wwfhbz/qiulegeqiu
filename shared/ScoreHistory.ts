import {LEGACY_RULES_VERSION,PREVIOUS_RULES_VERSION,V13_RULES_VERSION,V15_RULES_VERSION} from './Challenge';
export interface HistoricalScore {score:number;reached_level:number;rules_version?:string}
/** Personal history only: do not compare or convert scores across rule versions. */
export function scoreHistoryLines(records?:readonly HistoricalScore[],fallback?:HistoricalScore|null){
 const rows=records??(fallback?[fallback]:[]);
 return rows.map(row=>`${row.rules_version===V15_RULES_VERSION?'V1.5赛季':row.rules_version===V13_RULES_VERSION?'V1.3赛季':row.rules_version===PREVIOUS_RULES_VERSION?'旧版十二关':row.rules_version===LEGACY_RULES_VERSION?'旧版十关':'旧版'}记录：${row.score} 分 · 第${row.reached_level}关`);
}
