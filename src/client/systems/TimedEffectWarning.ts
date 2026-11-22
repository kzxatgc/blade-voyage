import { TICK_RATE } from '../../shared/constants.ts';
import { BLINK_INTERVAL_TICKS, FAST_BLINK_INTERVAL_TICKS } from './Blink.ts';

export const TIMED_EFFECT_WARNING_START_TICKS = 3 * TICK_RATE;
export const TIMED_EFFECT_WARNING_FAST_TICKS = TICK_RATE;
export const TIMED_EFFECT_WARNING_SPEED_MULTIPLIER = 1.4;

export function getTimedEffectWarningAlpha(ticksRemaining: number): number {
  if (!Number.isInteger(ticksRemaining) || ticksRemaining < 0) {
    throw new RangeError('Timed effect warning ticks are invalid.');
  }
  if (ticksRemaining > TIMED_EFFECT_WARNING_START_TICKS) {
    return 1;
  }

  const blinkIntervalTicks =
    ticksRemaining <= TIMED_EFFECT_WARNING_FAST_TICKS
      ? FAST_BLINK_INTERVAL_TICKS
      : BLINK_INTERVAL_TICKS;
  const tierStartTicks =
    ticksRemaining <= TIMED_EFFECT_WARNING_FAST_TICKS
      ? TIMED_EFFECT_WARNING_FAST_TICKS
      : TIMED_EFFECT_WARNING_START_TICKS;
  const tierElapsedTicks = tierStartTicks - ticksRemaining;
  const blinkPhase = Math.floor(
    (tierElapsedTicks * TIMED_EFFECT_WARNING_SPEED_MULTIPLIER) /
      blinkIntervalTicks
  );
  return blinkPhase % 2 === 0 ? 1 : 0;
}
