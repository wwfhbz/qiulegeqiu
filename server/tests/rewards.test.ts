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
it('无尽1.7：看视频复活后下一次发射清掉最底部20行（压线扣命仍只清5行），服务端同步',()=>{
 const g=new Game();g.setMode('endless');g.journal.seed=9;g.physics.setSeed(9);g.physics.reset();g.canOfferRevive=()=>true;const f=g.physics.endless!;
 expect(f.variant.reviveRows).toBe(20);g.start();
 // Sink the wall to the floor so the bottom rows are full, then lose every life.
 let n=0;while(!f.blocked&&n<400000){g.physics.balls.length=1;Object.assign(g.physics.balls[0],{x:400,y:200,vx:0,vy:0,alive:true});g.update(C.step);n++;}
 while(g.state!=='gameOver'){if(g.state==='ready')g.start();loseRound(g);}
 expect(g.awaitingRevive).toBe(true);expect(g.revive()).toBe(true);
 const rowsWithBricks=()=>{let count=0;for(let row=f.floorRow-19;row<=f.floorRow;row++){let any=false;for(let col=0;col<f.cols;col++)if(f.alive[row*f.cols+col])any=true;if(any)count++;}return count;};
 expect(rowsWithBricks()).toBeGreaterThan(10);g.start();expect(rowsWithBricks()).toBe(0);
 const relief=g.physics.effects;void relief;
 while(g.state!=='gameOver'||g.awaitingRevive){if(g.awaitingRevive){g.endRun();break;}if(g.state==='ready')g.start();loseRound(g);}
 const v=verifyTrace(g.journal.events,1e9,9,g.rulesVersion);expect(v.summary).toEqual(g.journal.summary(g.score.total,g.reachedLevel,false));
});
it('闯关1.10：看视频复活后下一球随机送一种特效（×3/闪电/火球/穿透），服务端按种子校验，伪造种类被拒绝',()=>{
 const kinds=new Set<string>();
 for(let seed=1;seed<=24;seed++){const g=play('campaign',seed),events=g.journal.events;
  const revives=events.flatMap((e,i)=>e.type==='revive'?[i]:[]);expect(revives).toHaveLength(2);
  for(const r of revives){const launch=events.findIndex((e,i)=>i>r&&e.type==='launch'),bonus=events[launch+1] as {type:string;kind:string;tick:number};expect(bonus.type).toBe('bonus');expect(bonus.tick).toBe(events[launch].tick);expect(['triple','lightning','fire','pierce']).toContain(bonus.kind);kinds.add(bonus.kind);}
  const v=verifyTrace(events,1e9,seed,RULES_VERSION);expect(v.summary).toEqual(g.journal.summary(g.score.total,g.reachedLevel,false));expect(v.suspicious).toEqual([]);
  if(seed===1){const i=events.findIndex(e=>e.type==='bonus'),other=(['triple','lightning','fire','pierce'] as const).find(k=>k!==(events[i] as {kind:string}).kind)!;
   expect(()=>verifyTrace(events.map((e,j)=>j===i?{...e,kind:other}:e) as ChallengeEvent[],1e9,seed,RULES_VERSION)).toThrow('复活特效奖励无效');
   expect(()=>verifyTrace(events.filter((_,j)=>j!==i),1e9,seed,RULES_VERSION)).toThrow();}
 }
 expect([...kinds].sort()).toEqual(['fire','lightning','pierce','triple']);
},120000);
it('闯关看视频跳关：最多2次、不能跳最后一关、无尽不可用；跳关后照常计分并通过服务端验证',()=>{
 const g=new Game();g.journal.seed=21;g.physics.setSeed(21);g.physics.reset();
 expect(g.canSkip).toBe(true);g.start();g.update(C.step);expect(g.skipLevel()).toBe(true);expect(g.levels.current.number).toBe(2);expect(g.state).toBe('ready');expect(g.lives).toBe(3);
 g.pause();expect(g.skipLevel()).toBe(true);expect(g.levels.current.number).toBe(3);expect(g.canSkip).toBe(false);expect(g.skipLevel()).toBe(false);
 g.start();for(let t=0;t<240;t++)g.update(C.step);while(g.state!=='gameOver'){if(g.state==='ready')g.start();loseRound(g);}
 const events=g.journal.events,v=verifyTrace(events,1e9,21,RULES_VERSION);expect(v.summary).toEqual(g.journal.summary(g.score.total,3,false));expect(v.summary.reachedLevel).toBe(3);
 const i=events.findIndex(e=>e.type==='skip');
 // A third skip, a skip on an old season, and a skip inserted in endless are all rejected.
 const at=events.length-1,last=events[at-1];expect(()=>verifyTrace([...events.slice(0,at-2),{type:'skip',tick:last.tick,level:3},...events.slice(at-2)] as ChallengeEvent[],1e9,21,RULES_VERSION)).toThrow();
 expect(()=>verifyTrace(events,1e9,21,'1.9.0-arcade-5l-12lv-fullskills-v7')).toThrow();void i;
 const e=new Game();e.setMode('endless');expect(e.canSkip).toBe(false);
 const final=new Game();for(let n=1;n<12;n++)expect(final.levels.next()).toBeTruthy();expect(final.levels.isFinal).toBe(true);expect(final.canSkip).toBe(false);
});
