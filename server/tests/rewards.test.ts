import {it,expect} from 'vitest';
import {Game} from '../../src/Game';
import {C} from '../../src/GameConfig';
import {RULES_VERSION,MAX_REVIVES,MAX_BOOSTS,REWARD_FEATURE,CHALLENGE_FEATURES,type ChallengeEvent} from '../../shared/Challenge';
import {verifyTrace} from '../src/verifier';
/** Rewarded help: up to 2 revives per run and up to 3 boosts (+3 balls) on launches after a lost life. */
const loseRound=(g:Game)=>{for(const b of g.physics.balls)Object.assign(b,{x:400,y:1080,vx:0,vy:760,outsideArena:true});g.update(C.step);};
function play(mode:'campaign'|'endless',seed:number){
 const g=new Game();if(mode==='endless')g.setMode('endless');g.journal.seed=seed;g.physics.setSeed(seed);g.physics.reset();g.canOfferRevive=()=>true;
 const step=(n:number)=>{for(let t=0;t<n&&g.state==='running';t++){const low=g.physics.balls.filter(b=>b.alive).sort((a,b)=>b.y-a.y)[0];if(low)g.physics.setTarget(low.x);g.update(C.step);}};
 expect(g.canBoost).toBe(false);g.start();step(600);
 while(g.state==='running')loseRound(g);
 for(let guard=0;guard<40&&!(g.state==='gameOver'&&!g.awaitingRevive);guard++){
  if(g.state==='gameOver'&&g.awaitingRevive){expect(g.revive()).toBe(true);continue;}
  if(g.state==='ready'){if(g.canBoost)expect(g.armBoost()).toBe(true);const before=g.physics.balls.length;g.start();if(g.journal.events.at(-1)?.type==='boost')expect(g.physics.balls.length).toBeGreaterThanOrEqual(before+3);step(240);}
  while(g.state==='running')loseRound(g);
 }
 return g;
}
it('服务端公布复活/加球能力，最多复活2次、加球3次',()=>{expect(CHALLENGE_FEATURES).toContain(REWARD_FEATURE);expect(MAX_REVIVES).toBe(2);expect(MAX_BOOSTS).toBe(3);});
it.each(['campaign','endless'] as const)('%s：看视频复活2次、加球3次后照常结束，服务端验证通过并可上榜',mode=>{
 const g=play(mode,11),events=g.journal.events;
 expect(events.filter(e=>e.type==='revive')).toHaveLength(2);expect(events.filter(e=>e.type==='boost')).toHaveLength(3);expect(events.at(-1)!.type).toBe('finish');
 expect(g.revive()).toBe(false);
 const v=verifyTrace(events,1e9,11,g.rulesVersion);expect(v.summary).toEqual(g.journal.summary(g.score.total,g.reachedLevel,false));expect(v.suspicious).toEqual([]);
});
it('伪造：第3次复活、开局加球、非发射时加球、同一发射加两次都被拒绝',()=>{
 const g=play('campaign',5),events=g.journal.events,seed=5;
 const at=(type:string)=>events.findIndex(e=>e.type===type);
 // A third revive inserted before the final finish.
 const finish=events.length-1,lastLost=events.at(-2)!;
 expect(()=>verifyTrace([...events.slice(0,finish),{type:'revive',tick:lastLost.tick,level:lastLost.level},{type:'launch',tick:lastLost.tick+1,level:lastLost.level},{type:'ballLost',tick:lastLost.tick+2,level:lastLost.level},{type:'lost',tick:lastLost.tick+2,level:lastLost.level},events[finish]] as ChallengeEvent[],1e9,seed,RULES_VERSION)).toThrow('复活无效');
 // Boost on the very first launch of the run (no life lost yet).
 const first=events[0];expect(()=>verifyTrace([first,{type:'boost',tick:first.tick,level:first.level},...events.slice(1)] as ChallengeEvent[],1e9,seed,RULES_VERSION)).toThrow('加球奖励无效');
 // Boost one tick after its launch, and a second boost on the same launch.
 const b=at('boost'),boost=events[b];
 expect(()=>verifyTrace([...events.slice(0,b),{...boost,tick:boost.tick+1},...events.slice(b+1)],1e9,seed,RULES_VERSION)).toThrow();
 expect(()=>verifyTrace([...events.slice(0,b+1),boost,...events.slice(b+1)],1e9,seed,RULES_VERSION)).toThrow('加球奖励无效');
});
it('不提供复活时照旧：生命耗尽立即结束，日志与原来一致',()=>{
 const g=new Game();g.journal.seed=3;g.physics.setSeed(3);g.physics.reset();g.start();
 for(let i=0;i<5;i++){loseRound(g);if(g.state==='ready')g.start();}
 expect(g.state).toBe('gameOver');expect(g.awaitingRevive).toBe(false);expect(g.journal.events.at(-1)!.type).toBe('finish');
});
