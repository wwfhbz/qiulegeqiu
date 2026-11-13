import type {GameHost} from './Contracts';
import {Renderer} from '../Renderer';
import {C} from '../GameConfig';
import {startFromPlayfield} from '../PlayfieldStart';
import {HapticTracker} from '../Haptics';
/** All browser-only Canvas/input/lifecycle APIs stay in this Web adapter. */
/** `steer`: extra surfaces (the touch strip under the arena) that steer the paddle like the canvas does. */
export function createWebHost(canvas:HTMLCanvasElement,canStart:()=>boolean=()=>true,steer:readonly HTMLElement[]=[]):GameHost {
 let currentRenderer:Renderer|undefined;
 return {get renderer(){return currentRenderer;},mount(game){
  const renderer=new Renderer(canvas,{cache:document.createElement('canvas'),createSurface:()=>document.createElement('canvas'),// Core count is not used: iOS Safari reports 2–4 cores on every iPhone, which turned off glows and
  // effects for all iPhone players. The renderer measures real frame times and degrades on its own.
  lowPerformance:()=>window.innerWidth<360,viewport:()=>canvas.getBoundingClientRect(),pixelRatio:()=>window.devicePixelRatio||1,observe:resize=>{const observer=new ResizeObserver(resize);observer.observe(canvas);return ()=>observer.disconnect();}});
  currentRenderer=renderer;
  const surfaces=[canvas,...steer];
  // Each surface gets its own handlers; x is always mapped through the canvas so the strip below steers 1:1.
  const moveOn=(target:HTMLElement)=>(event:PointerEvent)=>{if(event.pointerType!=='mouse'&&!target.hasPointerCapture(event.pointerId))return;const rect=canvas.getBoundingClientRect();if(rect.width>0)game.physics.setTarget((event.clientX-rect.left)/rect.width*C.width);};
  const downOn=(target:HTMLElement,move:(event:PointerEvent)=>void)=>(event:PointerEvent)=>{
   if(event.isPrimary===false||(event.button!==undefined&&event.button!==0)||!canStart())return;
   game.audio.unlock();target.setPointerCapture(event.pointerId);move(event);
   startFromPlayfield(game);
  };
  // Mobile Safari only starts audio from touchend/click, so unlock on every gesture anywhere on the page.
  const gesture=()=>game.audio.unlock();const gestures=['touchend','pointerup','click','keydown'] as const;
  for(const type of gestures)document.addEventListener(type,gesture,{capture:true,passive:true});
  // Same vibration moments as the WeChat build, where the browser supports it (Android Chrome).
  const haptics=new HapticTracker(),vibrate=(ms:number)=>{try{navigator.vibrate?.(ms);}catch{/* Optional API. */}};
  let previous=0,active=true,handle=0;
  const visibility=()=>{previous=0;if(document.hidden){game.pause();game.audio.suspend();}};
  const frame=(now:number)=>{if(!active)return;const dt=previous?(now-previous)/1000:0;previous=now;game.update(dt);const buzz=haptics.next(game.physics.effects,game.state!=='running',now);if(buzz&&!game.audio.muted)vibrate(buzz==='heavy'?40:25);renderer.draw(game.physics,game.state==='ready',now);if(active)handle=window.requestAnimationFrame(frame);};
  const handlers=surfaces.map(surface=>{const move=moveOn(surface);return {surface,move,down:downOn(surface,move)};});
  for(const {surface,move,down} of handlers){surface.addEventListener('pointerdown',down);surface.addEventListener('pointermove',move);}document.addEventListener('visibilitychange',visibility);handle=window.requestAnimationFrame(frame);
  return ()=>{active=false;window.cancelAnimationFrame(handle);renderer.dispose();if(currentRenderer===renderer)currentRenderer=undefined;for(const {surface,move,down} of handlers){surface.removeEventListener('pointerdown',down);surface.removeEventListener('pointermove',move);}document.removeEventListener('visibilitychange',visibility);for(const type of gestures)document.removeEventListener(type,gesture,{capture:true});};
 }};
}
/** Web Audio with the prefixed fallback still needed by older iOS Safari. */
export function createWebAudio(){
 // iOS 17+: play through the silent switch like a game, instead of being muted as "ambient" sound.
 try{const session=(navigator as Navigator&{audioSession?:{type:string}}).audioSession;if(session)session.type='playback';}catch{/* Optional API. */}
 const Context=window.AudioContext??(window as Window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
 if(!Context)throw Error('当前浏览器不支持网页音频');
 return new Context();
}
