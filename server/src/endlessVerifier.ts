import {validateTrajectoryMarkers} from '../../shared/Challenge.js';
import {EndlessField} from '../../src/endless/EndlessField.js';
import {ENDLESS,ENDLESS_CURRENT,endlessSettings,dropEvery,endlessPower,endlessBonus,endlessStage,DROP_SALT,BONUS_SALT,type EndlessVariant} from '../../src/endless/EndlessRules.js';
import {ScoreSystem} from '../../src/ScoreSystem.js';
import {C} from '../../src/GameConfig.js';
import {seededRandom,type PowerKind} from '../../src/PowerRules.js';
import {MAX_REVIVES,MAX_BOOSTS,BOOST_BALLS,type ChallengeEvent,type ChallengeSummary} from '../../shared/Challenge.js';
import {ApiError} from './moderation.js';
import {Cell} from '../../src/campaign/Patterns.js';
import {Physics} from '../../src/Physics.js';

/**
 * Endless-mode replay. The descending wall is rebuilt with the client's own EndlessField from the
 * declared seed and advanced tick by tick, so every hit must name a brick that really existed at that
 * moment, drops follow the same seeded schedule, and the score is recomputed. Like the campaign
 * verifier this is a rule replay, not a physical trajectory replay.
 */
export function verifyEndlessTrace(events:ChallengeEvent[],wallMs:number,seed:number,variant:EndlessVariant=ENDLESS_CURRENT):{summary:ChallengeSummary;suspicious:string[]}{
  try{validateTrajectoryMarkers(events);}catch{throw new ApiError(422,'轨迹版本标记无效');}
  const field=new EndlessField();field.start(seed,variant);const skills=endlessSettings(variant);
  const score=new ScoreSystem('unbounded'),drops:{id:number;kind:PowerKind;tick:number;y:number}[]=[],suspicious=new Set<string>();
  const dropRandom=seededRandom((seed>>>0^DROP_SALT)>>>0),bonusRandom=seededRandom((seed>>>0^BONUS_SALT)>>>0);let pendingRelief=false,expectBonus=false,reliefRows:number=ENDLESS.reliefRows;let nextDropAt=dropEvery(0,variant),dropSequence=0;
  // 1.8 drop spacing: drops earned inside the window wait and fall from the next broken brick.
  const spacing=variant.dropSpacing,pending:PowerKind[]=[];let lastDrop=-Infinity,blastTick=-1,blasts=0;
  const spawnDrop=(kind:PowerKind,tick:number,y:number)=>{const id=++dropSequence;if(drops.length<C.power.maxDrops)drops.push({id,kind,tick,y});};
  let lives:number=ENDLESS.lives,phase:'ready'|'running'|'gameOver'='ready',balls=0,peakBalls=1,lastTick=0,fieldTick=0,bricks=0,finished=false;
  let fireUntil=-1,lightningTick=-1,lightnings=0,hitTick=-1,tickHits=0,tickBallMax=0;
  // Rewarded help: revives only on game over, boosts only on the launch right after a lost life.
  let revives=0,boosts=0,launchTick=-1,boosted=false,afterLoss=false,lostRound=false;
  for(const e of events){
    if(finished||!Number.isSafeInteger(e.tick)||e.tick<lastTick||e.tick>6*3600/C.step||e.level!==1)throw new ApiError(422,'挑战事件顺序或关卡无效');
    // The wall moves at the start of each simulated tick, before any contact in that tick.
    while(fieldTick<e.tick){fieldTick++;field.tick();
      // Pressure death is mandatory: a run may not keep playing with the wall on the line past the limit (one frame of slack).
      if(variant.crush&&phase==='running'&&field.pressure>ENDLESS.crushTicks+12)throw new ApiError(422,'砖墙压线超时未扣命');}
    if(expectBonus&&e.type!=='bonus')throw new ApiError(422,'缺少压线补偿奖励');
    score.update((e.tick-lastTick)*C.step);lastTick=e.tick;
    for(let i=drops.length-1;i>=0;i--)if((e.tick-drops[i].tick)*C.step*C.power.fallSpeed>C.height+C.power.radius-drops[i].y+.02)drops.splice(i,1);
    if(e.tick!==hitTick){hitTick=e.tick;tickHits=0;tickBallMax=balls;}tickBallMax=Math.max(tickBallMax,balls);
    switch(e.type){
      case 'launch':if(phase!=='ready')throw new ApiError(422,'重复发射或无效回合');if(e.tripleRuleVersion!==undefined||e.brickPowerVersion!==undefined)throw new ApiError(422,'无尽模式不使用闯关规则标记');phase='running';balls=1;launchTick=e.tick;boosted=false;afterLoss=lostRound;lostRound=false;
        if(pendingRelief){pendingRelief=false;field.relief(reliefRows);reliefRows=ENDLESS.reliefRows;expectBonus=true;}break;
      case 'crushed':
        if(!variant.crush||phase!=='running'||field.pressure<ENDLESS.crushTicks)throw new ApiError(422,'压线扣命无效');
        lives--;phase=lives>0?'ready':'gameOver';balls=0;drops.length=0;dropSequence=0;pending.length=0;lastDrop=-Infinity;score.resetCombo();pendingRelief=lives>0;reliefRows=ENDLESS.reliefRows;fireUntil=-1;lostRound=true;break;
      case 'revive':if(phase!=='gameOver'||lives!==0||revives>=MAX_REVIVES)throw new ApiError(422,'复活无效');revives++;lives=1;phase='ready';pendingRelief=true;reliefRows=variant.reviveRows??ENDLESS.reliefRows;lostRound=true;break;
      case 'boost':if(phase!=='running'||e.tick!==launchTick||boosted||!afterLoss||boosts>=MAX_BOOSTS)throw new ApiError(422,'加球奖励无效');boosts++;boosted=true;balls=Math.min(C.maxBalls,balls+BOOST_BALLS);break;
      case 'bonus':{
        if(!expectBonus||e.kind!==endlessBonus(bonusRandom))throw new ApiError(422,'压线补偿奖励无效');expectBonus=false;
        if(e.kind==='plus3')balls=Math.min(C.maxBalls,balls+ENDLESS.plusBalls);
        else if(e.kind==='fire')fireUntil=e.tick+Math.ceil(skills.fireSeconds/C.step);
        else if(e.kind==='lightning'){if(lightningTick!==e.tick){lightningTick=e.tick;lightnings=0;}lightnings++;}
        break;}
      case 'hit':{
        if(phase!=='running'||!balls)throw new ApiError(422,'重复或不可能的方块事件');
        const index=field.indexOfWorld(e.index);if(index<0)throw new ApiError(422,'方块不存在或已被击碎');
        if(field.isSteel(index))throw new ApiError(422,'钢砖不可击碎');
        // 1.8: fire breaks a hard brick outright (journaled as crush); otherwise a hard brick only cracks.
        if(e.crush&&(!variant.special||e.tick>fireUntil||field.hp[index]<2))throw new ApiError(422,'火焰击碎硬砖无效');
        const y=field.top+Math.floor(index/field.cols)*field.step+field.size/2,kind=field.kinds[index];
        field.crush=!!e.crush;field.hit(index);field.crush=false;
        // Versioned fire area, lightning batch and bomb blasts bound the existing per-tick anomaly budget.
        const allowance=Math.max(tickBallMax,balls)*12*(e.tick<=fireUntil?1+skills.fireOffsets.length:1)+(e.tick===lightningTick?lightnings*skills.lightningBricks:0)+(e.tick===blastTick?blasts*Math.ceil(Math.PI*Physics.BLAST_RADIUS**2+2):0);
        if(++tickHits>allowance)suspicious.add('单步击碎数量异常');
        if(field.alive[index]){score.chip();break;}
        score.hit(e.index);bricks++;
        if(variant.special&&kind===Cell.Bomb){if(blastTick!==e.tick){blastTick=e.tick;blasts=0;}blasts++;}
        if(field.destroyedTotal>=nextDropAt){nextDropAt+=dropEvery(field.destroyedTotal,variant);const power=endlessPower(dropRandom,variant);
          if(!spacing)spawnDrop(power,e.tick,y);else if(pending.length<spacing.pending)pending.push(power);}
        if(spacing&&pending.length&&field.clock-lastDrop>=spacing.ticks){lastDrop=field.clock;spawnDrop(pending.shift()!,e.tick,y);}
        break;
      }
      case 'power':{
        if(phase!=='running'||balls<=0)throw new ApiError(422,'道具拾取状态无效');
        const index=drops.findIndex(d=>d.kind===e.kind&&(e.dropId===undefined||d.id===e.dropId)&&(e.tick-d.tick)*C.step*C.power.fallSpeed>=C.paddle.y-C.paddle.height/2-C.power.radius-d.y-C.power.fallSpeed*C.step-.02&&(e.tick-d.tick)*C.step*C.power.fallSpeed<=C.paddle.y+C.paddle.height/2+C.power.radius-d.y+.02);
        if(index<0)throw new ApiError(422,'无对应可拾取道具');drops.splice(index,1);
        if(e.kind==='plus3')balls=Math.min(C.maxBalls,balls+ENDLESS.plusBalls);
        else if(e.kind==='halve')balls=Math.max(1,Math.ceil(balls/2));
        else if(e.kind==='life')lives=Math.min(ENDLESS.lives,lives+1);
        else if(e.kind==='fire')fireUntil=e.tick+Math.ceil(skills.fireSeconds/C.step);
        else if(e.kind==='lightning'){if(lightningTick!==e.tick){lightningTick=e.tick;lightnings=0;}lightnings++;}
        if(variant.powerPoints)score.addPowerPoints();
        break;
      }
      case 'ballLost':if(phase!=='running'||balls<=0)throw new ApiError(422,'重复弹球死亡');balls--;break;
      case 'lost':if(phase!=='running'||balls!==0)throw new ApiError(422,'回合扣命无效');lives--;if(variant.pressureReset)field.pressure=0;phase=lives>0?'ready':'gameOver';drops.length=0;dropSequence=0;pending.length=0;lastDrop=-Infinity;score.resetCombo();lostRound=true;break;
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
