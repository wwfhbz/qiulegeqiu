import {RULES_VERSION,assertRulesVersion} from '../../shared/Challenge';
export interface BestScore { score:number; reached_level:number; bricks_destroyed:number; duration_ms:number; rank:number; display_name:string }
export interface Player { id:string; nickname:string; region_code:string; prefix:string; status:string; display_name:string }
export interface Me { rulesVersion?:string;csrfToken:string; player:Player|null; best:BestScore|null }
export class ApiClient {
  private identity?: Promise<Me>; private csrf=''; private loading=false;
  async request<T>(path:string,body?:unknown):Promise<T>{
    if(body!==undefined&&!this.csrf)await this.me();
    let response:Response;
    try{response=await fetch(`/api${path}`,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'content-type':'application/json','x-csrf-token':this.csrf},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(6000)});}catch{throw new Error('网络暂不可用，单机游戏不受影响');}
    const result=await response.json().catch(()=>({message:'排行榜服务暂不可用'}));
    if(!response.ok)throw new Error(result.message||'请求失败，请稍后重试');return result as T;
  }
  me(refresh=false):Promise<Me>{if(refresh&&!this.loading)this.identity=undefined;if(!this.identity){this.loading=true;this.identity=this.request<Me>('/me?rulesVersion='+encodeURIComponent(RULES_VERSION)).then(data=>{assertRulesVersion(data.rulesVersion,RULES_VERSION);this.csrf=data.csrfToken;return data;}).catch(error=>{this.identity=undefined;throw error;}).finally(()=>{this.loading=false;});}return this.identity;}
}
