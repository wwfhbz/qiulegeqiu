import {expect,it} from 'vitest';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {LevelManager} from '../../src/LevelManager';
import {LEVELS,V13_LEVELS,type LevelConfig} from '../../src/Levels';
import {RULES_VERSION,V13_RULES_VERSION,SUPPORTED_RULES_VERSIONS} from '../../shared/Challenge';
import {verifyTrace} from '../src/verifier';

/** Clear the two tutorial levels, then the first later level, and lose all lives there. */
function run(levels:readonly LevelConfig[]){
 const g=new Game(undefined,undefined,new LevelManager(levels));g.journal.seed=7;g.physics.setSeed(7);
 for(let level=1;level<=3;level++){g.start();for(let i=0;i<g.physics.blocks.alive.length;i++)if(g.physics.blocks.alive[i]){g.physics.onStep?.(C.step);g.physics.blocks.hit(i);}g.update(0);if(g.state==='levelComplete')g.nextLevel();}
 g.start();for(let life=0;life<5&&g.lives>0;life++){for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);if(g.state==='ready')g.start();}
 return g;
}
it('V1.5赛季：第1关210个X3、第3～12关1500→2500砖；服务端按同一配置验证',()=>{
 expect(SUPPORTED_RULES_VERSIONS).toContain(V13_RULES_VERSION);expect(SUPPORTED_RULES_VERSIONS.at(-1)).toBe(RULES_VERSION);
 expect(LEVELS.slice(2).map(l=>l.brickCount)).toEqual([1500,1600,1700,1800,1900,2000,2150,2300,2400,2500]);
 const g=run(LEVELS);expect(g.state).toBe('gameOver');expect(g.levels.current.number).toBe(4);
 const result=verifyTrace(g.journal.events,1e9,7,RULES_VERSION).summary;
 expect(result).toEqual(g.journal.summary(g.score.total,4,false));expect(result.bricksDestroyed).toBe(600+1200+1500);
 // The same journal is not a valid V1.3 run: its level 3 would need the full 4203-brick grid.
 expect(()=>verifyTrace(g.journal.events,1e9,7,V13_RULES_VERSION)).toThrow();
});
it('V1.3赛季冻结：480个X3和整格第3关继续按旧配置验证，不受新赛季影响',()=>{
 const g=run(V13_LEVELS),result=verifyTrace(g.journal.events,1e9,7,V13_RULES_VERSION).summary;
 expect(result.bricksDestroyed).toBe(600+1200+4203);expect(result).toEqual(g.journal.summary(g.score.total,4,false));
 expect(()=>verifyTrace(g.journal.events,1e9,7,RULES_VERSION)).toThrow();
});
