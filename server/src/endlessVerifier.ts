import {EndlessField} from '../../src/endless/EndlessField.js';
import {ENDLESS,ENDLESS_CURRENT,dropEvery,endlessPower,endlessStage,type EndlessVariant} from '../../src/endless/EndlessRules.js';
import {ScoreSystem} from '../../src/ScoreSystem.js';
import {C} from '../../src/GameConfig.js';
import {seededRandom,type PowerKind} from '../../src/PowerRules.js';
import type {ChallengeEvent,ChallengeSummary} from '../../shared/Challenge.js';
import {ApiError} from './moderation.js';

/**
 * Endless-mode replay. The descending wall is rebuilt with the client's own EndlessField from the
 * declared seed and advanced tick by tick, so every hit must name a brick that really existed at that
 * moment, drops follow the same seeded schedule, and the score is recomputed. Like the campaign
 * verifier this is a rule replay, not a physical trajectory replay.
 */
export function verifyEndlessTrace(events:ChallengeEvent[],wallMs:number,seed:number,variant:EndlessVariant=ENDLESS_CURRENT):{summary:ChallengeSummary;suspicious:string[]}{
  const field=new EndlessField();field.start(seed,variant);
  const score=new ScoreSystem('unbounded'),drops:{id:number;kind:PowerKind;tick:number;y:number}[]=[],suspicious=new Set<string>();
  const dropRandom=seededRandom((seed>>>0^0x5bd1e995)>>>0);let nextDropAt=dropEvery(0,variant),dropSequence=0;
  let lives:number=ENDLESS.lives,phase:'ready'|'running'|'gameOver'='ready',balls=0,peakBalls=1,lastTick=0,fieldTick=0,bricks=0,finished=false;
  let fireUntil=-1,lightningTick=-1,lightnings=0,hitTick=-1,tickHits=0,tickBallMax=0;
  for(const e of events){
    if(finished||!Number.isSafeInteger(e.tick)||e.tick<lastTick||e.tick>6*3600/C.step||e.level!==1)throw new ApiError(422,'挑战事件顺序或关卡无效');
    // The wall moves at the start of each simulated tick, before any contact in that tick.
    while(fieldTick<e.tick){fieldTick++;field.tick();}
    score.update((e.tick-lastTick)*C.step);lastTick=e.tick;
    for(let i=drops.length-1;i>=0;i--)if((e.tick-drops[i].tick)*C.step*C.power.fallSpeed>C.height+C.power.radius-drops[i].y+.02)drops.splice(i,1);
    if(e.tick!==hitTick){hitTick=e.tick;tickHits=0;tickBallMax=balls;}tickBallMax=Math.max(tickBallMax,balls);
    switch(e.type){
      case 'launch':if(phase!=='ready')throw new ApiError(422,'重复发射或无效回合');if(e.tripleRuleVersion!==undefined||e.brickPowerVersion!==undefined)throw new ApiError(422,'无尽模式不使用闯关规则标记');phase='running';balls=1;break;
      case 'hit':{
        if(phase!=='running'||!balls)throw new ApiError(422,'重复或不可能的方块事件');
        const index=field.indexOfWorld(e.index);if(index<0)throw new ApiError(422,'方块不存在或已被击碎');
        const y=field.top+Math.floor(index/field.cols)*field.step+field.size/2;field.hit(index);score.hit(e.index);bricks++;
        // Fire burns 8 neighbours per contact, lightning breaks a fixed batch: widen the per-tick budget accordingly.
        const allowance=Math.max(tickBallMax,balls)*12*(e.tick<=fireUntil?9:1)+(e.tick===lightningTick?lightnings*ENDLESS.lightningBricks:0);
        if(++tickHits>allowance)suspicious.add('单步击碎数量异常');
        if(field.destroyedTotal>=nextDropAt){nextDropAt+=dropEvery(field.destroyedTotal,variant);const kind=endlessPower(dropRandom),id=++dropSequence;if(drops.length<C.power.maxDrops)drops.push({id,kind,tick:e.tick,y});}
        break;
      }
      case 'power':{
        if(phase!=='running'||balls<=0)throw new ApiError(422,'道具拾取状态无效');
        const index=drops.findIndex(d=>d.kind===e.kind&&(e.dropId===undefined||d.id===e.dropId)&&(e.tick-d.tick)*C.step*C.power.fallSpeed>=C.paddle.y-C.paddle.height/2-C.power.radius-d.y-C.power.fallSpeed*C.step-.02&&(e.tick-d.tick)*C.step*C.power.fallSpeed<=C.paddle.y+C.paddle.height/2+C.power.radius-d.y+.02);
        if(index<0)throw new ApiError(422,'无对应可拾取道具');drops.splice(index,1);
        if(e.kind==='plus3')balls=Math.min(C.maxBalls,balls+ENDLESS.plusBalls);
        else if(e.kind==='halve')balls=Math.max(1,Math.ceil(balls/2));
        else if(e.kind==='life')lives=Math.min(ENDLESS.lives,lives+1);
        else if(e.kind==='fire')fireUntil=e.tick+Math.ceil(ENDLESS.fireSeconds/C.step);
        else if(e.kind==='lightning'){if(lightningTick!==e.tick){lightningTick=e.tick;lightnings=0;}lightnings++;}
        break;
      }
      case 'ballLost':if(phase!=='running'||balls<=0)throw new ApiError(422,'重复弹球死亡');balls--;break;
      case 'lost':if(phase!=='running'||balls!==0)throw new ApiError(422,'回合扣命无效');lives--;phase=lives>0?'ready':'gameOver';drops.length=0;dropSequence=0;score.resetCombo();break;
      case 'finish':if(phase!=='gameOver')throw new ApiError(422,'挑战尚未结束');finished=true;break;
      default:throw new ApiError(422,'无尽模式不支持该事件');
    }
    peakBalls=Math.max(peakBalls,balls);
  }
  if(!finished)throw new ApiError(422,'缺少结束事件');
  const durationMs=Math.round(lastTick*C.step*1000);if(durationMs>wallMs+2000)throw new ApiError(422,'模拟时间超过服务端挑战时间');
  if(durationMs<3000)suspicious.add('挑战用时过短');
  if(bricks>Math.max(10,durationMs/1000*(120+peakBalls*60)*3))suspicious.add('消除速度异常，需回放复核');
  return {summary:{score:score.total,reachedLevel:endlessStage(field.descents),bricksDestroyed:bricks,durationMs,completedAllLevels:false},suspicious:[...suspicious]};
}
