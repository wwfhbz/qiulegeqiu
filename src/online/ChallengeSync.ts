import { RULES_VERSION,assertTrajectorySupport,assertChallengeSupport,assertChallengeProtocol,assertTripleRuleSupport,assertBrickPowerSupport, type ChallengeEvent } from '../../shared/Challenge';
import type { Game } from '../Game';
import type { ApiTransport } from '../../shared/ApiTransport';
interface Run { generation:number; id:Promise<string>; sequence:number; acknowledged:number; pending?:ChallengeEvent[]; key:string; pumping?:Promise<void>; error?:string;fatal?:boolean;retryAt?:number;blocked?:string }
/** Sequential idempotent batches; networking is never awaited by game physics or controls. */
export class ChallengeSync {
  private run?:Run; private lastPump=0;
  get canRetry(){return !!this.run&&!this.run.fatal;}
  onProgress?: (uploaded:number,total:number)=>void;
  /** A stalled transport must release the UI; retries reuse the same batch/key. */
  private async request<T>(path:string,body?:unknown):Promise<T>{
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{return await Promise.race([this.api.request<T>(path,body),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('请求超时，挑战记录已保留，请重试提交')),10000);})]);}
    finally{if(timer!==undefined)clearTimeout(timer);}
  }
  constructor(private api:ApiTransport,private game:Game,private clock:()=>number=()=>performance.now(),private clientId:()=>string=()=>crypto.randomUUID()){}
  observe(){const journal=this.game.journal;if(!journal.events.length)return;
    if(!this.run||this.run.generation!==journal.generation){
      const rulesVersion=this.game.rulesVersion,run:Run={generation:journal.generation,id:Promise.resolve(''),sequence:0,acknowledged:0,key:this.clientId()};
      run.id=this.request<Parameters<typeof assertChallengeSupport>[0]&Parameters<typeof assertChallengeProtocol>[0]&Parameters<typeof assertTripleRuleSupport>[0]>('/health').then(health=>{assertChallengeSupport(health);assertChallengeProtocol(health);assertTripleRuleSupport(health);assertBrickPowerSupport(health);if(this.game.physics.trajectoryVersion===1)assertTrajectorySupport(health);if(rulesVersion!==RULES_VERSION&&!(health as {supportedRulesVersions?:string[]}).supportedRulesVersions?.includes(rulesVersion))throw Error('排行榜服务尚未支持无尽模式，本局仍可单机游玩');return this.request<{id:string;rulesVersion:string;challengeProtocolVersion?:number;challengeFeatures?:unknown}>('/challenges',{rulesVersion,unranked:journal.unranked,seed:journal.seed});}).then(r=>{if(r.rulesVersion!==rulesVersion||typeof r.id!=='string'||!r.id)throw Error('挑战接口返回的规则版本或标识无效，本次不能登记成绩');assertChallengeProtocol(r);assertTripleRuleSupport(r);assertBrickPowerSupport(r);if(this.game.physics.trajectoryVersion===1)assertTrajectorySupport(r);return r.id;}).catch(error=>{run.error=String(error.message);run.fatal=true;return '';});this.run=run;
    }
    if(this.run.fatal||this.run.blocked||this.clock()<(this.run.retryAt??0))return;
    if(this.clock()-this.lastPump>1500||journal.events.length-this.run.acknowledged>=128){this.lastPump=this.clock();void this.flush().catch(()=>{});}
  }
  async flush(manual=false){const run=this.run;if(!run)throw new Error('本次未建立联网挑战，仍可直接重新挑战');if(run.fatal)throw new Error(run.error||'本轮会话已失效，请重新开始');if(run.pumping)return run.pumping;if(run.blocked&&!manual)throw new Error(run.blocked);if(manual)run.blocked=undefined;
    run.pumping=(async()=>{const started=this.clock();const cid=await run.id;if(!cid)throw new Error(run.error||'本次挑战未连接服务器，无法登记');
      while(this.run===run&&this.game.journal.generation===run.generation&&run.acknowledged<this.game.journal.events.length){
        if(this.clock()-started>=20000)throw new Error('记录上传尚未完成，已保留进度，请再次提交继续上传');
        this.onProgress?.(run.acknowledged,this.game.journal.events.length);
        run.pending??=this.game.journal.events.slice(run.acknowledged,run.acknowledged+256);
        await this.request(`/challenges/${cid}/events`,{sequence:run.sequence,events:run.pending});
        run.acknowledged+=run.pending.length;run.sequence++;run.pending=undefined;run.error=undefined;run.retryAt=undefined;this.onProgress?.(run.acknowledged,this.game.journal.events.length);
      }
    })().catch(error=>{
      const status=(error as {status?:number}).status;
      if(status!==undefined&&[400,413,422].includes(status)){run.blocked=`挑战日志未被接受：${error.message}；请核对前后端日志协议，修复后可重试原记录`;run.error=run.blocked;}
      else if(status!==undefined&&[401,403,404,409,410].includes(status)){run.fatal=true;run.error='本轮挑战或身份不可用，请重新开始：'+error.message;}
      else{run.error=error.message;run.retryAt=this.clock()+1500;}throw new Error(run.error);
    }).finally(()=>{run.pumping=undefined;});return run.pumping;
  }
  async submit(){
    const run=this.run,generation=this.game.journal.generation;
    if(!run||run.generation!==generation)throw new Error('本次未建立联网挑战，仍可直接重新挑战');
    if(this.game.state!=='gameOver'&&this.game.state!=='victory')throw new Error('本次挑战尚未结束');
    if(this.game.journal.truncated)throw new Error('记录数量超限，本次仅保留本机成绩');
    await this.flush(true);if(this.run!==run||run.generation!==this.game.journal.generation)throw new Error('挑战已重新开始');const id=await run.id;
    return this.request<{verificationStatus:string}>(`/challenges/${id}/submit`,{idempotencyKey:run.key,summary:this.game.journal.summary(this.game.score.total,this.game.reachedLevel,this.game.state==='victory')});
  }
}
