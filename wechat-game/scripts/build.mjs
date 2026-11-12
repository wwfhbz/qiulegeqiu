import {build} from 'esbuild';
import {GAME_NAME,MINIGAME_VERSION} from '../../shared/Brand.ts';
import {RULES_VERSION} from '../../shared/Challenge.ts';
import * as fs from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
export const CLIENT_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const REPO_ROOT=resolve(CLIENT_ROOT,'..');
export function readBuildConfig(configRoot=CLIENT_ROOT,development=false,release=false){
 const file=join(configRoot,'local.config.json');let local={};
 if(fs.existsSync(file)){try{local=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw Error('local.config.json不是有效JSON');}}
 if(!local||typeof local!=='object'||Array.isArray(local)||Object.keys(local).some(k=>!['appid','apiBase'].includes(k)))throw Error('local.config只允许appid/apiBase，禁止放AppSecret');
 if(local.appid&&local.appid!=='touristappid'&&(typeof local.appid!=='string'||!/^wx[0-9a-f]{16}$/i.test(local.appid)))throw Error('AppID格式无效，请填写真实小游戏AppID或游客占位值');
 if(release&&(!local.appid||local.appid==='touristappid'))throw Error('正式提审候选包必须填写真实小游戏AppID');
 const apiBase=local.apiBase||(development?'http://127.0.0.1:8091/api':'https://ball.gmgnclaw.com/api');
 if(typeof apiBase!=='string'||!(/^https:\/\/[^/]+\/api\/?$/.test(apiBase)||(development&&/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/api\/?$/.test(apiBase))))throw Error('正式包必须使用HTTPS合法域名');
 let url;try{url=new URL(apiBase);}catch{throw Error('API地址无效，请检查配置');}if(url.username||url.password||url.search||url.hash)throw Error('API地址不能包含凭据或查询参数');
 return {appid:local.appid||'touristappid',runtime:{apiBase,development}};
}
export async function buildWechatGame({configRoot=CLIENT_ROOT,development=false,release=false}={}){
 configRoot=resolve(configRoot);const config=readBuildConfig(configRoot,development,release),out=join(configRoot,'dist'),stage=join(configRoot,'.build-'+randomUUID());fs.mkdirSync(stage,{recursive:true});
 try{
  const result=await build({absWorkingDir:REPO_ROOT,entryPoints:[join(CLIENT_ROOT,'game.js')],outfile:join(stage,'game.js'),bundle:true,platform:'neutral',format:'cjs',target:'es2020',minify:!development,sourcemap:development,metafile:true,define:{__MINIGAME_CONFIG__:JSON.stringify(config.runtime)}});
  const inputs=Object.keys(result.metafile.inputs).map(p=>p.replaceAll('\\','/'));
  if(inputs.some(p=>/src\/(?:platform\/WebPlatform|GameUI|online\/ApiClient)\./.test(p)))throw Error('小游戏错误引入浏览器适配层');
  const bundle=fs.readFileSync(join(stage,'game.js'),'utf8');
  if(/\b(?:document|localStorage|sessionStorage)\s*[.\[]|\bwindow\s*\.|\bfetch\s*\(|WECHAT_APP_SECRET|jscode2session|node:sqlite/.test(bundle))throw Error('小游戏包包含浏览器依赖或服务端代码');

  fs.mkdirSync(join(stage,'assets'),{recursive:true});
  fs.copyFileSync(join(REPO_ROOT,'public/ranking-art/reference-scene.png'),join(stage,'assets/ranking-scene.png'));
  fs.copyFileSync(join(CLIENT_ROOT,'game.json'),join(stage,'game.json'));
  const project=JSON.parse(fs.readFileSync(join(CLIENT_ROOT,'project.config.json'),'utf8'));Object.assign(project,{appid:config.appid,miniprogramRoot:'./',projectname:GAME_NAME,description:`${GAME_NAME} 微信小游戏 V${MINIGAME_VERSION}`});
  fs.writeFileSync(join(stage,'project.config.json'),JSON.stringify(project,null,2)+'\n');
  fs.writeFileSync(join(stage,'build-info.json'),JSON.stringify({clientVersion:MINIGAME_VERSION,rulesVersion:RULES_VERSION,apiBase:config.runtime.apiBase,development,inputs},null,2)+'\n');
  fs.rmSync(out,{recursive:true,force:true});fs.renameSync(stage,out);
  console.log(`微信小游戏产物：${out}。开发者工具导入此目录；游客AppID不代表真实登录或审核资格。`);
  return out;
 }finally{fs.rmSync(stage,{recursive:true,force:true});}
}
export async function cli(configRoot=CLIENT_ROOT){
 const args=process.argv.slice(2);if(args.some(arg=>!['--dev','--check','--release'].includes(arg)))throw Error('构建仅接受--dev、--check或--release');
 if(args.includes('--dev')&&args.includes('--release'))throw Error('正式提审包不能启用开发模式');
 if(args.includes('--check')){readBuildConfig(configRoot,args.includes('--dev'),args.includes('--release'));console.log('客户端配置检查通过');return;}
 return buildWechatGame({configRoot,development:args.includes('--dev'),release:args.includes('--release')});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await cli();
