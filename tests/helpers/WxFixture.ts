import type {Wx,TouchEvent,Canvas} from '../../wechat-game/src/Platform';
export function wxFixture(width=375,height=812,dpr=3){
 const texts:string[]=[];
 const events:Record<string,(e?:unknown)=>void>={},storage=new Map<string,unknown>(),requests:Parameters<Wx['request']>[0][]=[];
 const ctx=new Proxy({fillText:(s:string)=>texts.push(s),measureText:(s:string)=>({width:[...s].length*8}),roundRect:undefined},{get:(t,k)=>k in t?t[k as keyof typeof t]:()=>{},set:(t,k,v)=>{Reflect.set(t,k,v);return true;}}) as unknown as CanvasRenderingContext2D;
 const wx:Wx={createCanvas:()=>({width:0,height:0,getContext:()=>ctx}),getWindowInfo:()=>({windowWidth:width,windowHeight:height,pixelRatio:dpr,safeArea:{top:44,bottom:height-34,left:0,right:width}}),getMenuButtonBoundingClientRect:()=>({bottom:80,left:width-90}),
 onTouchStart:f=>{events.down=f as never;},onTouchMove:f=>{events.move=f as never;},onTouchEnd:f=>{events.up=f as never;},onTouchCancel:f=>{events.cancel=f as never;},onHide:f=>{events.hide=f;},onShow:f=>{events.show=f;},onWindowResize:f=>{events.resize=f;},
 login:o=>o.fail(),request:o=>{requests.push(o);o.fail();},getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>{storage.set(k,v);},removeStorageSync:k=>{storage.delete(k);},showModal:o=>o.success?.({confirm:false}),showActionSheet:()=>{},showToast:()=>{},showShareMenu:()=>{},onShareAppMessage:()=>{},shareAppMessage:()=>{}};
 const touch=(identifier:number,x:number,y:number):TouchEvent=>({touches:[{identifier,clientX:x,clientY:y}],changedTouches:[{identifier,clientX:x,clientY:y}]});
 return {wx,events,storage,requests,touch,texts};
}
