import {LEGACY_LEVELS} from '../../src/LegacyLevels.js';
import {RULES_VERSION,LEGACY_RULES_VERSION} from '../../shared/Challenge.js';
import { Blocks } from '../../src/Blocks.js';
import { ScoreSystem } from '../../src/ScoreSystem.js';
import { ARCADE } from '../../src/ArcadeRules.js';
import { C } from '../../src/GameConfig.js';
import {LEVELS,dropMultiplier,powerProfile}  from '../../src/Levels.js';
import { seededRandom,weightedPower,type PowerKind } from '../../src/PowerRules.js';
import { Obstacles } from '../../src/Obstacles.js';
import type { ChallengeEvent, ChallengeSummary } from '../../shared/Challenge.js';
import { ApiError } from './moderation.js';
/** Event/rule replay, not authoritative physical replay. Client seed is a declared run parameter, not a secret. */
export function verifyTrace(events: ChallengeEvent[], wallMs: number,seed=1,rulesVersion:string=LEGACY_RULES_VERSION): { summary: ChallengeSummary; suspicious: string[] } {
  const levels=rulesVersion===RULES_VERSION?LEVELS:rulesVersion===LEGACY_RULES_VERSION?LEGACY_LEVELS:undefined;if(!levels)throw new ApiError(422,'不支持的规则版本');
  const blocks=new Blocks(),score=new ScoreSystem(blocks.alive.length),obstacles=new Obstacles(),random=seededRandom(seed);
  blocks.reset(levels[0].obstacles??[],levels[0]);obstacles.load(levels[0].obstacles??[]);
  let valid=blocks.alive.slice(),level=1,lives:number=ARCADE.initialLives,phase='ready',balls=0,lastTick=0,bricks=0,finished=false,levelStartTick=0;
  let destroyedThisLevel=0;const suspicious=new Set<string>(),drops:{kind:PowerKind;tick:number;y:number}[]=[];
  let peakBalls=1,budgetTick=-1,tickBallMax=0;
  let tickHits=0,hitTick=-1,expectedBomb:string|null|undefined;
  for(const e of events){
    if(finished||!Number.isSafeInteger(e.tick)||e.tick<lastTick||e.tick>6*3600/C.step||e.level!==level)throw new ApiError(422,'挑战事件顺序或关卡无效');
    if(expectedBomb!==undefined&&e.type!=='bomb')throw new ApiError(422,'缺少炸弹目标事件');
    if(e.tick!==budgetTick){budgetTick=e.tick;tickBallMax=balls;}tickBallMax=Math.max(tickBallMax,balls);
    score.update((e.tick-lastTick)*C.step);lastTick=e.tick;obstacles.time=(e.tick-levelStartTick)*C.step;
    for(let i=drops.length-1;i>=0;i--)if((e.tick-drops[i].tick)*C.step*C.power.fallSpeed>C.height+C.power.radius-drops[i].y+.02)drops.splice(i,1);
    switch(e.type){
      case 'launch':if(phase!=='ready')throw new ApiError(422,'重复发射或无效回合');phase='running';balls=1;break;
      case 'hit':{
        if(phase!=='running'||!balls||!valid[e.index])throw new ApiError(422,'重复或不可能的方块事件');valid[e.index]=0;score.hit(e.index);bricks++;destroyedThisLevel++;
        if(hitTick!==e.tick){hitTick=e.tick;tickHits=0;}if(++tickHits>Math.max(tickBallMax,balls)*12)suspicious.add('单步击碎数量异常');
        const interval=Math.round(C.power.dropEvery/dropMultiplier(levels[level-1]));
        if(destroyedThisLevel%interval===0){const kind=weightedPower(powerProfile(levels[level-1]),random);if(drops.length<C.power.maxDrops)drops.push({kind,tick:e.tick,y:blocks.top+Math.floor(e.index/blocks.cols)*blocks.step+blocks.size/2});}break;
      }
      case 'power':{
        if(phase!=='running'||balls<=0)throw new ApiError(422,'道具拾取状态无效');
        const index=drops.findIndex(d=>d.kind===e.kind&&(e.tick-d.tick)*C.step*C.power.fallSpeed>=C.paddle.y-C.paddle.height/2-C.power.radius-d.y-C.power.fallSpeed*C.step-.02&&(e.tick-d.tick)*C.step*C.power.fallSpeed<=C.height+C.power.radius-d.y+.02);
        if(index<0)throw new ApiError(422,'无对应可拾取道具');drops.splice(index,1);
        if(e.kind==='triple')balls=Math.min(C.maxBalls,balls*3);
        if(e.kind==='halve'&&balls>0)balls=Math.max(1,Math.ceil(balls/2));
        if(e.kind==='life')lives=Math.min(ARCADE.maxLives,lives+1);
        if(e.kind==='bomb')expectedBomb=obstacles.destroyNearest(C.arena.x,C.arena.y)?.config.id??null;
        break;
      }
      case 'bomb':if(expectedBomb===undefined||e.target!==expectedBomb)throw new ApiError(422,'炸弹目标无效');if(expectedBomb===null)score.addBombCompensation();expectedBomb=undefined;break;
      case 'ballLost':if(phase!=='running'||balls<=0)throw new ApiError(422,'重复弹球死亡');balls--;break;
      case 'lost':if(phase!=='running'||balls!==0||destroyedThisLevel===blocks.total)throw new ApiError(422,'回合扣命无效');lives--;if(lives<0)throw new ApiError(422,'生命异常');phase=lives?'ready':'gameOver';drops.length=0;score.resetCombo();break;
      case 'clear':if(phase!=='running'||destroyedThisLevel!==blocks.total)throw new ApiError(422,'未完成本关');score.complete(lives);phase=level===levels.length?'victory':'cleared';break;
      case 'next':if(phase!=='cleared')throw new ApiError(422,'无效切关');level++;phase='ready';blocks.reset(levels[level-1].obstacles??[],levels[level-1]);valid=blocks.alive.slice();destroyedThisLevel=0;drops.length=0;score.beginLevel();obstacles.load(levels[level-1].obstacles??[]);levelStartTick=e.tick;break;
      case 'finish':if(phase!=='gameOver'&&phase!=='victory')throw new ApiError(422,'挑战尚未结束');finished=true;break;
    }
    peakBalls=Math.max(peakBalls,balls);tickBallMax=Math.max(tickBallMax,balls);
  }
  if(!finished||expectedBomb!==undefined)throw new ApiError(422,'缺少结束事件');
  const durationMs=Math.round(lastTick*C.step*1000);if(durationMs>wallMs+2000)throw new ApiError(422,'模拟时间超过服务端挑战时间');
  if(durationMs<3000)suspicious.add('挑战用时过短');if(bricks>Math.max(10,durationMs/1000*(120+peakBalls*60)))suspicious.add('消除速度异常，需回放复核');
  return {summary:{score:score.total,reachedLevel:level,bricksDestroyed:bricks,durationMs,completedAllLevels:phase==='victory'},suspicious:[...suspicious]};
}
