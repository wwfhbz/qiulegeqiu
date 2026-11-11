/** Geometry measured against the supplied 1200×1320 reference, shared by DOM and Canvas. */
export const REFERENCE={width:1200,height:1320,artHeight:1356,header:{x:80,y:216,width:1040,height:54},body:{x:74,y:276,width:1052,height:742},personal:{x:60,y:1060,width:1080,height:126},navY:1210,columns:[.12,.28,.16,.13,.15,.16],labels:['排名','玩家昵称','最高总分','最高关卡','消除砖块','最佳时间']} as const;
export function referenceRowHeight(rank:number){return rank===1?80:rank<=5?72:64;}
export function referenceStage(width:number,top:number,bottom:number){const scale=Math.max(.01,Math.min(width/REFERENCE.width,(bottom-top)/REFERENCE.height));return {x:(width-REFERENCE.width*scale)/2,y:top+(bottom-top-REFERENCE.height*scale)/2,scale};}
export function referenceSeconds(ms:number|undefined){return ms===undefined||!Number.isFinite(ms)?'—':`${(ms/1000).toFixed(1)} 秒`;}
