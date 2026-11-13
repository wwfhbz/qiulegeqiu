import type { Db } from './db.js';
import {LEGACY_RULES_VERSION,PREVIOUS_RULES_VERSION,V13_RULES_VERSION,V15_RULES_VERSION,RULES_VERSION,SUPPORTED_RULES_VERSIONS} from '../../shared/Challenge.js';
const fields='s.id,s.score,s.reached_level,s.bricks_destroyed,s.duration_ms,s.completed_all_levels,s.achieved_at,p.id AS player_id,p.nickname,r.prefix AS region_label,r.code AS region_code';
const ordering='s.score DESC,s.reached_level DESC,s.duration_ms ASC,s.achieved_at ASC,s.id ASC';
function board(rules:string){
 if(!SUPPORTED_RULES_VERSIONS.some(version=>version===rules))throw Error('不支持的排行榜赛季');
 const legacy=rules===LEGACY_RULES_VERSION;
 return {join:`FROM ${legacy?'player_bests':'season_player_bests'} b JOIN scores s ON s.id=b.score_id JOIN challenges c ON c.id=s.challenge_id JOIN players p ON p.id=b.player_id JOIN regions r ON r.code=p.region_code WHERE p.status='active' AND s.verification_status='verified'${legacy?' AND c.rules_version=?':' AND b.rules_version=? AND c.rules_version=b.rules_version'}`,args:[rules]};
}
/** No query parameter from an old client always means its original legacy board. */
export function leaderboard(db:Db,offset:number,limit:number,rules:string=LEGACY_RULES_VERSION){const b=board(rules);const rows=db.prepare(`SELECT ${fields} ${b.join} ORDER BY ${ordering} LIMIT ? OFFSET ?`).all(...b.args,limit,offset);return rows.map((r,i)=>({...r,rules_version:rules,rank:offset+i+1,display_name:`${r.region_label}·${r.nickname}`}));}
export function personalBest(db:Db,playerId:string,rules:string=LEGACY_RULES_VERSION){
 const b=board(rules),s=db.prepare(`SELECT ${fields} ${b.join} AND p.id=?`).get(...b.args,playerId);if(!s)return null;
 const better=db.prepare(`SELECT COUNT(*) AS count ${b.join} AND (s.score>? OR (s.score=? AND s.reached_level>?) OR (s.score=? AND s.reached_level=? AND s.duration_ms<?) OR (s.score=? AND s.reached_level=? AND s.duration_ms=? AND s.achieved_at<?) OR (s.score=? AND s.reached_level=? AND s.duration_ms=? AND s.achieved_at=? AND s.id<?))`).get(...b.args,s.score,s.score,s.reached_level,s.score,s.reached_level,s.duration_ms,s.score,s.reached_level,s.duration_ms,s.achieved_at,s.score,s.reached_level,s.duration_ms,s.achieved_at,s.id)!;
 return {...s,rules_version:rules,rank:Number(better.count)+1,display_name:`${s.region_label}·${s.nickname}`};
}
export function refreshBest(db:Db,playerId:string,rules:string=LEGACY_RULES_VERSION){
 board(rules);const legacy=rules===LEGACY_RULES_VERSION;
 const best=db.prepare(`SELECT s.id FROM scores s JOIN challenges c ON c.id=s.challenge_id WHERE s.player_id=? AND s.verification_status='verified' AND c.rules_version=? ORDER BY ${ordering} LIMIT 1`).get(playerId,rules);
 if(legacy){if(best)db.prepare('INSERT INTO player_bests VALUES(?,?) ON CONFLICT(player_id) DO UPDATE SET score_id=excluded.score_id').run(playerId,best.id);else db.prepare('DELETE FROM player_bests WHERE player_id=?').run(playerId);}
 else if(best)db.prepare('INSERT INTO season_player_bests VALUES(?,?,?) ON CONFLICT(rules_version,player_id) DO UPDATE SET score_id=excluded.score_id').run(rules,playerId,best.id);
 else db.prepare('DELETE FROM season_player_bests WHERE rules_version=? AND player_id=?').run(rules,playerId);
}

/** Unified fair ranking: requalify under the shared twelve-level rules; never convert legacy scores.
 * Derive from verified records so stale per-season pointers cannot hide a valid personal best. */
const globalRanking=`WITH candidates AS (
 SELECT ${fields},c.rules_version,
 ROW_NUMBER() OVER(PARTITION BY s.player_id ORDER BY ${ordering}) AS choice
 FROM scores s JOIN challenges c ON c.id=s.challenge_id JOIN players p ON p.id=s.player_id JOIN regions r ON r.code=p.region_code
 WHERE p.status='active' AND s.verification_status='verified' AND c.unranked=0 AND c.rules_version=?
), ranked AS (
 SELECT *,ROW_NUMBER() OVER(ORDER BY score DESC,reached_level DESC,duration_ms ASC,achieved_at ASC,id ASC) AS rank
 FROM candidates WHERE choice=1
) `;
function globalRow(row:Record<string,unknown>){const {choice,...value}=row;return {...value,display_name:`${row.region_label}·${row.nickname}`};}
export function globalLeaderboard(db:Db,offset:number,limit:number){return db.prepare(globalRanking+'SELECT * FROM ranked ORDER BY rank LIMIT ? OFFSET ?').all(RULES_VERSION,limit,offset).map(globalRow);}
export function globalPersonalBest(db:Db,playerId:string){const row=db.prepare(globalRanking+'SELECT * FROM ranked WHERE player_id=?').get(RULES_VERSION,playerId);return row?globalRow(row):null;}

/** Each old rule keeps its own personal record and rank; never compare or convert old scores. */
export function historicalBests(db:Db,playerId:string){
 return [V15_RULES_VERSION,V13_RULES_VERSION,PREVIOUS_RULES_VERSION,LEGACY_RULES_VERSION].flatMap(rules=>{const row=db.prepare(globalRanking+'SELECT * FROM ranked WHERE player_id=?').get(rules,playerId);return row?[globalRow(row)]:[];});
}
