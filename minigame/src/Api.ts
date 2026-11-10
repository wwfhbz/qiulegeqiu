import type {ApiTransport} from '../../shared/ApiTransport';
import type {Me} from '../../src/online/ApiClient';
import {storageKey,type Wx,type Config} from './Platform';
interface Credential {token:string;csrfToken:string;expiresAt:number}
export class WechatApi implements ApiTransport {
 private credential?:Credential;private pending?:Promise<void>;
 constructor(private wx:Wx,private config:Config){
  if(!/^https:\/\/[^/]+\/api\/?$/.test(config.apiBase)&&!(config.development&&/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/api\/?$/.test(config.apiBase)))throw Error('排行榜地址必须使用合法HTTPS域名');
  try{const saved=wx.getStorageSync(storageKey) as Credential;if(saved&&/^[A-Za-z0-9_-]{43}$/.test(saved.token)&&typeof saved.csrfToken==='string'&&saved.expiresAt>Date.now())this.credential=saved;}catch{/* Storage unavailable: login can still work in memory. */}
 }
 get authenticated(){return !!this.credential&&this.credential.expiresAt>Date.now();}
 async login(){if(this.authenticated)return;if(this.pending)return this.pending;
  this.pending=(async()=>{
   const code=await new Promise<string>((resolve,reject)=>this.wx.login({success:r=>r.code?resolve(r.code):reject(Error('微信未提供登录凭证')),fail:()=>reject(Error('微信登录不可用，可继续单机游玩'))}));
   const c=await this.send<Credential>('/wechat/login',{code},false);
   if(!/^[A-Za-z0-9_-]{43}$/.test(c.token)||typeof c.csrfToken!=='string'||!Number.isFinite(c.expiresAt)||c.expiresAt<=Date.now())throw Error('登录服务响应无效');
   this.credential=c;try{this.wx.setStorageSync(storageKey,c);}catch{/* No fake persistence claim. */}
  })().finally(()=>{this.pending=undefined;});return this.pending;
 }
 async request<T>(path:string,body?:unknown):Promise<T>{
  const publicGet=body===undefined&&/^\/(leaderboard|regions(?:\/[^?]+)?|players\/availability)(\?|$)/.test(path);
  if(!publicGet)await this.login();return this.send<T>(path,body,!publicGet||this.authenticated);
 }
 me(){return this.request<Me>('/me');}
 private async send<T>(path:string,body:unknown,auth:boolean):Promise<T>{
  if(!path.startsWith('/')||path.startsWith('//')||path.includes('\\'))throw Error('无效API路径');
  return new Promise<T>((resolve,reject)=>{
   const header:Record<string,string>={'content-type':'application/json'};
   if(auth&&this.credential){header.authorization='Bearer '+this.credential.token;if(body!==undefined)header['x-csrf-token']=this.credential.csrfToken;}
   this.wx.request({url:this.config.apiBase.replace(/\/$/,'')+path,method:body===undefined?'GET':'POST',header,data:body,timeout:6000,
    success:r=>{if(r.statusCode>=200&&r.statusCode<300)resolve(r.data as T);else{if(r.statusCode===401){this.credential=undefined;try{this.wx.removeStorageSync(storageKey);}catch{}}
     reject(Error((r.data as {message?:string})?.message||'排行榜暂不可用，单机游戏不受影响'));}},fail:()=>reject(Error('网络暂不可用，单机游戏不受影响'))});
  });
 }
}
