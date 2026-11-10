import { describe, it, expect } from 'vitest';
import { fitCanvas } from '../src/ViewportLayout';
import { C } from '../src/GameConfig';

describe('极简界面的等比例视口适配', () => {
  for (const [width, height] of [[1342, 730], [1000, 562], [374, 810], [304, 534]]) {
    it(`${width}×${height}内保留全部画布及操作区`, () => {
      const size = fitCanvas(width, height, 128)!;
      expect(size.width).toBeLessThanOrEqual(width);
      expect(size.height + 128).toBeLessThanOrEqual(height + 1e-8);
      expect(size.width / size.height).toBeCloseTo(C.width / C.height, 10);
    });
  }
  it('隐藏或不可用的布局保留上次尺寸', () => {
    expect(fitCanvas(0, 800, 128)).toBeNull();
    expect(fitCanvas(300, 100, 128)).toBeNull();
    expect(fitCanvas(NaN, 800, 128)).toBeNull();
  });
});
