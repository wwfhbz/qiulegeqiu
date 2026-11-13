export interface Touch {identifier:number;clientX?:number;clientY?:number;x?:number;y?:number;pageX?:number;pageY?:number}
export interface TouchEvent {touches:Touch[];changedTouches:Touch[]}
export interface Canvas {
 width:number;height:number;getContext(kind:'2d'):CanvasRenderingContext2D;
 toTempFilePath?(options:{success:(r:{tempFilePath:string})=>void;fail?:()=>void}):void;
}
export interface Wx {
 createCanvas():Canvas;
 createImage?():{src:string;onload?:()=>void;onerror?:()=>void};
 getDeviceInfo?():{benchmarkLevel?:number};
 getWindowInfo():{windowWidth:number;windowHeight:number;pixelRatio:number;safeArea?:{top:number;bottom:number;left:number;right:number}};
 getMenuButtonBoundingClientRect?():{bottom:number;left:number;top?:number};
 onTouchStart(fn:(e:TouchEvent)=>void):void;onTouchMove(fn:(e:TouchEvent)=>void):void;onTouchEnd(fn:(e:TouchEvent)=>void):void;onTouchCancel(fn:(e:TouchEvent)=>void):void;
 onHide(fn:()=>void):void;onShow(fn:()=>void):void;onWindowResize?(fn:()=>void):void;
 login(options:{success:(r:{code:string})=>void;fail:()=>void}):void;
 request(options:{url:string;method:'GET'|'POST';header:Record<string,string>;data?:unknown;timeout:number;success:(r:{statusCode:number;data:unknown})=>void;fail:()=>void}):void;
 getStorageSync(key:string):unknown;setStorageSync(key:string,value:unknown):void;removeStorageSync(key:string):void;
 showModal(options:{title:string;content:string;showCancel?:boolean;confirmText?:string;cancelText?:string;editable?:boolean;placeholderText?:string;success?:(r:{confirm:boolean;content?:string})=>void;fail?:()=>void}):void;
 showActionSheet(options:{itemList:string[];success:(r:{tapIndex:number})=>void;fail?:()=>void}):void;
 showToast(options:{title:string;icon:'none'}):void;
 showShareMenu(options:{menus:string[]}):void;
 onShareAppMessage(fn:()=>{title:string;imageUrl?:string;query?:string}):void;
 shareAppMessage(options:{title:string;imageUrl?:string;query?:string}):void;
 createWebAudioContext?():AudioContext;
 vibrateShort?(options:{type?:'heavy'|'medium'|'light';fail?:()=>void}):void;
 requirePrivacyAuthorize?(options:{success:()=>void;fail:()=>void}):void;
}
export interface Config {apiBase:string;development:boolean}
export const storageKey='qiulegeqiu:wechat-session:v1';
