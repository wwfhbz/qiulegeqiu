import {expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {LevelManager} from '../../src/LevelManager';
import {LEGACY_LEVELS} from '../../src/LegacyLevels';
import {PREVIOUS_LEVELS,V13_LEVELS,V15_LEVELS,V16_LEVELS,V17_LEVELS} from '../../src/Levels';
import {GLOBAL_BOARD_COMPAT_VERSION,RULES_VERSION,V13_RULES_VERSION,V15_RULES_VERSION,V16_RULES_VERSION,V17_RULES_VERSION,V18_RULES_VERSION,PREVIOUS_RULES_VERSION,LEGACY_RULES_VERSION,SUPPORTED_RULES_VERSIONS} from '../../shared/Challenge';
import {createApp} from '../src/app';
import {verifyTrace} from '../src/verifier';
function trace(rules:string,hits:number){
 const g=new Game(undefined,undefined,new LevelManager(rules===LEGACY_RULES_VERSION?LEGACY_LEVELS:rules===PREVIOUS_RULES_VERSION?PREVIOUS_LEVELS:rules===V13_RULES_VERSION?V13_LEVELS:rules===V15_RULES_VERSION?V15_LEVELS:rules===V16_RULES_VERSION?V16_LEVELS:rules===V17_RULES_VERSION||rules===V18_RULES_VERSION?V17_LEVELS:undefined));g.journal.seed=42;g.physics.setSeed(42);
 g.powerPointsEnabled=rules===RULES_VERSION||rules===V18_RULES_VERSION;
 if(rules!==RULES_VERSION&&rules!==V13_RULES_VERSION&&rules!==V15_RULES_VERSION&&rules!==V16_RULES_VERSION&&rules!==V17_RULES_VERSION&&rules!==V18_RULES_VERSION){g.physics.brickPowerVersion=1;g.physics.tripleRuleVersion=rules===LEGACY_RULES_VERSION?1:2;g.physics.reset();}
 g.start();let remaining=hits;
 for(let i=0;i<g.physics.blocks.alive.length&&remaining;i++)if(g.physics.blocks.alive[i]){g.physics.onStep?.(C.step);g.physics.blocks.hit(i);remaining--;}
 for(let tick=0;tick<500;tick++)g.physics.onStep?.(C.step);
 for(let life=0;life<5;life++){for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);if(g.state==='ready')g.start();}
 return g;
}
it('独立新版要求真实预分配标记；旧十二关和旧十关日志继续验证但不能冒充新版上榜',()=>{
 // Campaign seasons only; endless has its own replay tests.
 for(const rules of SUPPORTED_RULES_VERSIONS.filter(v=>!v.startsWith('endless-'))){const g=trace(rules,10);expect(verifyTrace(g.journal.events,1000000,42,rules).summary).toEqual(g.journal.summary(g.score.total,1,false));if(rules!==RULES_VERSION&&rules!==V13_RULES_VERSION&&rules!==V15_RULES_VERSION&&rules!==V16_RULES_VERSION&&rules!==V17_RULES_VERSION&&rules!==V18_RULES_VERSION)expect(()=>verifyTrace(g.journal.events,1000000,42,RULES_VERSION)).toThrow('预分配');}
 const fresh=trace(RULES_VERSION,10);expect(()=>verifyTrace(fresh.journal.events,1000000,42,PREVIOUS_RULES_VERSION)).toThrow();
});
it('旧客户端提交、旧版最高分指针和历史行保持完整；规则更新不清空全球榜：十二关各赛季取个人最高，旧十关也参与统一排名',async()=>{
 let now=Date.now();const s=await createApp({dbPath:':memory:',origin:'https://test.local',secure:true,rateLimit:false,now:()=>now});
 try{
 const health=(await s.app.inject({url:'/api/health'})).json();expect(health.supportedRulesVersions).toEqual(SUPPORTED_RULES_VERSIONS);expect(health.challengeProtocolVersion).toBe(2);
 const me=await s.app.inject({url:'/api/me?board=global'}),headers={cookie:'__Secure-qlgq='+me.cookies[0].value,origin:'https://test.local','x-csrf-token':me.json().csrfToken};await s.app.inject({method:'POST',url:'/api/players',headers,payload:{nickname:'保留历史再挑战',regionCode:'ISO:CN'}});
 const submit=async(rules:string,hits:number)=>{const g=trace(rules,hits),summary=g.journal.summary(g.score.total,1,false),r=await s.app.inject({method:'POST',url:'/api/challenges',headers,payload:{rulesVersion:rules,seed:42}});expect(r.statusCode,r.body).toBe(201);expect(r.json().rulesVersion).toBe(rules);now+=summary.durationMs+5000;
 for(let offset=0;offset<g.journal.events.length;offset+=256){const upload=await s.app.inject({method:'POST',url:`/api/challenges/${r.json().id}/events`,headers,payload:{sequence:offset/256,events:g.journal.events.slice(offset,offset+256)}});expect(upload.statusCode,upload.body).toBe(200);}
 const score=await s.app.inject({method:'POST',url:`/api/challenges/${r.json().id}/submit`,headers,payload:{idempotencyKey:randomUUID(),summary}});expect(score.statusCode,score.body).toBe(200);expect(score.json().verificationStatus).toBe('verified');return score.json().id;};
 const ten=await submit(LEGACY_RULES_VERSION,3),twelve=await submit(PREVIOUS_RULES_VERSION,100),oldRows=s.db.prepare('SELECT * FROM scores ORDER BY id').all(),oldPointers=s.db.prepare('SELECT * FROM player_bests').all(),oldSeasonPointers=s.db.prepare('SELECT * FROM season_player_bests').all();
 const before=(await s.app.inject({url:'/api/me?board=global',headers})).json();expect(before.best.id).toBe(twelve);expect(before.historicalBests.map((r:{rules_version:string})=>r.rules_version)).toEqual([PREVIOUS_RULES_VERSION,LEGACY_RULES_VERSION]);expect(before.historicalBests.map((r:{id:string})=>r.id)).toEqual([twelve,ten]);const kept=(await s.app.inject({url:'/api/leaderboard?board=global'})).json().items;expect(kept).toHaveLength(1);expect(kept[0]).toMatchObject({id:twelve,rank:1,rules_version:PREVIOUS_RULES_VERSION});
 const fresh=await submit(RULES_VERSION,1);expect(s.db.prepare('SELECT * FROM scores WHERE id IN (?,?) ORDER BY id').all(ten,twelve)).toEqual(oldRows);expect(s.db.prepare('SELECT * FROM player_bests').all()).toEqual(oldPointers);expect(s.db.prepare('SELECT * FROM season_player_bests WHERE rules_version=?').all(PREVIOUS_RULES_VERSION)).toEqual(oldSeasonPointers);
 const board=(await s.app.inject({url:'/api/leaderboard?board=global'})).json();expect(board.rankingRulesVersion).toBe(GLOBAL_BOARD_COMPAT_VERSION);expect(board.items).toHaveLength(1);expect(board.items[0]).toMatchObject({id:twelve,rank:1});expect(board.items[0].score).toBeGreaterThan(10);
 const after=(await s.app.inject({url:'/api/me?board=global',headers})).json();expect(after.best.id).toBe(twelve);expect(fresh).toBeTruthy();expect(after.historicalBests).toEqual(before.historicalBests);
 const better=await submit(PREVIOUS_RULES_VERSION,101);expect((await s.app.inject({url:'/api/me?board=global',headers})).json().best.id).toBe(better);expect((await s.app.inject({url:'/api/leaderboard?board=global'})).json().items).toHaveLength(1);expect((await s.app.inject({url:'/api/leaderboard?rulesVersion='+PREVIOUS_RULES_VERSION})).json().items[0].score).toBeGreaterThan(10);
 expect((await s.app.inject({url:'/api/leaderboard?board=global&rulesVersion='+PREVIOUS_RULES_VERSION})).statusCode).toBe(200);
 }finally{await s.app.close();}
});
