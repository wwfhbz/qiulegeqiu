import type {TrailSkin,PaddleSkin} from '../src/Renderer';
/** Ball trail skins (cosmetic only). Web: free to pick. WeChat: each unlocked once by a rewarded video. */
export const TRAIL_SKINS:readonly {id:Exclude<TrailSkin,'none'>;name:string;desc:string}[]=[
 {id:'comet',name:'流星',desc:'流星相随·接球流星雨'},
 {id:'heart',name:'爱心',desc:'爱心相随·接球爱心雨'},
 {id:'rainbow',name:'花瓣',desc:'小花相随·接球花瓣雨'},
];
export function isTrailSkin(value:unknown):value is TrailSkin{return value==='none'||TRAIL_SKINS.some(s=>s.id===value);}
/** Permanent paddle skins (cosmetic only, same hit box). Web: free. WeChat: each unlocked once by a rewarded video. */
export const PADDLE_SKINS:readonly {id:Exclude<PaddleSkin,'default'>;name:string;desc:string}[]=[
 {id:'neon',name:'霓虹光剑',desc:'粉紫到青色的能量光刃'},
 {id:'flame',name:'烈焰燃烧',desc:'熊熊火焰，火星飞溅'},
 {id:'gold',name:'黄金荣耀',desc:'金色宝石，扫光闪耀'},
];
export function isPaddleSkin(value:unknown):value is PaddleSkin{return value==='default'||PADDLE_SKINS.some(s=>s.id===value);}
/** V2.9 shipped an ice-crystal paddle that became the flame paddle: keep anyone's unlock and choice. */
export function migratePaddle(value:unknown){return value==='crystal'?'flame':value;}
