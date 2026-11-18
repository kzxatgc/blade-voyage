import * as Phaser from 'phaser';

export const SOUND_STORAGE_KEY = 'blade-voyage:sound-enabled';
export const SETTINGS_BUTTON_SIZE_CSS = 56;
export const SETTINGS_BUTTON_MARGIN_CSS = 12;
export const SETTINGS_BUTTON_ICON_SIZE_CSS = 32;

const SETTINGS_TOGGLE_SCALE = 1.16;
const SETTINGS_TOGGLE_DURATION_MS = 85;

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
