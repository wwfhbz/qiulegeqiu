/** Read-only response gates shared by candidate smoke tests and production verification. */
export function verifyLeaderboardHealth(data,rules=data?.rulesVersion){
 if(data?.ok!==true||data.challengeProtocolVersion!==2||!Array.isArray(data.challengeFeatures)||!data.challengeFeatures.includes('triple-threshold20-v1')||!data.challengeFeatures.includes('tutorial-brick-powers-v1')||!data.challengeFeatures.includes('deterministic-trajectory-v1')||data.database!=='ready'||typeof rules!=='string'||!rules||data.rulesVersion!==rules||!Array.isArray(data.supportedRulesVersions)||!data.supportedRulesVersions.includes(rules)||data.leaderboard?.rankingScope!=='all-campaign-versions'||data.leaderboard?.board!=='global')throw Error('API未满足统一排行榜、十二关、日志协议2、新版X3、新手关预分配道具及轨迹防卡死能力，停止切换');
}
export function verifyLeaderboardPage(data,rules,offset=0,limit=20){
 if(data?.board!=='global'||data.rankingScope!=='all-campaign-versions'||!Array.isArray(data.items)||data.items.length>limit||(data.nextOffset!==null&&data.nextOffset!==offset+data.items.length))throw Error('统一排行榜分页协议无效');
 const seen=new Set();for(const [i,row] of data.items.entries()){
  if(row.rank!==offset+i+1||!Number.isSafeInteger(row.score)||row.score<0||!Number.isSafeInteger(row.reached_level)||row.reached_level<1||typeof row.player_id!=='string'||seen.has(row.player_id))throw Error('统一排行榜数据或名次无效');seen.add(row.player_id);
 }
}
export function verifyIdentityPersistence(before,after){
 // Rankings may legitimately change while other players submit; only identity must remain stable.
 if(before?.board!=='global'||after?.board!=='global'||typeof before.csrfToken!=='string'||!before.csrfToken||before.csrfToken!==after.csrfToken||(before.player?.id??null)!==(after.player?.id??null))throw Error('重启后玩家身份未保持');
}
/** Reviewed rule transitions: [previous, next]. Each needs an --api-only dual-validator bridge first. */
export const REVIEWED_TRANSITIONS=[
 ['1.2.0-arcade-5l-12lv-v1','1.3.0-arcade-5l-12lv-drops-v2'],
 ['1.3.0-arcade-5l-12lv-drops-v2','1.5.0-arcade-5l-12lv-short-v3'],
 ['1.5.0-arcade-5l-12lv-short-v3','1.6.0-arcade-5l-12lv-full-v4'],
 // V1.6 may be the first release after 1.3 if 1.5 never reached production; its API verifies 1.3, 1.5 and 1.6.
 ['1.3.0-arcade-5l-12lv-drops-v2','1.6.0-arcade-5l-12lv-full-v4'],
 // V1.7 may follow whichever of 1.6/1.5/1.3 is live; its API verifies all of them.
 ['1.6.0-arcade-5l-12lv-full-v4','1.7.0-arcade-5l-12lv-scarce-v5'],
 ['1.5.0-arcade-5l-12lv-short-v3','1.7.0-arcade-5l-12lv-scarce-v5'],
 ['1.3.0-arcade-5l-12lv-drops-v2','1.7.0-arcade-5l-12lv-scarce-v5'],
 // V1.8 (+100 per power) may follow whichever earlier twelve-level season is live; its API verifies them all.
 ['1.7.0-arcade-5l-12lv-scarce-v5','1.8.0-arcade-5l-12lv-powerpts-v6'],
 ['1.6.0-arcade-5l-12lv-full-v4','1.8.0-arcade-5l-12lv-powerpts-v6'],
 ['1.5.0-arcade-5l-12lv-short-v3','1.8.0-arcade-5l-12lv-powerpts-v6'],
 ['1.3.0-arcade-5l-12lv-drops-v2','1.8.0-arcade-5l-12lv-powerpts-v6'],
 // V1.9 (full bowl, campaign skills) may follow any earlier twelve-level season; its API verifies them all.
 ['1.8.0-arcade-5l-12lv-powerpts-v6','1.9.0-arcade-5l-12lv-fullskills-v7'],
 ['1.7.0-arcade-5l-12lv-scarce-v5','1.9.0-arcade-5l-12lv-fullskills-v7'],
 ['1.6.0-arcade-5l-12lv-full-v4','1.9.0-arcade-5l-12lv-fullskills-v7'],
 ['1.5.0-arcade-5l-12lv-short-v3','1.9.0-arcade-5l-12lv-fullskills-v7'],
 ['1.3.0-arcade-5l-12lv-drops-v2','1.9.0-arcade-5l-12lv-fullskills-v7'],
 // V1.10 (3 lives) may follow any earlier twelve-level season; its API verifies them all.
 ['1.9.0-arcade-5l-12lv-fullskills-v7','1.10.0-arcade-3l-12lv-fullskills-v8'],
 ['1.8.0-arcade-5l-12lv-powerpts-v6','1.10.0-arcade-3l-12lv-fullskills-v8'],
 ['1.7.0-arcade-5l-12lv-scarce-v5','1.10.0-arcade-3l-12lv-fullskills-v8'],
 ['1.6.0-arcade-5l-12lv-full-v4','1.10.0-arcade-3l-12lv-fullskills-v8'],
 ['1.5.0-arcade-5l-12lv-short-v3','1.10.0-arcade-3l-12lv-fullskills-v8'],
 ['1.3.0-arcade-5l-12lv-drops-v2','1.10.0-arcade-3l-12lv-fullskills-v8'],
 // V1.11 (picture levels, hard/steel/bomb bricks, bosses) may follow any earlier twelve-level season; its API verifies them all.
 ['1.10.0-arcade-3l-12lv-fullskills-v8','1.11.0-arcade-3l-12lv-patterns-v9'],
 ['1.9.0-arcade-5l-12lv-fullskills-v7','1.11.0-arcade-3l-12lv-patterns-v9'],
 ['1.8.0-arcade-5l-12lv-powerpts-v6','1.11.0-arcade-3l-12lv-patterns-v9'],
 ['1.7.0-arcade-5l-12lv-scarce-v5','1.11.0-arcade-3l-12lv-patterns-v9'],
 ['1.6.0-arcade-5l-12lv-full-v4','1.11.0-arcade-3l-12lv-patterns-v9'],
 ['1.5.0-arcade-5l-12lv-short-v3','1.11.0-arcade-3l-12lv-patterns-v9'],
 ['1.3.0-arcade-5l-12lv-drops-v2','1.11.0-arcade-3l-12lv-patterns-v9'],
];
/** Seasons too old to bridge: 0.8 (ten levels) and 1.2 (pre-quota twelve levels) never move straight to a newer season. */
const BRIDGE_BLOCKED=['0.8.0-arcade-5l-10lv-v1','1.2.0-arcade-5l-12lv-v1'];
const seasonNumber=rules=>{const m=/^(\d+)\.(\d+)\.(\d+)-arcade-/.exec(rules);return m?[+m[1],+m[2],+m[3]]:undefined;};
/**
 * A campaign rules upgrade that may go through the --api-only bridge: every reviewed pair above, and from now on any
 * forward move between twelve-level campaign seasons. The bridge then proves on the live API that the new server
 * still verifies the season being replaced (all seasons share one permanent leaderboard), or the switch stops.
 */
