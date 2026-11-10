import { C } from './GameConfig';
import type {LevelConfig} from './Levels';
const cache=new Map<number,ReturnType<typeof createWall>>();
function createWall(exitHalfWidth:number){const {x,y,radius,wallWidth}=C.arena;const endY=Math.sqrt(radius*radius-exitHalfWidth*exitHalfWidth),gapAngle=Math.asin(exitHalfWidth/radius);return Object.freeze({startAngle:Math.PI/2+gapAngle,endAngle:Math.PI*2+Math.PI/2-gapAngle,endY,leftX:x-exitHalfWidth,rightX:x+exitHalfWidth,endpointY:y+endY,width:wallWidth,halfWidth:wallWidth/2,exitHalfWidth,nominalExitWidth:2*exitHalfWidth,visibleExitWidth:2*exitHalfWidth-wallWidth});}
export function arenaWall(exitHalfWidth:number=C.arena.exitHalfWidth){let wall=cache.get(exitHalfWidth);if(!wall){wall=createWall(exitHalfWidth);cache.set(exitHalfWidth,wall);}return wall;}
export const ARENA_WALL=arenaWall();
/** New exitWidth is the actual visible opening; old centerline geometry stays exactly unchanged. */
export function wallForLevel(level:LevelConfig){return arenaWall(level.exitWidth===undefined?C.arena.exitHalfWidth:(level.exitWidth+C.arena.wallWidth)/2);}
export function inExitSector(dx:number,dy:number,wall=ARENA_WALL){return dy>0&&Math.abs(dx)*wall.endY<dy*wall.exitHalfWidth;}
