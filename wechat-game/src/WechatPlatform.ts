import {AudioSystem} from '../../src/Audio';
import type {FrameRuntime,RendererHost} from '../../src/platform/Contracts';
import {context} from './CanvasAdapter';
import type {Wx,Canvas} from './Platform';
/** WeChat-only host. No DOM emulation, cookies or browser persistence are installed. */
export class WechatPlatform {
 private frame?: (time:number)=>void;
 private handle?:number;
 private running=false;
 private generation=0;
 private runtime?:FrameRuntime;
 constructor(private wx:Wx,private suppliedRuntime?:Partial<FrameRuntime>){}
 createCanvas(){const canvas=this.wx.createCanvas();context(canvas);return canvas;}
 createAudio(){return new AudioSystem(()=>{if(!this.wx.createWebAudioContext)throw Error('设备音频暂不可用');return this.wx.createWebAudioContext();});}
 rendererHost(cache:Canvas,viewport:RendererHost['viewport'],pixelRatio:()=>number):RendererHost{return {cache,viewport,pixelRatio,createSurface:()=>this.createCanvas()};}
 read(key:string){try{return this.wx.getStorageSync(key);}catch{return undefined;}}
 write(key:string,value:unknown){try{this.wx.setStorageSync(key,value);}catch{/* Storage may be disabled; gameplay continues in memory. */}}
 start(frame:(time:number)=>void){this.frame=frame;this.resume();}
 resume(){
  if(this.running||!this.frame)return;
  // requestAnimationFrame is supplied by the WeChat game runtime, not a browser window.
  if(!this.runtime){const runtime=this.suppliedRuntime??globalThis;const request=runtime.requestAnimationFrame,cancel=runtime.cancelAnimationFrame;
   if(typeof request!=='function')throw Error('当前微信基础库缺少帧调度接口，请升级微信');
   this.runtime={requestAnimationFrame:request.bind(runtime),cancelAnimationFrame:typeof cancel==='function'?cancel.bind(runtime):undefined};}
  this.running=true;const generation=++this.generation;
  const next=(now:number)=>{if(!this.running||generation!==this.generation)return;this.handle=undefined;this.frame?.(Number.isFinite(now)?now:Date.now());if(this.running&&generation===this.generation)this.handle=this.runtime!.requestAnimationFrame(next);};
  this.handle=this.runtime.requestAnimationFrame(next);
 }
 suspend(){this.running=false;this.generation++;if(this.handle!==undefined)this.runtime?.cancelAnimationFrame?.(this.handle);this.handle=undefined;}
 dispose(){this.suspend();this.frame=undefined;}
}
