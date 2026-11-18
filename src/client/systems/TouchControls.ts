import * as Phaser from 'phaser';
import { RENDER_DEPTH } from '../../shared/constants';
import { DEBUG_CONFIG } from '../../shared/debug';
import type { TouchControlsMode, TouchMovementInput } from '../../shared/types';
import {
  animateSettingsToggleIcon,
  SETTINGS_BUTTON_ICON_SIZE_CSS,
  SETTINGS_BUTTON_MARGIN_CSS,
  SETTINGS_BUTTON_SIZE_CSS,
  SOUND_STORAGE_KEY,
} from './SettingsUI';
import { shouldShowTouchControls } from './TouchControlsVisibility';

export type TouchControlActions = {
  down: () => void;
  jump: () => void;
  attack: () => void;
  throw: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  setPickupHintEnabled: (enabled: boolean) => void;
  setGamePaused: (paused: boolean) => void;
  playUiClick: () => void;
  returnToLevelPicker: () => void;
  levelNumber: number;
};

type TouchButton = 'left' | 'right' | 'down' | 'jump' | 'attack' | 'throw';
type SettingsCategory = 'sound' | 'controls' | 'hint';
type SettingsItem = SettingsCategory;
type TouchSettingsBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};
type SettingsToggleScales = {
  iconX: number;
  iconY: number;
};

const BUTTON_TEXTURES: Record<TouchButton, string> = {
  left: 'touch-left',
  right: 'touch-right',
  down: 'touch-down',
  jump: 'touch-jump',
  attack: 'touch-throw',
  throw: 'touch-attack',
};

const BUTTON_WIDTH = 96;
const BUTTON_HEIGHT = 96;
const BUTTON_IMAGE_SIZE = 72;
const BUTTON_IMAGE_RATIO = BUTTON_IMAGE_SIZE / BUTTON_WIDTH;
const BUTTON_PRESSED_SCALE = 0.9;
const BUTTON_PRESS_DURATION_MS = 70;
const BUTTON_RELEASE_DURATION_MS = 140;
const MIN_HIT_TARGET_CSS_SIZE = 48;
const BUTTON_MARGIN = 24;
const BUTTON_GAP = 12;
const SETTINGS_STORAGE_KEY = 'blade-voyage:touch-controls-mode';
const PICKUP_HINT_STORAGE_KEY = 'blade-voyage:pickup-hint-enabled';
const SETTINGS_PANEL_SCALE = 1.2;
const SETTINGS_PANEL_WIDTH_CSS = Math.round(250 * SETTINGS_PANEL_SCALE);
const SETTINGS_PANEL_HEIGHT_CSS = Math.round(182 * SETTINGS_PANEL_SCALE);
const SETTINGS_TITLE_FONT_SIZE = Math.round(18 * SETTINGS_PANEL_SCALE);
const SETTINGS_LEVEL_FONT_SIZE = 18;
const SETTINGS_TITLE_TOP_OFFSET_CSS = 60;
const SETTINGS_PANEL_SAFE_MARGIN_CSS = 24;
const SETTINGS_TOGGLE_HIT_HEIGHT_CSS = 54;
const SETTINGS_LEVEL_BOTTOM_MARGIN_CSS = 32;
const SETTINGS_HOME_X_CSS = -84;
const SETTINGS_HOME_ICON_SIZE_CSS = 64;
const SETTINGS_CENTER_ITEM_OPTICAL_OFFSET_CSS = 1.25;
const SETTINGS_ITEM_X_CSS: Record<SettingsItem, number> = {
  sound: -28,
  hint: 28 + SETTINGS_CENTER_ITEM_OPTICAL_OFFSET_CSS,
  controls: 84,
};
const SETTINGS_ITEM_Y_CSS = 12;
const SETTINGS_ITEM_ICON_SIZE_CSS: Record<SettingsItem, number> = {
  sound: 64,
  controls: 52,
  hint: 52,
};
const SETTINGS_CATEGORIES: SettingsCategory[] = ['sound', 'hint', 'controls'];
const SETTINGS_ITEMS: SettingsItem[] = ['sound', 'hint', 'controls'];

export class TouchControls {
  readonly movement: TouchMovementInput = { left: false, right: false };

