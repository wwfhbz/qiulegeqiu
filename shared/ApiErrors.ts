/** Keep HTTP, malformed payload and protocol compatibility failures distinct in both clients. */
export class ApiResponseError extends Error {
 constructor(message:string,readonly status:number,readonly code:string){super(message);}
}
export function apiPayload<T>(status:number,value:unknown):T {
 const data=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
 if(status<200||status>=300){
  const fallback=status===429?'操作过于频繁，请稍后重试':status>=500?'排行榜服务暂不可用，单机游戏不受影响':status===401?'登录状态已失效，请重新登录':'请求失败，请稍后重试';
  throw new ApiResponseError(typeof data?.message==='string'?data.message:fallback,status,typeof data?.code==='string'?data.code:'HTTP_ERROR');
 }
 if(!data)throw new ApiResponseError('排行榜接口返回了无效数据，请检查API代理配置',status,'INVALID_RESPONSE');
 return data as T;
}
export function assertIdentityPayload(data:unknown):asserts data is {csrfToken:string;player:unknown;best:unknown}{
 const value=data as Record<string,unknown>|null;
 if(!value||typeof value.csrfToken!=='string'||!value.csrfToken||!('player' in value)||!('best' in value))throw new ApiResponseError('身份接口响应无效，请检查API代理配置',200,'INVALID_IDENTITY');
}
