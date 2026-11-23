export function getLoadingRunnerCenterX(
  barLeftX: number,
  barFillWidth: number,
  runnerWidth: number,
  barWidth: number,
  endCapRatio: number
): number {
  if (
    !Number.isFinite(barLeftX) ||
    !Number.isFinite(barFillWidth) ||
    barFillWidth < 0 ||
    !Number.isFinite(runnerWidth) ||
    runnerWidth <= 0 ||
    !Number.isFinite(barWidth) ||
    barWidth <= 0 ||
    !Number.isFinite(endCapRatio) ||
    endCapRatio <= 0 ||
    endCapRatio > 1
  ) {
    throw new RangeError('Loading runner layout values are invalid.');
  }

  const runnerHalfWidth = runnerWidth / 2;
  const minimumCenterX = barLeftX + runnerHalfWidth;
  const maximumCenterX = barLeftX + barWidth * endCapRatio;
  const fillEndX = barLeftX + barFillWidth;
  return Math.max(minimumCenterX, Math.min(fillEndX, maximumCenterX));
}
