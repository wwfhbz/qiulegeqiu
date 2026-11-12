/** Read-only response gates shared by candidate smoke tests and production verification. */
export function verifyLeaderboardHealth(data,rules=data?.rulesVersion){
 if(data?.ok!==true||data.challengeProtocolVersion!==2||!Array.isArray(data.challengeFeatures)||!data.challengeFeatures.includes('triple-threshold20-v1')||!data.challengeFeatures.includes('tutorial-brick-powers-v1')||data.database!=='ready'||typeof rules!=='string'||!rules||data.rulesVersion!==rules||!Array.isArray(data.supportedRulesVersions)||!data.supportedRulesVersions.includes(rules)||data.leaderboard?.board!=='global'||data.leaderboard?.rankingRulesVersion!==rules)throw Error('API未满足统一排行榜、十二关、日志协议2、新版X3及新手关预分配道具能力，停止切换');
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
export function verifyRollbackCompatibility(nextRules,previousRules,{apiOnly=false}={}){
 if(typeof nextRules!=='string'||!nextRules.trim()||typeof previousRules!=='string'||!previousRules.trim())throw Error('缺少规则回退来源，停止发布，不回滚数据库');
 if(previousRules.trim()===nextRules.trim())return;
 // Only this reviewed transition may install a backwards-compatible API bridge first.
 // Frontend/assets remain unchanged; the following full publish rolls back to this dual validator.
 if(apiOnly===true&&previousRules.trim()==='1.2.0-arcade-5l-12lv-v1'&&nextRules.trim()==='1.3.0-arcade-5l-12lv-drops-v2')return;
 throw Error('回退目标不支持相同规则；先使用--api-only准备经审核的兼容后端基线，再发布新版网页；禁止重置或回滚数据库');
}

export function verifyCompatibilityBridgeHealth(data,rules){
 verifyLeaderboardHealth(data,rules);
 if(rules!=='1.3.0-arcade-5l-12lv-drops-v2'||!data.supportedRulesVersions.includes('1.2.0-arcade-5l-12lv-v1'))throw Error('兼容后端未声明支持旧十二关，停止切换');
}
