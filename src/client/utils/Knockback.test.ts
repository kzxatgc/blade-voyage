/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getHorizontalKnockbackDirection } from './Knockback.ts';

void describe('getHorizontalKnockbackDirection', () => {
  const source = { x: 10, y: 0, width: 20, height: 20 };

  void it('pushes the target away from the source on either side', () => {
    assert.equal(
      getHorizontalKnockbackDirection(
        source,
        { x: 40, y: 0, width: 20, height: 20 },
        -1
      ),
      1
    );
    assert.equal(
      getHorizontalKnockbackDirection(
        source,
        { x: -20, y: 0, width: 20, height: 20 },
        1
      ),
      -1
    );
  });

  void it('uses relative hitbox centers when the bodies overlap', () => {
    assert.equal(
      getHorizontalKnockbackDirection(
        source,
        { x: 25, y: 0, width: 20, height: 20 },
        -1
      ),
      1
    );
    assert.equal(
      getHorizontalKnockbackDirection(
        source,
        { x: 5, y: 0, width: 20, height: 20 },
        1
      ),
      -1
    );
  });

  void it('uses the attack direction when hitbox centers exactly overlap', () => {
    const centeredTarget = { ...source };
    assert.equal(
      getHorizontalKnockbackDirection(source, centeredTarget, -1),
      -1
    );
    assert.equal(
      getHorizontalKnockbackDirection(source, centeredTarget, 1),
      1
    );
  });
});
