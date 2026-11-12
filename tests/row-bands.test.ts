import {describe,it,expect} from 'vitest';
import {OCEAN,brickColorIndex} from '../shared/VisualTheme';
import {LEVELS} from '../src/Levels';
import {Blocks} from '../src/Blocks';
const colors=['#4399D2','#53B8BC','#75BE9D','#E9B75C','#E98275','#888CCF'];
describe('真实网格每10行一个稳定色带',()=>{
 it('六色顺序、边界及超过60行循环，不依赖列',()=>{for(let row=0;row<180;row++)for(const col of [0,1,19,80])expect(OCEAN.bricks[brickColorIndex(row,col)]).toBe(colors[Math.floor(row/10)%6]);});
 it.each(LEVELS)('第$number关所有普通砖使用真实行索引，销毁不重排颜色',level=>{const b=new Blocks();b.reset(level.obstacles,level);const original=new Map<number,string>();for(let i=0;i<b.alive.length;i++)if(b.alive[i]){const row=Math.floor(i/b.cols);original.set(i,OCEAN.bricks[brickColorIndex(row,i%b.cols)]);expect(original.get(i)).toBe(colors[Math.floor(row/10)%6]);}let n=0;for(const i of original.keys())if(n++%3===0)b.hit(i);for(const [i,color] of original)if(b.alive[i])expect(OCEAN.bricks[brickColorIndex(Math.floor(i/b.cols),i%b.cols)]).toBe(color);});
 it('保留机关和道具原有颜色语义',()=>{expect(OCEAN.bricks[4]).toBe('#888CCF');expect(OCEAN.bricks[1]).toBe('#53B8BC');expect(OCEAN.powers.triple.color).toBe('#E9B75C');});
});
