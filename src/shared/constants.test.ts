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
    // Camera bounds clamp constants (from game.py lines 223-234)
    assert.equal(constants.CAMERA_BOUNDS_X, 7 * 32);       // ±224px horizontal
    assert.equal(constants.CAMERA_BOUNDS_Y_UP, 2 * 32);    //  -64px above player center
    assert.equal(constants.CAMERA_BOUNDS_Y_DOWN, 2 * 32);  // +64px below player center
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
});
