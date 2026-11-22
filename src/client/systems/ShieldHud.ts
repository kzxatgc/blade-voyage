import {
  HEALTH_SPRITE_FRAME_SIZE,
  HEALTH_SPRITE_VISIBLE_TOP_PX,
} from './HealthHud.ts';

export const SHIELD_HUD_SPRITE_KEY = 'shield-hud';
export const SHIELD_HUD_FRAME_SIZE = 32;
export const SHIELD_HUD_VISIBLE_TOP_PX = 5;
export const SHIELD_HUD_FILL_STATES = 8;
export const SHIELD_HUD_ANIMATION_FRAMES = 8;
export const SHIELD_HUD_ANIMATION_FRAME_TICKS = 4;
export const SHIELD_HUD_ICON_SIZE_CSS = 48;
export const SHIELD_HUD_ICON_GAP_CSS = 8;

export function isShieldHudVisible(
  shieldTicksRemaining: number,
  playerIsDead: boolean
): boolean {
  return shieldTicksRemaining > 0 && !playerIsDead;
}

export function getShieldHudTopAlignedCenterY(
  healthImageTop: number,
  healthImageSize: number,
  shieldImageSize: number
): number {
  const healthVisibleTop =
    healthImageTop +
    (HEALTH_SPRITE_VISIBLE_TOP_PX / HEALTH_SPRITE_FRAME_SIZE) *
      healthImageSize;
  const shieldVisibleTopOffset =
    (SHIELD_HUD_VISIBLE_TOP_PX / SHIELD_HUD_FRAME_SIZE) * shieldImageSize;
  return healthVisibleTop + shieldImageSize / 2 - shieldVisibleTopOffset;
}

export function getShieldHudFrame(
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
    throw new RangeError('Shield HUD progress and elapsed ticks are invalid.');
  }

  const fillColumn = Math.round(
    (1 - remainingProgress) * (SHIELD_HUD_FILL_STATES - 1)
  );
  const animationRow =
    Math.floor(elapsedTicks / SHIELD_HUD_ANIMATION_FRAME_TICKS) %
    SHIELD_HUD_ANIMATION_FRAMES;
  return animationRow * SHIELD_HUD_FILL_STATES + fillColumn;
}
