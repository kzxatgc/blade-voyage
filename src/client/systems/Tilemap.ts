import type { MapData, OffGridTile, TileData } from '../../shared/types';

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
}
