import type { EntityPosition, EntityType } from './types';

export const WINDOW_WIDTH = 1280;
export const WINDOW_HEIGHT = 680;

export const DISPLAY_WIDTH = 640;
export const DISPLAY_HEIGHT = 340;

export const TILE_SIZE = 32;
export const GRAVITY = 0.5;
export const MAX_FALL_SPEED = 5;
export const CAMERA_SMOOTHING = 40;
// Camera scroll clamp bounds relative to player center (from game.py lines 223-234)
export const CAMERA_BOUNDS_X = 7 * TILE_SIZE;       // ±224px horizontal
export const CAMERA_BOUNDS_Y_UP = 2 * TILE_SIZE;    //  -64px above player center
export const CAMERA_BOUNDS_Y_DOWN = 2 * TILE_SIZE;  // +64px below player center
export const TICK_RATE = 60;
export const TARGET_FPS = 144;
export const MAX_FRAME_DELTA = 100;
// Camera zoom levels (matches game.py lines 152-198)
export const ZOOM_LEVELS = [1.0, 2.0, 3.0] as const;
export const DEFAULT_ZOOM = 2.0;
export const ZOOM_EASING_SPEED = 0.08;
export const PHYSICAL_TILES = new Set(['grass']);
export const RECT_POS_ADJUSTMENT: Readonly<
  Record<EntityType, EntityPosition>
> = {
  player: [22, 4],
  sword: [0, 0],
  potion: [0, 0],
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
  WATER: 0.5,
  WATER_REFLECTIONS: 0.75,
  BACK_TILES: 1,
  EMBEDDED_SWORD: 2,
  FRONT_TILES: 4,
  ENTITIES: 5,
  WEAPON_EFFECTS: 5.5,
  EFFECTS: 6,
  PARTICLES: 7,
  DEBUG: 10,
  HUD: 11,
  HUD_OVERLAY: 12,
  HUD_MODAL: 13,
} as const;

export const HEART_COLORS: RgbColor[] = [
  [255, 0, 0],
  [220, 20, 60],
  [139, 0, 0],
  [60, 0, 0],
];
