import {
  HEALTH_SPRITE_FRAME_SIZE,
  HEALTH_SPRITE_VISIBLE_TOP_PX,
} from './HealthHud.ts';

export const FRENZY_HUD_SPRITE_KEY = 'frenzy-bolt-hud';
export const FRENZY_HUD_FRAME_SIZE = 32;
export const FRENZY_HUD_VISIBLE_TOP_PX = 3;
export const FRENZY_HUD_FILL_STATES = 8;
export const FRENZY_HUD_ARC_FRAMES = 8;
export const FRENZY_HUD_ARC_FRAME_TICKS = 6;
export const FRENZY_HUD_ICON_SIZE_CSS = 48;
export const FRENZY_HUD_ICON_GAP_CSS = 8;

export function getFrenzyHudTopAlignedCenterY(
  healthImageTop: number,
  healthImageSize: number,
  frenzyImageSize: number
): number {
  const healthVisibleTop =
    healthImageTop +
    (HEALTH_SPRITE_VISIBLE_TOP_PX / HEALTH_SPRITE_FRAME_SIZE) *
      healthImageSize;
  const frenzyVisibleTopOffset =
    (FRENZY_HUD_VISIBLE_TOP_PX / FRENZY_HUD_FRAME_SIZE) * frenzyImageSize;
  return healthVisibleTop + frenzyImageSize / 2 - frenzyVisibleTopOffset;
}

export function getFrenzyHudFrame(
  remainingProgress: number,
  elapsedTicks: number
): number {
  if (
    !Number.isFinite(remainingProgress) ||
    remainingProgress < 0 ||
    remainingProgress > 1 ||
    !Number.isInteger(elapsedTicks) ||
    elapsedTicks < 0
  ) {
    throw new RangeError('Frenzy HUD progress and elapsed ticks are invalid.');
  }

  const fillColumn = Math.round(
    (1 - remainingProgress) * (FRENZY_HUD_FILL_STATES - 1)
  );
  const arcRow =
    Math.floor(elapsedTicks / FRENZY_HUD_ARC_FRAME_TICKS) %
    FRENZY_HUD_ARC_FRAMES;
  return arcRow * FRENZY_HUD_FILL_STATES + fillColumn;
}
