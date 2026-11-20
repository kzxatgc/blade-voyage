import * as Phaser from 'phaser';
import {
  LEVEL_PAGE_COUNT,
  LEVELS_PER_PAGE,
  PLAYABLE_LEVELS,
  getLevelNumbersForPage,
} from '../../shared/levels';
import {
  animateSettingsToggleIcon,
  SETTINGS_BUTTON_MARGIN_CSS,
  SETTINGS_BUTTON_SIZE_CSS,
  SOUND_STORAGE_KEY,
} from '../systems/SettingsUI';
import { IrisTransition, type IrisFocus } from '../systems/IrisTransition';

export const LEVEL_SELECT_SCENE_KEY = 'LevelSelectScene';

const LEVEL_BOX_KEY = 'level-boxes';
const LEVEL_DIGITS_KEY = 'level-digits';
const LEVEL_BOX_FRAME = 24;
const LEVEL_NAV_KEY = 'level-nav-arrows';
const LEVEL_NAV_FRAME = 53;
const LEVEL_NAV_DISABLED_TINT = 0x555555;
const NAV_BUTTON_PRESSED_SCALE_FACTOR = 0.85;
const NAV_BUTTON_PRESS_DURATION_MS = 70;
const NAV_BUTTON_RELEASE_DURATION_MS = 140;
const MIN_TOUCH_TARGET_CSS = 44;
const MIN_CARD_GAP_CSS = 6;
const NAV_BUTTON_BASE_SIZE = Math.round(84 * 1.2);
const LEVEL_BOX_BASE_SIZE = 120;
const LEVEL_DIGIT_BASE_SIZE = 40;
const PANEL_WIDTH = 896;
const PANEL_HEIGHT = 480;
const LEVEL_CARD_OUTER_MARGIN_FACTOR = 1.2;
const PANEL_ARROW_INSET = 22;
const LEVEL_PICKER_SOUND = 'settings-click';
const LEVEL_CARD_PRESSED_SCALE_FACTOR = 0.74;
const LEVEL_CARD_PRESS_DURATION_MS = 90;
const LEVEL_CARD_RELEASE_DURATION_MS = 130;
const LEVEL_PICKER_ENTRANCE_DURATION_MS = 800;
const SOUND_BUTTON_ENTRANCE_LEAD_MS = 500;
const SOUND_BUTTON_ENTRANCE_DURATION_MS = 600;

export class LevelSelectScene extends Phaser.Scene {
  private pageIndex = 0;
  private cardGroup?: Phaser.GameObjects.Container;
  private previousArrow?: Phaser.GameObjects.Image;
  private nextArrow?: Phaser.GameObjects.Image;
  private levelPickerGroup!: Phaser.GameObjects.Container;
  private soundHitTarget?: Phaser.GameObjects.Rectangle;
  private soundIcon?: Phaser.GameObjects.Image;
  private soundEnabled = true;
  private isStartingLevel = false;
  private readonly levelCardCenters = new Map<number, IrisFocus>();
  private irisTransition!: IrisTransition;

  constructor() {
    super(LEVEL_SELECT_SCENE_KEY);
  }

