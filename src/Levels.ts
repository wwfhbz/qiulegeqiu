export type ObstacleKind = 'fixed'|'moving'|'rotating';
export interface ObstacleConfig {
  readonly id:string;readonly kind:ObstacleKind;readonly x:number;readonly y:number;readonly length:number;readonly thickness:number;readonly angle:number;
  readonly amplitude?:number;readonly speed?:number;readonly phase?:number;readonly angularSpeed?:number;
}
export interface LevelConfig {readonly number:number;readonly name:string;readonly speedScale:number;readonly obstacles?:readonly ObstacleConfig[]}
const fixed=(id:string,x:number,y:number,length:number,angle=0):ObstacleConfig=>({id,kind:'fixed',x,y,length,thickness:10,angle});
const moving=(id:string,x:number,y:number,length:number,amplitude:number,phase=0):ObstacleConfig=>({id,kind:'moving',x,y,length,thickness:10,angle:0,amplitude,speed:.75,phase});
const rotating=(id:string,x:number,y:number,length:number):ObstacleConfig=>({id,kind:'rotating',x,y,length,thickness:10,angle:0,angularSpeed:.65});
/** Obstacles occupy the lower corridor; the block generator reserves their entire swept footprint. */
export const LEVELS:readonly LevelConfig[]=[
 {number:1,name:'初试身手',speedScale:1,obstacles:[]},
 {number:2,name:'横梁阻击',speedScale:1,obstacles:[fixed('横梁',400,748,240)]},
 {number:3,name:'双重防线',speedScale:1.05,obstacles:[fixed('上防线',330,734,190),fixed('下防线',470,785,190)]},
 {number:4,name:'移动封锁',speedScale:1.05,obstacles:[moving('封锁梁',400,752,160,125)]},
 {number:5,name:'十字迷阵',speedScale:1.1,obstacles:[fixed('横向迷阵',400,746,200),fixed('纵向迷阵',400,765,100,Math.PI/2)]},
 {number:6,name:'双轨夹击',speedScale:1.1,obstacles:[moving('上轨',400,734,145,135),moving('下轨',400,785,145,95,Math.PI)]},
 {number:7,name:'旋转屏障',speedScale:1.15,obstacles:[rotating('旋转屏障',400,750,150)]},
 {number:8,name:'机关走廊',speedScale:1.15,obstacles:[fixed('左走廊',300,735,120),fixed('右走廊',490,790,120),moving('巡逻梁',400,760,110,95)]},
 {number:9,name:'动态迷宫',speedScale:1.2,obstacles:[fixed('迷宫定梁',290,734,110),moving('迷宫动梁',325,785,100,50),rotating('迷宫转梁',500,746,92)]},
 {number:10,name:'终极突破',speedScale:1.2,obstacles:[fixed('终极横梁',280,728,105),fixed('终极纵梁',410,762,74,Math.PI/2),moving('终极动梁',300,775,100,35),rotating('终极转梁',520,740,96)]},
];
