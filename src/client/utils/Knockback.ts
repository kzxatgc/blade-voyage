import type { EntityRect } from '../../shared/types.ts';

export type KnockbackDirection = -1 | 1;

export const getHorizontalKnockbackDirection = (
  source: EntityRect,
  target: EntityRect,
  fallbackDirection: KnockbackDirection
): KnockbackDirection => {
  const sourceCenterX = source.x + source.width / 2;
  const targetCenterX = target.x + target.width / 2;
  if (targetCenterX === sourceCenterX) {
    return fallbackDirection;
  }
  return targetCenterX > sourceCenterX ? 1 : -1;
};
