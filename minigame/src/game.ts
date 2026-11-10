import {MiniGameApp} from './App';
import type {Wx,Config} from './Platform';
declare const wx:Wx;
declare const __MINIGAME_CONFIG__:Config;
export const app=new MiniGameApp(wx,__MINIGAME_CONFIG__);
function frame(now:number){app.frame(now);requestAnimationFrame(frame);}
requestAnimationFrame(frame);
