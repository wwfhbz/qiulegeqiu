import type {TrailSkin} from '../src/Renderer';
/** Ball trail skins (cosmetic only). Web: free to pick. WeChat: each unlocked once by a rewarded video. */
export const TRAIL_SKINS:readonly {id:Exclude<TrailSkin,'none'>;name:string;desc:string}[]=[
 {id:'comet',name:'彗星',desc:'金蓝色尾焰'},
 {id:'heart',name:'爱心',desc:'粉色爱心一路飘'},
 {id:'rainbow',name:'彩虹',desc:'七彩光带'},
];
export function isTrailSkin(value:unknown):value is TrailSkin{return value==='none'||TRAIL_SKINS.some(s=>s.id===value);}
