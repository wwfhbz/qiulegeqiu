import { C } from './GameConfig';
import type { PowerKind } from './PowerRules';
export type { PowerKind } from './PowerRules';
export class PowerUps {
  readonly items = Array.from({length:C.power.maxDrops},()=>({x:0,y:0,alive:false,dropId:0,kind:'triple' as PowerKind}));
  private sequence=0;
  reset(){this.sequence=0;for(const item of this.items)item.alive=false;}
  spawn(x:number,y:number,kind:PowerKind){const dropId=++this.sequence;const item=this.items.find(p=>!p.alive);if(item){item.dropId=dropId;item.x=x;item.y=y;item.kind=kind;item.alive=true;}}
  update(dt:number,paddleX:number,width:number,collect:(kind:PowerKind,dropId:number)=>void){
    for(const p of this.items){if(!p.alive)continue;p.y+=C.power.fallSpeed*dt;
      if(Math.abs(p.y-C.paddle.y)<=C.power.radius+C.paddle.height/2 && Math.abs(p.x-paddleX)<=width/2+C.power.radius){p.alive=false;collect(p.kind,p.dropId);}
      else if(p.y>C.height+C.power.radius)p.alive=false;
    }
  }
}
