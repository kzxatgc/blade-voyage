import type * as Phaser from 'phaser';

export const SOUND_STORAGE_KEY = 'blade-voyage:sound-enabled';
export const SETTINGS_BUTTON_SIZE_CSS = 64;
export const SETTINGS_BUTTON_MIN_SIZE_CSS = 48;
export const SETTINGS_BUTTON_MARGIN_CSS = 12;
export const SETTINGS_BUTTON_ICON_SIZE_CSS = 37;
export const SETTINGS_UI_SCALE_BREAKPOINT_CSS = 931.08;
export const SETTINGS_PANEL_MAX_HEIGHT_RATIO = 0.5;

const SETTINGS_TOGGLE_SCALE = 1.16;
const SETTINGS_TOGGLE_DURATION_MS = 85;

export const getResponsiveSettingsScale = (canvasWidthCss: number): number =>
  Math.max(
    SETTINGS_BUTTON_MIN_SIZE_CSS / SETTINGS_BUTTON_SIZE_CSS,
    Math.min(1, canvasWidthCss / SETTINGS_UI_SCALE_BREAKPOINT_CSS)
  );

export const getResponsiveSettingsPanelScale = (
  canvasWidthCss: number,
  canvasHeightCss: number,
  panelWidthCss: number,
  panelHeightCss: number,
  safeMarginCss: number
): number => {
  const availableWidthCss = Math.max(1, canvasWidthCss - safeMarginCss * 2);
  const availableHeightCss = Math.max(1, canvasHeightCss - safeMarginCss * 2);
  const maxHeightCss = canvasHeightCss * SETTINGS_PANEL_MAX_HEIGHT_RATIO;

  return Math.min(
    1,
    availableWidthCss / panelWidthCss,
    availableHeightCss / panelHeightCss,
    maxHeightCss / panelHeightCss
  );
};

export const animateSettingsToggleIcon = (
  scene: Phaser.Scene,
  icon: Phaser.GameObjects.Image,
  baseScaleX: number,
  baseScaleY: number
): void => {
  scene.tweens.killTweensOf(icon);
  icon.setScale(baseScaleX, baseScaleY);
  scene.tweens.add({
    targets: icon,
    scaleX: baseScaleX * SETTINGS_TOGGLE_SCALE,
    scaleY: baseScaleY * SETTINGS_TOGGLE_SCALE,
    duration: SETTINGS_TOGGLE_DURATION_MS,
    ease: 'Sine.Out',
    yoyo: true,
  });
};
