/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MapData } from './types.js';

const mapDataUrl = new URL('./mapData.ts', import.meta.url).href;
const getIsMapData = async () => (await import(mapDataUrl)).isMapData;

const validMap: MapData = {
  tiles: {
    '2;3': { type: 'grass', variant: 4, loc: [2, 3] },
  },
  off_grid_tiles: [
    {
      type: 'palm_tree/front/right',
      depth: 'front',
      status: 'animated',
      pos: [64, 96],
    },
  ],
};

void describe('Map data validation', () => {
  void it('accepts map data with valid grid and off-grid tiles', async () => {
    const isMapData = await getIsMapData();

    assert.equal(isMapData(validMap), true);
  });

  void it('rejects invalid grid tile and off-grid tile shapes', async () => {
    const isMapData = await getIsMapData();
    const invalidGridTile = {
      tiles: {
        '2;3': { type: 'grass', variant: 'four', loc: [2, 3] },
      },
      off_grid_tiles: [],
    };
    const invalidOffGridTile = {
      tiles: {},
      off_grid_tiles: [
        {
          type: 'palm_tree/front/right',
          depth: 'side',
          status: 'animated',
          pos: [64, 96],
        },
      ],
    };

    assert.equal(isMapData(invalidGridTile), false);
    assert.equal(isMapData(invalidOffGridTile), false);
  });
});