  create(
    data: { skipEntrance?: boolean; openOnLevelNumber?: number } = {}
  ): void {
    this.input.enabled = true;
    this.pageIndex = 0;
    this.isStartingLevel = false;
    this.irisTransition = new IrisTransition(this);
    this.levelCardCenters.clear();

    let openOnLevelNumber: number | undefined;
    if (data.openOnLevelNumber !== undefined) {
      const requestedIndex = PLAYABLE_LEVELS.findIndex(
        (level) => level.number === data.openOnLevelNumber
      );
      const focusIndex =
        requestedIndex >= 0 ? requestedIndex : PLAYABLE_LEVELS.length - 1;
      const focusLevel = PLAYABLE_LEVELS[focusIndex];
      if (!focusLevel) {
        throw new Error('Cannot focus the level picker without a playable level.');
      }
      openOnLevelNumber = focusLevel.number;
      this.pageIndex = Math.floor(focusIndex / LEVELS_PER_PAGE);
    }

    const { width, height } = this.scale;
    const centerX = width / 2;
    const centerY = height / 2;
    const panelWidth = Math.min(width - 72, PANEL_WIDTH);
    const panelHeight = Math.min(height - 48, PANEL_HEIGHT);

    this.soundEnabled = this.readSoundPreference();
    this.sound.setMute(!this.soundEnabled);

    this.levelPickerGroup = this.add
      .container(0, 0)
      .setScrollFactor(0)
      .setDepth(2);
    this.add
      .image(centerX, centerY, 'background')
      .setScrollFactor(0)
      .setDisplaySize(width, height)
      .setDepth(0);
    const panel = this.add
      .image(centerX, centerY, 'touch-settings-panel')
      .setDisplaySize(panelWidth, panelHeight)
      .setDepth(0);
    this.levelPickerGroup.add(panel);

    this.soundHitTarget = this.add
      .rectangle(
        0,
        0,
        SETTINGS_BUTTON_SIZE_CSS,
        SETTINGS_BUTTON_SIZE_CSS,
        0xffffff,
        0.001
      )
      .setScrollFactor(0)
      .setDepth(6)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.soundIcon = this.add
      .image(
        0,
        0,
        this.soundEnabled
          ? 'touch-settings-sound-on'
          : 'touch-settings-sound-off'
      )
      .setScrollFactor(0)
      .setDepth(7)
      .setVisible(false);
    this.soundHitTarget.on('pointerdown', this.toggleSound, this);
    this.scale.on('resize', this.layoutResponsiveUI, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layoutResponsiveUI, this);
    });
    this.layoutResponsiveUI();
    if (data.skipEntrance || openOnLevelNumber !== undefined) {
      this.soundHitTarget?.setVisible(true);
      this.soundIcon?.setVisible(true);
      if (openOnLevelNumber !== undefined) {
        const focus = this.levelCardCenters.get(openOnLevelNumber);
        if (!focus) {
          throw new Error(
            `Missing level-picker focus point for level ${openOnLevelNumber}.`
          );
        }
        this.irisTransition.startOpening(focus);
      }
      return;
    }

    this.input.enabled = false;
    this.time.delayedCall(
      LEVEL_PICKER_ENTRANCE_DURATION_MS - SOUND_BUTTON_ENTRANCE_LEAD_MS,
      this.playSoundButtonEntrance,
      [],
      this
    );
    this.playEntranceAnimation();
  }

  override update(_time: number, delta: number): void {
    this.irisTransition.update(delta);
  }

  private createPageArrow(
    x: number,
    y: number,
    flipped: boolean,
    displaySize: number
  ): Phaser.GameObjects.Image {
    const arrow = this.add
      .image(x, y, LEVEL_NAV_KEY, LEVEL_NAV_FRAME)
      .setDisplaySize(displaySize, displaySize)
      .setFlipX(flipped)
      .setDepth(6)
      .setInteractive({ useHandCursor: true });

    const getNextPage = () => this.pageIndex + (flipped ? -1 : 1);
    const isAvailable = () => {
      const nextPage = getNextPage();
      return nextPage >= 0 && nextPage < LEVEL_PAGE_COUNT;
    };
    const baseScaleX = arrow.scaleX;
    const baseScaleY = arrow.scaleY;
    const releaseArrow = () => {
      this.tweens.killTweensOf(arrow);
      this.tweens.add({
        targets: arrow,
        scaleX: baseScaleX,
        scaleY: baseScaleY,
        duration: NAV_BUTTON_RELEASE_DURATION_MS,
        ease: 'Sine.Out',
      });
    };

    arrow.on('pointerdown', () => {
      if (!isAvailable()) {
        return;
      }

      this.tweens.killTweensOf(arrow);
      this.tweens.add({
        targets: arrow,
        scaleX: baseScaleX * NAV_BUTTON_PRESSED_SCALE_FACTOR,
        scaleY: baseScaleY * NAV_BUTTON_PRESSED_SCALE_FACTOR,
        duration: NAV_BUTTON_PRESS_DURATION_MS,
        ease: 'Sine.Out',
      });
    });
    arrow.on('pointerout', () => {
      releaseArrow();
      if (isAvailable()) {
        arrow.clearTint();
      } else {
        arrow.setTint(LEVEL_NAV_DISABLED_TINT);
      }
    });
    arrow.on('pointerup', () => {
      const nextPage = getNextPage();
      if (nextPage < 0 || nextPage >= LEVEL_PAGE_COUNT) {
        releaseArrow();
        return;
      }

      releaseArrow();
      this.playUiClick();
      this.pageIndex = nextPage;
      this.renderPage();
    });
    arrow.on('pointerupoutside', releaseArrow);

    return arrow;
  }

  private renderPage(): void {
    const { width, height } = this.scale;
    const canGoPrevious = this.pageIndex > 0;
    const canGoNext = this.pageIndex < LEVEL_PAGE_COUNT - 1;
    this.previousArrow?.setAlpha(1);
    this.nextArrow?.setAlpha(1);
    if (canGoPrevious) {
      this.previousArrow?.clearTint();
    } else {
      this.previousArrow?.setTint(LEVEL_NAV_DISABLED_TINT);
    }
    if (canGoNext) {
      this.nextArrow?.clearTint();
    } else {
      this.nextArrow?.setTint(LEVEL_NAV_DISABLED_TINT);
    }
    this.cardGroup?.destroy(true);
    this.levelCardCenters.clear();

    const cardGroup = this.add.container(0, 0).setDepth(4);
    const levelNumbers = getLevelNumbersForPage(this.pageIndex);
    const panelWidth = Math.min(width - 72, PANEL_WIDTH);
    const panelHeight = Math.min(height - 48, PANEL_HEIGHT);
    const panelLeft = (width - panelWidth) / 2;
    const panelTop = (height - panelHeight) / 2;
    const columns = 4;
    const rows = LEVELS_PER_PAGE / columns;
    const boxDisplaySize = Math.max(
      LEVEL_BOX_BASE_SIZE,
      MIN_TOUCH_TARGET_CSS * this.getCanvasUnitScale()
    );
    const digitDisplaySize =
      LEVEL_DIGIT_BASE_SIZE * (boxDisplaySize / LEVEL_BOX_BASE_SIZE);
    const digitOffset = 13 * (digitDisplaySize / LEVEL_DIGIT_BASE_SIZE);
    const outerMarginX =
      ((panelWidth - columns * boxDisplaySize) / (columns + 1)) *
      LEVEL_CARD_OUTER_MARGIN_FACTOR;
    const outerMarginY =
      ((panelHeight - rows * boxDisplaySize) / (rows + 1)) *
      LEVEL_CARD_OUTER_MARGIN_FACTOR;
    const gapX =
      (panelWidth - columns * boxDisplaySize - 2 * outerMarginX) /
      (columns - 1);
    const gapY =
      (panelHeight - rows * boxDisplaySize - 2 * outerMarginY) / (rows - 1);
    const firstX = panelLeft + outerMarginX + boxDisplaySize / 2;
    const firstY = panelTop + outerMarginY + boxDisplaySize / 2;

    levelNumbers.forEach((levelNumber, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = firstX + column * (boxDisplaySize + gapX);
      const y = firstY + row * (boxDisplaySize + gapY);
      this.levelCardCenters.set(levelNumber, { x, y });
      cardGroup.add(
        this.createLevelCard(
          levelNumber,
          x,
          y,
          boxDisplaySize,
          digitDisplaySize,
          digitOffset
        )
      );
    });

    this.levelPickerGroup.add(cardGroup);
    this.cardGroup = cardGroup;
  }

  private layoutResponsiveUI(): void {
    const { width, height } = this.scale;
    const panelWidth = Math.min(width - 72, PANEL_WIDTH);
    const panelSide = (width - panelWidth) / 2;
    const unitScale = this.getCanvasUnitScale();
    const navButtonSize = Math.max(
      NAV_BUTTON_BASE_SIZE,
      MIN_TOUCH_TARGET_CSS * unitScale
    );
    const boxDisplaySize = Math.max(
      LEVEL_BOX_BASE_SIZE,
      MIN_TOUCH_TARGET_CSS * unitScale
    );
    const boxGapX = (panelWidth - 4 * boxDisplaySize) / 5;
    const arrowOffset = Math.min(
      0,
      boxGapX -
        navButtonSize / 2 -
        MIN_CARD_GAP_CSS * unitScale -
        PANEL_ARROW_INSET
    );

    this.previousArrow?.destroy();
    this.nextArrow?.destroy();
    this.previousArrow = this.createPageArrow(
      panelSide + PANEL_ARROW_INSET + arrowOffset,
      height / 2,
      true,
      navButtonSize
    );
    this.nextArrow = this.createPageArrow(
      width - panelSide - PANEL_ARROW_INSET - arrowOffset,
      height / 2,
      false,
      navButtonSize
    );
    this.levelPickerGroup.add([this.previousArrow, this.nextArrow]);

    this.layoutSoundControl();
    this.renderPage();
  }

  private playEntranceAnimation(): void {
    const { height } = this.scale;
    this.levelPickerGroup
      .setY(height)
      .setAlpha(0);
    this.tweens.add({
      targets: this.levelPickerGroup,
      y: 0,
      alpha: 1,
      duration: LEVEL_PICKER_ENTRANCE_DURATION_MS,
      ease: 'Back.Out',
    });
  }

  private playSoundButtonEntrance(): void {
    if (!this.soundIcon || !this.soundHitTarget) {
      this.input.enabled = true;
      return;
    }

    const { height } = this.scale;
    const soundY = this.soundIcon.y;
    const soundStartY =
      height + (SETTINGS_BUTTON_SIZE_CSS * this.getCanvasUnitScale()) / 2;
    this.soundIcon.setY(soundStartY).setVisible(true);
    this.soundHitTarget.setY(soundStartY).setVisible(true);
    this.tweens.add({
      targets: [this.soundIcon, this.soundHitTarget],
      y: soundY,
      duration: SOUND_BUTTON_ENTRANCE_DURATION_MS,
      ease: 'Sine.Out',
      onComplete: () => {
        this.input.enabled = true;
      },
    });
  }

  private createLevelCard(
    levelNumber: number,
    x: number,
    y: number,
    boxDisplaySize: number,
    digitDisplaySize: number,
    digitOffset: number
  ): Phaser.GameObjects.Container {
    const card = this.add.container(x, y);
    const levelBox = this.add
      .image(0, 0, LEVEL_BOX_KEY, LEVEL_BOX_FRAME)
      .setDisplaySize(boxDisplaySize, boxDisplaySize);
    const digits = String(levelNumber)
      .padStart(2, '0')
      .split('')
      .map(Number);
    const digitSprites = digits.map((digit, index) =>
      this.add
        .image(
          index === 0 ? -digitOffset : digitOffset,
          0,
          LEVEL_DIGITS_KEY,
          digit
        )
        .setDisplaySize(digitDisplaySize, digitDisplaySize)
    );

    card.add([levelBox, ...digitSprites]);
    levelBox.setInteractive({ useHandCursor: true });
    levelBox.on('pointerover', () => {
      this.tweens.killTweensOf(card);
      this.tweens.add({
        targets: card,
        scaleX: 1.04,
        scaleY: 1.04,
        duration: 100,
        ease: 'Sine.Out',
      });
    });
    levelBox.on('pointerout', () => {
      this.tweens.killTweensOf(card);
      this.tweens.add({
        targets: card,
        scaleX: 1,
        scaleY: 1,
        duration: 120,
        ease: 'Sine.Out',
      });
    });
    levelBox.on('pointerdown', () => this.startLevel(levelNumber, card));

    return card;
  }

  private startLevel(
    levelNumber: number,
    card: Phaser.GameObjects.Container
  ): void {
    if (
      !PLAYABLE_LEVELS.some((level) => level.number === levelNumber) ||
      this.irisTransition.isActive ||
      this.isStartingLevel
    ) {
      return;
    }

    const focus = this.levelCardCenters.get(levelNumber);
    if (!focus) {
      throw new Error(`Missing level-picker focus point for level ${levelNumber}.`);
    }

    this.isStartingLevel = true;
    this.playUiClick();
    this.tweens.killTweensOf(card);
    const releaseScaleX = card.scaleX;
    const releaseScaleY = card.scaleY;
    this.tweens.add({
      targets: card,
      scaleX: releaseScaleX * LEVEL_CARD_PRESSED_SCALE_FACTOR,
      scaleY: releaseScaleY * LEVEL_CARD_PRESSED_SCALE_FACTOR,
      duration: LEVEL_CARD_PRESS_DURATION_MS,
      ease: 'Sine.Out',
      onComplete: () => {
        this.tweens.add({
          targets: card,
          scaleX: releaseScaleX,
          scaleY: releaseScaleY,
          duration: LEVEL_CARD_RELEASE_DURATION_MS,
          ease: 'Back.Out',
        });
      },
    });
    const transitionStarted = this.irisTransition.startClosing(focus, () => {
      this.scene.start('Game', { levelNumber, openIris: true });
    });
    if (!transitionStarted) {
      this.isStartingLevel = false;
      this.tweens.killTweensOf(card);
      card.setScale(releaseScaleX, releaseScaleY);
    }
  }

  private toggleSound(): void {
    this.playUiClick();
    this.soundEnabled = !this.soundEnabled;
    this.sound.setMute(!this.soundEnabled);
    this.soundIcon?.setTexture(
      this.soundEnabled ? 'touch-settings-sound-on' : 'touch-settings-sound-off'
    );
    this.layoutSoundControl();

    if (this.soundIcon) {
      animateSettingsToggleIcon(
        this,
        this.soundIcon,
        this.soundIcon.scaleX,
        this.soundIcon.scaleY
      );
    }

    try {
      window.localStorage.setItem(
        SOUND_STORAGE_KEY,
        this.soundEnabled ? 'on' : 'off'
      );
    } catch (error) {
      console.error('Unable to save sound preference.', error);
    }
  }

  private readSoundPreference(): boolean {
    try {
      return window.localStorage.getItem(SOUND_STORAGE_KEY) !== 'off';
    } catch (error) {
      console.warn('Unable to read sound preference.', error);
      return true;
    }
  }

  private layoutSoundControl(): void {
    if (!this.soundHitTarget || !this.soundIcon) {
      return;
    }

    const { width, height } = this.scale;
    const unitScale = this.getCanvasUnitScale();
    const buttonSize = SETTINGS_BUTTON_SIZE_CSS * unitScale;
    const margin = SETTINGS_BUTTON_MARGIN_CSS * unitScale;
    const buttonX = width - margin - buttonSize / 2;
    const buttonY = height - margin - buttonSize / 2;

    this.soundHitTarget
      .setPosition(buttonX, buttonY)
      .setSize(buttonSize, buttonSize)
      .setInteractive({ useHandCursor: true });
    this.soundIcon
      .setPosition(buttonX, buttonY)
      .setDisplaySize(buttonSize, buttonSize);
  }

  private getCanvasUnitScale(): number {
    const { width, height } = this.scale;
    const canvasBounds = this.game.canvas.getBoundingClientRect();
    const canvasWidth = canvasBounds.width > 0 ? canvasBounds.width : width;
    const canvasHeight = canvasBounds.height > 0 ? canvasBounds.height : height;
    return Math.min(width / canvasWidth, height / canvasHeight);
  }

  private playUiClick(): void {
    this.sound.play(LEVEL_PICKER_SOUND, { volume: 0.45 });
  }
}
