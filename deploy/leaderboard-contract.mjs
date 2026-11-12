/** Read-only response gates shared by candidate smoke tests and production verification. */
export function verifyLeaderboardHealth(data,rules=data?.rulesVersion){
 if(data?.ok!==true||data.challengeProtocolVersion!==2||data.database!=='ready'||typeof rules!=='string'||!rules||data.rulesVersion!==rules||!Array.isArray(data.supportedRulesVersions)||!data.supportedRulesVersions.includes(rules)||data.leaderboard?.board!=='global'||data.leaderboard?.rankingRulesVersion!==rules)throw Error('API未满足统一排行榜、十二关与日志协议2，停止切换');
}
export function verifyLeaderboardPage(data,rules,offset=0,limit=20){
 if(data?.board!=='global'||data.rankingRulesVersion!==rules||!Array.isArray(data.items)||data.items.length>limit||(data.nextOffset!==null&&data.nextOffset!==offset+data.items.length))throw Error('统一排行榜分页协议无效');
 const seen=new Set();for(const [i,row] of data.items.entries()){
  if(row.rank!==offset+i+1||!Number.isSafeInteger(row.score)||row.score<0||!Number.isSafeInteger(row.reached_level)||row.reached_level<1||typeof row.player_id!=='string'||seen.has(row.player_id))throw Error('统一排行榜数据或名次无效');seen.add(row.player_id);
 }
}
export function verifyIdentityPersistence(before,after){
 // Rankings may legitimately change while other players submit; only identity must remain stable.
 if(before?.board!=='global'||after?.board!=='global'||typeof before.csrfToken!=='string'||!before.csrfToken||before.csrfToken!==after.csrfToken||(before.player?.id??null)!==(after.player?.id??null))throw Error('重启后玩家身份未保持');
}
export function verifyRollbackCompatibility(nextRules,previousRules){
 if(typeof nextRules!=='string'||!nextRules.trim()||typeof previousRules!=='string'||previousRules.trim()!==nextRules.trim())throw Error('回退目标不支持相同规则；先准备经审核的双规则兼容基线，禁止带新成绩退回旧验证器');
}
