export const SHIELD_EFFECT_SPRITE_KEY = 'shield-player-effect';
export const SHIELD_EFFECT_FRAME_SIZE = 32;
export const SHIELD_EFFECT_DISPLAY_SIZE = 48;
export const SHIELD_EFFECT_OFFSET_Y = 1;

export const SHIELD_ACTIVE_FIRST_FRAME = 13;
export const SHIELD_ACTIVE_FRAME_COUNT = 3;
export const SHIELD_ACTIVE_FRAME_TICKS = 6;

export const SHIELD_BREAK_FIRST_FRAME = 56;
export const SHIELD_BREAK_FRAME_COUNT = 4;
export const SHIELD_BREAK_FRAME_TICKS = 4;
export const SHIELD_BREAK_DURATION_TICKS =
  SHIELD_BREAK_FRAME_COUNT * SHIELD_BREAK_FRAME_TICKS;

function assertValidElapsedTicks(elapsedTicks: number): void {
  if (!Number.isInteger(elapsedTicks) || elapsedTicks < 0) {
    throw new RangeError('Shield effect elapsed ticks are invalid.');
  }
}

export function getShieldActiveFrame(elapsedTicks: number): number {
  assertValidElapsedTicks(elapsedTicks);
  return (
    SHIELD_ACTIVE_FIRST_FRAME +
    Math.floor(elapsedTicks / SHIELD_ACTIVE_FRAME_TICKS) %
      SHIELD_ACTIVE_FRAME_COUNT
  );
}

export function getShieldBreakFrame(
  elapsedTicks: number
): number | undefined {
  assertValidElapsedTicks(elapsedTicks);
  if (elapsedTicks >= SHIELD_BREAK_DURATION_TICKS) {
    return undefined;
  }
  return (
    SHIELD_BREAK_FIRST_FRAME +
    Math.floor(elapsedTicks / SHIELD_BREAK_FRAME_TICKS)
  );
}
