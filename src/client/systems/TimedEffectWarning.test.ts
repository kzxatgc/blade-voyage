/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getTimedEffectWarningAlpha,
  TIMED_EFFECT_WARNING_FAST_TICKS,
  TIMED_EFFECT_WARNING_START_TICKS,
} from './TimedEffectWarning.ts';

void describe('Timed effect warning', () => {
  void it('starts blinking at three seconds remaining', () => {
    assert.equal(
      getTimedEffectWarningAlpha(TIMED_EFFECT_WARNING_START_TICKS + 1),
      1
    );
    assert.equal(
      getTimedEffectWarningAlpha(TIMED_EFFECT_WARNING_START_TICKS),
      1
    );
    assert.equal(
      getTimedEffectWarningAlpha(TIMED_EFFECT_WARNING_START_TICKS - 8),
      1
    );
    assert.equal(
      getTimedEffectWarningAlpha(TIMED_EFFECT_WARNING_START_TICKS - 9),
      0
    );
  });

  void it('blinks faster during the final second', () => {
    assert.equal(
      getTimedEffectWarningAlpha(TIMED_EFFECT_WARNING_FAST_TICKS),
      1
    );
    assert.equal(
      getTimedEffectWarningAlpha(TIMED_EFFECT_WARNING_FAST_TICKS - 4),
      1
    );
    assert.equal(
      getTimedEffectWarningAlpha(TIMED_EFFECT_WARNING_FAST_TICKS - 5),
      0
    );
  });

  void it('rejects invalid remaining time', () => {
    assert.throws(() => getTimedEffectWarningAlpha(-1), RangeError);
    assert.throws(() => getTimedEffectWarningAlpha(0.5), RangeError);
  });
});
