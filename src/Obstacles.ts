import { C } from './GameConfig';
import type { Ball } from './Physics';
import type { ObstacleConfig } from './Levels';
import { obstaclePose,type Pose } from './ObstacleGeometry';
export interface Obstacle extends Pose {config:ObstacleConfig;destroyed:boolean}
/** Capsule colliders share their exact segment/width with Canvas drawing. */
export class Obstacles {
  items:Obstacle[]=[];time=0;
  private scratch:Pose={x:0,y:0,angle:0,vx:0,vy:0,omega:0};
  load(configs:readonly ObstacleConfig[]){this.time=0;this.items=configs.map(config=>({config,destroyed:false,x:0,y:0,angle:0,vx:0,vy:0,omega:0}));this.sync();}
  sync(){for(const item of this.items)obstaclePose(item.config,this.time,item);}
  collide(ball:Ball,time=this.time){let touched=false;
    for(const item of this.items){if(item.destroyed)continue;const pose=obstaclePose(item.config,time,this.scratch),c=item.config;
      const cos=Math.cos(pose.angle),sin=Math.sin(pose.angle),half=(c.length-c.thickness)/2;
      const dx=ball.x-pose.x,dy=ball.y-pose.y,projection=Math.max(-half,Math.min(half,dx*cos+dy*sin));
      const qx=pose.x+projection*cos,qy=pose.y+projection*sin;
      let nx=ball.x-qx,ny=ball.y-qy,d=Math.hypot(nx,ny);const contact=ball.radius+c.thickness/2;if(d>=contact)continue;
      const surfaceVx=pose.vx-pose.omega*(qy-pose.y),surfaceVy=pose.vy+pose.omega*(qx-pose.x);
      if(d<1e-8){nx=-sin;ny=cos;if((ball.vx-surfaceVx)*nx+(ball.vy-surfaceVy)*ny>0){nx=-nx;ny=-ny;}}else{nx/=d;ny/=d;}
      ball.x+=nx*(contact-d+.02);ball.y+=ny*(contact-d+.02);
      const dot=(ball.vx-surfaceVx)*nx+(ball.vy-surfaceVy)*ny;if(dot<0){ball.vx-=2*dot*nx;ball.vy-=2*dot*ny;}
      const speed=Math.hypot(ball.vx,ball.vy);if(speed>C.ball.maxSpeed){ball.vx*=C.ball.maxSpeed/speed;ball.vy*=C.ball.maxSpeed/speed;}
      touched=true;
    }return touched;
  }
  overlaps(ball:Ball){for(const item of this.items){if(item.destroyed)continue;const pose=obstaclePose(item.config,this.time,this.scratch),cos=Math.cos(pose.angle),sin=Math.sin(pose.angle),half=(item.config.length-item.config.thickness)/2,p=Math.max(-half,Math.min(half,(ball.x-pose.x)*cos+(ball.y-pose.y)*sin));if(Math.hypot(ball.x-pose.x-p*cos,ball.y-pose.y-p*sin)<ball.radius+item.config.thickness/2)return true;}return false;}
  destroyNearest(x:number,y:number){let target:Obstacle|undefined,best=Infinity;this.sync();for(const item of this.items){if(item.destroyed)continue;const half=(item.config.length-item.config.thickness)/2,cos=Math.cos(item.angle),sin=Math.sin(item.angle),p=Math.max(-half,Math.min(half,(x-item.x)*cos+(y-item.y)*sin));const distance=Math.hypot(x-item.x-p*cos,y-item.y-p*sin)-item.config.thickness/2;if(distance<best-1e-8||Math.abs(distance-best)<1e-8&&item.config.id<(target?.config.id??'')){best=distance;target=item;}}
    if(target)target.destroyed=true;return target;
  }
}
