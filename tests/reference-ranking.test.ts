import {expect,it} from 'vitest';
import {REFERENCE,referenceRowHeight,referenceStage,referenceSeconds} from '../src/online/ranking/ReferenceLayout';
it('参考图六列表格、十行首屏和底部个人栏使用固定逻辑几何',()=>{
 expect(REFERENCE.columns.reduce((n,v)=>n+v,0)).toBeCloseTo(1);expect(REFERENCE.labels).toEqual(['排名','玩家昵称','最高总分','最高关卡','消除砖块','最佳时间']);
 const ten=Array.from({length:10},(_,i)=>referenceRowHeight(i+1)).reduce((n,v)=>n+v,0)+9*6;expect(ten).toBe(REFERENCE.body.height);expect(REFERENCE.body.y+ten).toBeLessThan(REFERENCE.personal.y);
});
it('参考尺寸按1:1逻辑坐标显示，小屏等比例缩放而不拉伸表格',()=>{
 expect(referenceStage(1200,0,1320)).toEqual({x:0,y:0,scale:1});
 for(const [w,h] of [[320,568],[390,844],[768,1024]]){const s=referenceStage(w,86,h-42);expect(s.x).toBeGreaterThanOrEqual(0);expect(s.y).toBeGreaterThanOrEqual(86);expect(s.x+REFERENCE.width*s.scale).toBeLessThanOrEqual(w+1e-6);expect(s.y+REFERENCE.height*s.scale).toBeLessThanOrEqual(h-42+1e-6);}
});
it('参考图秒数格式只用于展示，不改变毫秒成绩与缺失值',()=>{expect(referenceSeconds(632700)).toBe('632.7 秒');expect(referenceSeconds(undefined)).toBe('—');expect(referenceSeconds(1000)).toBe('1.0 秒');});
