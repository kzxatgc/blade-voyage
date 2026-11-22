/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getTimedEffectWarningAlpha,
} from './TimedEffectWarning.ts';
import { POWER_UP_DURATION_TICKS } from '../../shared/constants.ts';

void describe('Timed effect warning', () => {
  const warningStartTicks = Math.round(POWER_UP_DURATION_TICKS * 0.3);
  const warningFastTicks = Math.round(POWER_UP_DURATION_TICKS * 0.1);

  void it('starts blinking at the final 30 percent of the effect', () => {
    assert.equal(
      getTimedEffectWarningAlpha(warningStartTicks + 1, POWER_UP_DURATION_TICKS),
      1
    );
    assert.equal(
      getTimedEffectWarningAlpha(warningStartTicks, POWER_UP_DURATION_TICKS),
      1
    );
    assert.equal(
      getTimedEffectWarningAlpha(warningStartTicks - 8, POWER_UP_DURATION_TICKS),
      1
    );
    assert.equal(
      getTimedEffectWarningAlpha(warningStartTicks - 9, POWER_UP_DURATION_TICKS),
      0
    );
  });

  void it('blinks faster during the final 10 percent', () => {
    assert.equal(
      getTimedEffectWarningAlpha(warningFastTicks, POWER_UP_DURATION_TICKS),
      1
    );
    assert.equal(
      getTimedEffectWarningAlpha(warningFastTicks - 4, POWER_UP_DURATION_TICKS),
      1
    );
    assert.equal(
      getTimedEffectWarningAlpha(warningFastTicks - 5, POWER_UP_DURATION_TICKS),
      0
    );
  });

  void it('rejects invalid remaining time', () => {
    assert.throws(
      () => getTimedEffectWarningAlpha(-1, POWER_UP_DURATION_TICKS),
      RangeError
    );
    assert.throws(
      () => getTimedEffectWarningAlpha(0.5, POWER_UP_DURATION_TICKS),
      RangeError
    );
    assert.throws(() => getTimedEffectWarningAlpha(0, 0), RangeError);
  });
});
