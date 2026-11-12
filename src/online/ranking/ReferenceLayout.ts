/** Geometry measured against the supplied 1200×1320 reference, shared by DOM and Canvas. */
export const REFERENCE={width:1200,height:1320,artHeight:1356,header:{x:80,y:216,width:1040,height:54},body:{x:74,y:276,width:1052,height:742},personal:{x:60,y:1060,width:1080,height:126},navY:1210,columns:[.10,.30,.17,.13,.14,.16],labels:['排名','玩家昵称','最高总分','最高关卡','消除砖块','最佳时间']} as const;
export function referenceRowHeight(rank:number){return rank===1?80:rank<=5?72:64;}
export function referenceStage(width:number,top:number,bottom:number){const scale=Math.max(.01,Math.min(width/REFERENCE.width,(bottom-top)/REFERENCE.height));return {x:(width-REFERENCE.width*scale)/2,y:top+(bottom-top-REFERENCE.height*scale)/2,scale};}
export function referenceSeconds(ms:number|undefined){return ms===undefined||!Number.isFinite(ms)?'—':`${(ms/1000).toFixed(1)} 秒`;}
/** Content-sized panel geometry; the footer belongs to the panel, never the viewport. */
export function rankingFlowGeometry(width:number,top:number,bottom:number,items:readonly {rank:number}[]){
 const scale=Math.max(.01,(width-16)/REFERENCE.width),headerPixels=64,head=32,footer=92,nav=44,gap=8,pad=12;
 const rowHeight=(rank:number)=>Math.max(referenceRowHeight(rank),(width<480?68:50)/scale);
 const natural=items.length?items.reduce((n,row)=>n+rowHeight(row.rank)*scale+6,0)-6:140;
 const available=Math.max(60,bottom-top-headerPixels-head-footer-nav-gap*3-pad);
 const bodyPixels=Math.min(natural,available),bodyY=headerPixels+head+gap,navY=bodyY+bodyPixels+gap,myY=navY+nav+gap,height=myY+footer+pad;
 const x=12/scale,w=REFERENCE.width-24/scale;
 return {x:8,y:top+Math.max(0,(bottom-top-height)/2),scale,rowHeight,headerPixels,reference:{...REFERENCE,height:height/scale,header:{x,y:headerPixels/scale,width:w,height:head/scale},body:{x,y:bodyY/scale,width:w,height:bodyPixels/scale},personal:{x,y:myY/scale,width:w,height:footer/scale},navY:navY/scale}};
}
