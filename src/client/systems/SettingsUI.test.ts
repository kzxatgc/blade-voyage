/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getResponsiveSettingsPanelScale,
  getResponsiveSettingsScale,
  SETTINGS_BUTTON_MIN_SIZE_CSS,
  SETTINGS_BUTTON_SIZE_CSS,
  SETTINGS_PANEL_MAX_HEIGHT_RATIO,
  SETTINGS_UI_SCALE_BREAKPOINT_CSS,
} from './SettingsUI.ts';

void describe('responsive settings UI scale', () => {
  void it('scales down to the minimum size and caps at that scale', () => {
    const minimumScale =
      SETTINGS_BUTTON_MIN_SIZE_CSS / SETTINGS_BUTTON_SIZE_CSS;
    const minimumWidth = SETTINGS_UI_SCALE_BREAKPOINT_CSS * minimumScale;

    assert.equal(getResponsiveSettingsScale(SETTINGS_UI_SCALE_BREAKPOINT_CSS), 1);
    assert.ok(getResponsiveSettingsScale((minimumWidth + SETTINGS_UI_SCALE_BREAKPOINT_CSS) / 2) < 1);
    assert.equal(getResponsiveSettingsScale(minimumWidth), minimumScale);
    assert.equal(getResponsiveSettingsScale(minimumWidth / 2), minimumScale);
  });

  void it('keeps the panel at its base size until height or width requires scaling', () => {
    const panelWidth = 300;
    const panelHeight = 218;
    const safeMargin = 24;

    assert.equal(
      getResponsiveSettingsPanelScale(390, 844, panelWidth, panelHeight, safeMargin),
      1
    );
    assert.equal(
      getResponsiveSettingsPanelScale(390, 240, panelWidth, panelHeight, safeMargin),
      (240 * SETTINGS_PANEL_MAX_HEIGHT_RATIO) / panelHeight
    );
    assert.equal(
      getResponsiveSettingsPanelScale(320, 844, panelWidth, panelHeight, safeMargin),
      (320 - safeMargin * 2) / panelWidth
    );
  });
});