  private readonly browserWindow: Window;
  private readonly buttons = new Map<
    TouchButton,
    Phaser.GameObjects.Container
  >();
  private readonly buttonImages = new Map<
    TouchButton,
    Phaser.GameObjects.Image
  >();
  private readonly buttonImageScales = new Map<TouchButton, [number, number]>();
  private readonly buttonPositions = new Map<TouchButton, [number, number]>();
  private readonly activePointers = new Map<number, TouchButton>();
  private readonly pointersDown = new Set<number>();
  private readonly touchPrimaryInputQuery: MediaQueryList;
  private readonly settingsToggleBounds = new Map<
    SettingsItem,
    TouchSettingsBounds
  >();
  private settingsHomeBounds: TouchSettingsBounds = {
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  };
  private readonly settingsToggleIcons = new Map<
    SettingsItem,
    Phaser.GameObjects.Image
  >();
  private readonly settingsToggleScales = new Map<
    SettingsItem,
    SettingsToggleScales
  >();
  private readonly settingsToggleDisplaySizes = new Map<
    SettingsItem,
    number
  >();
  private readonly handleInputModeChange = (): void => this.handleResize();
  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Escape' && this.settingsOpen) {
      this.setSettingsOpen(false);
    }
  };
  private settingsRoot!: Phaser.GameObjects.Container;
  private settingsMenu!: Phaser.GameObjects.Container;
  private settingsBackdrop!: Phaser.GameObjects.Rectangle;
  private settingsPanelImage!: Phaser.GameObjects.Image;
  private settingsHomeIcon!: Phaser.GameObjects.Image;
  private settingsLevelLabel!: Phaser.GameObjects.BitmapText;
  private settingsButtonBackground!: Phaser.GameObjects.Image;
  private settingsButtonIcon!: Phaser.GameObjects.Image;
  private settingsButtonBackgroundScaleX = 1;
  private settingsButtonBackgroundScaleY = 1;
  private settingsButtonScaleX = 1;
  private settingsButtonScaleY = 1;
  private settingsTitle!: Phaser.GameObjects.BitmapText;
  private settingsStatus!: Phaser.GameObjects.BitmapText;
  private settingsButtonBounds: TouchSettingsBounds = {
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  };
  private mode: TouchControlsMode = 'off';
  private soundEnabled = true;
  private pickupHintEnabled = true;
  private hasManualPreference = false;
  private settingsOpen = false;
  private persistenceUnavailable = false;
  private enabled = false;
  private lastZoom = 0;
  private lastWidth = 0;
  private lastHeight = 0;
  private lastCanvasWidth = 0;
  private lastButtonSize = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly actions: TouchControlActions
  ) {
    const browserWindow = scene.game.canvas.ownerDocument.defaultView;
    if (!browserWindow) {
      throw new Error('Touch controls require a browser window.');
    }
    this.browserWindow = browserWindow;
    this.touchPrimaryInputQuery = browserWindow.matchMedia(
      '(pointer: coarse) and (hover: none)'
    );
    const savedMode = this.readSavedMode();
    this.hasManualPreference = savedMode !== undefined;
    this.mode = savedMode ?? this.detectMode(this.getCanvasWidth());
    this.soundEnabled = this.readSavedSoundPreference() ?? true;
    this.actions.setSoundEnabled(this.soundEnabled);
    this.pickupHintEnabled = this.readSavedPickupHintPreference() ?? true;
    this.actions.setPickupHintEnabled(this.pickupHintEnabled);
    this.touchPrimaryInputQuery.addEventListener(
      'change',
      this.handleInputModeChange
    );
    scene.input.on('pointerdown', this.handlePointerDown, this);
    scene.input.on('pointermove', this.handlePointerMove, this);
    scene.input.on('pointerup', this.handlePointerUp, this);
    scene.input.on('pointerupoutside', this.handlePointerUp, this);
    scene.input.on('pointerout', this.handlePointerUp, this);
    scene.input.keyboard?.on('keydown', this.handleKeyDown, this);
    scene.scale.on('resize', this.handleResize, this);
    scene.events.once('shutdown', this.destroy, this);
    this.createSettingsUI();
    this.layoutSettingsUI();
    this.updateVisibility(this.getCanvasWidth());
  }

  update(): void {
    const canvasWidth = this.getCanvasWidth();
    const layoutChanged =
      this.lastZoom !== this.scene.cameras.main.zoom ||
      this.lastWidth !== this.scene.scale.width ||
      this.lastHeight !== this.scene.scale.height ||
      this.lastCanvasWidth !== canvasWidth;
    this.updateVisibility(canvasWidth);
    if (layoutChanged) {
      this.layoutSettingsUI();
      if (this.buttons.size > 0) {
        this.layout(canvasWidth);
      }
    }
  }

  destroy(): void {
    this.touchPrimaryInputQuery.removeEventListener(
      'change',
      this.handleInputModeChange
    );
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.scene.input.off('pointermove', this.handlePointerMove, this);
    this.scene.input.off('pointerup', this.handlePointerUp, this);
    this.scene.input.off('pointerupoutside', this.handlePointerUp, this);
    this.scene.input.off('pointerout', this.handlePointerUp, this);
    this.scene.input.keyboard?.off('keydown', this.handleKeyDown, this);
    this.scene.scale.off('resize', this.handleResize, this);
    this.scene.tweens.killTweensOf(this.settingsButtonIcon);
    this.scene.tweens.killTweensOf(this.settingsButtonBackground);
    for (const image of this.buttonImages.values()) {
      this.scene.tweens.killTweensOf(image);
    }
    for (const button of this.buttons.values()) {
      button.destroy();
    }
    this.settingsRoot.destroy();
    this.buttons.clear();
    this.buttonImages.clear();
    this.buttonImageScales.clear();
    this.buttonPositions.clear();
    this.activePointers.clear();
    this.pointersDown.clear();
    this.settingsToggleBounds.clear();
    this.settingsToggleIcons.clear();
    this.settingsToggleScales.clear();
    this.settingsToggleDisplaySizes.clear();
    this.movement.left = false;
    this.movement.right = false;
  }

  private enable(): void {
    this.enabled = true;
    if (this.buttons.size > 0) {
      for (const button of this.buttons.values()) {
        button.setVisible(true);
      }
      this.layout();
      return;
    }

    this.scene.input.addPointer(4);
    for (const [kind, texture] of Object.entries(BUTTON_TEXTURES) as [
      TouchButton,
      string,
    ][]) {
      const image = this.scene.add
        .image(BUTTON_WIDTH / 2, BUTTON_HEIGHT / 2, texture)
        .setDisplaySize(BUTTON_IMAGE_SIZE, BUTTON_IMAGE_SIZE);
      const button = this.scene.add
        .container(0, 0, [image])
        .setSize(BUTTON_WIDTH, BUTTON_HEIGHT)
        .setScrollFactor(0)
        .setDepth(RENDER_DEPTH.DEBUG + 1)
        .setAlpha(0.78);

      this.buttons.set(kind, button);
      this.buttonImages.set(kind, image);
    }

    this.layout();
  }

  private disable(): void {
    this.enabled = false;
    this.activePointers.clear();
    this.pointersDown.clear();
    this.movement.left = false;
    this.movement.right = false;
    this.updateButtonStates();
    for (const button of this.buttons.values()) {
      button.setVisible(false);
    }
  }

  private getCanvasWidth(): number {
    return this.scene.game.canvas.getBoundingClientRect().width;
  }

  private updateVisibility(canvasWidth: number): void {
    if (!this.hasManualPreference) {
      this.mode = this.detectMode(canvasWidth);
    }
    const shouldBeVisible = shouldShowTouchControls(
      canvasWidth,
      this.touchPrimaryInputQuery.matches,
      DEBUG_CONFIG.enabled,
      DEBUG_CONFIG.showTouchControlsOnDesktop,
      this.mode
    );
    if (shouldBeVisible === this.enabled) {
      return;
    }
    if (shouldBeVisible) {
      this.enable();
    } else {
      this.disable();
    }
  }

  private handleResize(): void {
    const canvasWidth = this.getCanvasWidth();
    this.updateVisibility(canvasWidth);
    this.layoutSettingsUI();
    if (this.buttons.size > 0) {
      this.layout(canvasWidth);
    }
  }

  private layout(canvasWidth = this.getCanvasWidth()): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const zoom = this.scene.cameras.main.zoom;
    const buttonSize =
      canvasWidth > 0
        ? (MIN_HIT_TARGET_CSS_SIZE * width) / canvasWidth
        : BUTTON_WIDTH;
    const gap = BUTTON_GAP;
    const bottom = height - BUTTON_MARGIN - buttonSize;
    const actionTop = bottom - buttonSize - gap;
    const actionLeft = width - BUTTON_MARGIN - buttonSize * 2 - gap;
    const actionRight = width - BUTTON_MARGIN - buttonSize;
    const positions: Record<TouchButton, [number, number]> = {
      left: [BUTTON_MARGIN, bottom],
      right: [BUTTON_MARGIN + buttonSize + gap, bottom],
      attack: [actionRight, actionTop],
      down: [actionLeft, bottom],
      throw: [actionLeft, actionTop],
      jump: [actionRight, bottom],
    };

    if (this.lastButtonSize !== buttonSize) {
      for (const [kind, button] of this.buttons) {
        const image = this.buttonImages.get(kind);
        if (!image) {
          continue;
        }
        button.setSize(buttonSize, buttonSize);
        image
          .setPosition(buttonSize / 2, buttonSize / 2)
          .setDisplaySize(
            buttonSize * BUTTON_IMAGE_RATIO,
            buttonSize * BUTTON_IMAGE_RATIO
          );
        this.buttonImageScales.set(kind, [image.scaleX, image.scaleY]);
        if ([...this.activePointers.values()].includes(kind)) {
          image.setScale(
            image.scaleX * BUTTON_PRESSED_SCALE,
            image.scaleY * BUTTON_PRESSED_SCALE
          );
        }
      }
      this.lastButtonSize = buttonSize;
    }

    for (const [kind, button] of this.buttons) {
      const position = positions[kind];
      if (!position) {
        continue;
      }
      const [screenX, screenY] = position;
      this.buttonPositions.set(kind, [screenX, screenY]);
      button
        .setPosition(
          width / 2 + (screenX - width / 2) / zoom,
          height / 2 + (screenY - height / 2) / zoom
        )
        .setScale(1 / zoom);
    }

    this.lastZoom = zoom;
    this.lastWidth = width;
    this.lastHeight = height;
    this.lastCanvasWidth = canvasWidth;
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    this.updateVisibility(this.getCanvasWidth());
    const allowDesktopInput =
      DEBUG_CONFIG.enabled && DEBUG_CONFIG.showTouchControlsOnDesktop;
    const isOverSettings =
      this.settingsOpen ||
      this.containsPoint(this.settingsButtonBounds, pointer.x, pointer.y);
    const isOverActionControl =
      this.enabled && this.getButtonAt(pointer) !== undefined;
    if (
      !pointer.wasTouch &&
      !allowDesktopInput &&
      !isOverSettings &&
      !isOverActionControl
    ) {
      return;
    }

    if (this.handleSettingsPointerDown(pointer)) {
      return;
    }
    if (!this.enabled) {
      return;
    }

    this.pointersDown.add(pointer.id);
    this.setPointerButton(pointer.id, this.getButtonAt(pointer));
  }

  isPointerOnControl(pointer: Phaser.Input.Pointer): boolean {
    return (
      this.settingsOpen ||
      this.containsPoint(this.settingsButtonBounds, pointer.x, pointer.y) ||
      (this.enabled && this.getButtonAt(pointer) !== undefined)
    );
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown || !this.pointersDown.has(pointer.id)) {
      return;
    }
    this.setPointerButton(pointer.id, this.getButtonAt(pointer));
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    this.pointersDown.delete(pointer.id);
    this.setPointerButton(pointer.id);
  }

  private createSettingsUI(): void {
    this.settingsBackdrop = this.scene.add
      .rectangle(0, 0, 1, 1, 0x17121c, 0.68)
      .setOrigin(0.5);
    this.settingsPanelImage = this.scene.add.image(
      0,
      0,
      'touch-settings-panel'
    );
    this.settingsTitle = this.scene.add
      .bitmapText(
        0,
        0,
        'touch-settings-font',
        'SETTINGS',
        SETTINGS_TITLE_FONT_SIZE
      )
      .setOrigin(0.5);
    this.settingsStatus = this.scene.add
      .bitmapText(0, 0, 'touch-settings-font', 'DEVICE DETECTED', 12)
      .setOrigin(0.5);
    this.settingsHomeIcon = this.scene.add.image(0, 0, 'touch-settings-home');
    this.settingsLevelLabel = this.scene.add
      .bitmapText(
        0,
        0,
        'touch-settings-font',
        `LV ${String(this.actions.levelNumber).padStart(2, '0')}`,
        SETTINGS_LEVEL_FONT_SIZE
      )
      .setOrigin(0.5);

    const menuChildren: Phaser.GameObjects.GameObject[] = [
      this.settingsBackdrop,
      this.settingsPanelImage,
      this.settingsTitle,
      this.settingsHomeIcon,
      this.settingsLevelLabel,
    ];
    for (const item of SETTINGS_ITEMS) {
      const icon = this.scene.add.image(
        0,
        0,
        item === 'sound'
          ? 'touch-settings-sound-on'
          : item === 'controls'
            ? 'touch-settings-controls-on'
            : 'touch-settings-hint-on'
      );
      this.settingsToggleIcons.set(item, icon);
      menuChildren.push(icon);
    }
    menuChildren.push(this.settingsStatus);
    this.settingsMenu = this.scene.add
      .container(0, 0, menuChildren)
      .setVisible(false);

    this.settingsButtonBackground = this.scene.add.image(
      0,
      0,
      'touch-settings-button'
    );
    this.settingsButtonIcon = this.scene.add.image(0, 0, 'touch-settings-gear');
    this.settingsRoot = this.scene.add
      .container(0, 0, [
        this.settingsMenu,
        this.settingsButtonBackground,
        this.settingsButtonIcon,
      ])
      .setScrollFactor(0)
      .setDepth(RENDER_DEPTH.DEBUG + 2);
    this.updateSettingsUI();
  }

  private layoutSettingsUI(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const canvasBounds = this.scene.game.canvas.getBoundingClientRect();
    const canvasWidth = canvasBounds.width > 0 ? canvasBounds.width : width;
    const canvasHeight = canvasBounds.height > 0 ? canvasBounds.height : height;
    const unitScale = Math.min(width / canvasWidth, height / canvasHeight);
    const zoom = this.scene.cameras.main.zoom;
    this.settingsRoot.setPosition(width / 2, height / 2).setScale(1 / zoom);

    const buttonSize = SETTINGS_BUTTON_SIZE_CSS * unitScale;
    const buttonMargin = SETTINGS_BUTTON_MARGIN_CSS * unitScale;
    const buttonX = width - buttonMargin - buttonSize / 2;
    const buttonY = buttonMargin + buttonSize / 2;
    const buttonLocalX = buttonX - width / 2;
    const buttonLocalY = buttonY - height / 2;
    this.settingsButtonBounds = {
      left: buttonX - buttonSize / 2,
      top: buttonY - buttonSize / 2,
      width: buttonSize,
      height: buttonSize,
    };
    this.scene.tweens.killTweensOf(this.settingsButtonBackground);
    this.scene.tweens.killTweensOf(this.settingsButtonIcon);
    this.settingsButtonBackground
      .setPosition(buttonLocalX, buttonLocalY)
      .setDisplaySize(buttonSize, buttonSize);
    this.settingsButtonBackgroundScaleX = this.settingsButtonBackground.scaleX;
    this.settingsButtonBackgroundScaleY = this.settingsButtonBackground.scaleY;
    this.settingsButtonIcon
      .setPosition(buttonLocalX, buttonLocalY)
      .setDisplaySize(
        SETTINGS_BUTTON_ICON_SIZE_CSS * unitScale,
        SETTINGS_BUTTON_ICON_SIZE_CSS * unitScale
      )
      .setAngle(this.settingsOpen ? 30 : 0);
    this.settingsButtonScaleX = this.settingsButtonIcon.scaleX;
    this.settingsButtonScaleY = this.settingsButtonIcon.scaleY;

    const availableWidthCss = Math.max(
      1,
      canvasWidth - SETTINGS_PANEL_SAFE_MARGIN_CSS * 2
    );
    const availableHeightCss = Math.max(
      1,
      canvasHeight - SETTINGS_PANEL_SAFE_MARGIN_CSS * 2
    );
    const panelScale = Math.min(
      1,
      availableWidthCss / SETTINGS_PANEL_WIDTH_CSS,
      availableHeightCss / SETTINGS_PANEL_HEIGHT_CSS
    );
    const uiScale = unitScale * panelScale;
    const panelWidth = SETTINGS_PANEL_WIDTH_CSS * uiScale;
    const panelHeight = SETTINGS_PANEL_HEIGHT_CSS * uiScale;
    this.settingsBackdrop
      .setPosition(0, 0)
      .setSize(width, height)
      .setFillStyle(0x17121c, 0.68);
    this.settingsPanelImage
      .setPosition(0, 0)
      .setDisplaySize(panelWidth, panelHeight);
    this.settingsTitle
      .setPosition(0, -panelHeight / 2 + SETTINGS_TITLE_TOP_OFFSET_CSS * uiScale)
      .setFontSize(SETTINGS_TITLE_FONT_SIZE * uiScale);
    this.settingsStatus
      .setPosition(0, panelHeight / 2 - 20 * uiScale)
      .setFontSize(12 * uiScale);
    this.settingsLevelLabel
      .setPosition(0, height / 2 - SETTINGS_LEVEL_BOTTOM_MARGIN_CSS * unitScale)
      .setFontSize(SETTINGS_LEVEL_FONT_SIZE * unitScale);
    const homeLocalX = SETTINGS_HOME_X_CSS * unitScale;
    const homeLocalY = SETTINGS_ITEM_Y_CSS * unitScale;
    this.settingsHomeIcon
      .setPosition(homeLocalX, homeLocalY)
      .setDisplaySize(
        SETTINGS_HOME_ICON_SIZE_CSS * unitScale,
        SETTINGS_HOME_ICON_SIZE_CSS * unitScale
      );
    const homeHitWidth = SETTINGS_HOME_ICON_SIZE_CSS * unitScale;
    const homeHitHeight = Math.max(
      SETTINGS_TOGGLE_HIT_HEIGHT_CSS * unitScale,
      MIN_HIT_TARGET_CSS_SIZE * unitScale
    );
    this.settingsHomeBounds = {
      left: width / 2 + homeLocalX - homeHitWidth / 2,
      top: height / 2 + homeLocalY - homeHitHeight / 2,
      width: homeHitWidth,
      height: homeHitHeight,
    };

    for (const item of SETTINGS_ITEMS) {
      const localX = SETTINGS_ITEM_X_CSS[item] * unitScale;
      const localY = SETTINGS_ITEM_Y_CSS * unitScale;
      const icon = this.settingsToggleIcons.get(item);
      if (!icon) {
        continue;
      }
      this.scene.tweens.killTweensOf(icon);
      const iconDisplaySize =
        SETTINGS_ITEM_ICON_SIZE_CSS[item] * unitScale;
      icon
        .setPosition(localX, localY)
        .setDisplaySize(iconDisplaySize, iconDisplaySize);
      this.settingsToggleDisplaySizes.set(item, iconDisplaySize);
      this.settingsToggleScales.set(item, {
        iconX: icon.scaleX,
        iconY: icon.scaleY,
      });
      const screenX = width / 2 + localX;
      const screenY = height / 2 + localY;
      const hitWidth = Math.max(
        SETTINGS_ITEM_X_CSS.controls * unitScale,
        MIN_HIT_TARGET_CSS_SIZE * unitScale
      );
      const hitHeight = Math.max(
        SETTINGS_TOGGLE_HIT_HEIGHT_CSS * unitScale,
        iconDisplaySize,
        MIN_HIT_TARGET_CSS_SIZE * unitScale
      );
      this.settingsToggleBounds.set(item, {
        left: screenX - hitWidth / 2,
        top: screenY - hitHeight / 2,
        width: hitWidth,
        height: hitHeight,
      });
    }
    this.updateSettingsUI();
    this.lastZoom = zoom;
    this.lastWidth = width;
    this.lastHeight = height;
    this.lastCanvasWidth = canvasWidth;
  }

  private readSavedMode(): TouchControlsMode | undefined {
    try {
      const savedMode =
        this.browserWindow.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedMode === 'on' || savedMode === 'off') {
        return savedMode;
      }
    } catch (error) {
      this.persistenceUnavailable = true;
      console.warn('Unable to read touch-control preference.', error);
    }
    return undefined;
  }

  private readSavedSoundPreference(): boolean | undefined {
    try {
      const savedSound = this.browserWindow.localStorage.getItem(
        SOUND_STORAGE_KEY
      );
      if (savedSound === 'on') {
        return true;
      }
      if (savedSound === 'off') {
        return false;
      }
    } catch (error) {
      this.persistenceUnavailable = true;
      console.warn('Unable to read sound preference.', error);
    }
    return undefined;
  }

  private readSavedPickupHintPreference(): boolean | undefined {
    try {
      const savedPreference = this.browserWindow.localStorage.getItem(
        PICKUP_HINT_STORAGE_KEY
      );
      if (savedPreference === 'on') {
        return true;
      }
      if (savedPreference === 'off') {
        return false;
      }
    } catch (error) {
      this.persistenceUnavailable = true;
      console.warn('Unable to read pickup-hint preference.', error);
    }
    return undefined;
  }

  private detectMode(canvasWidth: number): TouchControlsMode {
    return shouldShowTouchControls(
      canvasWidth,
      this.touchPrimaryInputQuery.matches,
      DEBUG_CONFIG.enabled,
      DEBUG_CONFIG.showTouchControlsOnDesktop
    )
      ? 'on'
      : 'off';
  }

  private setMode(mode: TouchControlsMode): void {
    this.mode = mode;
    this.hasManualPreference = true;
    try {
      this.browserWindow.localStorage.setItem(SETTINGS_STORAGE_KEY, mode);
      this.persistenceUnavailable = false;
    } catch (error) {
      this.persistenceUnavailable = true;
      console.error('Unable to save touch-control preference.', error);
    }
    this.updateVisibility(this.getCanvasWidth());
    this.updateSettingsUI();
  }

  private setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    this.actions.setSoundEnabled(enabled);
    try {
      this.browserWindow.localStorage.setItem(
        SOUND_STORAGE_KEY,
        enabled ? 'on' : 'off'
      );
      this.persistenceUnavailable = false;
    } catch (error) {
      this.persistenceUnavailable = true;
      console.error('Unable to save sound preference.', error);
    }
    this.updateSettingsUI();
  }

  private setPickupHintEnabled(enabled: boolean): void {
    this.pickupHintEnabled = enabled;
    this.actions.setPickupHintEnabled(enabled);
    try {
      this.browserWindow.localStorage.setItem(
        PICKUP_HINT_STORAGE_KEY,
        enabled ? 'on' : 'off'
      );
      this.persistenceUnavailable = false;
    } catch (error) {
      this.persistenceUnavailable = true;
      console.error('Unable to save pickup-hint preference.', error);
    }
    this.updateSettingsUI();
  }

  private updateSettingsUI(): void {
    for (const category of SETTINGS_CATEGORIES) {
      const icon = this.settingsToggleIcons.get(category);
      if (!icon) {
        continue;
      }
      icon
        .setTexture(
          category === 'sound'
            ? this.soundEnabled
              ? 'touch-settings-sound-on'
              : 'touch-settings-sound-off'
            : category === 'controls'
              ? this.mode === 'on'
                ? 'touch-settings-controls-on'
                : 'touch-settings-controls-off'
              : this.pickupHintEnabled
                ? 'touch-settings-hint-on'
                : 'touch-settings-hint-off'
        )
        .setAlpha(1);
      const displaySize = this.settingsToggleDisplaySizes.get(category);
      if (displaySize !== undefined) {
        icon.setDisplaySize(displaySize, displaySize);
        this.settingsToggleScales.set(category, {
          iconX: icon.scaleX,
          iconY: icon.scaleY,
        });
      }
    }
    if (this.persistenceUnavailable) {
      this.settingsStatus?.setText('NOT SAVED').setVisible(true);
      return;
    }
    this.settingsStatus?.setVisible(false);
  }

  private animateSettingsToggle(item: SettingsItem): void {
    const icon = this.settingsToggleIcons.get(item);
    const scales = this.settingsToggleScales.get(item);
    if (!icon || !scales) {
      return;
    }

    animateSettingsToggleIcon(
      this.scene,
      icon,
      scales.iconX,
      scales.iconY
    );
  }

  private setSettingsOpen(open: boolean): void {
    if (this.settingsOpen === open) {
      return;
    }
    this.settingsOpen = open;
    this.actions.setGamePaused(open);
    this.settingsMenu.setVisible(open).setAlpha(1).setScale(1);
    this.animateSettingsButton(open);
    if (open) {
      this.activePointers.clear();
      this.pointersDown.clear();
      this.movement.left = false;
      this.movement.right = false;
      this.updateButtonStates();
    }
  }

  private animateSettingsButton(open: boolean): void {
    this.scene.tweens.killTweensOf(this.settingsButtonIcon);
    this.scene.tweens.killTweensOf(this.settingsButtonBackground);
    this.settingsButtonIcon.setTexture(
      open ? 'touch-settings-gear-open' : 'touch-settings-gear'
    );
    this.settingsButtonIcon.setScale(
      this.settingsButtonScaleX,
      this.settingsButtonScaleY
    );
    this.settingsButtonBackground.setScale(
      this.settingsButtonBackgroundScaleX,
      this.settingsButtonBackgroundScaleY
    );
    this.scene.tweens.add({
      targets: this.settingsButtonIcon,
      angle: open ? 30 : 0,
      duration: 220,
      ease: 'Back.Out',
    });
    this.scene.tweens.add({
      targets: this.settingsButtonIcon,
      scaleX: this.settingsButtonScaleX * 1.32,
      scaleY: this.settingsButtonScaleY * 1.32,
      duration: 110,
      ease: 'Back.Out',
      yoyo: true,
    });
    this.scene.tweens.add({
      targets: this.settingsButtonBackground,
      scaleX: this.settingsButtonBackgroundScaleX * 1.1,
      scaleY: this.settingsButtonBackgroundScaleY * 1.1,
      duration: 110,
      ease: 'Back.Out',
      yoyo: true,
    });
  }

  private handleSettingsPointerDown(pointer: Phaser.Input.Pointer): boolean {
    if (this.containsPoint(this.settingsButtonBounds, pointer.x, pointer.y)) {
      this.actions.playUiClick();
      this.setSettingsOpen(!this.settingsOpen);
      return true;
    }
    if (!this.settingsOpen) {
      return false;
    }
    for (const [item, bounds] of this.settingsToggleBounds) {
      if (this.containsPoint(bounds, pointer.x, pointer.y)) {
        this.actions.playUiClick();
        if (item === 'sound') {
          this.setSoundEnabled(!this.soundEnabled);
        } else if (item === 'controls') {
          this.setMode(this.mode === 'on' ? 'off' : 'on');
        } else {
          this.setPickupHintEnabled(!this.pickupHintEnabled);
        }
        this.animateSettingsToggle(item);
        return true;
      }
    }
    if (
      this.containsPoint(
        this.settingsHomeBounds,
        pointer.x,
        pointer.y
      )
    ) {
      this.actions.playUiClick();
      this.setSettingsOpen(false);
      this.actions.returnToLevelPicker();
      return true;
    }
    this.actions.playUiClick();
    this.setSettingsOpen(false);
    return true;
  }

  private containsPoint(
    bounds: TouchSettingsBounds,
    x: number,
    y: number
  ): boolean {
    return (
      x >= bounds.left &&
      x <= bounds.left + bounds.width &&
      y >= bounds.top &&
      y <= bounds.top + bounds.height
    );
  }

  private getButtonAt(pointer: Phaser.Input.Pointer): TouchButton | undefined {
    for (const [kind, [left, top]] of this.buttonPositions) {
      if (
        pointer.x >= left &&
        pointer.x <= left + this.lastButtonSize &&
        pointer.y >= top &&
        pointer.y <= top + this.lastButtonSize
      ) {
        return kind;
      }
    }
    return undefined;
  }

  private setPointerButton(pointerId: number, nextButton?: TouchButton): void {
    const currentButton = this.activePointers.get(pointerId);
    if (currentButton === nextButton) {
      return;
    }

    this.activePointers.delete(pointerId);
    if (nextButton) {
      this.activePointers.set(pointerId, nextButton);
      if (nextButton === 'jump') {
        this.actions.jump();
      } else if (nextButton === 'down') {
        this.actions.down();
      } else if (nextButton === 'attack') {
        this.actions.attack();
      } else if (nextButton === 'throw') {
        this.actions.throw();
      }
    }

    this.movement.left = [...this.activePointers.values()].includes('left');
    this.movement.right = [...this.activePointers.values()].includes('right');
    this.updateButtonStates();
  }

  private updateButtonStates(): void {
    for (const [kind, button] of this.buttons) {
      const isPressed = [...this.activePointers.values()].includes(kind);
      button.setAlpha(isPressed ? 1 : 0.78);
      const image = this.buttonImages.get(kind);
      const baseScales = this.buttonImageScales.get(kind);
      if (!image || !baseScales) {
        continue;
      }

      this.scene.tweens.killTweensOf(image);
      this.scene.tweens.add({
        targets: image,
        scaleX: baseScales[0] * (isPressed ? BUTTON_PRESSED_SCALE : 1),
        scaleY: baseScales[1] * (isPressed ? BUTTON_PRESSED_SCALE : 1),
        duration: isPressed
          ? BUTTON_PRESS_DURATION_MS
          : BUTTON_RELEASE_DURATION_MS,
        ease: isPressed ? 'Sine.Out' : 'Back.Out',
      });
    }
  }
}
