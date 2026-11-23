/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLoadingRunnerCenterX } from './LoadingHud.ts';

void describe('Loading HUD', () => {
  void it('aligns the runner position to the filled bar edge', () => {
    const runnerCenterX = getLoadingRunnerCenterX(100, 40, 20, 200, 0.95);
    assert.equal(runnerCenterX, 140);
  });

  void it('keeps the runner within the bar start and end cap', () => {
    assert.equal(getLoadingRunnerCenterX(100, 0, 20, 200, 0.95), 110);
    assert.equal(getLoadingRunnerCenterX(100, 200, 20, 200, 0.95), 290);
  });

  void it('rejects invalid layout values', () => {
    assert.throws(
      () => getLoadingRunnerCenterX(0, -1, 20, 200, 0.95),
      RangeError
    );
    assert.throws(
      () => getLoadingRunnerCenterX(0, 10, 20, 200, 1.1),
      RangeError
    );
  });
});
