/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getShieldActiveFrame,
  getShieldBreakFrame,
  SHIELD_ACTIVE_FRAME_TICKS,
  SHIELD_BREAK_DURATION_TICKS,
} from './ShieldEffect.ts';

void describe('Player shield effect', () => {
  void it('loops row 2 columns 6–8 for the active shield', () => {
    assert.equal(getShieldActiveFrame(0), 13);
    assert.equal(getShieldActiveFrame(SHIELD_ACTIVE_FRAME_TICKS), 14);
    assert.equal(getShieldActiveFrame(SHIELD_ACTIVE_FRAME_TICKS * 2), 15);
    assert.equal(getShieldActiveFrame(SHIELD_ACTIVE_FRAME_TICKS * 3), 13);
  });

  void it('plays row 8 columns 1–4 once as the break burst', () => {
    assert.equal(getShieldBreakFrame(0), 56);
    assert.equal(getShieldBreakFrame(4), 57);
    assert.equal(getShieldBreakFrame(12), 59);
    assert.equal(getShieldBreakFrame(SHIELD_BREAK_DURATION_TICKS), undefined);
  });

  void it('rejects invalid animation time', () => {
    assert.throws(() => getShieldActiveFrame(0.5), RangeError);
    assert.throws(() => getShieldBreakFrame(-1), RangeError);
  });
});
