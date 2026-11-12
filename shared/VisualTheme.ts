/** Presentation only. Never import this module from physics, scoring or the verifier. */
export const OCEAN={
 name:'深海蓝·现代街机',
 colors:{background:'#101D2D',arena:'#192B40',gradientEnd:'#243B55',panel:'#23384F',border:'#49617A',line:'#3A5068',text:'#F4F7FB',secondary:'#B8C8D8',muted:'#8499AF',number:'#FFFFFF',positive:'#76D6B0',warning:'#F0B86A',accent:'#56C4DC',heart:'#E98275'},
 alpha:{veil:'rgba(16,29,45,.74)',backdrop:'rgba(16,29,45,.88)',brickHighlight:'rgba(255,255,255,.22)',brickShadow:'rgba(16,29,45,.20)',lineHighlight:'rgba(244,247,251,.28)',badgeEdge:'rgba(244,247,251,.35)',death:'rgba(233,130,117,.22)',shadowSoft:'rgba(0,0,0,.12)',shadowPanel:'rgba(0,0,0,.25)'},
 bricks:['#4399D2','#53B8BC','#E9B75C','#E98275','#888CCF','#75BE9D'],
 ball:{body:'#F7FAFF',edge:'#C7D8EA',highlight:'#FFFFFF',trail:'#A6D3EA'},
 paddle:{body:'#DCE7F3',edge:'#4B789D',accent:'#56C4DC',shadow:'#102033'},
 powers:{triple:{color:'#E9B75C',label:'X3'},wide:{color:'#53B8BC',label:'↔'},halve:{color:'#E98275',label:'÷2'},life:{color:'#75BE9D',label:'＋1'},bomb:{color:'#888CCF',label:'炸弹'}},
 powerBadge:{width:36,height:26,radius:9,cellWidth:40,cellHeight:30,pixelRatio:2},
 rank:{gold:'#C6AB74',silver:'#A6BECE',bronze:'#C49C84',fourth:'#81A9C7',fifth:'#7497B4',normal:'#8499AF',mine:'#294D62'},
 fonts:{body:'"PingFang SC", "Microsoft YaHei", sans-serif',numbers:'Arial, "PingFang SC", sans-serif'},
 motion:{particleSeconds:.16,sourceParticleSeconds:.35,flashSeconds:.12,trailLength:12},
} as const;
export const OCEAN_CSS:Record<string,string>=Object.fromEntries<string>([...Object.entries(OCEAN.colors).map(([key,value])=>['--o-'+key,value] as const),...Object.entries(OCEAN.rank).map(([key,value])=>['--o-rank-'+key,value] as const),...Object.entries(OCEAN.alpha).map(([key,value])=>['--o-alpha-'+key,value] as const),['--o-font-body',OCEAN.fonts.body] as const,['--o-font-numbers',OCEAN.fonts.numbers] as const]);
export function brickColorIndex(row:number,col:number){return (Math.floor(row/3)+Math.floor(col/7))%OCEAN.bricks.length;}
export function rankColor(rank:number){return rank===1?OCEAN.rank.gold:rank===2?OCEAN.rank.silver:rank===3?OCEAN.rank.bronze:rank===4?OCEAN.rank.fourth:rank===5?OCEAN.rank.fifth:OCEAN.rank.normal;}
export function visualBudget(balls:number,lowDevice=false){
 const tier=balls>50?2:balls>20?1:0;
 return {tier,trailLength:tier===2?0:tier===1?7:OCEAN.motion.trailLength,trailAlpha:tier===1?.10:.22,particles:lowDevice?12:tier===2?16:tier===1?32:64,highlights:!lowDevice&&tier<2};
}
