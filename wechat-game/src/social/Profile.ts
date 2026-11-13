import type {Wx,NativeUserButton} from '../Platform';
export const PROFILE_KEY='qiulegeqiu:local-profile:v1';
export interface LocalProfile {nickname:string;avatar:string}
export function safeNickname(value:string){const name=value.normalize('NFKC').trim().replace(/\s+/gu,' ');if([...name].length<2||[...name].length>12||!/^[-\p{L}\p{N} _·]+$/u.test(name))throw Error('昵称需为2～12个中文、字母、数字或安全字符');return name;}
export class Profile {
 data:LocalProfile={nickname:'球球玩家',avatar:''};image?:CanvasImageSource;private native?:NativeUserButton;
 constructor(private wx:Wx){try{const saved=wx.getStorageSync(PROFILE_KEY) as LocalProfile;if(saved){this.data.nickname=safeNickname(saved.nickname);if(typeof saved.avatar==='string'&&/^(https:\/\/|wxfile:\/\/|http:\/\/usr\/)/.test(saved.avatar))this.data.avatar=saved.avatar;}}catch{/* Corrupt optional presentation cannot affect login. */}this.loadImage();}
 private loadImage(){this.image=undefined;if(!this.data.avatar||!this.wx.createImage)return;const image=this.wx.createImage();image.onload=()=>{this.image=image as unknown as CanvasImageSource;};image.onerror=()=>{this.image=undefined;};image.src=this.data.avatar;}
 private save(){try{this.wx.setStorageSync(PROFILE_KEY,{...this.data});return true;}catch{return false;}}
 nickname(name:string){this.data.nickname=safeNickname(name);this.save();}
 async chooseAvatar(){if(!this.wx.chooseMedia||!this.wx.getFileSystemManager)throw Error('当前微信不支持持久头像选择，可保留默认头像');const path=await new Promise<string>((resolve,reject)=>this.wx.chooseMedia!({count:1,mediaType:['image'],sourceType:['album'],success:r=>r.tempFiles[0]?.tempFilePath?resolve(r.tempFiles[0].tempFilePath):reject(Error('没有选择头像')),fail:()=>reject(Error('未选择头像，默认资料保持不变'))}));const saved=await new Promise<string>((resolve,reject)=>this.wx.getFileSystemManager!().saveFile({tempFilePath:path,success:r=>resolve(r.savedFilePath),fail:()=>reject(Error('头像保存失败，原头像保持不变'))}));this.data.avatar=saved;this.save();this.loadImage();}
 authorize(rect:{x:number;y:number;width:number;height:number},done:(message:string)=>void){
  if(!this.wx.createUserInfoButton||this.wx.canIUse?.('createUserInfoButton')===false){done('当前微信不支持此资料按钮，请手动填写昵称或选择头像');return;}
  this.clearButton();try{const button=this.wx.createUserInfoButton({type:'text',text:'点击填写微信资料（可拒绝）',withCredentials:false,style:{left:rect.x,top:rect.y,width:rect.width,height:rect.height,lineHeight:rect.height,backgroundColor:'#163049',color:'#EAF6FF',textAlign:'center',fontSize:13,borderRadius:10}});this.native=button;
   button.onTap(result=>{if(this.native!==button)return;this.clearButton();if(!result.userInfo){done('未授权，默认资料和游戏不受影响');return;}const {nickName,avatarUrl}=result.userInfo;try{if(nickName)this.data.nickname=safeNickname(nickName);}catch{/* Generic/unsupported names leave the previous display name. */}if(avatarUrl?.startsWith('https://'))this.data.avatar=avatarUrl;const persisted=this.save();this.loadImage();done(persisted?'已保存微信返回的展示资料；平台可能仅返回默认资料':'已更新本次展示；当前环境无法持久保存');});
  }catch{this.clearButton();done('微信资料按钮暂不可用，请使用手动填写');}
 }
 clearButton(){try{this.native?.destroy();}catch{/* Optional native UI cannot break the game loop. */}this.native=undefined;}
}
