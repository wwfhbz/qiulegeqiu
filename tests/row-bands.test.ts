import {describe,it,expect} from 'vitest';
import {OCEAN,brickColorIndex,brickColor,levelBandColors} from '../shared/VisualTheme';
import {LEVELS} from '../src/Levels';
import {Blocks} from '../src/Blocks';
describe('每关三色渐变，按固定像素高度分六条稳定色带',()=>{
 it('每96逻辑像素一条色带，0～5封顶，不依赖列；与砖块尺寸无关',()=>{
  for(const step of [9,11,15,16,22])for(let row=0;row<Math.ceil(800/step);row++)expect(brickColorIndex(row,step)).toBe(Math.min(5,Math.floor(row*step/96)));
 });
 it('每关调色板：首/中/尾等于三个锚点，六色互不相同；1～6关各不相同，7～12关复用',()=>{
  const seen=new Set<string>();
  for(let level=1;level<=6;level++){const colors=levelBandColors(level),[top,,bottom]=OCEAN.levelPalettes[level-1];expect(colors).toHaveLength(6);expect(new Set(colors).size).toBe(6);expect(colors[0]).toBe(top.toUpperCase());expect(colors[5]).toBe(bottom.toUpperCase());for(const c of colors)expect(c).toMatch(/^#[0-9A-F]{6}$/);const key=colors.join();expect(seen.has(key)).toBe(false);seen.add(key);expect(levelBandColors(level+6)).toEqual(colors);}
 });
 it.each(LEVELS)('第$number关砖区出现全部六色；颜色只取真实行号，销毁不重排',level=>{
  const b=new Blocks();b.reset(level.obstacles,level);const original=new Map<number,string>();
  for(let i=0;i<b.alive.length;i++)if(b.alive[i])original.set(i,brickColor(Math.floor(i/b.cols),b.step,level.number));
  expect(new Set(original.values()).size).toBe(6);
  let n=0;for(const i of original.keys())if(n++%3===0)b.hit(i);
  for(const [i,color] of original)if(b.alive[i])expect(brickColor(Math.floor(i/b.cols),b.step,level.number)).toBe(color);
 });
 it('保留机关和道具原有颜色语义',()=>{expect(OCEAN.bricks[4]).toBe('#9B8CFF');expect(OCEAN.bricks[1]).toBe('#2EC4B6');expect(OCEAN.powers.triple.color).toBe('#FFB547');expect(OCEAN.powers.halve.good).toBe(false);});
});
