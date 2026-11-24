export function getLoadingRunnerCenterX(
  barLeftX: number,
  progress: number,
  runnerWidth: number,
  barWidth: number,
  endCapRatio: number
): number {
  if (
    !Number.isFinite(barLeftX) ||
    !Number.isFinite(progress) ||
    progress < 0 ||
    progress > 1 ||
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

  const minimumCenterX = barLeftX + runnerWidth / 2;
  const maximumCenterX = barLeftX + barWidth * endCapRatio;
  return minimumCenterX + (maximumCenterX - minimumCenterX) * progress;
}
