import * as Phaser from 'phaser';
import { RENDER_DEPTH } from '../../shared/constants';
import { DEBUG_CONFIG } from '../../shared/debug';
import type { TouchMovementInput } from '../../shared/types';

export type TouchControlActions = {
  down: () => void;
  jump: () => void;
  attack: () => void;
  throw: () => void;
};

type TouchButton = 'left' | 'right' | 'down' | 'jump' | 'attack' | 'throw';

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
const MIN_HIT_TARGET_CSS_SIZE = 48;
const BUTTON_MARGIN = 24;
const BUTTON_GAP = 12;

export class TouchControls {
  readonly movement: TouchMovementInput = { left: false, right: false };

  private readonly buttons = new Map<
    TouchButton,
    Phaser.GameObjects.Container
  >();
  private readonly buttonImages = new Map<
    TouchButton,
    Phaser.GameObjects.Image
  >();
  private readonly buttonPositions = new Map<TouchButton, [number, number]>();
  private readonly activePointers = new Map<number, TouchButton>();
  private readonly pointersDown = new Set<number>();
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
    this.enabled =
      scene.sys.game.device.input.touch ||
      (DEBUG_CONFIG.enabled && DEBUG_CONFIG.showTouchControlsOnDesktop);
    if (this.enabled) {
      this.enable();
    }

    scene.input.on('pointerdown', this.handlePointerDown, this);
    scene.input.on('pointermove', this.handlePointerMove, this);
    scene.input.on('pointerup', this.handlePointerUp, this);
    scene.input.on('pointerupoutside', this.handlePointerUp, this);
    scene.input.on('pointerout', this.handlePointerUp, this);
    scene.scale.on('resize', this.layout, this);
    scene.events.once('shutdown', this.destroy, this);
  }

  update(): void {
    if (
      this.enabled &&
      (this.lastZoom !== this.scene.cameras.main.zoom ||
        this.lastWidth !== this.scene.scale.width ||
        this.lastHeight !== this.scene.scale.height ||
        this.lastCanvasWidth !==
          this.scene.game.canvas.getBoundingClientRect().width)
    ) {
      this.layout();
    }
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.scene.input.off('pointermove', this.handlePointerMove, this);
    this.scene.input.off('pointerup', this.handlePointerUp, this);
    this.scene.input.off('pointerupoutside', this.handlePointerUp, this);
    this.scene.input.off('pointerout', this.handlePointerUp, this);
    this.scene.scale.off('resize', this.layout, this);
    for (const button of this.buttons.values()) {
      button.destroy();
    }
    this.buttons.clear();
    this.buttonImages.clear();
    this.buttonPositions.clear();
    this.activePointers.clear();
    this.pointersDown.clear();
    this.movement.left = false;
    this.movement.right = false;
  }

  private enable(): void {
    if (this.buttons.size > 0) {
      return;
    }

    this.enabled = true;
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

  private layout(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const zoom = this.scene.cameras.main.zoom;
    const canvasWidth = this.scene.game.canvas.getBoundingClientRect().width;
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
    const allowDesktopInput =
      DEBUG_CONFIG.enabled && DEBUG_CONFIG.showTouchControlsOnDesktop;
    const isOverControl = this.getButtonAt(pointer) !== undefined;
    if (!pointer.wasTouch && !allowDesktopInput && !isOverControl) {
      return;
    }

    if (!this.enabled) {
      this.enable();
    }
    this.pointersDown.add(pointer.id);
    this.setPointerButton(pointer.id, this.getButtonAt(pointer));
  }

  isPointerOnControl(pointer: Phaser.Input.Pointer): boolean {
    return this.enabled && this.getButtonAt(pointer) !== undefined;
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
    }
  }
}
