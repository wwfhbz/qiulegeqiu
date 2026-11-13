import {z} from 'zod';
/** Names only: never serialize input, values, cookies, tokens, or arbitrary user-supplied keys. */
const safeNames=new Set(['events','sequence','tick','level','type','index','kind','dropId','target','summary','score','reachedLevel','bricksDestroyed','durationMs','completedAllLevels','idempotencyKey','rulesVersion','seed','unranked','tripleRuleVersion','brickPowerVersion','trajectoryVersion','nickname','regionCode','code','ticket','offset','limit','board']);
export function validationFailure(error:z.ZodError){
 const fields=error.issues.slice(0,8).flatMap(issue=>{
  const path=issue.path.map(p=>typeof p==='number'?`[${p}]`:safeNames.has(String(p))?String(p):'字段').join('.').replaceAll('.[','[');
  const keys=issue.code==='unrecognized_keys'?issue.keys.filter(k=>safeNames.has(k)):[];
  return (keys.length?keys.map(k=>path?path+'.'+k:k):[path||'请求体']).map(field=>({field,code:issue.code}));
 });
 const first=fields[0];return {code:'VALIDATION_ERROR',message:`提交内容格式不正确（${first?.field??'请求体'}：${first?.code==='unrecognized_keys'?'不支持的字段':'字段类型或范围无效'}）`,fields};
}
