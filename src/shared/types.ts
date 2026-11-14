export type TileLocation = [number, number];

export type EntityPosition = [number, number];
export type EntitySize = [number, number];
export type EntityType =
  | 'player'
  | 'sword'
  | 'enemy/pink_star'
  | 'enemy/crabby'
  | 'enemy/fierce_tooth';

export interface EntityRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EntityCollision {
  right: boolean;
  left: boolean;
  bottom: boolean;
  regular: boolean;
}

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
