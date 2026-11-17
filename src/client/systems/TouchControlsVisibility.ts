export const MOBILE_VIEWPORT_MAX_WIDTH = 768;

export function shouldShowTouchControls(
  viewportWidth: number,
  touchPrimaryInput: boolean,
  debugEnabled: boolean,
  showTouchControlsOnDesktop: boolean
): boolean {
  return (
    (viewportWidth > 0 &&
      (viewportWidth <= MOBILE_VIEWPORT_MAX_WIDTH || touchPrimaryInput)) ||
    (debugEnabled && showTouchControlsOnDesktop)
  );
}
