/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getShieldHudFrame,
  getShieldHudTopAlignedCenterY,
  SHIELD_HUD_ANIMATION_FRAMES,
  SHIELD_HUD_ANIMATION_FRAME_TICKS,
  SHIELD_HUD_FILL_STATES,
  SHIELD_HUD_FRAME_SIZE,
  SHIELD_HUD_VISIBLE_TOP_PX,
} from './ShieldHud.ts';
import {
  HEALTH_SPRITE_FRAME_SIZE,
  HEALTH_SPRITE_VISIBLE_TOP_PX,
} from './HealthHud.ts';

void describe('Shield HUD', () => {
  void it('maps remaining time across fill columns and animation rows', () => {
    assert.deepEqual(
      [1, 6 / 7, 5 / 7, 4 / 7, 3 / 7, 2 / 7, 1 / 7, 0].map((progress) =>
        getShieldHudFrame(progress, 0)
      ),
      [0, 1, 2, 3, 4, 5, 6, 7]
    );
    assert.equal(getShieldHudFrame(1, SHIELD_HUD_ANIMATION_FRAME_TICKS), 8);
    assert.equal(
      getShieldHudFrame(
        0,
        (SHIELD_HUD_ANIMATION_FRAMES - 1) * SHIELD_HUD_ANIMATION_FRAME_TICKS
      ),
      (SHIELD_HUD_ANIMATION_FRAMES - 1) * SHIELD_HUD_FILL_STATES +
        SHIELD_HUD_FILL_STATES -
        1
    );
    assert.equal(
      getShieldHudFrame(
        1,
        SHIELD_HUD_ANIMATION_FRAMES * SHIELD_HUD_ANIMATION_FRAME_TICKS
      ),
      0
    );
  });

  void it('rejects invalid timer state', () => {
    assert.throws(() => getShieldHudFrame(Number.NaN, 0), RangeError);
    assert.throws(() => getShieldHudFrame(1.1, 0), RangeError);
    assert.throws(() => getShieldHudFrame(1, -1), RangeError);
  });

  void it('aligns the visible shield top with health at responsive sizes', () => {
    for (const scale of [0.75, 1, 1.5]) {
      const healthImageTop = -120;
      const healthImageSize = 84 * scale;
      const shieldImageSize = 48 * scale;
      const healthVisibleTop =
        healthImageTop +
        (HEALTH_SPRITE_VISIBLE_TOP_PX / HEALTH_SPRITE_FRAME_SIZE) *
          healthImageSize;
      const shieldCenterY = getShieldHudTopAlignedCenterY(
        healthImageTop,
        healthImageSize,
        shieldImageSize
      );
      const shieldVisibleTop =
        shieldCenterY -
        shieldImageSize / 2 +
        (SHIELD_HUD_VISIBLE_TOP_PX / SHIELD_HUD_FRAME_SIZE) *
          shieldImageSize;

      assert.ok(Math.abs(shieldVisibleTop - healthVisibleTop) < 1e-9);
    }
  });
});
