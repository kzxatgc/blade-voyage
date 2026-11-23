/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getBuffIndicatorOrder } from './BuffHud.ts';

void describe('Buff HUD order', () => {
  void it('keeps the oldest buff nearest the heart as newer buffs arrive', () => {
    assert.deepEqual(getBuffIndicatorOrder([], ['shield']), ['shield']);
    assert.deepEqual(
      getBuffIndicatorOrder(['shield'], ['shield', 'frenzy']),
      ['shield', 'frenzy']
    );
  });

  void it('moves the remaining buff into the first slot when one expires', () => {
    assert.deepEqual(
      getBuffIndicatorOrder(['shield', 'frenzy'], ['frenzy']),
      ['frenzy']
    );
    assert.deepEqual(
      getBuffIndicatorOrder(['frenzy', 'shield'], ['shield']),
      ['shield']
    );
  });

  void it('keeps a refreshed buff in its current position', () => {
    assert.deepEqual(
      getBuffIndicatorOrder(['frenzy', 'shield'], ['frenzy', 'shield']),
      ['frenzy', 'shield']
    );
  });
});
