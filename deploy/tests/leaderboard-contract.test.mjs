import {test} from 'node:test';import assert from 'node:assert/strict';
import {verifyLeaderboardHealth,verifyLeaderboardPage,verifyIdentityPersistence,verifyRollbackCompatibility,verifyCompatibilityBridgeHealth} from '../leaderboard-contract.mjs';
const rules='1.2.0-arcade-5l-12lv-v1';
test('旧后端即使health返回200且rules相同，也必须有统一榜单能力才能发布',()=>{assert.throws(()=>verifyLeaderboardHealth({ok:true,database:'ready',rulesVersion:rules}),/停止切换/);const health={ok:true,challengeProtocolVersion:2,challengeFeatures:['triple-threshold20-v1','tutorial-brick-powers-v1','deterministic-trajectory-v1'],database:'ready',rulesVersion:rules,supportedRulesVersions:[rules],leaderboard:{board:'global',rankingRulesVersion:rules,rankingScope:'all-campaign-versions'}};assert.doesNotThrow(()=>verifyLeaderboardHealth(health,rules));assert.throws(()=>verifyLeaderboardHealth(health,'wrong'),/停止切换/);});
test('统一榜单校验真实页偏移及重复玩家，不能把旧赛季榜当新榜',()=>{const page={board:'global',rankingRulesVersion:rules,rankingScope:'all-campaign-versions',items:[{rank:21,score:3,reached_level:1,player_id:'p'}],nextOffset:null};assert.doesNotThrow(()=>verifyLeaderboardPage(page,rules,20));assert.throws(()=>verifyLeaderboardPage(page,rules,0));assert.throws(()=>verifyLeaderboardPage({...page,board:undefined},rules,20));assert.throws(()=>verifyLeaderboardPage({...page,items:[...page.items,{...page.items[0],rank:22}]},rules,20));});
test('重启持久化比较身份，其他玩家导致排名变化不能错误回滚',()=>{const before={board:'global',csrfToken:'proof',player:{id:'p'},best:{rank:1}},after={...before,best:{rank:2}};assert.doesNotThrow(()=>verifyIdentityPersistence(before,after));assert.throws(()=>verifyIdentityPersistence(before,{...after,player:{id:'other'}}));assert.throws(()=>verifyIdentityPersistence(before,{...after,csrfToken:'changed'}));});

test('回退基线必须支持相同规则，缺少来源或十关旧API拒绝，不回滚数据库',()=>{assert.doesNotThrow(()=>verifyRollbackCompatibility(rules,rules+'\n'));assert.throws(()=>verifyRollbackCompatibility(rules,'0.8.0-arcade-5l-10lv-v1'));assert.throws(()=>verifyRollbackCompatibility(rules,undefined));});
test('规则相同但缺失日志协议2时禁止正式切换，不以健康200代替接口兼容',()=>{const health={ok:true,database:'ready',rulesVersion:rules,supportedRulesVersions:[rules],leaderboard:{board:'global',rankingRulesVersion:rules,rankingScope:'all-campaign-versions'}};assert.throws(()=>verifyLeaderboardHealth(health,rules),/停止切换/);assert.doesNotThrow(()=>verifyLeaderboardHealth({...health,challengeProtocolVersion:2,challengeFeatures:['triple-threshold20-v1','tutorial-brick-powers-v1','deterministic-trajectory-v1']},rules));});
test('协议2但未声明新版X3能力时拒绝切换',()=>{assert.throws(()=>verifyLeaderboardHealth({ok:true,database:'ready',rulesVersion:rules,challengeProtocolVersion:2,supportedRulesVersions:[rules],leaderboard:{board:'global',rankingRulesVersion:rules,rankingScope:'all-campaign-versions'}},rules),/停止切换/);});
test('已有新版X3但不支持预分配道具的后端不得切换新版网页',()=>{assert.throws(()=>verifyLeaderboardHealth({ok:true,database:'ready',rulesVersion:rules,challengeProtocolVersion:2,challengeFeatures:['triple-threshold20-v1'],supportedRulesVersions:[rules],leaderboard:{board:'global',rankingRulesVersion:rules,rankingScope:'all-campaign-versions'}},rules),/停止切换/);});

