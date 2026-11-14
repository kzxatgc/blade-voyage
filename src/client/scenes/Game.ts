import * as Phaser from 'phaser';
import {
  CAMERA_SMOOTHING,
  DISPLAY_WIDTH,
  TICK_RATE,
  WINDOW_WIDTH,
} from '../../shared/constants';
import { isMapData } from '../../shared/mapData';
import { Player } from '../entities/Player';
import { CloudImageSource, Clouds } from '../systems/Clouds';
import { Particles } from '../systems/Particles';
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
const PLAYER_MOVE_SPEED = 2.2;
const SLOW_WALK_RATIO = 0.6; // Classic 3:5 ratio (1.5 / 2.5)
const CLOUD_RENDER_ZOOM = WINDOW_WIDTH / DISPLAY_WIDTH;

export class Game extends Phaser.Scene {
  private leftKeys: Phaser.Input.Keyboard.Key[] = [];
  private playerEntity?: Player;
  private playerSprite?: Phaser.GameObjects.Image;
  private rightKeys: Phaser.Input.Keyboard.Key[] = [];
  private jumpKeys: Phaser.Input.Keyboard.Key[] = [];
  private downKeys: Phaser.Input.Keyboard.Key[] = [];
  private shiftKeys: Phaser.Input.Keyboard.Key[] = [];
  private tilemap?: Tilemap;
  private tileAnimations: Record<string, Animation> = {};
  private particles?: Particles;
  private tickAccumulator = 0;
  private scroll: [number, number] = [0, 0];
  private previousScroll: [number, number] = [0, 0];
  private previousPlayerPosition: [number, number] = [0, 0];
  private worldScroll: [number, number] = [0, 0];
  private clouds?: Clouds;
  private playerRenderAnimation: Animation | null = null;

  constructor() {
    super('Game');
  }

  preload() {
    this.load.json('game-map', '/assets/maps/0.json');
  }

