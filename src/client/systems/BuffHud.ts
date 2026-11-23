export type BuffIndicatorId = 'frenzy' | 'shield';

export function getBuffIndicatorOrder(
  previousOrder: readonly BuffIndicatorId[],
  activeBuffs: readonly BuffIndicatorId[]
): BuffIndicatorId[] {
  const activeBuffSet = new Set(activeBuffs);
  const nextOrder = previousOrder.filter((buff) => activeBuffSet.has(buff));

  for (const buff of activeBuffs) {
    if (!nextOrder.includes(buff)) {
      nextOrder.push(buff);
    }
  }

  return nextOrder;
}
