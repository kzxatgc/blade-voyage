/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FRENZY_HUD_FRAME_SIZE,
  FRENZY_HUD_VISIBLE_TOP_PX,
  getFrenzyHudFrame,
  getFrenzyHudTopAlignedCenterY,
} from './FrenzyHud.ts';
import {
  HEALTH_SPRITE_FRAME_SIZE,
  HEALTH_SPRITE_VISIBLE_TOP_PX,
} from './HealthHud.ts';

void describe('Frenzy HUD', () => {
  void it('maps remaining time across fill columns and arc rows', () => {
    assert.deepEqual(
      [1, 6 / 7, 5 / 7, 4 / 7, 3 / 7, 2 / 7, 1 / 7, 0].map((progress) =>
        getFrenzyHudFrame(progress, 0)
      ),
      [0, 1, 2, 3, 4, 5, 6, 7]
    );
    assert.equal(getFrenzyHudFrame(1, 6), 8);
    assert.equal(getFrenzyHudFrame(0, 42), 63);
    assert.equal(getFrenzyHudFrame(1, 48), 0);
  });

  void it('rejects invalid timer state', () => {
    assert.throws(() => getFrenzyHudFrame(Number.NaN, 0), RangeError);
    assert.throws(() => getFrenzyHudFrame(1.1, 0), RangeError);
    assert.throws(() => getFrenzyHudFrame(1, -1), RangeError);
  });

  void it('aligns visible top edges at responsive sizes', () => {
    for (const scale of [0.75, 1, 1.5]) {
      const healthImageTop = -120;
      const healthImageSize = 84 * scale;
      const frenzyImageSize = 48 * scale;
      const healthVisibleTop =
        healthImageTop +
        (HEALTH_SPRITE_VISIBLE_TOP_PX / HEALTH_SPRITE_FRAME_SIZE) *
          healthImageSize;
      const frenzyCenterY = getFrenzyHudTopAlignedCenterY(
        healthImageTop,
        healthImageSize,
        frenzyImageSize
      );
      const frenzyVisibleTop =
        frenzyCenterY -
        frenzyImageSize / 2 +
        (FRENZY_HUD_VISIBLE_TOP_PX / FRENZY_HUD_FRAME_SIZE) *
          frenzyImageSize;

      assert.ok(Math.abs(frenzyVisibleTop - healthVisibleTop) < 1e-9);
    }
  });
});
