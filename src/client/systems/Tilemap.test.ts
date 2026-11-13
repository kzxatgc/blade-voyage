/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MapData } from '../../shared/types.js';
import type {
  AnimationFrameSource,
  TilemapRenderScene,
} from './Tilemap.js';

const tilemapUrl = new URL('./Tilemap.ts', import.meta.url).href;
const getTilemapModule = async (): Promise<typeof import('./Tilemap.js')> =>
  import(tilemapUrl);
const getTilemap = async () => (await getTilemapModule()).Tilemap;

const createMockMap = (): MapData => ({
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
});

const createRenderScene = () => {
  const draws: {
    x: number;
    y: number;
    texture: string;
    origin: [number, number] | null;
  }[] = [];

  const scene: TilemapRenderScene = {
    add: {
      image(x, y, texture) {
        const draw = { x, y, texture, origin: null as [number, number] | null };
        draws.push(draw);
        return {
          setOrigin(originX, originY) {
            draw.origin = [originX, originY];
          },
        };
      },
    },
  };

  return { scene, draws };
};

void describe('Tilemap', () => {
  void it('loads and saves the map data shape', async () => {
    const Tilemap = await getTilemap();
    const tilemap = new Tilemap(32);

    tilemap.loadFromData(createMockMap());

    assert.equal(Object.keys(tilemap.tiles).length, 4);
    assert.equal(tilemap.tiles['4;8']?.type, 'grass');
    assert.equal(tilemap.tiles['4;8']?.variant, 9);
    assert.deepEqual(tilemap.save(), createMockMap());
  });

  void it('extracts matching tiles and optionally removes them', async () => {
    const Tilemap = await getTilemap();
    const tilemap = new Tilemap(32);
    tilemap.load(createMockMap());

    const retained = tilemap.extract([['spawner', 0]]);
    assert.equal(retained.length, 1);
    assert.equal(tilemap.tiles['5;7']?.variant, 0);

    const removed = tilemap.extract([['spawner', 0]], false);
    assert.deepEqual(removed, retained);
    assert.equal(tilemap.tiles['5;7'], undefined);
  });
});

void describe('Tilemap front rendering', () => {
  void it('draws grid tiles at their world position minus the render offset', async () => {
    const Tilemap = await getTilemap();
    const tilemap = new Tilemap(32);
    const { scene, draws } = createRenderScene();

    tilemap.loadFromData({
      tiles: {
        '4;8': { type: 'grass', variant: 9, loc: [4, 8] },
      },
      off_grid_tiles: [],
    });
    tilemap.frontRender(scene, [2, 3]);

    assert.deepEqual(draws, [
      { x: 126, y: 253, texture: 'grass/9', origin: [0, 0] },
    ]);
  });

  void it('draws only animated front off-grid tiles with their current frame', async () => {
    const Tilemap = await getTilemap();
    const tilemap = new Tilemap();
    const { scene, draws } = createRenderScene();
    const animations: Record<string, AnimationFrameSource> = {
      'palm_tree/front/right': {
        img: () => 'palm_tree/front/right/2',
      },
    };

    tilemap.loadFromData({
      tiles: {},
      off_grid_tiles: [
        {
          type: 'palm_tree/front/right',
          depth: 'front',
          status: 'animated',
          pos: [464, 122],
        },
        {
          type: 'palm_tree/back/right',
          depth: 'back',
          status: 'animated',
          pos: [300, 100],
        },
        {
          type: 'palm_tree/front/left',
          depth: 'front',
          status: 'static',
          pos: [250, 100],
        },
      ],
    });
    tilemap.frontRender(scene, [10, 20], animations);

    assert.deepEqual(draws, [
      {
        x: 454,
        y: 102,
        texture: 'palm_tree/front/right/2',
        origin: [0, 0],
      },
    ]);
  });

  void it('fails explicitly when a front animation is not registered', async () => {
    const Tilemap = await getTilemap();
    const tilemap = new Tilemap();
    const { scene } = createRenderScene();
    tilemap.loadFromData({
      tiles: {},
      off_grid_tiles: [
        {
          type: 'palm_tree/front/right',
          depth: 'front',
          status: 'animated',
          pos: [464, 122],
        },
      ],
    });

    assert.throws(
      () => tilemap.frontRender(scene),
      /Missing animation for front tile "palm_tree\/front\/right"/
    );
  });

  void it('creates a temporary plus map with nine unique grass tiles', async () => {
    const { createTemporaryPlusMap } = await getTilemapModule();
    const map = createTemporaryPlusMap();
    const tiles = Object.values(map.tiles);

    assert.equal(tiles.length, 9);
    assert.equal(new Set(tiles.map((tile) => tile.variant)).size, 9);
    assert.deepEqual(
      tiles.map((tile) => tile.loc),
      [
        [8, 5],
        [9, 5],
        [10, 5],
        [11, 5],
        [12, 5],
        [10, 3],
        [10, 4],
        [10, 6],
        [10, 7],
      ]
    );
    assert.deepEqual(map.off_grid_tiles, []);
  });
});
