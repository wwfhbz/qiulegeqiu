import type {GameHost} from './Contracts';
import {Renderer} from '../Renderer';
import {C} from '../GameConfig';
import {startFromPlayfield} from '../PlayfieldStart';
/** All browser-only Canvas/input/lifecycle APIs stay in this Web adapter. */
export function createWebHost(canvas:HTMLCanvasElement,canStart:()=>boolean=()=>true):GameHost {
 let currentRenderer:Renderer|undefined;
 return {get renderer(){return currentRenderer;},mount(game){
  const renderer=new Renderer(canvas,{cache:document.createElement('canvas'),createSurface:()=>document.createElement('canvas'),lowPerformance:()=>window.innerWidth<360||(navigator.hardwareConcurrency??8)<=4,viewport:()=>canvas.getBoundingClientRect(),pixelRatio:()=>window.devicePixelRatio||1,observe:resize=>{const observer=new ResizeObserver(resize);observer.observe(canvas);return ()=>observer.disconnect();}});
  currentRenderer=renderer;
  const move=(event:PointerEvent)=>{if(event.pointerType!=='mouse'&&!canvas.hasPointerCapture(event.pointerId))return;const rect=canvas.getBoundingClientRect();if(rect.width>0)game.physics.setTarget((event.clientX-rect.left)/rect.width*C.width);};
  const down=(event:PointerEvent)=>{
   if(event.isPrimary===false||(event.button!==undefined&&event.button!==0)||!canStart())return;
   game.audio.unlock();canvas.setPointerCapture(event.pointerId);move(event);
   startFromPlayfield(game);
  };
  let previous=0,active=true,handle=0;
  const visibility=()=>{previous=0;if(document.hidden){game.pause();game.audio.suspend();}};
  const frame=(now:number)=>{if(!active)return;const dt=previous?(now-previous)/1000:0;previous=now;game.update(dt);renderer.draw(game.physics,game.state==='ready',now);if(active)handle=window.requestAnimationFrame(frame);};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);document.addEventListener('visibilitychange',visibility);handle=window.requestAnimationFrame(frame);
  return ()=>{active=false;window.cancelAnimationFrame(handle);renderer.dispose();if(currentRenderer===renderer)currentRenderer=undefined;canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);document.removeEventListener('visibilitychange',visibility);};
 }};
}
export function createWebAudio(){return new AudioContext();}
