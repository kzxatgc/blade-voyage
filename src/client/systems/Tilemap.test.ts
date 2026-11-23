/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MapData, TileData, TileLocation } from '../../shared/types.js';
import type {
  AnimationFrameSource,
  TilemapAnimation,
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
          setTexture(texture) {
            draw.texture = texture;
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

  void it('preserves cached spawners when runtime extraction removes them', async () => {
    const Tilemap = await getTilemap();
    const tilemap = new Tilemap(32);
    const map = createMockMap();

    tilemap.loadFromData(map);
    assert.equal(tilemap.extract([['spawner', 0]], false).length, 1);
    assert.equal(map.tiles['5;7']?.variant, 0);

    tilemap.loadFromData(map);
    assert.equal(tilemap.extract([['spawner', 0]], false).length, 1);
  });
});

void describe('Tilemap collision queries', () => {
  void it('returns the tiles in the source nine-cell neighborhood and order', async () => {
    const Tilemap = await getTilemap();
    const tilemap = new Tilemap(32);
    const map: MapData = {
      tiles: {
        '2;3': { type: 'grass', variant: 0, loc: [2, 3] },
        '2;2': { type: 'grass', variant: 1, loc: [2, 2] },
        '3;2': { type: 'grass', variant: 2, loc: [3, 2] },
        '4;2': { type: 'grass', variant: 3, loc: [4, 2] },
        '4;3': { type: 'grass', variant: 4, loc: [4, 3] },
        '3;3': { type: 'grass', variant: 5, loc: [3, 3] },
        '2;4': { type: 'grass', variant: 6, loc: [2, 4] },
        '3;4': { type: 'grass', variant: 7, loc: [3, 4] },
        '4;4': { type: 'grass', variant: 8, loc: [4, 4] },
        '5;3': { type: 'grass', variant: 9, loc: [5, 3] },
      },
      off_grid_tiles: [],
    };
    tilemap.loadFromData(map);

    assert.deepEqual(tilemap.tilesAround([100, 100]), [
      map.tiles['2;3'],
      map.tiles['2;2'],
      map.tiles['3;2'],
      map.tiles['4;2'],
      map.tiles['4;3'],
      map.tiles['3;3'],
      map.tiles['2;4'],
      map.tiles['3;4'],
      map.tiles['4;4'],
    ]);
  });

  void it('returns rectangles only for nearby physical tiles', async () => {
    const Tilemap = await getTilemap();
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({
      tiles: {
        '3;3': { type: 'grass', variant: 4, loc: [3, 3] },
        '2;3': { type: 'spawner', variant: 0, loc: [2, 3] },
        '6;3': { type: 'grass', variant: 4, loc: [6, 3] },
      },
      off_grid_tiles: [],
    });

    assert.deepEqual(tilemap.physicalRectsAround([100, 100]), [
      { x: 96, y: 96, width: 32, height: 32 },
    ]);
  });

  void it('returns a solid tile only for positions inside physical tiles', async () => {
    const Tilemap = await getTilemap();
    const tilemap = new Tilemap(32);
    const grass = { type: 'grass', variant: 4, loc: [2, 3] as [number, number] };
    const spawner = {
      type: 'spawner',
      variant: 0,
      loc: [3, 3] as [number, number],
    };
    tilemap.loadFromData({
      tiles: { '2;3': grass, '3;3': spawner },
      off_grid_tiles: [],
    });

    assert.deepEqual(tilemap.solidCheck([64, 96]), grass);
    assert.deepEqual(tilemap.solidCheck([95, 127]), grass);
    assert.equal(tilemap.solidCheck([96, 96]), undefined);
    assert.equal(tilemap.solidCheck([0, 0]), undefined);
  });

  void it('uses an inclusive per-axis radius for nearby off-grid tiles', async () => {
    const Tilemap = await getTilemap();
    const tilemap = new Tilemap();
    const boundaryTile = {
      type: 'palm_tree/back/right',
      depth: 'back' as const,
      status: 'animated' as const,
      pos: [140, 60] as [number, number],
    };
    tilemap.loadFromData({
      tiles: {},
      off_grid_tiles: [
        boundaryTile,
        {
          ...boundaryTile,
          pos: [141, 100],
        },
        {
          ...boundaryTile,
          pos: [100, 59],
        },
      ],
    });

    assert.deepEqual(tilemap.offGridTilesAround([100, 100]), [boundaryTile]);
    assert.equal(tilemap.offGridTilesAround([100, 100], 41).length, 3);
  });

  void it('returns front palm platform rectangles with source offsets', async () => {
    const Tilemap = await getTilemap();
    const tilemap = new Tilemap();
    tilemap.loadFromData({
      tiles: {},
      off_grid_tiles: [
        {
          type: 'palm_tree/front/left',
          depth: 'front',
          status: 'animated',
          pos: [200, 180],
        },
        {
          type: 'palm_tree/front/regular',
          depth: 'front',
          status: 'animated',
          pos: [200, 180],
        },
        {
          type: 'palm_tree/front/right',
          depth: 'front',
          status: 'animated',
          pos: [200, 180],
        },
        {
          type: 'palm_tree/back/regular',
          depth: 'back',
          status: 'animated',
          pos: [200, 180],
        },
      ],
    });

    assert.deepEqual(
      tilemap.platformsAround([200, 180], 'palm_tree/front/left'),
      [{ x: 230, y: 180, width: 25, height: 1 }]
    );
    assert.deepEqual(
      tilemap.platformsAround([200, 180], 'palm_tree/front/regular'),
      [{ x: 207, y: 180, width: 25, height: 1 }]
    );
    assert.deepEqual(
      tilemap.platformsAround([200, 180], 'palm_tree/front/right'),
      [{ x: 207, y: 180, width: 25, height: 1 }]
    );
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

  void it('can exclude grid tiles that are rendered by a runtime system', async () => {
    const Tilemap = await getTilemap();
    const tilemap = new Tilemap(32);
    const { scene, draws } = createRenderScene();

    tilemap.loadFromData({
      tiles: {
        '1;2': { type: 'grass', variant: 4, loc: [1, 2] },
        '2;2': { type: 'cannon', variant: 0, loc: [2, 2] },
      },
      off_grid_tiles: [],
    });
    tilemap.frontRender(scene, [0, 0], {}, new Set(['cannon']));

    assert.deepEqual(draws, [
      { x: 32, y: 64, texture: 'grass/4', origin: [0, 0] },
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

  void it('creates a temporary plus map with variants matching each tile edge', async () => {
    const { createTemporaryPlusMap } = await getTilemapModule();
    const map = createTemporaryPlusMap();
    const tiles = Object.values(map.tiles);

    assert.equal(tiles.length, 9);
    assert.deepEqual(tiles.map((tile) => [tile.loc, tile.variant]), [
      [[8, 5], 9],
      [[9, 5], 10],
      [[10, 5], 4],
      [[11, 5], 10],
      [[12, 5], 11],
      [[10, 3], 13],
      [[10, 4], 14],
      [[10, 6], 14],
      [[10, 7], 15],
    ]);
    assert.deepEqual(map.off_grid_tiles, []);
  });

  void it('draws animated back-depth tiles behind the entity layer', async () => {
    const Tilemap = await getTilemap();
    const tilemap = new Tilemap();
    const { scene, draws } = createRenderScene();
    const animations: Record<string, AnimationFrameSource> = {
      'palm_tree/back/right': {
        img: () => 'palm_tree/back/right/2',
      },
    };

    tilemap.loadFromData({
      tiles: {},
      off_grid_tiles: [
        {
          type: 'palm_tree/back/right',
          depth: 'back',
          status: 'animated',
          pos: [32, 48],
        },
        {
          type: 'palm_tree/front/right',
          depth: 'front',
          status: 'animated',
          pos: [80, 80],
        },
        {
          type: 'palm_tree/back/left',
          depth: 'back',
          status: 'static',
          pos: [100, 100],
        },
      ],
    });
    tilemap.backRender(scene, [4, 8], animations);

    assert.deepEqual(draws, [
      {
        x: 28,
        y: 40,
        texture: 'palm_tree/back/right/2',
        origin: [0, 0],
      },
    ]);
  });

  void it('updates each animated tile type once and refreshes its rendered images', async () => {
    const Tilemap = await getTilemap();
    const tilemap = new Tilemap();
    const { scene, draws } = createRenderScene();
    const animation: TilemapAnimation & { frame: number; updates: number } = {
      frame: 0,
      updates: 0,
      indexChanged: false,
      img() {
        return `palm_tree/back/right/${this.frame}`;
      },
      update() {
        this.updates++;
        this.frame++;
        this.indexChanged = true;
      },
    };
    const animations = { 'palm_tree/back/right': animation };

    tilemap.loadFromData({
      tiles: {
        '0;0': {
          type: 'palm_tree/back/right',
          variant: 0,
          loc: [0, 0],
        },
      },
      off_grid_tiles: [
        {
          type: 'palm_tree/back/right',
          depth: 'back',
          status: 'animated',
          pos: [32, 0],
        },
        {
          type: 'palm_tree/back/right',
          depth: 'front',
          status: 'animated',
          pos: [64, 0],
        },
      ],
    });
    tilemap.backRender(scene, [0, 0], animations);
    tilemap.frontRender(scene, [0, 0], animations);
    tilemap.updateAnimations(animations);

    assert.equal(animation.updates, 1);
    assert.deepEqual(
      draws.map((draw) => draw.texture),
      [
        'palm_tree/back/right/1',
        'palm_tree/back/right/1',
        'palm_tree/back/right/1',
      ]
    );
  });
});

void describe('Tilemap autotiling', () => {
  void it('maps cardinal neighbor combinations to the source grass variants', async () => {
    const Tilemap = await getTilemap();
    const combinations: {
      neighbors: TileLocation[];
      variant: number;
    }[] = [
      { neighbors: [[0, 1], [1, 0]], variant: 0 },
      { neighbors: [[0, 1], [1, 0], [-1, 0]], variant: 1 },
      { neighbors: [[0, 1], [-1, 0]], variant: 2 },
      { neighbors: [[0, 1], [1, 0], [0, -1]], variant: 3 },
      { neighbors: [[0, 1], [1, 0], [0, -1], [-1, 0]], variant: 4 },
      { neighbors: [[0, 1], [-1, 0], [0, -1]], variant: 5 },
      { neighbors: [[1, 0], [0, -1]], variant: 6 },
      { neighbors: [[1, 0], [0, -1], [-1, 0]], variant: 7 },
      { neighbors: [[0, -1], [-1, 0]], variant: 8 },
      { neighbors: [[1, 0]], variant: 9 },
      { neighbors: [[-1, 0], [1, 0]], variant: 10 },
      { neighbors: [[-1, 0]], variant: 11 },
      { neighbors: [], variant: 12 },
      { neighbors: [[0, 1]], variant: 13 },
      { neighbors: [[0, 1], [0, -1]], variant: 14 },
      { neighbors: [[0, -1]], variant: 15 },
    ];

    for (const { neighbors, variant } of combinations) {
      const tiles: Record<string, TileData> = {
        '0;0': { type: 'grass', variant: -1, loc: [0, 0] },
      };
      for (const [x, y] of neighbors) {
        tiles[`${x};${y}`] = { type: 'grass', variant: 0, loc: [x, y] };
      }

      const tilemap = new Tilemap();
      tilemap.loadFromData({ tiles, off_grid_tiles: [] });
      tilemap.autoTile();

      assert.equal(tilemap.tiles['0;0']?.variant, variant);
    }
  });

  void it('ignores different tile types as neighbors and leaves non-grass variants unchanged', async () => {
    const Tilemap = await getTilemap();
    const tilemap = new Tilemap();
    tilemap.loadFromData({
      tiles: {
        '0;0': { type: 'grass', variant: 7, loc: [0, 0] },
        '-1;0': { type: 'spawner', variant: 0, loc: [-1, 0] },
        '10;10': { type: 'spawner', variant: 3, loc: [10, 10] },
        '11;10': { type: 'spawner', variant: 2, loc: [11, 10] },
      },
      off_grid_tiles: [],
    });

    tilemap.autoTile();

    assert.equal(tilemap.tiles['0;0']?.variant, 12);
    assert.equal(tilemap.tiles['10;10']?.variant, 3);
  });
});
