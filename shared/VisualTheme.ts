/** Presentation only. Never import this module from physics, scoring or the verifier. */
export const OCEAN={
 name:'深海蓝·现代街机',
 colors:{background:'#0A1424',arena:'#112640',gradientEnd:'#1B3A5E',panel:'#16304D',border:'#3E6A92',line:'#2A4A6C',text:'#F4F9FF',secondary:'#B5CCE3',muted:'#7F9AB6',number:'#FFFFFF',positive:'#4CD9A0',warning:'#FFB547',accent:'#4FE3FF',heart:'#FF6B81',danger:'#FF4D6A'},
 alpha:{veil:'rgba(16,29,45,.74)',backdrop:'rgba(16,29,45,.88)',brickHighlight:'rgba(255,255,255,.22)',brickShadow:'rgba(16,29,45,.20)',lineHighlight:'rgba(244,247,251,.28)',badgeEdge:'rgba(244,247,251,.35)',death:'rgba(233,130,117,.22)',shadowSoft:'rgba(0,0,0,.12)',shadowPanel:'rgba(0,0,0,.25)'},
 brickBands:{rows:10,order:[0,1,5,2,3,4]},
 bricks:['#3FA9F5','#2EC4B6','#FFB547','#FF6B81','#9B8CFF','#4CD9A0'],
 ball:{body:'#FFFFFF',edge:'#BFE9FF',highlight:'#FFFFFF',trail:'#7FE8FF',glow:'#4FE3FF'},
 paddle:{body:'#EAF7FF',edge:'#2F7FB8',accent:'#4FE3FF',shadow:'#06101D',wide:'#2EC4B6'},
 powers:{triple:{color:'#FFB547',label:'×3',good:true},wide:{color:'#2EC4B6',label:'↔',good:true},halve:{color:'#FF4D6A',label:'÷2',good:false},life:{color:'#4CD9A0',label:'♥',good:true},bomb:{color:'#9B8CFF',label:'✸',good:true}},
 powerBadge:{width:30,height:30,radius:15,cellWidth:44,cellHeight:44,pixelRatio:2},
 rank:{gold:'#C6AB74',silver:'#A6BECE',bronze:'#C49C84',fourth:'#81A9C7',fifth:'#7497B4',normal:'#8499AF',mine:'#294D62'},
 fonts:{body:'"PingFang SC", "Microsoft YaHei", sans-serif',numbers:'Arial, "PingFang SC", sans-serif'},
 motion:{particleSeconds:.35,sourceParticleSeconds:.35,flashSeconds:.12,trailLength:16,shakeSeconds:.32,popupSeconds:.9,lastBricks:24},
} as const;
export const OCEAN_CSS:Record<string,string>=Object.fromEntries<string>([...Object.entries(OCEAN.colors).map(([key,value])=>['--o-'+key,value] as const),...Object.entries(OCEAN.rank).map(([key,value])=>['--o-rank-'+key,value] as const),...Object.entries(OCEAN.alpha).map(([key,value])=>['--o-alpha-'+key,value] as const),['--o-font-body',OCEAN.fonts.body] as const,['--o-font-numbers',OCEAN.fonts.numbers] as const]);
export function brickColorIndex(row:number,_col?:number){return OCEAN.brickBands.order[Math.floor(row/OCEAN.brickBands.rows)%OCEAN.brickBands.order.length];}
export function rankColor(rank:number){return rank===1?OCEAN.rank.gold:rank===2?OCEAN.rank.silver:rank===3?OCEAN.rank.bronze:rank===4?OCEAN.rank.fourth:rank===5?OCEAN.rank.fifth:OCEAN.rank.normal;}
export function visualBudget(balls:number,lowDevice=false){
 const tier=balls>50?2:balls>20?1:0;
 return {tier,trailLength:tier===2?0:tier===1?7:OCEAN.motion.trailLength,trailAlpha:tier===1?.10:.22,particles:lowDevice?12:tier===2?16:tier===1?32:64,highlights:!lowDevice&&tier<2};
}
