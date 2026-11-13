import type { Db } from './db.js';
import {LEGACY_RULES_VERSION,PREVIOUS_RULES_VERSION,V13_RULES_VERSION,V15_RULES_VERSION,V16_RULES_VERSION,V17_RULES_VERSION,SUPPORTED_RULES_VERSIONS,RULES_VERSION,isEndlessRules} from '../../shared/Challenge.js';
const fields='s.id,s.score,s.reached_level,s.bricks_destroyed,s.duration_ms,s.completed_all_levels,s.achieved_at,p.id AS player_id,p.nickname,r.prefix AS region_label,r.code AS region_code';
const ordering='s.score DESC,s.reached_level DESC,s.duration_ms ASC,s.achieved_at ASC,s.id ASC';
/** Frozen per-rule pointers remain for audit/old tooling only, never for ranking. */
function auditRule(rules:string){if(!SUPPORTED_RULES_VERSIONS.some(version=>version===rules))throw Error('不支持的验证规则');}
/** Old query aliases all resolve to exactly one board per mode. */
export function leaderboard(db:Db,offset:number,limit:number,rules:string=LEGACY_RULES_VERSION){return isEndlessRules(rules)?endlessLeaderboard(db,offset,limit):globalLeaderboard(db,offset,limit);}
export function personalBest(db:Db,playerId:string,rules:string=LEGACY_RULES_VERSION){return isEndlessRules(rules)?endlessPersonalBest(db,playerId):globalPersonalBest(db,playerId);}
export function refreshBest(db:Db,playerId:string,rules:string=LEGACY_RULES_VERSION){
 auditRule(rules);const legacy=rules===LEGACY_RULES_VERSION;
 const best=db.prepare(`SELECT s.id FROM scores s JOIN challenges c ON c.id=s.challenge_id WHERE s.player_id=? AND s.verification_status='verified' AND c.rules_version=? ORDER BY ${ordering} LIMIT 1`).get(playerId,rules);
 if(legacy){if(best)db.prepare('INSERT INTO player_bests VALUES(?,?) ON CONFLICT(player_id) DO UPDATE SET score_id=excluded.score_id').run(playerId,best.id);else db.prepare('DELETE FROM player_bests WHERE player_id=?').run(playerId);}
 else if(best)db.prepare('INSERT INTO season_player_bests VALUES(?,?,?) ON CONFLICT(rules_version,player_id) DO UPDATE SET score_id=excluded.score_id').run(rules,playerId,best.id);
 else db.prepare('DELETE FROM season_player_bests WHERE rules_version=? AND player_id=?').run(rules,playerId);
}

/** Ranking over the selected mode: each player's single best verified score; scores are never converted.
 * Derive from verified records so stale per-season pointers cannot hide a valid personal best. */
const ranking=(mode:'campaign'|'endless')=>`WITH candidates AS (
 SELECT ${fields},c.rules_version,
 ROW_NUMBER() OVER(PARTITION BY s.player_id ORDER BY ${ordering}) AS choice
 FROM scores s JOIN challenges c ON c.id=s.challenge_id JOIN players p ON p.id=s.player_id JOIN regions r ON r.code=p.region_code
 WHERE p.status='active' AND s.verification_status='verified' AND c.unranked=0 AND c.mode='${mode}'
), ranked AS (
 SELECT *,ROW_NUMBER() OVER(ORDER BY score DESC,reached_level DESC,duration_ms ASC,achieved_at ASC,id ASC) AS rank
 FROM candidates WHERE choice=1
) `;
function globalRow(row:Record<string,unknown>){const {choice,...value}=row;return {...value,display_name:`${row.region_label}·${row.nickname}`};}
/** Permanent campaign board: every historical/future verified campaign, including the old ten-level rules. */
const globalRanking=ranking('campaign');
export function globalLeaderboard(db:Db,offset:number,limit:number){return db.prepare(globalRanking+'SELECT * FROM ranked ORDER BY rank LIMIT ? OFFSET ?').all(limit,offset).map(globalRow);}
export function globalPersonalBest(db:Db,playerId:string){const row=db.prepare(globalRanking+'SELECT * FROM ranked WHERE player_id=?').get(playerId);return row?globalRow(row):null;}

/** Permanent mode-wide board. Version only verifies/audits; future versions need no ranking changes. */
const endlessRanking=ranking('endless');
export function endlessLeaderboard(db:Db,offset:number,limit:number){return db.prepare(endlessRanking+'SELECT * FROM ranked ORDER BY rank LIMIT ? OFFSET ?').all(limit,offset).map(globalRow);}
export function endlessPersonalBest(db:Db,playerId:string){const row=db.prepare(endlessRanking+'SELECT * FROM ranked WHERE player_id=?').get(playerId);return row?globalRow(row):null;}

/** Per-rule personal audit records, never separate ranked boards. Rank, when present, is the player's real campaign rank. */
export function historicalBests(db:Db,playerId:string){
 const rank=(globalPersonalBest(db,playerId) as Record<string,unknown>|null)?.rank;
 const rows=db.prepare(`WITH audit AS (
 SELECT ${fields},c.rules_version,ROW_NUMBER() OVER(PARTITION BY c.rules_version ORDER BY ${ordering}) choice
 FROM scores s JOIN challenges c ON c.id=s.challenge_id JOIN players p ON p.id=s.player_id JOIN regions r ON r.code=p.region_code
 WHERE p.id=? AND c.mode='campaign' AND c.unranked=0 AND p.status='active' AND s.verification_status='verified' AND c.rules_version<>?
 ) SELECT * FROM audit WHERE choice=1`).all(playerId,RULES_VERSION);
 const known:readonly string[]=[LEGACY_RULES_VERSION,PREVIOUS_RULES_VERSION,V13_RULES_VERSION,V15_RULES_VERSION,V16_RULES_VERSION,V17_RULES_VERSION];
 rows.sort((a,b)=>known.indexOf(String(b.rules_version))-known.indexOf(String(a.rules_version)));
 return rows.map(row=>({...globalRow(row),rank}));
}
