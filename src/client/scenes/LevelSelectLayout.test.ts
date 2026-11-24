import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getLevelBoxDisplaySize,
  getLevelBoxFaceCenterOffsetY,
} from './LevelSelectLayout.ts';

void describe('Level Select layout', () => {
  void it('uses 85% of the design size for the normal tile size', () => {
    assert.equal(getLevelBoxDisplaySize(1, 44), 102);
  });

  void it('preserves the minimum CSS touch target on narrow canvases', () => {
    assert.equal(getLevelBoxDisplaySize(3, 44), 132);
  });

  void it('centers text on the raised face above the lower shadow', () => {
    assert.ok(
      Math.abs(getLevelBoxFaceCenterOffsetY(102) + 102 / 14) < 0.0001
    );
  });
});
