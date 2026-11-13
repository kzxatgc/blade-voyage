import type {
  MapData,
  OffGridTile,
  TileData,
  TileLocation,
} from '../../shared/types';

export interface TilemapRenderImage {
  setOrigin(x: number, y: number): void;
}

export interface TilemapRenderScene {
  add: {
    image(x: number, y: number, texture: string): TilemapRenderImage;
  };
}

export interface AnimationFrameSource {
  img(): string;
}

export function createTemporaryPlusMap(): MapData {
  const locations: TileLocation[] = [
    [8, 5],
    [9, 5],
    [10, 5],
    [11, 5],
    [12, 5],
    [10, 3],
    [10, 4],
    [10, 6],
    [10, 7],
  ];
  const tiles: Record<string, TileData> = {};

  locations.forEach((loc, variant) => {
    tiles[`${loc[0]};${loc[1]}`] = { type: 'grass', variant, loc };
  });

  return { tiles, off_grid_tiles: [] };
}

export class Tilemap {
  tiles: Record<string, TileData> = {};
  offGridTiles: OffGridTile[] = [];
  readonly tileSize: number;

  constructor(size = 32) {
    this.tileSize = size;
  }

  load(data: MapData) {
    this.loadFromData(data);
  }

  loadFromData(data: MapData) {
    this.tiles = data.tiles;
    this.offGridTiles = data.off_grid_tiles;
  }

  save(): MapData {
    return {
      tiles: this.tiles,
      off_grid_tiles: this.offGridTiles,
    };
  }

  extract(idPairs: readonly (readonly [string, number])[], keep = true) {
    const matches: TileData[] = [];

    for (const [location, tile] of Object.entries(this.tiles)) {
      if (
        !idPairs.some(
          ([type, variant]) =>
            tile.type === type && tile.variant === variant
        )
      ) {
        continue;
      }

      matches.push({ ...tile });
      if (!keep) {
        delete this.tiles[location];
      }
    }

    return matches;
  }

  frontRender(
    scene: TilemapRenderScene,
    offset: TileLocation = [0, 0],
    animations: Readonly<Record<string, AnimationFrameSource>> = {}
  ) {
    for (const tile of Object.values(this.tiles)) {
      scene.add
        .image(
          tile.loc[0] * this.tileSize - offset[0],
          tile.loc[1] * this.tileSize - offset[1],
          `${tile.type}/${tile.variant}`
        )
        .setOrigin(0, 0);
    }

    for (const tile of this.offGridTiles) {
      if (tile.depth !== 'front' || tile.status !== 'animated') {
        continue;
      }

      const animation = animations[tile.type];
      if (!animation) {
        throw new Error(`Missing animation for front tile "${tile.type}".`);
      }

      scene.add
        .image(
          tile.pos[0] - offset[0],
          tile.pos[1] - offset[1],
          animation.img()
        )
        .setOrigin(0, 0);
    }
  }
}