  create() {
    this.cameras.main.setBackgroundColor(0xe6e6e6);
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
    this.jumpKeys = [
      Phaser.Input.Keyboard.KeyCodes.W,
      Phaser.Input.Keyboard.KeyCodes.UP,
    ]
      .map((keyCode) => this.input.keyboard?.addKey(keyCode))
      .filter((key): key is Phaser.Input.Keyboard.Key => key !== undefined);
    this.downKeys = [
      Phaser.Input.Keyboard.KeyCodes.S,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
    ]
      .map((keyCode) => this.input.keyboard?.addKey(keyCode))
      .filter((key): key is Phaser.Input.Keyboard.Key => key !== undefined);
    this.shiftKeys = [
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
    ]
      .map((keyCode) => this.input.keyboard?.addKey(keyCode))
      .filter((key): key is Phaser.Input.Keyboard.Key => key !== undefined);
    this.add
      .image(this.scale.width / 2, this.scale.height / 2, 'background')
      .setScrollFactor(0)
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
    this.particles = new Particles();
    this.playerEntity = new Player([
      playerSpawn.loc[0] * this.tilemap.tileSize,
      playerSpawn.loc[1] * this.tilemap.tileSize,
    ], this.particles);

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (
        event.code === 'KeyA' ||
        event.code === 'ArrowLeft' ||
        event.code === 'KeyD' ||
        event.code === 'ArrowRight'
      ) {
        this.playerEntity?.checkDoubleTap(event.code);
      }
    });

    this.input.keyboard?.on('keyup', (event: KeyboardEvent) => {
      if (
        event.code === 'KeyA' ||
        event.code === 'ArrowLeft' ||
        event.code === 'KeyD' ||
        event.code === 'ArrowRight'
      ) {
        if (this.playerEntity) {
          this.playerEntity.runBoost = 0;
        }
      }
    });
    const camera = this.cameras.main;
    this.scroll = [
      this.playerEntity.pos[0] + 32 - camera.width / 2,
      this.playerEntity.pos[1] + 18 - camera.height / 2,
    ];
    this.previousScroll = [...this.scroll];
    this.previousPlayerPosition = [...this.playerEntity.pos];
    this.worldScroll = [...this.scroll];
    camera.setRoundPixels(false);
    camera.setScroll(this.scroll[0], this.scroll[1]);

    const cloudImages = [0, 1, 2].map((frame) =>
      this.getCloudImageSource(`background/cloud/${frame}`)
    );
    this.clouds = new Clouds(
      cloudImages,
      10,
      [this.getCloudImageSource('background/big_cloud')]
    );
    this.renderClouds();
    this.tilemap.backRender(this, [0, 0], this.tileAnimations);

    const playerAnimation = this.playerEntity.animation;
    if (!playerAnimation) {
      throw new Error('The player idle animation is not configured.');
    }

    this.playerSprite = this.add.image(
      this.playerEntity.pos[0],
      this.playerEntity.pos[1],
      playerAnimation.img()
    );
    this.playerRenderAnimation = playerAnimation;
    this.playerSprite.setOrigin(0, 0);
    this.tilemap.frontRender(this, [0, 0], this.tileAnimations);
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
      this.particles?.update();
      this.previousScroll = [...this.scroll];
      this.previousPlayerPosition = [...this.playerEntity.pos];
      const movingLeft = this.leftKeys.some((key) => key.isDown);
      const movingRight = this.rightKeys.some((key) => key.isDown);
      const isShiftDown = this.shiftKeys.some((key) => key.isDown);
      const horizontalDirection = Number(movingRight) - Number(movingLeft);

      if (horizontalDirection !== 0) {
        this.playerEntity.runBoost = isShiftDown ? SLOW_WALK_RATIO : 1.0;
      } else {
        this.playerEntity.runBoost = 0;
      }
      let jumpPressed = false;
      for (const key of this.jumpKeys) {
        jumpPressed = Phaser.Input.Keyboard.JustDown(key) || jumpPressed;
      }
      if (jumpPressed) {
        this.playerEntity.jump();
      }
      let dropThroughPressed = false;
      for (const key of this.downKeys) {
        dropThroughPressed =
          Phaser.Input.Keyboard.JustDown(key) || dropThroughPressed;
      }
      if (dropThroughPressed) {
        this.playerEntity.dropThroughPlatform();
      }

      this.playerEntity.update(this.tilemap, [
        horizontalDirection * PLAYER_MOVE_SPEED,
        0,
      ]);
      this.clouds?.update();
      const playerAnimation = this.playerEntity.animation;
      if (!playerAnimation) {
        throw new Error('The player animation is not configured.');
      }

      const renderAnimation =
        this.playerEntity.landingAnimation ?? playerAnimation;
      const animationChanged = renderAnimation !== this.playerRenderAnimation;
      renderAnimation.update();
      const camera = this.cameras.main;
      const targetX =
        this.playerEntity.pos[0] + 32 - camera.width / 2;
      const targetY =
        this.playerEntity.pos[1] + 18 - camera.height / 2;
      this.scroll[0] += (targetX - this.scroll[0]) / CAMERA_SMOOTHING;
      this.scroll[1] += (targetY - this.scroll[1]) / CAMERA_SMOOTHING;
      const worldTargetX =
        this.playerEntity.pos[0] + 32 - camera.width / 2;
      const worldTargetY =
        this.playerEntity.pos[1] + 18 - camera.height / 2;
      this.worldScroll[0] += (worldTargetX - this.worldScroll[0]) / 20;
      this.worldScroll[1] += (worldTargetY - this.worldScroll[1]) / 20;
      this.renderClouds();
      this.playerSprite.setFlipX(this.playerEntity.flip);
      this.tilemap.updateAnimations(this.tileAnimations);
      if (animationChanged || renderAnimation.indexChanged) {
        this.playerSprite.setTexture(renderAnimation.img());
      }
      this.playerRenderAnimation = renderAnimation;
    }

    const interpolation = Math.min(this.tickAccumulator / tickDuration, 1);
    const renderedPlayerX =
      this.previousPlayerPosition[0] +
      (this.playerEntity.pos[0] - this.previousPlayerPosition[0]) *
      interpolation;
    const renderedPlayerY =
      this.previousPlayerPosition[1] +
      (this.playerEntity.pos[1] - this.previousPlayerPosition[1]) *
      interpolation;
    this.cameras.main.setScroll(
      this.previousScroll[0] +
      (this.scroll[0] - this.previousScroll[0]) * interpolation,
      this.previousScroll[1] +
      (this.scroll[1] - this.previousScroll[1]) * interpolation
    );
    this.playerSprite.setPosition(renderedPlayerX, renderedPlayerY);
    this.particles?.render(this, [
      renderedPlayerX - this.playerEntity.pos[0],
      renderedPlayerY - this.playerEntity.pos[1],
    ]);
  }

  private getCloudImageSource(key: string): CloudImageSource {
    const source = this.textures.get(key).getSourceImage();
    return { key, width: source.width, height: source.height };
  }

  private renderClouds() {
    this.clouds?.render(
      this,
      [Math.floor(this.worldScroll[0]), Math.floor(this.worldScroll[1])],
      CLOUD_RENDER_ZOOM
    );
  }
}
