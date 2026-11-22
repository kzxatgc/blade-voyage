export const HEALTH_SPRITE_KEY = 'player-health';
export const HEALTH_SPRITE_FRAME_SIZE = 32;
export const HEALTH_SPRITE_FRAME_COUNT = 5;
export const HEALTH_SPRITE_VISIBLE_TOP_PX = 5;
export const HEALTH_INDICATOR_SIZE_CSS = 84;
export const HEALTH_GAIN_PULSE_SCALE = 1.18;
export const HEALTH_GAIN_PULSE_DURATION_MS = 140;

export function getHealthSpriteFrame(health: number, maxHealth: number): number {
  if (
    !Number.isFinite(health) ||
    !Number.isFinite(maxHealth) ||
    maxHealth <= 0
  ) {
    throw new RangeError(
      'Health must be finite and maximum health must be finite and positive.'
    );
  }

  const clampedHealth = Math.max(0, Math.min(health, maxHealth));
  const missingHealthRatio = 1 - clampedHealth / maxHealth;
  return Math.round(missingHealthRatio * (HEALTH_SPRITE_FRAME_COUNT - 1));
}