export function isBridgeableTransition(previousRules,nextRules){
 const from=String(previousRules??'').trim(),to=String(nextRules??'').trim();
 if(REVIEWED_TRANSITIONS.some(([a,b])=>a===from&&b===to))return true;
 const a=seasonNumber(from),b=seasonNumber(to);
 if(!a||!b||BRIDGE_BLOCKED.includes(from))return false;
 for(let i=0;i<3;i++)if(a[i]!==b[i])return b[i]>a[i];
 return false;
}
export function verifyRollbackCompatibility(nextRules,previousRules,{apiOnly=false}={}){
 if(typeof nextRules!=='string'||!nextRules.trim()||typeof previousRules!=='string'||!previousRules.trim())throw Error('缺少规则回退来源，停止发布，不回滚数据库');
 if(previousRules.trim()===nextRules.trim())return;
 // Only this reviewed transition may install a backwards-compatible API bridge first.
 // Frontend/assets remain unchanged; the following full publish rolls back to this dual validator.
 if(apiOnly===true&&isBridgeableTransition(previousRules,nextRules))return;
 throw Error('回退目标不支持相同规则；先使用--api-only准备经审核的兼容后端基线，再发布新版网页；禁止重置或回滚数据库');
}

/** The bridge API must answer health for the new rules and still verify the season it replaces (`previousRules`). */
export function verifyCompatibilityBridgeHealth(data,rules,previousRules){
 verifyLeaderboardHealth(data,rules);
 const from=typeof previousRules==='string'&&previousRules.trim()?previousRules.trim():REVIEWED_TRANSITIONS.find(([,to])=>to===rules)?.[0];
 if(!from||!data.supportedRulesVersions.includes(from))throw Error('兼容后端未声明支持上一赛季规则，停止切换');
}
