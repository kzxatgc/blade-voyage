import {
  SETTINGS_UI_SCALE_BREAKPOINT_CSS,
} from './SettingsUI';

const ACTION_PROMPT_MIN_EDGE_PADDING_CSS = 11;
const ACTION_PROMPT_EDGE_PADDING_RANGE_CSS = 3;
const ACTION_PROMPT_TRANSITION_PHASE_DURATION_MS = 240;

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
type WorldToScreen = (point: NonNullable<ActionPromptOptions['worldPosition']>) => ScreenPoint;

const MOUSE_BUTTON_CODE = { left: 0, middle: 1, right: 2 } as const;
const PROMPT_SPRITE_URL = '/assets/img/ui/action-prompt-keycaps.png';
const KEY_SPRITE_CELLS: Readonly<Record<string, { column: number; row: number }>> = {
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

export class ActionPromptHUD {
  private readonly root: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly rows: HTMLDivElement;
  private resizeObserver: ResizeObserver | undefined;
  private mutationObserver: MutationObserver | undefined;
  private canvas: HTMLCanvasElement | undefined;
  private worldPosition: ActionPromptOptions['worldPosition'];
  private worldToScreen: WorldToScreen | undefined;
  private readonly keyCodes = new Set<string>();
  private signature = '';
  private raf = 0;
  private transitionTimeout = 0;
  private holdProgress = 0;

  constructor(private readonly host: HTMLElement) {
    const doc = host.ownerDocument;
    this.root = doc.createElement('div');
    this.root.className = 'action-prompt-hud';
    this.root.setAttribute('aria-live', 'polite');
    this.root.setAttribute('aria-hidden', 'true');

    this.prompt = doc.createElement('div');
    this.prompt.className = 'action-prompt is-hidden';
    this.rows = doc.createElement('div');
    this.rows.className = 'action-prompt-rows';
    this.prompt.append(this.rows);
    this.root.append(this.prompt);
    host.append(this.root);

    const view = doc.defaultView;
    view?.addEventListener('keydown', this.handleKeyDown);
    view?.addEventListener('keyup', this.handleKeyUp);
    view?.addEventListener('pointerdown', this.handlePointerDown);
    view?.addEventListener('pointerup', this.clearPressed);
    view?.addEventListener('pointercancel', this.clearPressed);
    view?.addEventListener('blur', this.clearPressed);
    view?.addEventListener('resize', this.layout);
    if (view?.ResizeObserver) {
      this.resizeObserver = new view.ResizeObserver(this.layout);
      this.resizeObserver.observe(host);
    }
    if (view?.MutationObserver) {
      this.mutationObserver = new view.MutationObserver(this.layout);
      this.mutationObserver.observe(host, { childList: true });
    }
    this.layout();
  }

  show(options: ActionPromptOptions): void {
    this.worldPosition = options.worldPosition;
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
      const animate =
        this.signature.length > 0 &&
        !this.prompt.classList.contains('is-hidden');
      this.holdProgress = 0;
      this.render(options, animate);
      this.signature = nextSignature;
    }
    this.prompt.classList.remove('is-hidden');
    this.root.setAttribute('aria-hidden', 'false');
    this.updatePosition();
    this.setHoldProgress(this.holdProgress);
    this.trackWorldPosition();
  }

  hide(): void {
    this.clearContentTransition();
    this.worldPosition = undefined;
    this.prompt.classList.add('is-hidden');
    this.root.setAttribute('aria-hidden', 'true');
    this.stopTracking();
  }

  setHoldProgress(progress0to1: number): void {
    this.holdProgress = Math.max(0, Math.min(1, progress0to1));
    this.prompt.style.setProperty('--action-prompt-progress', String(this.holdProgress));
    this.prompt.classList.toggle(
      'is-holding',
      this.holdProgress > 0 && this.holdProgress < 1
    );
    this.prompt.classList.toggle('is-hold-complete', this.holdProgress >= 1);
  }

  setWorldToScreen(project: WorldToScreen): void {
    this.worldToScreen = project;
    this.updatePosition();
  }

  destroy(): void {
    this.hide();
    const view = this.host.ownerDocument.defaultView;
    view?.removeEventListener('keydown', this.handleKeyDown);
    view?.removeEventListener('keyup', this.handleKeyUp);
    view?.removeEventListener('pointerdown', this.handlePointerDown);
    view?.removeEventListener('pointerup', this.clearPressed);
    view?.removeEventListener('pointercancel', this.clearPressed);
    view?.removeEventListener('blur', this.clearPressed);
    view?.removeEventListener('resize', this.layout);
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.root.remove();
  }

  private render(options: ActionPromptOptions, animate = false): void {
    this.clearContentTransition();
    if (animate) {
      const exitingRows = this.host.ownerDocument.createElement('div');
      exitingRows.className = 'action-prompt-rows action-prompt-rows-exiting';
      exitingRows.setAttribute('aria-hidden', 'true');
      for (const row of this.rows.children) {
        exitingRows.append(row.cloneNode(true));
      }
      exitingRows
        .querySelectorAll('[data-key-code], [data-mouse-button]')
        .forEach((input) => {
          input.removeAttribute('data-key-code');
          input.removeAttribute('data-mouse-button');
        });
      this.prompt.insertBefore(exitingRows, this.rows);
    }

    this.rows.replaceChildren();
    this.rows.classList.remove('is-entering');
    this.prompt.classList.toggle('is-key-prompt', options.inputType === 'key');
    this.prompt.classList.toggle('is-mouse-prompt', options.inputType === 'mouse');
    this.prompt.classList.toggle('has-hold', (options.holdDuration ?? 0) > 0);
    this.keyCodes.clear();
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

    for (const [index, row] of rows.entries()) {
      const rowElement = this.host.ownerDocument.createElement('div');
      rowElement.className = 'action-prompt-row';
      const inputGroup = this.host.ownerDocument.createElement('div');
      inputGroup.className = 'action-prompt-input';
      inputGroup.setAttribute('aria-hidden', 'true');

      row.inputs.forEach((input, inputIndex) => {
        if (inputIndex > 0) {
          const or = this.host.ownerDocument.createElement('span');
          or.className = 'action-prompt-or';
          or.append(this.createPixelText('OR', 'white'));
          inputGroup.append(or);
        }
        inputGroup.append(this.renderInput(input));
      });

      const copy = this.host.ownerDocument.createElement('span');
      copy.className = 'action-prompt-copy';
      const action = this.host.ownerDocument.createElement('span');
      action.className = 'action-prompt-action';
      action.append(this.createPixelText(row.actionText, 'gold'));
      copy.append(action);
      if (row.itemName) {
        const item = this.host.ownerDocument.createElement('span');
        item.className = 'action-prompt-item';
        item.append(this.createPixelText(row.itemName, 'white'));
        copy.append(item);
      }

      rowElement.append(inputGroup, copy);
      rowElement.classList.toggle('is-primary-row', index === 0);
      this.rows.append(rowElement);
    }

    if (animate) {
      void this.rows.offsetWidth;
      this.rows.classList.add('is-entering');
      const view = this.host.ownerDocument.defaultView;
      if (view) {
        this.transitionTimeout = view.setTimeout(
          this.clearContentTransition,
          ACTION_PROMPT_TRANSITION_PHASE_DURATION_MS * 2
        );
      }
    }
  }

  private clearContentTransition = (): void => {
    const view = this.host.ownerDocument.defaultView;
    if (this.transitionTimeout && view) {
      view.clearTimeout(this.transitionTimeout);
    }
    this.transitionTimeout = 0;
    this.rows.classList.remove('is-entering');
    this.prompt
      .querySelectorAll('.action-prompt-rows-exiting')
      .forEach((rows) => rows.remove());
  };

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

  private renderInput(input: ActionPromptInput): HTMLSpanElement {
    const element = this.createSprite();
    if (input.inputType === 'key') {
      const keyName = input.keyLabel.toUpperCase();
      const cell = KEY_SPRITE_CELLS[keyName];
      if (!cell) {
        throw new Error(`No action prompt sprite is configured for "${keyName}".`);
      }
      element.classList.add('action-prompt-key');
      if (input.keyCode) {
        element.dataset.keyCode = input.keyCode;
        this.keyCodes.add(input.keyCode);
      }
      this.setSpriteCell(element, cell.column, cell.row);
    } else {
      element.classList.add('action-prompt-mouse');
      element.dataset.mouseButton = input.mouseButton;
      this.setSpriteCell(
        element,
        MOUSE_SPRITE_COLUMN[input.mouseButton],
        3
      );
    }
    return element;
  }

  private createSprite(): HTMLSpanElement {
    const element = this.host.ownerDocument.createElement('span');
    element.className = 'action-prompt-sprite';
    element.style.backgroundImage = `url("${PROMPT_SPRITE_URL}")`;
    return element;
  }

  private createPixelText(
    text: string,
    tone: 'gold' | 'white'
  ): HTMLSpanElement {
    const element = this.host.ownerDocument.createElement('span');
    element.className = `action-prompt-pixel-text is-${tone}`;
    element.setAttribute('aria-label', text);

    const normalizedText = text.toUpperCase();
    const fragments =
      normalizedText === 'ATTACK'
        ? ['ATT', 'ACK']
        : normalizedText === 'THROW'
          ? ['THR', 'OW']
          : normalizedText === 'PICKUP'
            ? ['PIC', 'KUP']
            : [];
    if (fragments.length === 2) {
      element.classList.add('is-two-row');
      for (const fragment of fragments) {
        const row = this.host.ownerDocument.createElement('span');
        row.className = 'action-prompt-pixel-word-row';
        row.classList.toggle('is-centered', fragment === 'OW');
        row.textContent = fragment;
        element.append(row);
      }
      return element;
    }
    element.textContent = normalizedText;
    return element;
  }

  private setSpriteCell(
    element: HTMLSpanElement,
    column: number,
    row: number
  ): void {
    element.style.backgroundPosition = `${-column * 32}px ${-row * 32}px`;
  }

  private layout = (): void => {
    const canvas = this.host.querySelector('canvas') ?? undefined;
    if (canvas && canvas !== this.canvas) {
      this.canvas = canvas;
      this.resizeObserver?.observe(canvas);
    }
    const hostRect = this.host.getBoundingClientRect();
    const canvasRect = canvas?.getBoundingClientRect();
    this.root.style.left = `${canvasRect ? canvasRect.left - hostRect.left : 0}px`;
    this.root.style.top = `${canvasRect ? canvasRect.top - hostRect.top : 0}px`;
    this.root.style.width = `${canvasRect?.width ?? hostRect.width}px`;
    this.root.style.height = `${canvasRect?.height ?? hostRect.height}px`;
    this.updatePosition();
  };

  private updatePosition(): void {
    if (this.worldPosition && this.worldToScreen) {
      const point = this.worldToScreen(this.worldPosition);
      this.prompt.style.left = `${point.x}px`;
      this.prompt.style.top = `${point.y}px`;
      this.prompt.classList.add('is-world-positioned');
      return;
    }
    const edgePadding =
      ACTION_PROMPT_MIN_EDGE_PADDING_CSS +
      ACTION_PROMPT_EDGE_PADDING_RANGE_CSS *
        Math.min(1, this.root.clientWidth / SETTINGS_UI_SCALE_BREAKPOINT_CSS);
    this.prompt.style.left = `${edgePadding}px`;
    this.prompt.style.top = '50%';
    this.prompt.classList.remove('is-world-positioned');
  }

  private trackWorldPosition(): void {
    if (this.raf || !this.worldPosition) {
      return;
    }
    const view = this.host.ownerDocument.defaultView;
    if (!view) {
      return;
    }
    const update = () => {
      if (!this.worldPosition) {
        this.raf = 0;
        return;
      }
      this.updatePosition();
      this.raf = view.requestAnimationFrame(update);
    };
    this.raf = view.requestAnimationFrame(update);
  }

  private stopTracking(): void {
    const view = this.host.ownerDocument.defaultView;
    if (this.raf && view) {
      view.cancelAnimationFrame(this.raf);
    }
    this.raf = 0;
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.keyCodes.has(event.code)) {
      this.prompt
        .querySelector(`[data-key-code="${event.code}"]`)
        ?.classList.add('is-pressed');
    }
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    if (this.keyCodes.has(event.code)) {
      this.prompt
        .querySelector(`[data-key-code="${event.code}"]`)
        ?.classList.remove('is-pressed');
    }
  };

  private handlePointerDown = (event: PointerEvent): void => {
    const button = Object.entries(MOUSE_BUTTON_CODE).find(
      ([, code]) => code === event.button
    )?.[0];
    if (button) {
      this.prompt
        .querySelector(`[data-mouse-button="${button}"]`)
        ?.classList.add('is-pressed');
    }
  };

  private clearPressed = (): void => {
    this.prompt.querySelectorAll('.is-pressed').forEach((element) => {
      element.classList.remove('is-pressed');
    });
  };
}

declare global {
  interface Window {
    ActionPromptHUD: ActionPromptHUD;
  }
}
