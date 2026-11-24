import * as Phaser from 'phaser';
import { RENDER_DEPTH } from '../../shared/constants';
import { SETTINGS_UI_SCALE_BREAKPOINT_CSS } from './SettingsUI';
import { getActionPromptUnitScale } from './ActionPromptLayout';

const ACTION_PROMPT_MIN_EDGE_PADDING_CSS = 11;
const ACTION_PROMPT_EDGE_PADDING_RANGE_CSS = 3;
const ACTION_PROMPT_TRANSITION_DURATION_MS = 160;
const ACTION_PROMPT_ROW_GAP_CSS = 7;
const ACTION_PROMPT_INPUT_GAP_CSS = 5;
const ACTION_PROMPT_COPY_GAP_CSS = 9;
const ACTION_PROMPT_SPRITE_SIZE_CSS = 32;
const ACTION_PROMPT_KEY_SPRITE_KEY = 'action-prompt-keycaps';

export type ActionPromptOptions = {
  inputType: 'key' | 'mouse';
  keyLabel?: string;
  keyCode?: string;
  mouseButton?: 'left' | 'right' | 'middle';
  actionText: string;
  itemName?: string;
  holdDuration?: number;
  worldPosition?: { x: number; y: number };
  additionalInputs?: ActionPromptInput[];
  additionalRows?: ActionPromptRow[];
};

export type ActionPromptInput =
  | { inputType: 'key'; keyLabel: string; keyCode?: string }
  | { inputType: 'mouse'; mouseButton: 'left' | 'right' | 'middle' };

export type ActionPromptRow = {
  actionText: string;
  itemName?: string;
  inputs: ActionPromptInput[];
};

type ScreenPoint = { x: number; y: number };
type WorldToScreen = (
  point: NonNullable<ActionPromptOptions['worldPosition']>
) => ScreenPoint;
type SpriteCell = { column: number; row: number };
type TrackedInput = {
  image: Phaser.GameObjects.Image;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
};
type PromptRowLayout = {
  container: Phaser.GameObjects.Container;
  width: number;
  height: number;
  firstInputCenterX: number;
};

const KEY_SPRITE_CELLS: Readonly<Record<string, SpriteCell>> = {
  A: { column: 0, row: 0 },
  B: { column: 1, row: 0 },
  K: { column: 2, row: 0 },
  L: { column: 3, row: 0 },
  E: { column: 4, row: 0 },
  Q: { column: 5, row: 0 },
  SPACE: { column: 1, row: 3 },
};
const MOUSE_SPRITE_COLUMN: Readonly<
  Record<NonNullable<ActionPromptOptions['mouseButton']>, number>
> = {
  left: 4,
  right: 6,
  middle: 7,
};
const MOUSE_BUTTON_CODE = { left: 0, middle: 1, right: 2 } as const;

export class ActionPromptHUD {
  private readonly root: Phaser.GameObjects.Container;
  private readonly announcer: HTMLDivElement;
  private readonly rowLayouts: PromptRowLayout[] = [];
  private readonly inputImages = new Map<string, TrackedInput[]>();
  private readonly pressedKeys = new Set<string>();
  private readonly pressedMouseButtons = new Set<string>();
  private readonly pressedTouchActions = new Set<'attack' | 'throw'>();
  private progressGraphics: Phaser.GameObjects.Graphics | undefined;
  private progressCenter: ScreenPoint | undefined;
  private worldPosition: ActionPromptOptions['worldPosition'];
  private worldToScreen: WorldToScreen | undefined;
  private currentOptions: ActionPromptOptions | undefined;
  private signature = '';
  private announcedText = '';
  private unitScale = 1;
  private lastWidth = 0;
  private lastHeight = 0;
  private lastZoom = 0;
  private holdProgress = 0;
  private isShown = false;
  private destroyed = false;
  private initialLayoutFrame: number | undefined;
  private initialLayoutFrameSecond: number | undefined;

