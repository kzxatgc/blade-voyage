/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const debugUrl = new URL('./debug.ts', import.meta.url).href;

void describe('Debug config', () => {
  void it('initializes with debug mode enabled and optional overlays off', async () => {
    const debug = await import(debugUrl);
    debug.setDebugMode(true);
    debug.DEBUG_CONFIG.showSwordSpawnRange = true;
    debug.DEBUG_CONFIG.showEnemyDetectionRange = true;
    debug.DEBUG_CONFIG.showCannonDetectionRange = true;
    debug.DEBUG_CONFIG.showEnemyAttackRange = true;

    assert.equal(debug.isDebugEnabled(), true);
    assert.equal(debug.DEBUG_CONFIG.enabled, true);
    assert.equal(debug.DEBUG_CONFIG.showTouchControlsOnDesktop, false);
    assert.equal(debug.DEBUG_CONFIG.boostPotionSpawnRates, true);
    assert.equal(debug.DEBUG_CONFIG.showSwordSpawnRange, true);
    assert.equal(debug.DEBUG_CONFIG.showEnemyDetectionRange, true);
    assert.equal(debug.DEBUG_CONFIG.showCannonDetectionRange, true);
    assert.equal(debug.DEBUG_CONFIG.showEnemyAttackRange, true);
  });

  void it('sets and toggles debug mode', async () => {
    const debug = await import(debugUrl);
    debug.setDebugMode(false);
    assert.equal(debug.isDebugEnabled(), false);
    assert.equal(debug.DEBUG_CONFIG.enabled, false);

    const toggledOn = debug.toggleDebugMode();
    assert.equal(toggledOn, true);
    assert.equal(debug.isDebugEnabled(), true);

    const toggledOff = debug.toggleDebugMode();
    assert.equal(toggledOff, false);
    assert.equal(debug.isDebugEnabled(), false);
  });
});
