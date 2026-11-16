/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MapData } from './types.js';

const constantsUrl = new URL('./constants.ts', import.meta.url).href;

void describe('Game constants', () => {
  void it('matches the source game dimensions and movement constants', async () => {
    const constants = await import(constantsUrl);

    assert.equal(constants.WINDOW_WIDTH, 1280);
    assert.equal(constants.WINDOW_HEIGHT, 680);
    assert.equal(constants.DISPLAY_WIDTH, 640);
    assert.equal(constants.DISPLAY_HEIGHT, 340);
    assert.equal(constants.TILE_SIZE, 32);
    assert.equal(constants.GRAVITY, 0.5);
    assert.equal(constants.MAX_FALL_SPEED, 5);
    assert.equal(constants.CAMERA_SMOOTHING, 40);
    assert.equal(constants.TICK_RATE, 60);
    assert.equal(constants.TARGET_FPS, 144);
    assert.equal(constants.MAX_FRAME_DELTA, 100);
    // Camera bounds clamp constants (from game.py lines 223-234)
    assert.equal(constants.CAMERA_BOUNDS_X, 7 * 32);       // ±224px horizontal
    assert.equal(constants.CAMERA_BOUNDS_Y_UP, 2 * 32);    //  -64px above player center
    assert.equal(constants.CAMERA_BOUNDS_Y_DOWN, 2 * 32);  // +64px below player center
    assert.deepEqual(constants.ZOOM_LEVELS, [1.0, 2.0, 3.0]);
    assert.equal(constants.DEFAULT_ZOOM, 2.0);
    assert.equal(constants.ZOOM_EASING_SPEED, 0.08);
  });

  void it('preserves the source particle color palettes', async () => {
    const constants = await import(constantsUrl);

    assert.deepEqual(constants.FIERY_BURST_COLORS, [
      [255, 255, 255],
      [255, 215, 0],
      [255, 140, 0],
      [255, 69, 0],
      [139, 0, 0],
    ]);
    assert.deepEqual(constants.GRASS_COLORS, [
      [124, 171, 110],
      [62, 89, 67],
    ]);
    assert.deepEqual(constants.HEART_COLORS, [
      [255, 0, 0],
      [220, 20, 60],
      [139, 0, 0],
      [60, 0, 0],
    ]);
  });

  void it('accepts the source map JSON shape', () => {
    const map: MapData = {
      tiles: {
        '3;0': { type: 'grass', variant: 4, loc: [3, 0] },
      },
      off_grid_tiles: [
        {
          type: 'palm_tree/front/right',
          depth: 'front',
          status: 'animated',
          pos: [464, 122],
        },
      ],
    };

    assert.deepEqual(map.tiles['3;0']?.loc, [3, 0]);
    assert.equal(map.off_grid_tiles[0]?.status, 'animated');
  });

  void it('simulates deterministic 60Hz fixed accumulator across variable frame rates', async () => {
    const constants = await import(constantsUrl);
    const tickDuration = 1000 / constants.TICK_RATE;

    function runAccumulatorSimulation(frameDeltas: number[]) {
      let accumulator = 0;
      let ticks = 0;
      for (const rawDelta of frameDeltas) {
        const delta = Math.min(rawDelta, constants.MAX_FRAME_DELTA);
        accumulator += delta;
        while (accumulator >= tickDuration) {
          accumulator -= tickDuration;
          ticks++;
        }
      }
      const alpha = Math.min(accumulator / tickDuration, 1.0);
      return { ticks, alpha, remainingAccumulator: accumulator };
    }

    // 144 FPS monitor (144 frames of ~6.944ms = 1000ms) -> exactly 59-60 ticks (due to float epsilon)
    const deltas144 = Array.from({ length: 144 }, () => 1000 / 144);
    const sim144 = runAccumulatorSimulation(deltas144);
    assert.ok(sim144.ticks === 59 || sim144.ticks === 60);
    assert.ok(sim144.alpha >= 0 && sim144.alpha <= 1);

    // 60 FPS monitor (60 frames of 16.6667ms = 1000ms) -> exactly 60 ticks
    const deltas60 = Array.from({ length: 60 }, () => 1000 / 60);
    const sim60 = runAccumulatorSimulation(deltas60);
    assert.equal(sim60.ticks, 60);

    // 30 FPS monitor (30 frames of 33.3333ms = 1000ms) -> exactly 60 ticks
    const deltas30 = Array.from({ length: 30 }, () => 1000 / 30);
    const sim30 = runAccumulatorSimulation(deltas30);
    assert.equal(sim30.ticks, 60);

    // Lag spike clamping (delta > MAX_FRAME_DELTA clamped to MAX_FRAME_DELTA)
    const lagSim = runAccumulatorSimulation([500]); // 500ms lag clamped to 100ms
    assert.ok(lagSim.ticks === 5 || lagSim.ticks === 6); // 100 / 16.6667 = 5 or 6 ticks depending on float remainder
    assert.ok(lagSim.alpha >= 0 && lagSim.alpha <= 1);
  });
});
