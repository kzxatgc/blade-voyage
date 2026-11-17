import type { TouchControlsMode } from '../../shared/types';

export const MOBILE_VIEWPORT_MAX_WIDTH = 768;

export function shouldShowTouchControls(
  viewportWidth: number,
  touchPrimaryInput: boolean,
  debugEnabled: boolean,
  showTouchControlsOnDesktop: boolean,
  mode?: TouchControlsMode
): boolean {
  if (mode === 'on') {
    return true;
  }
  if (mode === 'off') {
    return false;
  }

  return (
    (viewportWidth > 0 &&
      (viewportWidth <= MOBILE_VIEWPORT_MAX_WIDTH || touchPrimaryInput)) ||
    (debugEnabled && showTouchControlsOnDesktop)
  );
}
