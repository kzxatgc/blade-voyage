export type TileLocation = [number, number];

export interface TileData {
  type: string;
  variant: number;
  loc: TileLocation;
}

export interface OffGridTile {
  type: string;
  variant?: number;
  depth: 'back' | 'front';
  status: 'static' | 'animated';
  pos: [number, number];
}

export interface MapData {
  tiles: Record<string, TileData>;
  off_grid_tiles: OffGridTile[];
}
