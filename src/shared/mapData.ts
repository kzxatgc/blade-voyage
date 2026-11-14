import type { MapData, OffGridTile, TileData, TileLocation } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTileLocation(value: unknown): value is TileLocation {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(
      (coordinate) =>
        typeof coordinate === 'number' && Number.isFinite(coordinate)
    )
  );
}

function isTileData(value: unknown): value is TileData {
  return (
    isRecord(value) &&
    typeof value.type === 'string' &&
    Number.isInteger(value.variant) &&
    isTileLocation(value.loc)
  );
}

function isOffGridTile(value: unknown): value is OffGridTile {
  return (
    isRecord(value) &&
    typeof value.type === 'string' &&
    (value.variant === undefined || Number.isInteger(value.variant)) &&
    (value.depth === 'back' || value.depth === 'front') &&
    (value.status === 'static' || value.status === 'animated') &&
    isTileLocation(value.pos)
  );
}

export function isMapData(value: unknown): value is MapData {
  return (
    isRecord(value) &&
    isRecord(value.tiles) &&
    Object.values(value.tiles).every(isTileData) &&
    Array.isArray(value.off_grid_tiles) &&
    value.off_grid_tiles.every(isOffGridTile)
  );
}
