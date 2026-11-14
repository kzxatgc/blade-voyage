import * as Phaser from 'phaser';
import { TICK_RATE } from '../../shared/constants';
import { createTemporaryPlusMap, Tilemap } from '../systems/Tilemap';
import { Animation } from '../utils/Animation';

const TILE_ANIMATION_TYPES = [
  'palm_tree/front/left',
  'palm_tree/front/regular',
  'palm_tree/front/right',
  'palm_tree/back/left',
  'palm_tree/back/regular',
  'palm_tree/back/right',
];

export class Game extends Phaser.Scene {
  private idleAnimation?: Animation;
  private idleSprite?: Phaser.GameObjects.Image;
  private tilemap?: Tilemap;
  private tileAnimations: Record<string, Animation> = {};
  private tickAccumulator = 0;

  constructor() {
    super('Game');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x000000);
    this.add
      .image(this.scale.width / 2, this.scale.height / 2, 'background')
      .setDisplaySize(this.scale.width, this.scale.height);

    this.tilemap = new Tilemap();
    this.tilemap.loadFromData(createTemporaryPlusMap());
    this.tileAnimations = Object.fromEntries(
      TILE_ANIMATION_TYPES.map((type) => [type, new Animation(type, 4, 28)])
    );
    this.tilemap.backRender(this, [0, 0], this.tileAnimations);

    this.idleAnimation = new Animation('player/idle', 5, 6);
    this.idleSprite = this.add.image(
      this.scale.width * 0.53,
      this.scale.height * 0.08,
      this.idleAnimation.img()
    );
    this.tilemap.frontRender(this, [0, 0], this.tileAnimations);
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
      this.tilemap?.updateAnimations(this.tileAnimations);
      if (this.idleAnimation.indexChanged) {
        this.idleSprite.setTexture(this.idleAnimation.img());
      }
    }
  }
}