  constructor(private readonly scene: Phaser.Scene) {
    const host = scene.game.canvas.parentElement;
    if (!host) {
      throw new Error('The game canvas must be attached before creating the action prompt HUD.');
    }

    this.root = scene.add
      .container(scene.scale.width / 2, scene.scale.height / 2)
      .setScrollFactor(0)
      .setDepth(RENDER_DEPTH.HUD)
      .setScale(1 / scene.cameras.main.zoom)
      .setAlpha(0)
      .setVisible(false);

    this.announcer = host.ownerDocument.createElement('div');
    this.announcer.setAttribute('aria-live', 'polite');
    this.announcer.setAttribute('aria-hidden', 'false');
    Object.assign(this.announcer.style, {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0',
    });
    host.append(this.announcer);

    this.scene.scale.on('resize', this.layout, this);
    this.scene.input.keyboard?.on('keydown', this.handleKeyDown);
    this.scene.input.keyboard?.on('keyup', this.handleKeyUp);
    this.scene.input.on('pointerdown', this.handlePointerDown);
    this.scene.input.on('pointerup', this.handlePointerUp);
    this.scene.input.on('pointerupoutside', this.handlePointerUp);
    host.ownerDocument.defaultView?.addEventListener('blur', this.handleBlur);
    this.layout();
    const animationWindow = host.ownerDocument.defaultView;
    if (animationWindow) {
      this.initialLayoutFrame = animationWindow.requestAnimationFrame(() => {
        this.initialLayoutFrame = undefined;
        this.layout();
        this.initialLayoutFrameSecond = animationWindow.requestAnimationFrame(() => {
          this.initialLayoutFrameSecond = undefined;
          this.layout();
        });
      });
    }
  }

  show(options: ActionPromptOptions): void {
    this.layout();
    this.worldPosition = options.worldPosition;
    this.currentOptions = options;
    const nextSignature = JSON.stringify({
      inputType: options.inputType,
      keyLabel: options.keyLabel,
      keyCode: options.keyCode,
      mouseButton: options.mouseButton,
      actionText: options.actionText,
      itemName: options.itemName,
      holdDuration: options.holdDuration,
      additionalInputs: options.additionalInputs,
      additionalRows: options.additionalRows,
    });

    if (nextSignature !== this.signature) {
      this.signature = nextSignature;
      this.holdProgress = 0;
      this.buildRows(options);
    }
    this.positionRows();
    this.setHoldProgress(this.holdProgress);
    const accessibleText = this.getAccessibleText(options);
    if (accessibleText !== this.announcedText) {
      this.announcer.textContent = accessibleText;
      this.announcedText = accessibleText;
    }

    if (!this.isShown) {
      this.isShown = true;
      this.scene.tweens.killTweensOf(this.root);
      this.root.setVisible(true).setAlpha(0);
      this.scene.tweens.add({
        targets: this.root,
        alpha: 1,
        duration: ACTION_PROMPT_TRANSITION_DURATION_MS,
        ease: 'Sine.Out',
      });
    }

    const animationWindow = this.scene.game.canvas.ownerDocument.defaultView;
    if (animationWindow) {
      animationWindow.requestAnimationFrame(() => {
        this.layout();
        this.positionRows();
        if (this.currentOptions) {
          this.buildRows(this.currentOptions);
          this.positionRows();
        }
      });
    }
  }

