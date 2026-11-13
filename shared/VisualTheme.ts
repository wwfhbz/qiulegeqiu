/** Presentation only. Never import this module from physics, scoring or the verifier. */
export const OCEAN={
 name:'深海蓝·现代街机',
 colors:{background:'#0A1424',arena:'#112640',gradientEnd:'#1B3A5E',panel:'#16304D',border:'#3E6A92',line:'#2A4A6C',text:'#F4F9FF',secondary:'#B5CCE3',muted:'#7F9AB6',number:'#FFFFFF',positive:'#4CD9A0',warning:'#FFB547',accent:'#4FE3FF',heart:'#FF6B81',danger:'#FF4D6A'},
 alpha:{veil:'rgba(16,29,45,.74)',backdrop:'rgba(16,29,45,.88)',brickHighlight:'rgba(255,255,255,.22)',brickShadow:'rgba(16,29,45,.20)',lineHighlight:'rgba(244,247,251,.28)',badgeEdge:'rgba(244,247,251,.35)',death:'rgba(233,130,117,.22)',shadowSoft:'rgba(0,0,0,.12)',shadowPanel:'rgba(0,0,0,.25)'},
 /** Six equal-height bands across the 576px brick region, whatever the brick size. */
 brickBands:{height:96,count:6},
 /** Each level's own three-anchor gradient (top → middle → bottom); levels 7–12 reuse 1–6. */
 levelPalettes:[
  ['#56CCF2','#2EC4B6','#8BE37A'],
  ['#2EC4B6','#FFD166','#FF9F5A'],
  ['#FFB547','#FF6B81','#C77DFF'],
  ['#9B8CFF','#5B8CFF','#3FD0E8'],
  ['#4CD9A0','#3FA9F5','#9B8CFF'],
  ['#FF9F5A','#FF5C8A','#9B6BFF'],
 ],
 bricks:['#3FA9F5','#2EC4B6','#FFB547','#FF6B81','#9B8CFF','#4CD9A0'],
 ball:{body:'#FFFFFF',edge:'#BFE9FF',highlight:'#FFFFFF',trail:'#7FE8FF',glow:'#4FE3FF'},
 paddle:{body:'#EAF7FF',edge:'#2F7FB8',accent:'#4FE3FF',shadow:'#06101D',wide:'#2EC4B6'},
 powers:{triple:{color:'#FFB547',label:'×3',good:true},wide:{color:'#2EC4B6',label:'↔',good:true},halve:{color:'#FF4D6A',label:'÷2',good:false},life:{color:'#4CD9A0',label:'♥',good:true},bomb:{color:'#9B8CFF',label:'✸',good:true},plus3:{color:'#FFB547',label:'+3',good:true},pierce:{color:'#4FD8F0',label:'穿',good:true},fire:{color:'#FF7A45',label:'火',good:true},lightning:{color:'#F5C518',label:'电',good:true}},
 powerBadge:{width:30,height:30,radius:15,cellWidth:44,cellHeight:44,pixelRatio:2},
 rank:{gold:'#C6AB74',silver:'#A6BECE',bronze:'#C49C84',fourth:'#81A9C7',fifth:'#7497B4',normal:'#8499AF',mine:'#294D62'},
 fonts:{body:'"PingFang SC", "Microsoft YaHei", sans-serif',numbers:'Arial, "PingFang SC", sans-serif'},
 motion:{particleSeconds:.35,sourceParticleSeconds:.35,flashSeconds:.12,trailLength:16,shakeSeconds:.32,popupSeconds:.9,lastBricks:24},
} as const;
export const OCEAN_CSS:Record<string,string>=Object.fromEntries<string>([...Object.entries(OCEAN.colors).map(([key,value])=>['--o-'+key,value] as const),...Object.entries(OCEAN.rank).map(([key,value])=>['--o-rank-'+key,value] as const),...Object.entries(OCEAN.alpha).map(([key,value])=>['--o-alpha-'+key,value] as const),['--o-font-body',OCEAN.fonts.body] as const,['--o-font-numbers',OCEAN.fonts.numbers] as const]);
/** Band slot 0–5 from the brick's real grid row only: never its column, seed or what has been destroyed. */
export function brickColorIndex(row:number,step=16){return Math.max(0,Math.min(OCEAN.brickBands.count-1,Math.floor(row*step/OCEAN.brickBands.height)));}
const mix=(a:string,b:string,t:number)=>{const x=parseInt(a.slice(1),16),y=parseInt(b.slice(1),16);return '#'+[16,8,0].map(s=>Math.round((x>>s&255)+((y>>s&255)-(x>>s&255))*t).toString(16).padStart(2,'0')).join('').toUpperCase();};
const bandCache=new Map<number,readonly string[]>();
/** Six band colours for a level, interpolated through its three anchors. */
export function levelBandColors(level=1):readonly string[]{
 const key=(Math.max(1,Math.floor(level))-1)%OCEAN.levelPalettes.length;let colors=bandCache.get(key);
 if(!colors){const [top,middle,bottom]=OCEAN.levelPalettes[key],n=OCEAN.brickBands.count;colors=Object.freeze(Array.from({length:n},(_,i)=>{const t=i/(n-1);return t<=.5?mix(top,middle,t*2):mix(middle,bottom,(t-.5)*2);}));bandCache.set(key,colors);}
 return colors;
}
export function brickColor(row:number,step=16,level=1){return levelBandColors(level)[brickColorIndex(row,step)];}
/** Endless: colour follows the brick's world row (it moves with the brick): 8 rows per band, 48 per palette. */
export function endlessBrickColor(worldRow:number){const w=Math.max(0,Math.floor(worldRow));return levelBandColors(1+Math.floor(w/48)%OCEAN.levelPalettes.length)[Math.floor(w/8)%OCEAN.brickBands.count];}
export function rankColor(rank:number){return rank===1?OCEAN.rank.gold:rank===2?OCEAN.rank.silver:rank===3?OCEAN.rank.bronze:rank===4?OCEAN.rank.fourth:rank===5?OCEAN.rank.fifth:OCEAN.rank.normal;}
export function visualBudget(balls:number,lowDevice=false){
 const tier=balls>50?2:balls>20?1:0;
 return {tier,trailLength:tier===2?0:tier===1?7:OCEAN.motion.trailLength,trailAlpha:tier===1?.10:.22,particles:lowDevice?12:tier===2?16:tier===1?32:64,highlights:!lowDevice&&tier<2};
}
