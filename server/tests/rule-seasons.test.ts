import {expect,it} from 'vitest';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {LevelManager} from '../../src/LevelManager';
import {LEVELS,V13_LEVELS,V15_LEVELS,V16_LEVELS,LATER_DROP_EVERY,type LevelConfig} from '../../src/Levels';
import {POWER_WEIGHTS,weightedPower,seededRandom} from '../../src/PowerRules';
import {RULES_VERSION,V13_RULES_VERSION,V15_RULES_VERSION,V16_RULES_VERSION,V17_RULES_VERSION,SUPPORTED_RULES_VERSIONS,GLOBAL_BOARD_RULES_VERSIONS,LEGACY_RULES_VERSION,ENDLESS_RULES_VERSION} from '../../shared/Challenge';
import {verifyTrace} from '../src/verifier';

/** Clear the two tutorial levels, then the first later level, and lose all lives on level 4. */
function run(levels:readonly LevelConfig[]){
 const g=new Game(undefined,undefined,new LevelManager(levels));g.journal.seed=7;g.physics.setSeed(7);
 for(let level=1;level<=3;level++){g.start();for(let i=0;i<g.physics.blocks.alive.length;i++)if(g.physics.blocks.alive[i]){g.physics.onStep?.(C.step);g.physics.blocks.hit(i);}g.update(0);if(g.state==='levelComplete')g.nextLevel();}
 g.start();for(let life=0;life<5&&g.lives>0;life++){for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);if(g.state==='ready')g.start();}
 expect(g.state).toBe('gameOver');expect(g.levels.current.number).toBe(4);return g;
}
const seasons=[
 {rules:RULES_VERSION,levels:LEVELS,bricks:600+1200+1320},
 {rules:V16_RULES_VERSION,levels:V16_LEVELS,bricks:600+1200+1320},
 {rules:V15_RULES_VERSION,levels:V15_LEVELS,bricks:600+1200+1500},
 {rules:V13_RULES_VERSION,levels:V13_LEVELS,bricks:600+1200+4203},
];
it('赛季登记：V1.8为当前规则，V1.7/V1.6/V1.5/V1.3冻结后仍受支持',()=>{
 expect(GLOBAL_BOARD_RULES_VERSIONS.at(-1)).toBe(RULES_VERSION);expect(SUPPORTED_RULES_VERSIONS).toContain(ENDLESS_RULES_VERSION);expect(RULES_VERSION).toBe('1.8.0-arcade-5l-12lv-powerpts-v6');expect(V17_RULES_VERSION).toBe('1.7.0-arcade-5l-12lv-scarce-v5');
 for(const {rules} of seasons)expect(SUPPORTED_RULES_VERSIONS).toContain(rules);
});
it.each(seasons)('$rules：服务端按本赛季关卡验证，且日志不能冒充其他赛季',({rules,levels,bricks})=>{
 const g=run(levels),result=verifyTrace(g.journal.events,1e9,7,rules).summary;
 expect(result).toEqual(g.journal.summary(g.score.total,4,false));expect(result.bricksDestroyed).toBe(bricks);
 // Where level 3 differs, a clear can only verify under its own rules. V1.6/V1.7 share levels 1–3 exactly.
 for(const other of seasons)if(other.bricks!==bricks)expect(()=>verifyTrace(g.journal.events,1e9,7,other.rules)).toThrow();
});

it('V1.7道具：随机掉落间隔逐关增加，第4～12关生命与炸弹各占0.3%，冻结赛季保持5%',()=>{
 expect([...LATER_DROP_EVERY]).toEqual([14,18,22,26,30,34,38,42,46,50]);
 for(let i=1;i<LATER_DROP_EVERY.length;i++)expect(LATER_DROP_EVERY[i]).toBeGreaterThan(LATER_DROP_EVERY[i-1]);
 const total=(rows:readonly {weight:number}[])=>rows.reduce((s,r)=>s+r.weight,0),share=(rows:readonly {kind:string;weight:number}[],kind:string)=>rows.find(r=>r.kind===kind)!.weight/total(rows);
 for(const kind of ['life','bomb']){expect(share(POWER_WEIGHTS.scarce,kind)).toBeCloseTo(.003,6);expect(share(POWER_WEIGHTS.later,kind)).toBeCloseTo(.05,6);}
 expect(LEVELS[2].powerProfile).toBe('first');expect(LEVELS.slice(3).every(l=>l.powerProfile==='scarce')).toBe(true);
 expect(V16_LEVELS.slice(3).every(l=>l.powerProfile==='later')).toBe(true);
 // Empirical draw over a fixed stream stays inside the requested 0.1%–0.5% band.
 const random=seededRandom(2026),counts:Record<string,number>={};for(let i=0;i<200000;i++){const k=weightedPower('scarce',random);counts[k]=(counts[k]??0)+1;}
 for(const kind of ['life','bomb']){const rate=(counts[kind]??0)/200000;expect(rate).toBeGreaterThan(.001);expect(rate).toBeLessThan(.005);}
});

it('规则更新不清空全球榜：兼容清单包括旧十关和十二关，排名依模式不依清单',()=>{
 expect([...GLOBAL_BOARD_RULES_VERSIONS]).toEqual(SUPPORTED_RULES_VERSIONS.filter(v=>!v.startsWith('endless-')));
 expect(GLOBAL_BOARD_RULES_VERSIONS).toContain(RULES_VERSION);
});
