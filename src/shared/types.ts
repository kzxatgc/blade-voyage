export type TileLocation = [number, number];

export type EntityPosition = [number, number];
export type EntitySize = [number, number];
export type TouchMovementInput = { left: boolean; right: boolean };
export type TouchControlsMode = 'on' | 'off';
export type EntityType =
  | 'player'
  | 'sword'
  | 'potion'
  | 'enemy/pink_star'
  | 'enemy/crabby'
  | 'enemy/fierce_tooth';

/** Valid discrete zoom steps for the camera (1x, 2x, 3x) */
export type ZoomLevel = 1.0 | 2.0 | 3.0;

export interface EntityRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Rect {
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
