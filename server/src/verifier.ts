import { Blocks } from '../../src/Blocks.js';
import { ScoreSystem } from '../../src/ScoreSystem.js';
import { ARCADE } from '../../src/ArcadeRules.js';
import { C } from '../../src/GameConfig.js';
import type { ChallengeEvent, ChallengeSummary } from '../../shared/Challenge.js';
import { ApiError } from './moderation.js';

/** Event replay, not physical replay. A forged but plausible client trace is still possible. */
export function verifyTrace(events: ChallengeEvent[], wallMs: number): { summary: ChallengeSummary; suspicious: string[] } {
  const blocks=new Blocks(), score=new ScoreSystem(blocks.alive.length);
  const valid=blocks.alive.slice();
  let level=1,lives:number=ARCADE.initialLives,phase='ready',balls=0,lastTick=0,bricks=0,finished=false;
  let destroyedThisLevel=0; const suspicious=new Set<string>();
  const drops: {kind:'triple'|'wide';tick:number;y:number}[]=[];
  let tickHits=0,hitTick=-1;
  for(const e of events){
    if(finished||!Number.isSafeInteger(e.tick)||e.tick<lastTick||e.tick>6*3600/C.step||e.level!==level)throw new ApiError(422,'挑战事件顺序或关卡无效');
    score.update((e.tick-lastTick)*C.step); lastTick=e.tick;
    for(let i=drops.length-1;i>=0;i--)if((e.tick-drops[i].tick)*C.step*C.power.fallSpeed>C.height+C.power.radius-drops[i].y+.02)drops.splice(i,1);
    switch(e.type){
      case 'launch': if(phase!=='ready')throw new ApiError(422,'重复发射或无效回合');phase='running';balls=1;break;
      case 'hit': {
        if(phase!=='running'||!balls||!valid[e.index])throw new ApiError(422,'重复或不可能的方块事件');
        valid[e.index]=0;score.hit(e.index);bricks++;destroyedThisLevel++;
        if(hitTick!==e.tick){hitTick=e.tick;tickHits=0;} if(++tickHits>balls*12)suspicious.add('单步击碎数量异常');
        const interval=Math.round(C.power.dropEvery/(level===1?ARCADE.powerUpDropMultiplier.level1:ARCADE.powerUpDropMultiplier.level2AndAbove));
        if(destroyedThisLevel%interval===0&&drops.length<C.power.maxDrops)drops.push({kind:Math.floor(destroyedThisLevel/interval)%2?'triple':'wide',tick:e.tick,y:blocks.top+Math.floor(e.index/blocks.cols)*C.grid.step+C.grid.size/2});
        break;
      }
      case 'power': {
        if(phase!=='running')throw new ApiError(422,'道具拾取状态无效');
        // Expired drops must not consume pool space during an extended rally.
        const candidate=drops.findIndex(d=>d.kind===e.kind&&(e.tick-d.tick)*C.step*C.power.fallSpeed>=C.paddle.y-C.paddle.height/2-C.power.radius-d.y-C.power.fallSpeed*C.step-.02&&(e.tick-d.tick)*C.step*C.power.fallSpeed<=C.height+C.power.radius-d.y+.01);
        if(candidate<0)throw new ApiError(422,'无对应可拾取道具');drops.splice(candidate,1);
        if(e.kind==='triple')balls=Math.min(C.maxBalls,balls*3);break;
      }
      case 'ballLost':if(phase!=='running'||balls<=0)throw new ApiError(422,'重复弹球死亡');balls--;break;
      case 'lost':if(phase!=='running'||balls!==0||destroyedThisLevel===blocks.total)throw new ApiError(422,'回合扣命无效');lives--;if(lives<0)throw new ApiError(422,'生命异常');phase=lives?'ready':'gameOver';drops.length=0;score.resetCombo();break;
      case 'clear':if(phase!=='running'||destroyedThisLevel!==blocks.total)throw new ApiError(422,'未完成本关');score.complete(lives);phase=level===ARCADE.levels.length?'victory':'cleared';break;
      case 'next': if(phase!=='cleared')throw new ApiError(422,'无效切关');level++;phase='ready';valid.set(blocks.alive);destroyedThisLevel=0;drops.length=0;score.beginLevel();break;
      case 'finish': if(phase!=='gameOver'&&phase!=='victory')throw new ApiError(422,'挑战尚未结束');finished=true;break;
    }
    // Physical updates advance drops even if no event occurs. Remove passed drops before future spawns.
    for(let i=drops.length-1;i>=0;i--)if((e.tick-drops[i].tick)*C.step*C.power.fallSpeed>C.height+C.power.radius-drops[i].y)drops.splice(i,1);
  }
  if(!finished)throw new ApiError(422,'缺少结束事件');
  const durationMs=Math.round(lastTick*C.step*1000);
  if(durationMs>wallMs+2000)throw new ApiError(422,'模拟时间超过服务端挑战时间');
  if(durationMs<3000)suspicious.add('挑战用时过短');
  if(bricks>Math.max(10,durationMs/1000*180))suspicious.add('消除速度异常，需回放复核');
  return {summary:{score:score.total,reachedLevel:level,bricksDestroyed:bricks,durationMs,completedAllLevels:phase==='victory'},suspicious:[...suspicious]};
}