test('跨版本必须先显式安装兼容API，完整发布仍拒绝未知或不兼容回退基线',()=>{
 const previous='1.2.0-arcade-5l-12lv-v1',current='1.3.0-arcade-5l-12lv-drops-v2';
 assert.throws(()=>verifyRollbackCompatibility(current,previous),/--api-only/);
 assert.doesNotThrow(()=>verifyRollbackCompatibility(current,previous,{apiOnly:true}));
 for(const old of ['0.8.0-arcade-5l-10lv-v1','unknown',undefined])assert.throws(()=>verifyRollbackCompatibility(current,old,{apiOnly:true}));
 const health={ok:true,database:'ready',rulesVersion:current,supportedRulesVersions:[previous,current],challengeProtocolVersion:2,challengeFeatures:['triple-threshold20-v1','tutorial-brick-powers-v1','deterministic-trajectory-v1'],leaderboard:{board:'global',rankingRulesVersion:current,rankingScope:'all-campaign-versions'}};
 assert.doesNotThrow(()=>verifyCompatibilityBridgeHealth(health,current));assert.throws(()=>verifyCompatibilityBridgeHealth({...health,supportedRulesVersions:[current]},current),/上一赛季/);
});
test('V1.3→V1.5同样只能经--api-only双验证桥接，不能跳过V1.3直接从V1.2切换',()=>{
 const previous='1.3.0-arcade-5l-12lv-drops-v2',current='1.5.0-arcade-5l-12lv-short-v3';
 assert.throws(()=>verifyRollbackCompatibility(current,previous),/--api-only/);
 assert.doesNotThrow(()=>verifyRollbackCompatibility(current,previous,{apiOnly:true}));
 assert.throws(()=>verifyRollbackCompatibility(current,'1.2.0-arcade-5l-12lv-v1',{apiOnly:true}));
 const health={ok:true,database:'ready',rulesVersion:current,supportedRulesVersions:['1.2.0-arcade-5l-12lv-v1',previous,current],challengeProtocolVersion:2,challengeFeatures:['triple-threshold20-v1','tutorial-brick-powers-v1','deterministic-trajectory-v1'],leaderboard:{board:'global',rankingRulesVersion:current,rankingScope:'all-campaign-versions'}};
 assert.doesNotThrow(()=>verifyCompatibilityBridgeHealth(health,current));assert.throws(()=>verifyCompatibilityBridgeHealth({...health,supportedRulesVersions:[current]},current),/上一赛季/);
});
test('API桥接不发布HTML或assets，普通发布保留原回滚路径，绝不回滚数据库',async()=>{
 const {readFileSync}=await import('node:fs'),script=readFileSync('deploy/publish.sh','utf8');
 assert.match(script,/if \[\[ "\$api_only" = 0 \]\];then\ninstall -d -m 755 "\$site\/assets"/);
 assert.match(script,/if \[\[ "\$api_only" = 0 \]\];then\ninstall -m 644 "\$source_dir\/dist\/index.html"/);
 assert.match(script,/verifyCompatibilityBridgeHealth/);assert.doesNotMatch(script,/8080|game\.gmgnclaw/);
});

test('V1.5→V1.6及尚未上线V1.5时的V1.3→V1.6均经--api-only双验证桥接；V1.2不能直接跳到V1.6',()=>{
 const previous='1.5.0-arcade-5l-12lv-short-v3',current='1.6.0-arcade-5l-12lv-full-v4';
 assert.throws(()=>verifyRollbackCompatibility(current,previous),/--api-only/);
 assert.doesNotThrow(()=>verifyRollbackCompatibility(current,previous,{apiOnly:true}));
 assert.doesNotThrow(()=>verifyRollbackCompatibility(current,'1.3.0-arcade-5l-12lv-drops-v2',{apiOnly:true}));assert.throws(()=>verifyRollbackCompatibility(current,'1.3.0-arcade-5l-12lv-drops-v2'),/--api-only/);
 assert.throws(()=>verifyRollbackCompatibility(current,'1.2.0-arcade-5l-12lv-v1',{apiOnly:true}));
 const health={ok:true,database:'ready',rulesVersion:current,supportedRulesVersions:['1.2.0-arcade-5l-12lv-v1','1.3.0-arcade-5l-12lv-drops-v2',previous,current],challengeProtocolVersion:2,challengeFeatures:['triple-threshold20-v1','tutorial-brick-powers-v1','deterministic-trajectory-v1'],leaderboard:{board:'global',rankingRulesVersion:current,rankingScope:'all-campaign-versions'}};
 assert.doesNotThrow(()=>verifyCompatibilityBridgeHealth(health,current));assert.throws(()=>verifyCompatibilityBridgeHealth({...health,supportedRulesVersions:['1.3.0-arcade-5l-12lv-drops-v2',current]},current),/上一赛季/);
});

