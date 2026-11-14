import * as Phaser from 'phaser';
import { TICK_RATE } from '../../shared/constants';
import { isMapData } from '../../shared/mapData';
import { Player } from '../entities/Player';
import { Tilemap } from '../systems/Tilemap';
import { Animation } from '../utils/Animation';

const TILE_ANIMATION_TYPES = [
  'palm_tree/front/left',
  'palm_tree/front/regular',
  'palm_tree/front/right',
  'palm_tree/back/left',
  'palm_tree/back/regular',
  'palm_tree/back/right',
];
const PLAYER_MOVE_SPEED = 2.5;

export class Game extends Phaser.Scene {
  private leftKeys: Phaser.Input.Keyboard.Key[] = [];
  private playerEntity?: Player;
  private playerSprite?: Phaser.GameObjects.Image;
  private rightKeys: Phaser.Input.Keyboard.Key[] = [];
  private tilemap?: Tilemap;
  private tileAnimations: Record<string, Animation> = {};
  private tickAccumulator = 0;
  private cameraOffset: [number, number] = [0, 0];

  constructor() {
    super('Game');
  }

  preload() {
    this.load.json('game-map', '/assets/maps/0.json');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x000000);
    this.leftKeys = [
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
    ]
      .map((keyCode) => this.input.keyboard?.addKey(keyCode))
      .filter((key): key is Phaser.Input.Keyboard.Key => key !== undefined);
    this.rightKeys = [
      Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
    ]
      .map((keyCode) => this.input.keyboard?.addKey(keyCode))
      .filter((key): key is Phaser.Input.Keyboard.Key => key !== undefined);
    this.add
      .image(this.scale.width / 2, this.scale.height / 2, 'background')
      .setDisplaySize(this.scale.width, this.scale.height);

    const mapData: unknown = this.cache.json.get('game-map');
    if (!isMapData(mapData)) {
      throw new Error('The game map at /assets/maps/0.json is missing or invalid.');
    }

    this.tilemap = new Tilemap();
    this.tilemap.loadFromData(mapData);
    const [playerSpawn] = this.tilemap.extract([['spawner', 0]], false);
    if (!playerSpawn) {
      throw new Error('The game map does not contain a player spawner (variant 0).');
    }

    this.tileAnimations = Object.fromEntries(
      TILE_ANIMATION_TYPES.map((type) => [type, new Animation(type, 4, 10)])
    );
    this.playerEntity = new Player([
      playerSpawn.loc[0] * this.tilemap.tileSize,
      playerSpawn.loc[1] * this.tilemap.tileSize,
    ]);
    this.cameraOffset = [
      this.playerEntity.pos[0] + 32 - this.scale.width / 2,
      this.playerEntity.pos[1] + 18 - this.scale.height / 2,
    ];
    this.tilemap.backRender(this, this.cameraOffset, this.tileAnimations);

    const playerAnimation = this.playerEntity.animation;
    if (!playerAnimation) {
      throw new Error('The player idle animation is not configured.');
    }

    this.playerSprite = this.add.image(
      this.playerEntity.pos[0] - this.cameraOffset[0],
      this.playerEntity.pos[1] - this.cameraOffset[1],
      playerAnimation.img()
    );
    this.playerSprite.setOrigin(0, 0);
    this.tilemap.frontRender(this, this.cameraOffset, this.tileAnimations);
  }

  override update(_time: number, delta: number) {
    if (
      !this.playerSprite ||
      !this.playerEntity ||
      !this.tilemap
    ) {
      return;
    }

    this.tickAccumulator += delta;
    const tickDuration = 1000 / TICK_RATE;

    while (this.tickAccumulator >= tickDuration) {
      this.tickAccumulator -= tickDuration;
      const movingLeft = this.leftKeys.some((key) => key.isDown);
      const movingRight = this.rightKeys.some((key) => key.isDown);
      const horizontalDirection = Number(movingRight) - Number(movingLeft);
      this.playerEntity.update(this.tilemap, [
        horizontalDirection * PLAYER_MOVE_SPEED,
        0,
      ]);
      const playerAnimation = this.playerEntity.animation;
      if (!playerAnimation) {
        throw new Error('The player animation is not configured.');
      }

      playerAnimation.update();
      this.playerSprite.setPosition(
        this.playerEntity.pos[0] - this.cameraOffset[0],
        this.playerEntity.pos[1] - this.cameraOffset[1]
      );
      this.playerSprite.setFlipX(this.playerEntity.flip);
      this.tilemap.updateAnimations(this.tileAnimations);
      if (playerAnimation.indexChanged) {
        this.playerSprite.setTexture(playerAnimation.img());
      }
    }
  }
}
