import { newSeed } from './PowerRules';
import { C } from './GameConfig';
import { MAX_CHALLENGE_EVENTS, type ChallengeEvent, type ChallengeSummary } from '../shared/Challenge';
type WithoutTick<E> = E extends {tick:number} ? Omit<E,'tick'> : never;
/** Local event journal is evidence for server checks, never an authentication credential. */
export class ChallengeJournal {
  readonly events: ChallengeEvent[] = [];
  seed=newSeed();
  tick = 0; generation = 0; unranked = false; truncated = false; bricksDestroyed = 0;
  /** True once 90% of the record limit is used: the HUD warns that the run will soon stop being submittable. */
  get nearLimit(){return this.events.length>=MAX_CHALLENGE_EVENTS*.9;}
  reset() { this.events.length=0;this.seed=newSeed();this.tick=0;this.generation++;this.unranked=false;this.truncated=false;this.bricksDestroyed=0; }
  record(event:WithoutTick<ChallengeEvent>) {
    if(this.events.length>=MAX_CHALLENGE_EVENTS){this.truncated=true;return;}
    this.events.push({...event,tick:this.tick} as ChallengeEvent);
    if(event.type==='hit')this.bricksDestroyed++;
  }
  summary(score:number,reachedLevel:number,completedAllLevels:boolean):ChallengeSummary {return {score,reachedLevel,bricksDestroyed:this.bricksDestroyed,durationMs:Math.round(this.tick*C.step*1000),completedAllLevels};}
}
