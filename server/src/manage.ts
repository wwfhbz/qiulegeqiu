import {RULES_VERSION,LEGACY_RULES_VERSION} from '../../shared/Challenge.js';
import { randomUUID } from 'node:crypto';
import { openDb, transaction, rollbackWechatEmpty } from './db.js';
import { seedRegions } from './regions.js';
import { moderateNickname } from './moderation.js';
import { refreshBest } from './leaderboard.js';
const [command,target,value,reason]=process.argv.slice(2);
const db=openDb(process.env.DB_PATH||'../work/leaderboard.sqlite');seedRegions(db);
function audit(action:string,id:string,note:string){if(!note||note.length<3)throw new Error('必须提供至少3个字符的审核理由');db.prepare('INSERT INTO admin_audit VALUES(?,?,?,?,?,?)').run(randomUUID(),`os:${process.getuid?.()??'unknown'}`,action,id,note,Date.now());}
try {
 switch(command){
  case 'rollback-wechat-empty':if(target!=='--confirm-empty')throw Error('仅空微信表允许结构回退，需--confirm-empty；不要恢复覆盖数据库');rollbackWechatEmpty(db);console.log('空微信扩展结构已回退；玩家、成绩、会话未删除');break;
  case 'migrate': console.log('数据库初始化/迁移完成');break;
  case 'ban': case 'unban':transaction(db,()=>{if(!db.prepare('SELECT id FROM players WHERE id=?').get(target))throw Error('玩家不存在');audit(command,target,value);db.prepare('UPDATE players SET status=?,updated_at=? WHERE id=?').run(command==='ban'?'banned':'active',Date.now(),target);});console.log('玩家状态已更新');break;
  case 'rename': {const name=await moderateNickname(value);transaction(db,()=>{if(!db.prepare('SELECT id FROM players WHERE id=?').get(target))throw Error('玩家不存在');audit('rename',target,reason);db.prepare('UPDATE players SET nickname=?,normalized_nickname=?,updated_at=? WHERE id=?').run(name.nickname,name.normalized,Date.now(),target);});console.log('昵称已更新');break;}
  case 'review': if(!['approve','reject'].includes(value))throw Error('审核动作必须approve或reject');transaction(db,()=>{const score=db.prepare('SELECT s.player_id,c.rules_version FROM scores s JOIN challenges c ON c.id=s.challenge_id WHERE s.id=?').get(target);if(!score)throw Error('成绩不存在');audit('review-'+value,target,reason);db.prepare('UPDATE scores SET verification_status=?,review_reason=? WHERE id=?').run(value==='approve'?'verified':'rejected',reason,target);refreshBest(db,String(score.player_id),score.rules_version===RULES_VERSION?RULES_VERSION:LEGACY_RULES_VERSION);});console.log('成绩审核完成');break;
  case 'appeals':console.log(JSON.stringify(db.prepare('SELECT id,player_id,message,status,created_at FROM appeals WHERE status=\'open\' ORDER BY created_at LIMIT 100').all(),null,2));break;
  case 'resolve':transaction(db,()=>{if(!db.prepare('SELECT id FROM appeals WHERE id=?').get(target))throw Error('申诉不存在');audit('resolve',target,value);db.prepare('UPDATE appeals SET status=\'resolved\',resolution=?,resolved_at=? WHERE id=?').run(value,Date.now(),target);});console.log('申诉已处理');break;
  case 'review-list':console.log(JSON.stringify(db.prepare('SELECT id,player_id,score,review_reason FROM scores WHERE verification_status=\'quarantined\' ORDER BY submitted_at LIMIT 100').all(),null,2));break;
  default:throw Error('用法：migrate | ban/unban 玩家ID 理由 | rename 玩家ID 新昵称 理由 | review 成绩ID approve/reject 理由 | appeals | resolve 申诉ID 处理说明 | review-list');
 }
} finally {db.close();}
