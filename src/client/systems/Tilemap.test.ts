/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MapData } from '../../shared/types.js';

const tilemapUrl = new URL('./Tilemap.ts', import.meta.url).href;
const getTilemap = async () => (await import(tilemapUrl)).Tilemap;

const mockMap: MapData = {
  tiles: {
    '4;8': { type: 'grass', variant: 9, loc: [4, 8] },
    '5;8': { type: 'grass', variant: 10, loc: [5, 8] },
    '6;8': { type: 'grass', variant: 11, loc: [6, 8] },
    '5;7': { type: 'spawner', variant: 0, loc: [5, 7] },
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

void describe('Tilemap', () => {
  void it('loads and saves the map data shape', async () => {
    const Tilemap = await getTilemap();
    const tilemap = new Tilemap(32);

    tilemap.loadFromData(mockMap);

    assert.equal(Object.keys(tilemap.tiles).length, 4);
    assert.equal(tilemap.tiles['4;8']?.type, 'grass');
    assert.equal(tilemap.tiles['4;8']?.variant, 9);
    assert.deepEqual(tilemap.save(), mockMap);
  });

  void it('extracts matching tiles and optionally removes them', async () => {
    const Tilemap = await getTilemap();
    const tilemap = new Tilemap(32);
    tilemap.load(mockMap);

    const retained = tilemap.extract([['spawner', 0]]);
    assert.equal(retained.length, 1);
    assert.equal(tilemap.tiles['5;7']?.variant, 0);

    const removed = tilemap.extract([['spawner', 0]], false);
    assert.deepEqual(removed, retained);
    assert.equal(tilemap.tiles['5;7'], undefined);
  });
});
