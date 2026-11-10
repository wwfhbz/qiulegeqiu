import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const include='include /etc/nginx/snippets/qiulegeqiu-api.conf;';
function lex(text){const tokens=[];for(let i=0;i<text.length;){if(/\s/.test(text[i])){i++;continue;}if(text[i]==='#'){while(i<text.length&&text[i]!=='\n')i++;continue;}const start=i;if('{};'.includes(text[i])){tokens.push({value:text[i++],start,end:i});continue;}if(text[i]==='"'||text[i]==="'"){const quote=text[i++];let value='';while(i<text.length&&text[i]!==quote){if(text[i]==='\\'&&i+1<text.length)i++;value+=text[i++];}if(text[i++]!==quote)throw Error('Nginx引号未闭合');tokens.push({value,start,end:i});continue;}while(i<text.length&&!/[\s{};#]/.test(text[i]))i++;tokens.push({value:text.slice(start,i),start,end:i});}return tokens;}
export function planNginx(text){
 const tokens=lex(text),candidates=[];
 for(let i=0;i<tokens.length-1;i++){if(tokens[i].value!=='server'||tokens[i+1].value!=='{')continue;let depth=1,pending=[],names=[],tls=false,hasApi=false,hasInclude=false,j=i+2;
  for(;j<tokens.length&&depth;j++){const token=tokens[j];if(token.value==='{'){if(depth===1&&pending[0]==='location'&&pending.some(v=>v.includes('/api')))hasApi=true;pending=[];depth++;}else if(token.value==='}'){depth--;pending=[];}else if(depth===1&&token.value===';'){if(pending[0]==='server_name')names=pending.slice(1);if(pending[0]==='listen'&&/^(?:[^:]+:|\[[^\]]+\]:)?443$/.test(pending[1]||''))tls=true;if(pending[0]==='include'&&pending[1]==='/etc/nginx/snippets/qiulegeqiu-api.conf')hasInclude=true;pending=[];}else if(depth===1)pending.push(token.value);}
  if(depth)throw Error('Nginx块未闭合');if(names.includes('ball.gmgnclaw.com')&&tls){if(names.length!==1)throw Error('球了个球与其他域名共用server块，需单独审核，不自动修改');candidates.push({close:tokens[j-1],hasApi,hasInclude});}i=j-1;
 }
 if(candidates.length!==1)throw Error('必须精确定位一个ball.gmgnclaw.com的443站点块');
 const target=candidates[0];if(target.hasInclude)return {changed:false,config:text};if(target.hasApi)throw Error('站点已有/api规则，需核对旧API和数据，不自动覆盖');
 return {changed:true,config:text.slice(0,target.close.start)+'    '+include+'\n'+text.slice(target.close.start)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [input,output]=process.argv.slice(2);if(!input)throw Error('用法：node nginx-plan.mjs 原配置 [输出文件]');const result=planNginx(readFileSync(input,'utf8'));if(output)writeFileSync(output,result.config,{mode:0o600});else process.stdout.write(result.config);}
