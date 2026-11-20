import * as Phaser from 'phaser';
import { TICK_RATE } from '../../shared/constants';

export type IrisFocus = {
  x: number;
  y: number;
};

type TransitionState = 'inactive' | 'opening' | 'closing' | 'closed';

const TRANSITION_DURATION_FRAMES = 30;
const TRANSITION_DURATION_MS = (TRANSITION_DURATION_FRAMES * 1000) / TICK_RATE;
const TRANSITION_DEPTH = 1000;

let textureSequence = 0;

export class IrisTransition {
  private readonly textureKey = `iris-transition-${textureSequence++}`;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly context: CanvasRenderingContext2D;
  private readonly image: Phaser.GameObjects.Image;
  private state: TransitionState = 'inactive';
  private focus: IrisFocus = { x: 0, y: 0 };
  private elapsedMs = 0;
  private maxRadius = 0;
  private onComplete: (() => void) | undefined;
  private inputWasEnabled = true;
  private destroyed = false;

  constructor(private readonly scene: Phaser.Scene) {
    const texture = scene.textures.createCanvas(
      this.textureKey,
      scene.scale.width,
      scene.scale.height
    );
    if (!texture) {
      throw new Error('Unable to create the iris transition texture.');
    }

    this.texture = texture;
    this.context = texture.getContext();
    this.image = scene.add
      .image(scene.scale.width / 2, scene.scale.height / 2, this.textureKey)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(TRANSITION_DEPTH)
      .setVisible(false);

    scene.events.once('shutdown', this.destroy, this);
  }

  get isActive(): boolean {
    return this.state !== 'inactive';
  }

  startOpening(focus: IrisFocus, onComplete?: () => void): void {
    this.begin('opening', focus, onComplete);
  }

  startClosing(focus: IrisFocus, onComplete: () => void): boolean {
    if (this.isActive) {
      return false;
    }
    this.begin('closing', focus, onComplete);
    return true;
  }

  update(delta: number): void {
    if (this.state === 'inactive') {
      return;
    }

    if (this.state === 'closed') {
      const onComplete = this.onComplete;
      this.onComplete = undefined;
      onComplete?.();
      return;
    }

    this.elapsedMs = Math.min(
      this.elapsedMs + Math.max(delta, 0),
      TRANSITION_DURATION_MS
    );
    this.render();

    if (this.elapsedMs < TRANSITION_DURATION_MS) {
      return;
    }

    if (this.state === 'opening') {
      this.state = 'inactive';
      this.image.setVisible(false);
      this.restoreInput();
      const onComplete = this.onComplete;
      this.onComplete = undefined;
      onComplete?.();
      return;
    }

    this.state = 'closed';
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.scene.events.off('shutdown', this.destroy, this);
    this.image.destroy();
    this.scene.textures.remove(this.textureKey);
  }

  private begin(
    state: 'opening' | 'closing',
    focus: IrisFocus,
    onComplete?: () => void
  ): void {
    if (this.isActive) {
      throw new Error(`Cannot start an iris transition while ${this.state}.`);
    }

    this.state = state;
    this.focus = focus;
    this.elapsedMs = 0;
    this.onComplete = onComplete;
    this.inputWasEnabled = this.scene.input.enabled;
    this.scene.input.enabled = false;
    this.image.setVisible(true);

    const { width, height } = this.scene.scale;
    this.maxRadius =
      Math.max(
        Math.hypot(focus.x, focus.y),
        Math.hypot(width - focus.x, focus.y),
        Math.hypot(focus.x, height - focus.y),
        Math.hypot(width - focus.x, height - focus.y)
      ) + 1;
    this.render();
  }

  private render(): void {
    const { width, height } = this.scene.scale;
    const progress = Math.min(this.elapsedMs / TRANSITION_DURATION_MS, 1);
    const radius =
      this.state === 'opening'
        ? this.maxRadius * progress
        : this.maxRadius * (1 - progress);

    this.context.clearRect(0, 0, width, height);
    this.context.globalCompositeOperation = 'source-over';
    this.context.fillStyle = '#000000';
    this.context.fillRect(0, 0, width, height);
    this.context.globalCompositeOperation = 'destination-out';
    this.context.beginPath();
    this.context.arc(this.focus.x, this.focus.y, radius, 0, Math.PI * 2);
    this.context.fill();
    this.context.globalCompositeOperation = 'source-over';
    this.texture.refresh();
    this.image.setScale(1 / this.scene.cameras.main.zoom);
  }

  private restoreInput(): void {
    this.scene.input.enabled = this.inputWasEnabled;
  }
}