  hide(): void {
    if (!this.isShown) {
      return;
    }
    this.isShown = false;
    this.announcer.textContent = '';
    this.announcedText = '';
    this.scene.tweens.killTweensOf(this.root);
    this.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      duration: ACTION_PROMPT_TRANSITION_DURATION_MS,
      ease: 'Sine.Out',
      onComplete: () => {
        if (!this.isShown) {
          this.root.setVisible(false);
        }
      },
    });
  }

  setHoldProgress(progress0to1: number): void {
    const progress = Math.max(0, Math.min(1, progress0to1));
    if (progress === this.holdProgress) {
      return;
    }
    this.holdProgress = progress;
    this.drawHoldProgress();
  }

  setTouchButtonPressed(button: 'attack' | 'throw', pressed: boolean): void {
    if (pressed) {
      this.pressedTouchActions.add(button);
    } else {
      this.pressedTouchActions.delete(button);
    }
    this.setInputPressed(`touch:${button}`, pressed);
  }

  setWorldToScreen(project: WorldToScreen): void {
    this.worldToScreen = project;
    this.positionRows();
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.scene.scale.off('resize', this.layout, this);
    this.scene.input.keyboard?.off('keydown', this.handleKeyDown);
    this.scene.input.keyboard?.off('keyup', this.handleKeyUp);
    this.scene.input.off('pointerdown', this.handlePointerDown);
    this.scene.input.off('pointerup', this.handlePointerUp);
    this.scene.input.off('pointerupoutside', this.handlePointerUp);
    this.scene.game.canvas.ownerDocument.defaultView?.removeEventListener(
      'blur',
      this.handleBlur
    );
    this.scene.tweens.killTweensOf(this.root);
    if (this.initialLayoutFrame !== undefined) {
      this.scene.game.canvas.ownerDocument.defaultView?.cancelAnimationFrame(
        this.initialLayoutFrame
      );
      this.initialLayoutFrame = undefined;
    }
    if (this.initialLayoutFrameSecond !== undefined) {
      this.scene.game.canvas.ownerDocument.defaultView?.cancelAnimationFrame(
        this.initialLayoutFrameSecond
      );
      this.initialLayoutFrameSecond = undefined;
    }
    this.root.destroy(true);
    this.announcer.remove();
  }

  private layout(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const canvasBounds = this.scene.game.canvas.getBoundingClientRect();
    const canvasWidth = canvasBounds.width > 0 ? canvasBounds.width : width;
    const canvasHeight = canvasBounds.height > 0 ? canvasBounds.height : height;
    const zoom = this.scene.cameras.main.zoom;
    const unitScale = getActionPromptUnitScale(
      width,
      height,
      canvasWidth,
      canvasHeight
    );
    const changed =
      width !== this.lastWidth ||
      height !== this.lastHeight ||
      unitScale !== this.unitScale ||
      zoom !== this.lastZoom;

    this.unitScale = unitScale;
    this.lastWidth = width;
    this.lastHeight = height;
    this.lastZoom = zoom;
    this.root.setPosition(width / 2, height / 2).setScale(1 / zoom);

    if (changed && this.currentOptions && this.signature) {
      this.buildRows(this.currentOptions);
      this.positionRows();
      this.drawHoldProgress();
    }
  }

  private buildRows(options: ActionPromptOptions): void {
    this.root.removeAll(true);
    this.rowLayouts.length = 0;
    this.inputImages.clear();
    this.progressGraphics = undefined;
    this.progressCenter = undefined;

    const rows: ActionPromptRow[] = [
      {
        actionText: options.actionText,
        ...(options.itemName ? { itemName: options.itemName } : {}),
        inputs: [
          this.getPrimaryInput(options),
          ...(options.additionalInputs ?? []),
        ],
      },
      ...(options.additionalRows ?? []),
    ];

    for (const row of rows) {
      this.rowLayouts.push(this.createRow(row));
    }

    this.progressGraphics = this.scene.add.graphics();
    this.root.add(this.progressGraphics);
    this.drawHoldProgress();
    this.restorePressedInputs();
  }

  private createRow(row: ActionPromptRow): PromptRowLayout {
    const scale = this.unitScale;
    const container = this.scene.add.container(0, 0);
    const inputGroup = this.scene.add.container(0, 0);
    let inputWidth = 0;
    let firstInputCenterX = ACTION_PROMPT_SPRITE_SIZE_CSS * scale / 2;

    row.inputs.forEach((input, index) => {
      if (index > 0) {
        const separator = this.createText('OR', 9, '#ffffff', 'Arial', true);
        separator.setOrigin(0, 0.5).setPosition(
          inputWidth,
          0
        );
        inputGroup.add(separator);
        inputWidth += separator.width + 3 * scale;
      }

      const { frame, pressedKey } = this.getInputFrame(input);
      const image = this.scene.add
        .image(0, 0, ACTION_PROMPT_KEY_SPRITE_KEY, frame)
        .setOrigin(0, 0.5)
        .setDisplaySize(
          ACTION_PROMPT_SPRITE_SIZE_CSS * scale,
          ACTION_PROMPT_SPRITE_SIZE_CSS * scale
        )
        .setPosition(inputWidth, 0);
      inputGroup.add(image);
      if (pressedKey) {
        const tracked: TrackedInput = {
          image,
          x: image.x,
          y: image.y,
          scaleX: image.scaleX,
          scaleY: image.scaleY,
        };
        this.inputImages.set(pressedKey, [
          ...(this.inputImages.get(pressedKey) ?? []),
          tracked,
        ]);
      }
      if (index === 0) {
        firstInputCenterX = inputWidth + ACTION_PROMPT_SPRITE_SIZE_CSS * scale / 2;
      }
      inputWidth += (ACTION_PROMPT_SPRITE_SIZE_CSS + ACTION_PROMPT_INPUT_GAP_CSS) * scale;
    });
    if (row.inputs.length > 0) {
      inputWidth -= ACTION_PROMPT_INPUT_GAP_CSS * scale;
    }
    container.add(inputGroup);

    const fragments = this.getActionFragments(row.actionText);
    const actionText = this.createText(
      fragments ? fragments.join('\n') : row.actionText.toUpperCase(),
      fragments ? 8 : 10,
      '#ffd700',
      '"Press Start 2P", monospace'
    );
    actionText.setOrigin(0, 0.5);
    const actionHeight = (fragments ? 20 : 14) * scale;
    const itemText = row.itemName
      ? this.createText(row.itemName.toUpperCase(), 13, '#fffaf0', 'Segoe UI', true)
      : undefined;
    const itemHeight = itemText ? 16 * scale : 0;
    const copyHeight = actionHeight + (itemText ? 2 * scale + itemHeight : 0);
    const copyX = inputWidth + ACTION_PROMPT_COPY_GAP_CSS * scale;
    actionText.setPosition(copyX, -copyHeight / 2 + actionHeight / 2);
    container.add(actionText);
    let copyWidth = actionText.width;
    if (itemText) {
      itemText
        .setOrigin(0, 0.5)
        .setPosition(copyX, -copyHeight / 2 + actionHeight + 2 * scale + itemHeight / 2);
      container.add(itemText);
      copyWidth = Math.max(copyWidth, itemText.width);
    }

    const height = Math.max(ACTION_PROMPT_SPRITE_SIZE_CSS * scale, copyHeight);
    this.root.add(container);
    return {
      container,
      width: inputWidth + (copyWidth > 0 ? ACTION_PROMPT_COPY_GAP_CSS * scale + copyWidth : 0),
      height,
      firstInputCenterX,
    };
  }

  private createText(
    text: string,
    fontSizeCss: number,
    color: string,
    fontFamily: string,
    bold = false
  ): Phaser.GameObjects.Text {
    const scale = this.unitScale;
    return this.scene.add.text(0, 0, text, {
      color,
      fontFamily,
      fontSize: `${fontSizeCss * scale}px`,
      fontStyle: bold ? 'bold' : '',
      lineSpacing: 2 * scale,
      stroke: '#000000',
      strokeThickness: scale,
      padding: { x: scale, y: scale },
    });
  }

  private positionRows(): void {
    if (this.rowLayouts.length === 0) {
      return;
    }
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const totalHeight =
      this.rowLayouts.reduce((sum, row) => sum + row.height, 0) +
      ACTION_PROMPT_ROW_GAP_CSS * this.unitScale *
        Math.max(0, this.rowLayouts.length - 1);
    const worldPoint =
      this.worldPosition && this.worldToScreen
        ? this.worldToScreen(this.worldPosition)
        : undefined;
    const edgePadding =
      ACTION_PROMPT_MIN_EDGE_PADDING_CSS +
      ACTION_PROMPT_EDGE_PADDING_RANGE_CSS *
        Math.min(1, width / SETTINGS_UI_SCALE_BREAKPOINT_CSS);
    const x = worldPoint
      ? worldPoint.x - width / 2 - this.getMaxRowWidth() / 2
      : -width / 2 + edgePadding * this.unitScale;
    const top = worldPoint
      ? worldPoint.y - height / 2 - totalHeight - 4 * this.unitScale
      : -totalHeight / 2;

    let nextY = top;
    for (const row of this.rowLayouts) {
      row.container.setPosition(x, nextY + row.height / 2);
      nextY += row.height + ACTION_PROMPT_ROW_GAP_CSS * this.unitScale;
    }

    const firstRow = this.rowLayouts[0];
    if (firstRow && this.currentOptions?.holdDuration) {
      this.progressCenter = {
        x: x + firstRow.firstInputCenterX,
        y: top + firstRow.height / 2,
      };
    } else {
      this.progressCenter = undefined;
    }
    this.drawHoldProgress();
  }

  private getMaxRowWidth(): number {
    return Math.max(...this.rowLayouts.map((row) => row.width));
  }

  private drawHoldProgress(): void {
    const graphics = this.progressGraphics;
    const center = this.progressCenter;
    if (!graphics) {
      return;
    }
    graphics.clear();
    if (!center || !this.currentOptions?.holdDuration) {
      return;
    }
    const radius = ACTION_PROMPT_SPRITE_SIZE_CSS * this.unitScale * 0.56;
    graphics.lineStyle(2 * this.unitScale, 0xffffff, 0.25);
    graphics.strokeCircle(center.x, center.y, radius);
    if (this.holdProgress > 0) {
      graphics.lineStyle(
        2 * this.unitScale,
        0xffd16b,
        this.holdProgress >= 1 ? 1 : 0.9
      );
      graphics.beginPath();
      graphics.arc(
        center.x,
        center.y,
        radius,
        -Math.PI / 2,
        -Math.PI / 2 + this.holdProgress * Math.PI * 2,
        false
      );
      graphics.strokePath();
    }
  }

  private getInputFrame(input: ActionPromptInput): {
    frame: number;
    pressedKey?: string;
  } {
    if (input.inputType === 'key') {
      const keyName = input.keyLabel.toUpperCase();
      const cell = KEY_SPRITE_CELLS[keyName];
      if (!cell) {
        throw new Error(`No action prompt sprite is configured for "${keyName}".`);
      }
      const pressedKey =
        input.keyCode
          ? `key:${input.keyCode}`
          : keyName === 'A'
            ? 'touch:attack'
            : keyName === 'B'
              ? 'touch:throw'
              : undefined;
      return {
        frame: cell.row * 8 + cell.column,
        ...(pressedKey ? { pressedKey } : {}),
      };
    }
    return {
      frame: 3 * 8 + MOUSE_SPRITE_COLUMN[input.mouseButton],
      pressedKey: `mouse:${input.mouseButton}`,
    };
  }

  private getPrimaryInput(options: ActionPromptOptions): ActionPromptInput {
    if (options.inputType === 'key') {
      return {
        inputType: 'key',
        keyLabel: options.keyLabel ?? 'L',
        ...(options.keyCode ? { keyCode: options.keyCode } : {}),
      };
    }
    return {
      inputType: 'mouse',
      mouseButton: options.mouseButton ?? 'left',
    };
  }

  private getActionFragments(actionText: string): [string, string] | undefined {
    const normalized = actionText.toUpperCase();
    if (normalized === 'ATTACK') {
      return ['ATT', 'ACK'];
    }
    if (normalized === 'PICKUP') {
      return ['PIC', 'KUP'];
    }
    if (normalized === 'THROW') {
      return ['THR', 'OW'];
    }
    return undefined;
  }

  private getAccessibleText(options: ActionPromptOptions): string {
    const rows: ActionPromptRow[] = [
      {
        actionText: options.actionText,
        ...(options.itemName ? { itemName: options.itemName } : {}),
        inputs: [
          this.getPrimaryInput(options),
          ...(options.additionalInputs ?? []),
        ],
      },
      ...(options.additionalRows ?? []),
    ];
    return rows
      .map((row) => {
        const inputs = row.inputs
          .map((input) =>
            input.inputType === 'key'
              ? input.keyLabel
              : `${input.mouseButton} mouse button`
          )
          .join(' or ');
        return `${row.actionText}${row.itemName ? ` ${row.itemName}` : ''}: ${inputs}`;
      })
      .join('. ');
  }

  private restorePressedInputs(): void {
    for (const key of this.pressedKeys) {
      this.setInputPressed(`key:${key}`, true);
    }
    for (const button of this.pressedMouseButtons) {
      this.setInputPressed(`mouse:${button}`, true);
    }
    for (const action of this.pressedTouchActions) {
      this.setInputPressed(`touch:${action}`, true);
    }
  }

  private setInputPressed(key: string, pressed: boolean): void {
    for (const tracked of this.inputImages.get(key) ?? []) {
      tracked.image
        .setPosition(tracked.x, tracked.y + (pressed ? 2 * this.unitScale : 0))
        .setScale(
          tracked.scaleX * (pressed ? 0.96 : 1),
          tracked.scaleY * (pressed ? 0.96 : 1)
        );
      if (pressed) {
        tracked.image.setTint(0xffe6a3);
      } else {
        tracked.image.clearTint();
      }
    }
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.inputImages.has(`key:${event.code}`)) {
      this.pressedKeys.add(event.code);
      this.setInputPressed(`key:${event.code}`, true);
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.code);
    this.setInputPressed(`key:${event.code}`, false);
  };

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    const button = Object.entries(MOUSE_BUTTON_CODE).find(
      ([, code]) => code === pointer.button
    )?.[0];
    if (button && this.inputImages.has(`mouse:${button}`)) {
      this.pressedMouseButtons.add(button);
      this.setInputPressed(`mouse:${button}`, true);
    }
  };

  private readonly handlePointerUp = (): void => {
    for (const button of this.pressedMouseButtons) {
      this.setInputPressed(`mouse:${button}`, false);
    }
    this.pressedMouseButtons.clear();
  };

  private readonly handleBlur = (): void => {
    for (const key of this.pressedKeys) {
      this.setInputPressed(`key:${key}`, false);
    }
    this.pressedKeys.clear();
    this.handlePointerUp();
  };
}
