import {Physics} from '../../src/Physics';
import {LEVELS,type LevelConfig} from '../../src/Levels';
import {LEGACY_LEVELS} from '../../src/LegacyLevels';
import {C} from '../../src/GameConfig';
/** Deterministic reachability probe, not human-player mortality telemetry. */
export function tutorialTolerance(){
 return [LEGACY_LEVELS[0],LEVELS[0],LEVELS[1]].map((level:LevelConfig)=>{
  const run=(delay:number|undefined)=>{let caught=0,dead=0;for(const position of [-1,-.75,-.5,-.25,0,.25,.5,.75,1])for(const angle of [-.6,-.3,0,.3,.6]){
   const p=new Physics();p.level=level;p.speedScale=level.speedScale;p.reset();const b=p.balls[0],half=p.wall.visibleExitWidth/2-b.radius-1;Object.assign(b,{x:C.arena.x+position*half,y:C.arena.y+C.arena.radius+8,vx:Math.sin(angle)*p.launchSpeed,vy:Math.cos(angle)*p.launchSpeed,outsideArena:true});let hit=false;p.onSound=kind=>{if(kind==='paddle')hit=true;};
   for(let n=0;n<180&&p.balls.length&&!hit;n++){if(delay!==undefined&&n*C.step>=delay&&b.vy>0)p.setTarget(b.x+b.vx*Math.max(0,C.paddle.y-b.y)/b.vy);p.advance(C.step);}if(hit)caught++;if(!p.balls.length)dead++;
  }return {samples:45,caught,dead};};
  return {name:level.name,speed:level.speedScale,paddleScale:level.paddleScale??1,exit:level.exitWidth??104.6,stationary:run(undefined),trackingAfter350ms:run(.35)};
 });
}
