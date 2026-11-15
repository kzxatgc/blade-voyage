import type { EntityPosition, EntityType } from './types';

export const WINDOW_WIDTH = 1280;
export const WINDOW_HEIGHT = 680;

export const DISPLAY_WIDTH = 640;
export const DISPLAY_HEIGHT = 340;

export const TILE_SIZE = 32;
export const GRAVITY = 0.5;
export const MAX_FALL_SPEED = 5;
export const CAMERA_SMOOTHING = 40;
export const TICK_RATE = 60;
export const TARGET_FPS = 144;
export const PHYSICAL_TILES = new Set(['grass']);
export const RECT_POS_ADJUSTMENT: Readonly<
  Record<EntityType, EntityPosition>
> = {
  player: [22, 4],
  sword: [0, 0],
  'enemy/pink_star': [4, 6],
  'enemy/crabby': [20, 3],
  'enemy/fierce_tooth': [5, 8],
};

export type RgbColor = [number, number, number];

export const FIERY_BURST_COLORS: RgbColor[] = [
  [255, 255, 255],
  [255, 215, 0],
  [255, 140, 0],
  [255, 69, 0],
  [139, 0, 0],
];

export const GRASS_COLORS: RgbColor[] = [
  [124, 171, 110],
  [62, 89, 67],
];

export const RENDER_DEPTH = {
  BACKGROUND: 0,
  BACK_TILES: 1,
  EMBEDDED_SWORD: 2,
  FRONT_TILES: 4,
  ENTITIES: 5,
  EFFECTS: 6,
  PARTICLES: 7,
  DEBUG: 10,
} as const;

export const HEART_COLORS: RgbColor[] = [
  [255, 0, 0],
  [220, 20, 60],
  [139, 0, 0],
  [60, 0, 0],
];
