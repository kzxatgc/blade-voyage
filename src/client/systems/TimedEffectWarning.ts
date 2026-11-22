import { BLINK_INTERVAL_TICKS, FAST_BLINK_INTERVAL_TICKS } from './Blink.ts';

export const TIMED_EFFECT_WARNING_SPEED_MULTIPLIER = 1.4;

const WARNING_START_RATIO = 0.3;
const WARNING_FAST_RATIO = 0.1;

export function getTimedEffectWarningAlpha(
  ticksRemaining: number,
  durationTicks: number
): number {
  if (
    !Number.isInteger(ticksRemaining) ||
    ticksRemaining < 0 ||
    !Number.isInteger(durationTicks) ||
    durationTicks <= 0
  ) {
    throw new RangeError('Timed effect warning ticks are invalid.');
  }
  const warningStartTicks = Math.round(
    durationTicks * WARNING_START_RATIO
  );
  const warningFastTicks = Math.round(durationTicks * WARNING_FAST_RATIO);
  if (ticksRemaining > warningStartTicks) {
    return 1;
  }

  const blinkIntervalTicks =
    ticksRemaining <= warningFastTicks
      ? FAST_BLINK_INTERVAL_TICKS
      : BLINK_INTERVAL_TICKS;
  const tierStartTicks =
    ticksRemaining <= warningFastTicks ? warningFastTicks : warningStartTicks;
  const tierElapsedTicks = tierStartTicks - ticksRemaining;
  const blinkPhase = Math.floor(
    (tierElapsedTicks * TIMED_EFFECT_WARNING_SPEED_MULTIPLIER) /
      blinkIntervalTicks
  );
  return blinkPhase % 2 === 0 ? 1 : 0;
}
