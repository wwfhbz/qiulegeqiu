/**
 * Campaign 1.11 level layouts (pure geometry, no state). Each level paints the bowl with brick kinds as a function
 * of the cell centre in arena units: u to the right, v downwards, the arena radius = 1, origin at the arena centre.
 * The block grid later asks `cellKind` for every cell that fits the bowl; the same function draws the previews.
 */
export const enum Cell { Empty=0, Normal=1, Hard2=2, Hard3=3, Steel=4, Bomb=5 }
/** Boss: a core with hit points and rotating steel shield rings (each with one or two openings). */
export interface BossShield {readonly radius:number;readonly width:number;readonly gaps:number;readonly gapDeg:number;readonly speed:number}
export interface BossConfig {readonly name:string;readonly u:number;readonly v:number;readonly radius:number;readonly hp:number;readonly shields:readonly BossShield[]}
export interface Pattern {readonly name:string;readonly shape:string;readonly cell:(u:number,v:number)=>Cell;readonly boss?:BossConfig}

const TAU=Math.PI*2;
const len=(u:number,v:number)=>Math.hypot(u,v);
/** Angle measured clockwise from straight up, 0…2π. */
const bearing=(u:number,v:number)=>(Math.atan2(u,-v)+TAU)%TAU;
/** Distance from p to segment a–b. */
function segDist(px:number,py:number,ax:number,ay:number,bx:number,by:number){const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(px-ax-t*dx,py-ay-t*dy);}
/** Five-pointed star polygon (points up), outer radius R, inner r. */
function starPolygon(cu:number,cv:number,R:number,r:number){const pts:[number,number][]=[];for(let i=0;i<10;i++){const a=i*Math.PI/5,rr=i%2?r:R;pts.push([cu+Math.sin(a)*rr,cv-Math.cos(a)*rr]);}return pts;}
function inPolygon(u:number,v:number,pts:readonly [number,number][]){let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,yi]=pts[i],[xj,yj]=pts[j];if((yi>v)!==(yj>v)&&u<(xj-xi)*(v-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
function polygonEdgeDist(u:number,v:number,pts:readonly [number,number][]){let d=Infinity;for(let i=0,j=pts.length-1;i<pts.length;j=i++)d=Math.min(d,segDist(u,v,pts[j][0],pts[j][1],pts[i][0],pts[i][1]));return d;}
/** True when the bearing is inside one of `count` evenly spaced openings of `deg` degrees, the first centred at `offset`. */
function inGap(angle:number,count:number,deg:number,offset=0){const span=TAU/count,half=deg*Math.PI/360;const a=((angle-offset)%span+span)%span;return a<half||a>span-half;}

const STAR=starPolygon(0,-.02,.93,.43);
const PATTERNS:readonly Pattern[]=[
 {name:'初试身手',shape:'圆盘',cell:()=>Cell.Normal},
 {name:'渐入佳境',shape:'圆盘',cell:()=>Cell.Normal},
 // From level 3 on, every picture sits on a full bowl of normal bricks, so the levels keep their volume.
 {name:'星光',shape:'五角星',cell:(u,v)=>polygonEdgeDist(u,v,STAR)<.06?Cell.Hard2:Cell.Normal},
 {name:'微笑',shape:'笑脸',cell:(u,v)=>{const d=len(u,v+.05);if(d>=.73&&d<=.8)return Cell.Hard2;
  if(len(u-.29,v+.27)<.12||len(u+.29,v+.27)<.12)return Cell.Bomb;
  const m=len(u,v+.12);if(m>.38&&m<.5&&v>.1)return Cell.Bomb;return Cell.Normal;}},
 {name:'城堡',shape:'圆环',cell:(u,v)=>{const d=len(u,v),a=bearing(u,v);
  if(d>.58&&d<.67)return inGap(a,4,22,Math.PI/4)?Cell.Empty:Cell.Steel;
  return d<.26?Cell.Hard2:Cell.Normal;}},
 {name:'双子',shape:'双圆',cell:(u,v)=>{for(const cu of [-.45,.45]){const d=len(u-cu,v+.06);if(d<.43)return d>.35?Cell.Hard3:d<.14?Cell.Hard2:Cell.Normal;}
  // A narrow open channel between the twins; everything else is normal bricks.
  return Math.abs(u)<.035&&v>-.5&&v<.4?Cell.Empty:Cell.Normal;}},
 {name:'漩涡',shape:'螺旋',cell:(u,v)=>{const d=len(u,v);if(d<.12)return Cell.Hard2;
  // Archimedean spiral wall r = .14 + .26·θ/2π (about 2.9 turns out to the rim), drawn as a band.
  const a=bearing(u,v);let near=Infinity;for(let k=0;k<4;k++){const r=.14+.26*(a+k*TAU)/TAU;near=Math.min(near,Math.abs(d-r));}
  return near<.035?Cell.Steel:near<.07?Cell.Hard2:Cell.Normal;}},
 {name:'守门巨像',shape:'Boss',cell:(u,v)=>{const d=len(u,v+.08);if(d<.42)return Cell.Empty;return d<.6?Cell.Hard2:Cell.Normal;},
  boss:{name:'守门巨像',u:0,v:-.08,radius:.15,hp:40,shields:[{radius:.32,width:.07,gaps:1,gapDeg:70,speed:.6}]}},
 {name:'连环',shape:'棋盘',cell:(u,v)=>{const t=.2,i=Math.floor((u+1)/t),j=Math.floor((v+1)/t);
  const cu=-1+(i+.5)*t,cv=-1+(j+.5)*t;
  if((i+j)%2===0)return Math.max(Math.abs(u-cu),Math.abs(v-cv))<.07?Cell.Hard2:Cell.Normal;return len(u-cu,v-cv)<.045?Cell.Bomb:Cell.Normal;}},
 {name:'迷宫',shape:'迷宫',cell:(u,v)=>{const d=len(u,v),a=bearing(u,v);
  // Three steel rings, each with two openings that do not line up, plus short radial walls between them.
  const rings:[number,number][]=[[.3,0],[.55,Math.PI/2],[.8,Math.PI/4]];
  for(const [r,off] of rings)if(Math.abs(d-r)<.03)return inGap(a,2,26,off)?Cell.Normal:Cell.Steel;
  for(const [r0,r1,deg] of [[.3,.55,60],[.3,.55,240],[.55,.8,150],[.55,.8,330]] as const){const w=deg*Math.PI/180;if(d>r0&&d<r1&&Math.abs(Math.sin(a-w))*d<.03&&Math.cos(a-w)>0)return Cell.Steel;}
  return d<.55?Cell.Hard2:Cell.Normal;}},
 {name:'堡垒',shape:'三层城',cell:(u,v)=>{const d=len(u,v+.04);if(d>.9)return Cell.Empty;if(d>.78)return Cell.Hard3;if(d>.68)return Cell.Normal;
  if(d>.56){const a=bearing(u,v+.04);return Math.floor(a/(TAU/24))%2===0?Cell.Steel:Cell.Normal;}
  if(d<.2)return Cell.Bomb;return d<.38?Cell.Hard2:Cell.Normal;}},
 {name:'星核',shape:'最终Boss',cell:(u,v)=>{const d=len(u,v+.08);if(d>.9)return Cell.Empty;if(d<.56)return Cell.Empty;return d<.7?Cell.Hard3:Cell.Hard2;},
  boss:{name:'星核',u:0,v:-.08,radius:.17,hp:80,shields:[{radius:.3,width:.06,gaps:2,gapDeg:40,speed:.7},{radius:.45,width:.06,gaps:2,gapDeg:34,speed:-.5}]}},
];
export const CAMPAIGN_PATTERNS=PATTERNS;
export const CELL_HP:Record<Cell,number>={[Cell.Empty]:0,[Cell.Normal]:1,[Cell.Hard2]:2,[Cell.Hard3]:3,[Cell.Steel]:Infinity,[Cell.Bomb]:1};
