import type { Db } from './db.js';
const fields='s.id,s.score,s.reached_level,s.bricks_destroyed,s.duration_ms,s.completed_all_levels,s.achieved_at,p.id AS player_id,p.nickname,r.prefix AS region_label,r.code AS region_code';
const join='FROM player_bests b JOIN scores s ON s.id=b.score_id JOIN players p ON p.id=b.player_id JOIN regions r ON r.code=p.region_code WHERE p.status=\'active\' AND s.verification_status=\'verified\'';
const ordering='s.score DESC,s.reached_level DESC,s.duration_ms ASC,s.achieved_at ASC,s.id ASC';
export function leaderboard(db:Db,offset:number,limit:number){const rows=db.prepare(`SELECT ${fields} ${join} ORDER BY ${ordering} LIMIT ? OFFSET ?`).all(limit,offset);return rows.map((r,i)=>({...r,rank:offset+i+1,display_name:`${r.region_label}·${r.nickname}`}));}
export function personalBest(db:Db,playerId:string){
 const s=db.prepare(`SELECT ${fields} ${join} AND p.id=?`).get(playerId);if(!s)return null;
 const better=db.prepare(`SELECT COUNT(*) AS count ${join} AND (s.score>? OR (s.score=? AND s.reached_level>?) OR (s.score=? AND s.reached_level=? AND s.duration_ms<?) OR (s.score=? AND s.reached_level=? AND s.duration_ms=? AND s.achieved_at<?) OR (s.score=? AND s.reached_level=? AND s.duration_ms=? AND s.achieved_at=? AND s.id<?))`).get(s.score,s.score,s.reached_level,s.score,s.reached_level,s.duration_ms,s.score,s.reached_level,s.duration_ms,s.achieved_at,s.score,s.reached_level,s.duration_ms,s.achieved_at,s.id)!;
 return {...s,rank:Number(better.count)+1,display_name:`${s.region_label}·${s.nickname}`};
}
export function refreshBest(db:Db,playerId:string){const best=db.prepare('SELECT id FROM scores WHERE player_id=? AND verification_status=\'verified\' ORDER BY score DESC,reached_level DESC,duration_ms,achieved_at,id LIMIT 1').get(playerId);if(best)db.prepare('INSERT INTO player_bests VALUES(?,?) ON CONFLICT(player_id) DO UPDATE SET score_id=excluded.score_id').run(playerId,best.id);else db.prepare('DELETE FROM player_bests WHERE player_id=?').run(playerId);}
