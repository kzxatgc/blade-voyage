/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getHealthSpriteFrame } from './HealthHud.ts';

void describe('Health HUD', () => {
  void it('maps four health points to the five heart fill states', () => {
    assert.deepEqual(
      [4, 3, 2, 1, 0].map((health) => getHealthSpriteFrame(health, 4)),
      [0, 1, 2, 3, 4]
    );
  });

  void it('clamps health values to the full and empty frames', () => {
    assert.equal(getHealthSpriteFrame(5, 4), 0);
    assert.equal(getHealthSpriteFrame(-1, 4), 4);
  });
});
