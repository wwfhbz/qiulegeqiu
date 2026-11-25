/** Where the personal best lives (localStorage on the web, wx storage in the mini game). */
export interface BestStore{read():string|null;write(value:string):void}
export const ENDLESS_BEST_KEY='qiulegeqiu:endless-best:v1';
/**
 * Personal best for endless mode, kept on this device: the furthest stage and the highest score.
 * Display only — it never affects scoring or verification.
 */
export class EndlessBest{
 stage=0;score=0;
 /** Best before the current run, so the HUD can tell when this run has passed it. */
 private before={stage:0,score:0};
 private store?:BestStore;
 attach(store:BestStore){this.store=store;try{const v=JSON.parse(store.read()??'{}') as {stage?:unknown;score?:unknown};
  if(Number.isSafeInteger(v.stage)&&(v.stage as number)>0)this.stage=v.stage as number;if(Number.isSafeInteger(v.score)&&(v.score as number)>0)this.score=v.score as number;}catch{/* A broken save starts fresh. */}
  this.before={stage:this.stage,score:this.score};}
 /** A new run starts: compare against the best as it stands now. */
 beginRun(){this.before={stage:this.stage,score:this.score};}
 /** True once this run reached a further stage than the previous best (never on a first-ever run). */
 beaten(stage:number){return this.before.stage>0&&stage>this.before.stage;}
 /** The best stage to show during a run (the previous best, so the target does not move). */
 get target(){return this.before.stage;}
 /** Record a finished run; true when it set a new best stage or score. */
 record(stage:number,score:number){
  const better=stage>this.stage||score>this.score;if(!better)return false;
  this.stage=Math.max(this.stage,stage);this.score=Math.max(this.score,score);
  try{this.store?.write(JSON.stringify({stage:this.stage,score:this.score}));}catch{/* Storage may be full or blocked. */}
  return true;
 }
 /** Run-start values, for the result page ("new record" badges). */
 get previous(){return this.before;}
}
