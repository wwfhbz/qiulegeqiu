import { readFileSync } from 'node:fs';
import { resource } from './db.js';
export class ApiError extends Error { constructor(public statusCode: number, message: string,public code?:string) { super(message); } }
const rules = JSON.parse(readFileSync(resource('data/nickname-rules.json'),'utf8')) as { version:string; categories: Record<string,string[]> };
export function normalizeNickname(input: string) {
  if (/[\p{Cc}\p{Cf}\p{Cs}]/u.test(input)) throw new ApiError(400,'昵称不能包含控制字符或隐藏字符');
  const nickname = input.normalize('NFKC').replace(/\s+/gu,' ').trim();
  if ([...nickname].length<2||[...nickname].length>12||!/^[\p{Script=Han}A-Za-z0-9 _·.\-]+$/u.test(nickname)) throw new ApiError(400,'昵称需为2～12个中文、英文字母、数字或安全字符');
  const normalized = nickname.toLowerCase().replace(/\s/gu,'');
  const screening = normalized.replace(/[ _·.\-]/g,'');
  if(Object.values(rules.categories).some(words=>words.some(word=>screening.includes(word.normalize('NFKC').toLowerCase())))) throw new ApiError(400,'昵称未通过审核，请更换昵称；误判可通过申诉入口反馈');
  return { nickname, normalized };
}
/** Optional private third-party gateway. It must implement { decision: allow|deny|review }. */
export async function moderateNickname(input: string) {
  const normalized=normalizeNickname(input), url=process.env.MODERATION_URL;
  if(url){
    if(!url.startsWith('https://'))throw new ApiError(503,'昵称审核服务配置错误');
    let response: Response;
    try { response=await fetch(url,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${process.env.MODERATION_API_KEY||''}`},body:JSON.stringify({text:normalized.nickname,scene:'nickname',rulesVersion:rules.version}),signal:AbortSignal.timeout(4000)}); }catch{throw new ApiError(503,'昵称审核暂不可用，请稍后重试');}
    if(!response.ok)throw new ApiError(503,'昵称审核暂不可用，请稍后重试');
    const result=await response.json() as { decision?:string };
    if(result.decision!=='allow')throw new ApiError(400,'昵称需人工审核或不符合规范，请更换昵称');
  }
  return normalized;
}
