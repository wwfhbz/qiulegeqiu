import {expect,it} from 'vitest';
import {rankingFlowGeometry} from '../src/online/ranking/ReferenceLayout';
it.each([[320,568],[390,844],[768,1024]])('微信%s×%s个人栏紧靠操作区，少量成绩不留固定画布空白',(width,height)=>{
 const top=86,bottom=height-42;const one=rankingFlowGeometry(width,top,bottom,[{rank:1}]),many=rankingFlowGeometry(width,top,bottom,Array.from({length:20},(_,i)=>({rank:i+1})));
 for(const p of [one,many]){const r=p.reference;expect((r.personal.y-r.navY)*p.scale).toBeCloseTo(52);expect(p.y+r.height*p.scale).toBeLessThanOrEqual(bottom+1e-6);expect((r.body.y+r.body.height)*p.scale).toBeLessThan(r.personal.y*p.scale);}
 expect(one.reference.body.height*one.scale).toBeLessThan(90);expect(one.reference.height*one.scale).toBeLessThan(many.reference.height*many.scale);
});
it('空榜使用有限高度，不生成一整块虚假的空行',()=>{const p=rankingFlowGeometry(390,86,802,[]);expect(p.reference.body.height*p.scale).toBe(140);});
