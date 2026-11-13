import {expect,it} from 'vitest';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {LevelManager} from '../../src/LevelManager';
import {LEVELS,V13_LEVELS,V15_LEVELS,type LevelConfig} from '../../src/Levels';
import {RULES_VERSION,V13_RULES_VERSION,V15_RULES_VERSION,SUPPORTED_RULES_VERSIONS} from '../../shared/Challenge';
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
 {rules:V15_RULES_VERSION,levels:V15_LEVELS,bricks:600+1200+1500},
 {rules:V13_RULES_VERSION,levels:V13_LEVELS,bricks:600+1200+4203},
];
it('赛季登记：V1.6为当前规则，V1.5/V1.3冻结后仍受支持',()=>{
 expect(SUPPORTED_RULES_VERSIONS.at(-1)).toBe(RULES_VERSION);expect(RULES_VERSION).toBe('1.6.0-arcade-5l-12lv-full-v4');
 for(const {rules} of seasons)expect(SUPPORTED_RULES_VERSIONS).toContain(rules);
});
it.each(seasons)('$rules：服务端按本赛季关卡验证，且日志不能冒充其他赛季',({rules,levels,bricks})=>{
 const g=run(levels),result=verifyTrace(g.journal.events,1e9,7,rules).summary;
 expect(result).toEqual(g.journal.summary(g.score.total,4,false));expect(result.bricksDestroyed).toBe(bricks);
 // Level 3 brick counts differ between every season, so a clear can only verify under its own rules.
 for(const other of seasons)if(other.rules!==rules)expect(()=>verifyTrace(g.journal.events,1e9,7,other.rules)).toThrow();
});
