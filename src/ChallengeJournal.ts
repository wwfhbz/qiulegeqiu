import { C } from './GameConfig';
import type { ChallengeEvent, ChallengeSummary } from '../shared/Challenge';
/** Local event journal is evidence for server checks, never an authentication credential. */
export class ChallengeJournal {
  readonly events: ChallengeEvent[] = [];
  tick = 0; generation = 0; unranked = false; truncated = false; bricksDestroyed = 0;
  reset() { this.events.length=0;this.tick=0;this.generation++;this.unranked=false;this.truncated=false;this.bricksDestroyed=0; }
  record(event: Omit<Extract<ChallengeEvent,{type:'hit'}>,'tick'> | Omit<Extract<ChallengeEvent,{type:'power'}>,'tick'> | { type:'launch'|'ballLost'|'lost'|'clear'|'next'|'finish'; level:number }) {
    if(this.events.length>=50000){this.truncated=true;return;}
    this.events.push({...event,tick:this.tick} as ChallengeEvent);
    if(event.type==='hit')this.bricksDestroyed++;
  }
  summary(score:number,reachedLevel:number,completedAllLevels:boolean):ChallengeSummary {return {score,reachedLevel,bricksDestroyed:this.bricksDestroyed,durationMs:Math.round(this.tick*C.step*1000),completedAllLevels};}
}
