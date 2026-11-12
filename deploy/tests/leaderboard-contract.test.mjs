import {test} from 'node:test';import assert from 'node:assert/strict';
import {verifyLeaderboardHealth,verifyLeaderboardPage,verifyIdentityPersistence,verifyRollbackCompatibility,verifyCompatibilityBridgeHealth} from '../leaderboard-contract.mjs';
const rules='1.2.0-arcade-5l-12lv-v1';
test('旧后端即使health返回200且rules相同，也必须有统一榜单能力才能发布',()=>{assert.throws(()=>verifyLeaderboardHealth({ok:true,database:'ready',rulesVersion:rules}),/停止切换/);const health={ok:true,challengeProtocolVersion:2,challengeFeatures:['triple-threshold20-v1','tutorial-brick-powers-v1'],database:'ready',rulesVersion:rules,supportedRulesVersions:[rules],leaderboard:{board:'global',rankingRulesVersion:rules}};assert.doesNotThrow(()=>verifyLeaderboardHealth(health,rules));assert.throws(()=>verifyLeaderboardHealth(health,'wrong'),/停止切换/);});
test('统一榜单校验真实页偏移及重复玩家，不能把旧赛季榜当新榜',()=>{const page={board:'global',rankingRulesVersion:rules,items:[{rank:21,score:3,reached_level:1,player_id:'p'}],nextOffset:null};assert.doesNotThrow(()=>verifyLeaderboardPage(page,rules,20));assert.throws(()=>verifyLeaderboardPage(page,rules,0));assert.throws(()=>verifyLeaderboardPage({...page,board:undefined},rules,20));assert.throws(()=>verifyLeaderboardPage({...page,items:[...page.items,{...page.items[0],rank:22}]},rules,20));});
test('重启持久化比较身份，其他玩家导致排名变化不能错误回滚',()=>{const before={board:'global',csrfToken:'proof',player:{id:'p'},best:{rank:1}},after={...before,best:{rank:2}};assert.doesNotThrow(()=>verifyIdentityPersistence(before,after));assert.throws(()=>verifyIdentityPersistence(before,{...after,player:{id:'other'}}));assert.throws(()=>verifyIdentityPersistence(before,{...after,csrfToken:'changed'}));});

test('回退基线必须支持相同规则，缺少来源或十关旧API拒绝，不回滚数据库',()=>{assert.doesNotThrow(()=>verifyRollbackCompatibility(rules,rules+'\n'));assert.throws(()=>verifyRollbackCompatibility(rules,'0.8.0-arcade-5l-10lv-v1'));assert.throws(()=>verifyRollbackCompatibility(rules,undefined));});
test('规则相同但缺失日志协议2时禁止正式切换，不以健康200代替接口兼容',()=>{const health={ok:true,database:'ready',rulesVersion:rules,supportedRulesVersions:[rules],leaderboard:{board:'global',rankingRulesVersion:rules}};assert.throws(()=>verifyLeaderboardHealth(health,rules),/停止切换/);assert.doesNotThrow(()=>verifyLeaderboardHealth({...health,challengeProtocolVersion:2,challengeFeatures:['triple-threshold20-v1','tutorial-brick-powers-v1']},rules));});
test('协议2但未声明新版X3能力时拒绝切换',()=>{assert.throws(()=>verifyLeaderboardHealth({ok:true,database:'ready',rulesVersion:rules,challengeProtocolVersion:2,supportedRulesVersions:[rules],leaderboard:{board:'global',rankingRulesVersion:rules}},rules),/停止切换/);});
test('已有新版X3但不支持预分配道具的后端不得切换新版网页',()=>{assert.throws(()=>verifyLeaderboardHealth({ok:true,database:'ready',rulesVersion:rules,challengeProtocolVersion:2,challengeFeatures:['triple-threshold20-v1'],supportedRulesVersions:[rules],leaderboard:{board:'global',rankingRulesVersion:rules}},rules),/停止切换/);});

test('跨版本必须先显式安装兼容API，完整发布仍拒绝未知或不兼容回退基线',()=>{
 const previous='1.2.0-arcade-5l-12lv-v1',current='1.3.0-arcade-5l-12lv-drops-v2';
 assert.throws(()=>verifyRollbackCompatibility(current,previous),/--api-only/);
 assert.doesNotThrow(()=>verifyRollbackCompatibility(current,previous,{apiOnly:true}));
 for(const old of ['0.8.0-arcade-5l-10lv-v1','unknown',undefined])assert.throws(()=>verifyRollbackCompatibility(current,old,{apiOnly:true}));
 const health={ok:true,database:'ready',rulesVersion:current,supportedRulesVersions:[previous,current],challengeProtocolVersion:2,challengeFeatures:['triple-threshold20-v1','tutorial-brick-powers-v1'],leaderboard:{board:'global',rankingRulesVersion:current}};
 assert.doesNotThrow(()=>verifyCompatibilityBridgeHealth(health,current));assert.throws(()=>verifyCompatibilityBridgeHealth({...health,supportedRulesVersions:[current]},current),/旧十二关/);
});
test('API桥接不发布HTML或assets，普通发布保留原回滚路径，绝不回滚数据库',async()=>{
 const {readFileSync}=await import('node:fs'),script=readFileSync('deploy/publish.sh','utf8');
 assert.match(script,/if \[\[ "\$api_only" = 0 \]\];then\ninstall -d -m 755 "\$site\/assets"/);
 assert.match(script,/if \[\[ "\$api_only" = 0 \]\];then\ninstall -m 644 "\$source_dir\/dist\/index.html"/);
 assert.match(script,/verifyCompatibilityBridgeHealth/);assert.doesNotMatch(script,/8080|game\.gmgnclaw/);
});
