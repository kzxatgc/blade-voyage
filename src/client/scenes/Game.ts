import * as Phaser from 'phaser';
import { TICK_RATE } from '../../shared/constants';
import { createTemporaryPlusMap, Tilemap } from '../systems/Tilemap';
import { Animation } from '../utils/Animation';

export class Game extends Phaser.Scene {
  private idleAnimation?: Animation;
  private idleSprite?: Phaser.GameObjects.Image;
  private tilemap?: Tilemap;
  private tickAccumulator = 0;

  constructor() {
    super('Game');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x000000);
    this.tilemap = new Tilemap();
    this.tilemap.loadFromData(createTemporaryPlusMap());
    this.tilemap.frontRender(this);

    this.idleAnimation = new Animation('player/idle', 5, 6);
    this.idleSprite = this.add.image(
      this.scale.width * 0.31,
      this.scale.height * 0.08,
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
