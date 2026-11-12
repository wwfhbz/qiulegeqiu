import {apiPayload,assertIdentityPayload} from '../../shared/ApiErrors';
import {RULES_VERSION,assertGlobalBoard,type LeaderboardMetadata} from '../../shared/Challenge';
export interface BestScore { score:number; reached_level:number; bricks_destroyed:number; duration_ms:number; rank:number; display_name:string }
export interface Player { id:string; nickname:string; region_code:string; prefix:string; status:string; display_name:string }
export interface Me extends LeaderboardMetadata {historicalBest?:BestScore|null;historicalBests?:(BestScore&{rules_version:string})[];rankingAvailable?:boolean;csrfToken:string; player:Player|null; best:BestScore|null }
export class ApiClient {
  private identity?: Promise<Me>; private csrf=''; private loading=false;
  async request<T>(path:string,body?:unknown):Promise<T>{
    if(body!==undefined&&(path==='/challenges'||!this.csrf))await this.me(path==='/challenges');
    let response:Response;
    try{response=await fetch(`/api${path}`,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'content-type':'application/json','x-csrf-token':this.csrf},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(6000)});}catch{throw new Error('网络暂不可用，单机游戏不受影响');}
    const result=await response.json().catch(()=>null);return apiPayload<T>(response.status,result);
  }
  me(refresh=false):Promise<Me>{if(refresh&&this.loading)return this.identity!.then(()=>this.me(true),()=>this.me(true));if(refresh&&!this.loading)this.identity=undefined;if(!this.identity){this.loading=true;this.identity=this.request<Me>('/me?board=global').then(data=>{assertIdentityPayload(data);this.csrf=data.csrfToken;try{assertGlobalBoard(data);return {...data,rankingAvailable:true};}catch{return {...data,historicalBest:data.historicalBest??(data.rulesVersion!==RULES_VERSION?data.best:null),best:null,rankingAvailable:false};}}).catch(error=>{this.identity=undefined;throw error;}).finally(()=>{this.loading=false;});}return this.identity;}
}
