import type {Game} from './Game';
/** A field gesture may only launch an already waiting round, never resume/reset/advance. */
export function startFromPlayfield(game:Game,activate:()=>void=()=>game.start()):boolean {
  if(game.state!=='ready'||game.lives<=0)return false;
  activate();return true;
}
export const START_HINT='点击任意位置开始游戏';
export const START_HINT_FADE_MS=250;
/** Presentation clock only; never changes simulation time or journal events. */
export class StartHint {
  private wasReady=false;
  private fadeAt:number|undefined;
  alpha(ready:boolean,now:number){
    if(ready){this.wasReady=true;this.fadeAt=undefined;return .7;}
    if(this.wasReady){this.wasReady=false;this.fadeAt=now;}
    return this.fadeAt===undefined?0:.7*Math.max(0,1-(now-this.fadeAt)/START_HINT_FADE_MS);
  }
}