test('V1.7可从线上的V1.6、V1.5或V1.3经--api-only桥接；V1.2不能直接跳到V1.7',()=>{
 const current='1.7.0-arcade-5l-12lv-scarce-v5',all=['1.2.0-arcade-5l-12lv-v1','1.3.0-arcade-5l-12lv-drops-v2','1.5.0-arcade-5l-12lv-short-v3','1.6.0-arcade-5l-12lv-full-v4',current];
 for(const previous of all.slice(1,4)){assert.throws(()=>verifyRollbackCompatibility(current,previous),/--api-only/);assert.doesNotThrow(()=>verifyRollbackCompatibility(current,previous,{apiOnly:true}));}
 assert.throws(()=>verifyRollbackCompatibility(current,all[0],{apiOnly:true}));
 const health={ok:true,database:'ready',rulesVersion:current,supportedRulesVersions:all,challengeProtocolVersion:2,challengeFeatures:['triple-threshold20-v1','tutorial-brick-powers-v1','deterministic-trajectory-v1'],leaderboard:{board:'global',rankingRulesVersion:current,rankingScope:'all-campaign-versions'}};
 assert.doesNotThrow(()=>verifyCompatibilityBridgeHealth(health,current));assert.throws(()=>verifyCompatibilityBridgeHealth({...health,supportedRulesVersions:[current]},current),/上一赛季/);
});

test('V1.8（吃道具+100分）可从线上任一十二关赛季经--api-only桥接；V1.2不能直接跳到V1.8',()=>{
 const current='1.8.0-arcade-5l-12lv-powerpts-v6',all=['1.2.0-arcade-5l-12lv-v1','1.3.0-arcade-5l-12lv-drops-v2','1.5.0-arcade-5l-12lv-short-v3','1.6.0-arcade-5l-12lv-full-v4','1.7.0-arcade-5l-12lv-scarce-v5',current];
 for(const previous of all.slice(1,5)){assert.throws(()=>verifyRollbackCompatibility(current,previous),/--api-only/);assert.doesNotThrow(()=>verifyRollbackCompatibility(current,previous,{apiOnly:true}));}
 assert.throws(()=>verifyRollbackCompatibility(current,all[0],{apiOnly:true}));
 const health={ok:true,database:'ready',rulesVersion:current,supportedRulesVersions:all,challengeProtocolVersion:2,challengeFeatures:['triple-threshold20-v1','tutorial-brick-powers-v1','deterministic-trajectory-v1'],leaderboard:{board:'global',rankingRulesVersion:current,rankingScope:'all-campaign-versions'}};
 assert.doesNotThrow(()=>verifyCompatibilityBridgeHealth(health,current));
});

test('相同计分版本但缺失轨迹能力时停止新版发布，不能仅凭health 200通过',()=>{const health={ok:true,challengeProtocolVersion:2,database:'ready',rulesVersion:rules,supportedRulesVersions:[rules],leaderboard:{board:'global',rankingRulesVersion:rules,rankingScope:'all-campaign-versions'},challengeFeatures:['triple-threshold20-v1','tutorial-brick-powers-v1']};assert.throws(()=>verifyLeaderboardHealth(health,rules),/轨迹防卡死/);assert.doesNotThrow(()=>verifyLeaderboardHealth({...health,challengeFeatures:[...health.challengeFeatures,'deterministic-trajectory-v1']},rules));});
test('同一个规则号不能冒充永久双模式查询；全版本范围不与未来游戏版本绑定',()=>{
 const health={ok:true,database:'ready',rulesVersion:rules,supportedRulesVersions:[rules],challengeProtocolVersion:2,challengeFeatures:['triple-threshold20-v1','tutorial-brick-powers-v1','deterministic-trajectory-v1'],leaderboard:{board:'global',rankingRulesVersion:'legacy-metadata',rankingScope:'all-campaign-versions'}};
 assert.doesNotThrow(()=>verifyLeaderboardHealth(health,rules));assert.throws(()=>verifyLeaderboardHealth({...health,leaderboard:{board:'global',rankingRulesVersion:rules}},rules));
 assert.doesNotThrow(()=>verifyLeaderboardPage({board:'global',rankingScope:'all-campaign-versions',rankingRulesVersion:'legacy',items:[],nextOffset:null},'future-rules'));
});
