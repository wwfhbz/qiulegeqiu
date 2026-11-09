import { C } from './GameConfig';
export type PowerKind = 'triple' | 'wide';
export class PowerUps {
  readonly items = Array.from({length:C.power.maxDrops},()=>({x:0,y:0,alive:false,kind:'triple' as PowerKind}));
  reset(){for(const item of this.items)item.alive=false;}
  spawn(x:number,y:number,kind:PowerKind){const item=this.items.find(p=>!p.alive);if(item){item.x=x;item.y=y;item.kind=kind;item.alive=true;}}
  update(dt:number,paddleX:number,width:number,collect:(kind:PowerKind)=>void){
    for(const p of this.items){if(!p.alive)continue;p.y+=C.power.fallSpeed*dt;
      if(Math.abs(p.y-C.paddle.y)<=C.power.radius+C.paddle.height/2 && Math.abs(p.x-paddleX)<=width/2+C.power.radius){p.alive=false;collect(p.kind);}
      else if(p.y>C.arena.y+C.arena.radius+C.power.radius)p.alive=false;
    }
  }
}
