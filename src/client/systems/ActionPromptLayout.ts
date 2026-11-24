export const getActionPromptUnitScale = (
  sceneWidth: number,
  sceneHeight: number,
  canvasWidth: number,
  canvasHeight: number
): number => {
  if (
    !Number.isFinite(sceneWidth) ||
    sceneWidth <= 0 ||
    !Number.isFinite(sceneHeight) ||
    sceneHeight <= 0 ||
    !Number.isFinite(canvasWidth) ||
    canvasWidth <= 0 ||
    !Number.isFinite(canvasHeight) ||
    canvasHeight <= 0
  ) {
    return 1;
  }

  return Math.min(
    sceneWidth / canvasWidth,
    sceneHeight / canvasHeight
  );
};
