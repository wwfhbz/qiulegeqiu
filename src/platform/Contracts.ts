import type {Physics} from '../Physics';
import type {Game} from '../Game';
/** Structural Canvas contract; DOM declarations are compile-time types, never a runtime shim. */
export interface CanvasSurface {width:number;height:number;getContext(kind:'2d'):CanvasRenderingContext2D|null}
export interface RendererHost {cache:CanvasSurface;viewport():{width:number;height:number};pixelRatio():number;createSurface?():CanvasSurface;lowPerformance?():boolean;observe?(resize:()=>void):void|(()=>void)}
export interface GameHost {readonly renderer?:{draw(physics:Physics,ready:boolean):void};mount(game:Game):()=>void}
export interface FrameRuntime {requestAnimationFrame(callback:(time:number)=>void):number;cancelAnimationFrame?(handle:number):void}
