import type {Db} from './db.js';
import {transaction} from './db.js';
import {ApiError} from './moderation.js';
import {beijingTime,type NicknameQuota} from '../../shared/NicknamePolicy.js';
const DAY=86400000,OFFSET=8*3600000;
const calendar=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'numeric',day:'numeric'});
/** Calendar weeks start Monday 00:00 in Asia/Shanghai, including weeks crossing New Year. */
export function nicknameQuota(db:Db,playerId:string,time:number):NicknameQuota {
 const parts=calendar.formatToParts(time),part=(kind:string)=>Number(parts.find(p=>p.type===kind)!.value),year=part('year'),midnight=Date.UTC(year,part('month')-1,part('day'));
 const weekStart=midnight-((new Date(midnight).getUTCDay()+6)%7)*DAY-OFFSET,yearStart=Date.UTC(year,0,1)-OFFSET,weekResetsAt=weekStart+7*DAY,yearResetsAt=Date.UTC(year+1,0,1)-OFFSET;
 // One SQLite statement gives both calendar counters the same read snapshot.
 const counts=db.prepare(`SELECT
 (SELECT COUNT(*) FROM nickname_changes WHERE player_id=? AND changed_at>=? AND changed_at<?) week_used,
 (SELECT COUNT(*) FROM nickname_changes WHERE player_id=? AND changed_at>=? AND changed_at<?) year_used`).get(playerId,weekStart,weekResetsAt,playerId,yearStart,yearResetsAt)!;
 const weeklyRemaining=Math.max(0,2-Number(counts.week_used)),yearlyRemaining=Math.max(0,6-Number(counts.year_used));
 const allowed=weeklyRemaining>0&&yearlyRemaining>0;return {weeklyRemaining,yearlyRemaining,allowed,nextAllowedAt:allowed?null:Math.max(weeklyRemaining===0?weekResetsAt:time,yearlyRemaining===0?yearResetsAt:time),weekResetsAt,yearResetsAt,timeZone:'Asia/Shanghai'};
}
export function renameNickname(db:Db,playerId:string,name:{nickname:string;normalized:string},clock:()=>number){
 try{return transaction(db,()=>{
  const p=db.prepare('SELECT * FROM players WHERE id=?').get(playerId);if(!p||p.status!=='active')throw new ApiError(403,'账号不可修改昵称');const time=clock();
  if(p.normalized_nickname===name.normalized)return {changed:false,nickname:p.nickname,nicknameChange:nicknameQuota(db,playerId,time)};
  const quota=nicknameQuota(db,playerId,time);if(!quota.allowed)throw new ApiError(429,`昵称修改次数已达上限，下次可修改时间：${beijingTime(quota.nextAllowedAt!)}；仍可提交成绩`,'NICKNAME_CHANGE_LIMIT');
  db.prepare('UPDATE players SET nickname=?,normalized_nickname=?,updated_at=? WHERE id=?').run(name.nickname,name.normalized,time,playerId);
  db.prepare('INSERT INTO nickname_changes(player_id,changed_at) VALUES(?,?)').run(playerId,time);
  return {changed:true,nickname:name.nickname,nicknameChange:nicknameQuota(db,playerId,time)};
 });}catch(e){if(String(e).includes('UNIQUE constraint failed'))throw new ApiError(409,'该地区的昵称已被使用，请更换昵称');throw e;}
}
