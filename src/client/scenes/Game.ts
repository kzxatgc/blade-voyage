import * as Phaser from 'phaser';
import { TICK_RATE } from '../../shared/constants';
import { Animation } from '../utils/Animation';

export class Game extends Phaser.Scene {
  private idleAnimation?: Animation;
  private idleSprite?: Phaser.GameObjects.Image;
  private tickAccumulator = 0;

  constructor() {
    super('Game');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x000000);
    this.idleAnimation = new Animation('player/idle', 5, 6);
    this.idleSprite = this.add.image(
      this.scale.width / 2,
      this.scale.height / 2,
      this.idleAnimation.img()
    );
  }

  override update(_time: number, delta: number) {
    if (!this.idleAnimation || !this.idleSprite) {
      return;
    }

    this.tickAccumulator += delta;
    const tickDuration = 1000 / TICK_RATE;

    while (this.tickAccumulator >= tickDuration) {
      this.tickAccumulator -= tickDuration;
      this.idleAnimation.update();
      if (this.idleAnimation.indexChanged) {
        this.idleSprite.setTexture(this.idleAnimation.img());
      }
    }
  }
}
