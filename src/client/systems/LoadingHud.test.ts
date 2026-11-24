/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLoadingRunnerCenterX } from './LoadingHud.ts';

void describe('Loading HUD', () => {
  void it('moves the runner as soon as loading progress advances', () => {
    const startX = getLoadingRunnerCenterX(100, 0, 20, 200, 0.95);
    const nextX = getLoadingRunnerCenterX(100, 0.01, 20, 200, 0.95);

    assert.ok(nextX > startX);
    assert.equal(startX, 110);
  });

  void it('keeps the runner within the bar start and end cap', () => {
    assert.equal(getLoadingRunnerCenterX(100, 0, 20, 200, 0.95), 110);
    assert.equal(getLoadingRunnerCenterX(100, 1, 20, 200, 0.95), 290);
  });

  void it('rejects invalid layout values', () => {
    assert.throws(
      () => getLoadingRunnerCenterX(0, -0.1, 20, 200, 0.95),
      RangeError
    );
    assert.throws(
      () => getLoadingRunnerCenterX(0, 10, 20, 200, 1.1),
      RangeError
    );
  });
});
