import { RULES_VERSION, type ChallengeEvent } from '../../shared/Challenge';
import type { Game } from '../Game';
import type { ApiTransport } from '../../shared/ApiTransport';
interface Run { generation:number; id:Promise<string>; sequence:number; acknowledged:number; pending?:ChallengeEvent[]; key:string; pumping?:Promise<void>; error?:string }
/** Sequential idempotent batches; networking is never awaited by game physics or controls. */
export class ChallengeSync {
  private run?:Run; private lastPump=0;
  constructor(private api:ApiTransport,private game:Game,private clock:()=>number=()=>performance.now(),private clientId:()=>string=()=>crypto.randomUUID()){}
  observe(){const journal=this.game.journal;if(!journal.events.length)return;
    if(!this.run||this.run.generation!==journal.generation){
      const run:Run={generation:journal.generation,id:Promise.resolve(''),sequence:0,acknowledged:0,key:this.clientId()};
      run.id=this.api.request<{id:string}>('/challenges',{rulesVersion:RULES_VERSION,unranked:journal.unranked,seed:journal.seed}).then(r=>r.id).catch(error=>{run.error=String(error.message);return '';});this.run=run;
    }
    if(this.clock()-this.lastPump>1500||journal.events.length-this.run.acknowledged>=128){this.lastPump=this.clock();void this.flush().catch(()=>{});}
  }
  async flush(){const run=this.run;if(!run)throw new Error('本次未建立联网挑战，仍可直接重新挑战');if(run.pumping)return run.pumping;
    run.pumping=(async()=>{const cid=await run.id;if(!cid)throw new Error(run.error||'本次挑战未连接服务器，无法登记');
      while(this.run===run&&this.game.journal.generation===run.generation&&run.acknowledged<this.game.journal.events.length){
        run.pending??=this.game.journal.events.slice(run.acknowledged,run.acknowledged+256);
        await this.api.request(`/challenges/${cid}/events`,{sequence:run.sequence,events:run.pending});
        run.acknowledged+=run.pending.length;run.sequence++;run.pending=undefined;run.error=undefined;
      }
    })().catch(error=>{run.error=error.message;throw error;}).finally(()=>{run.pumping=undefined;});return run.pumping;
  }
  async submit(){if(this.game.journal.truncated)throw new Error('记录数量超限，本次仅保留本机成绩');await this.flush();const run=this.run!;if(run.generation!==this.game.journal.generation)throw new Error('挑战已重新开始');const id=await run.id;
    return this.api.request<{verificationStatus:string}>(`/challenges/${id}/submit`,{idempotencyKey:run.key,summary:this.game.journal.summary(this.game.score.total,this.game.levels.current.number,this.game.state==='victory')});
  }
}
