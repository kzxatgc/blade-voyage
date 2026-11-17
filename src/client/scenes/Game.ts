import * as Phaser from 'phaser';
import {
  CAMERA_BOUNDS_X,
  CAMERA_BOUNDS_Y_DOWN,
  CAMERA_BOUNDS_Y_UP,
  CAMERA_SMOOTHING,
  DEFAULT_ZOOM,
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  MAX_FRAME_DELTA,
  RENDER_DEPTH,
  TICK_RATE,
  WINDOW_HEIGHT,
  WINDOW_WIDTH,
  ZOOM_EASING_SPEED,
  ZOOM_LEVELS,
} from '../../shared/constants';
import { isMapData } from '../../shared/mapData';
import { Player } from '../entities/Player';
import { CloudImageSource, Clouds } from '../systems/Clouds';
import { Particles } from '../systems/Particles';
import { Swords } from '../systems/Swords';
import {
  createHeartSparkParticles,
  getDamageSparkCount,
  Sparks,
} from '../systems/Sparks';
import { Tilemap } from '../systems/Tilemap';
import { Enemy, spawnEntities } from '../systems/Spawner';
import { Animation } from '../utils/Animation';
import { DEBUG_CONFIG, toggleDebugMode } from '../../shared/debug';
import { SoundSystem } from '../systems/Audio';
import { TouchControls } from '../systems/TouchControls';

const TILE_ANIMATION_TYPES = [
  'palm_tree/front/left',
  'palm_tree/front/regular',
  'palm_tree/front/right',
  'palm_tree/back/left',
  'palm_tree/back/regular',
  'palm_tree/back/right',
];
const PLAYER_MOVE_SPEED = 2.0;
const SLOW_WALK_RATIO = 0.6; // Classic 3:5 ratio (1.5 / 2.5)

export class Game extends Phaser.Scene {
  private leftKeys: Phaser.Input.Keyboard.Key[] = [];
  private playerEntity?: Player;
  private playerSprite?: Phaser.GameObjects.Image;
  private rightKeys: Phaser.Input.Keyboard.Key[] = [];
  private jumpKeys: Phaser.Input.Keyboard.Key[] = [];
  private downKeys: Phaser.Input.Keyboard.Key[] = [];
  private slowLeftKeys: Phaser.Input.Keyboard.Key[] = [];
  private slowRightKeys: Phaser.Input.Keyboard.Key[] = [];
  private spaceKey: Phaser.Input.Keyboard.Key | undefined;
  private kKey: Phaser.Input.Keyboard.Key | undefined;
  private qKey: Phaser.Input.Keyboard.Key | undefined;
  private lKey: Phaser.Input.Keyboard.Key | undefined;
  private tilemap?: Tilemap;
  private tileAnimations: Record<string, Animation> = {};
  private particles?: Particles;
  private swords?: Swords;
  private enemies: Enemy[] = [];
  private sparksEffect: Sparks[] = [];
  private sparksGraphics?: Phaser.GameObjects.Graphics;
  private tickAccumulator = 0;
  private scroll: [number, number] = [0, 0];
  private previousScroll: [number, number] = [0, 0];
  private previousPlayerPosition: [number, number] = [0, 0];
  private previousEnemyPositions: [number, number][] = [];
  private worldScroll: [number, number] = [0, 0];
  private clouds?: Clouds;
  private playerRenderAnimation: Animation | null = null;
  private soundSystem?: SoundSystem;
  private touchControls?: TouchControls;
  private targetZoom: number = DEFAULT_ZOOM;
  private currentZoom: number = DEFAULT_ZOOM;
  private displayWidth: number = DISPLAY_WIDTH;
  private displayHeight: number = DISPLAY_HEIGHT;
  private backgroundImage?: Phaser.GameObjects.Image;

  constructor() {
    super('Game');
  }

  preload() {
    this.load.json('game-map', '/assets/maps/0.json');
    this.load.image('touch-left', '/assets/img/ui/touch/left.png');
    this.load.image('touch-right', '/assets/img/ui/touch/right.png');
    this.load.image('touch-down', '/assets/img/ui/touch/down.png');
    this.load.image('touch-jump', '/assets/img/ui/touch/jump.png');
    this.load.image('touch-attack', '/assets/img/ui/touch/attack.png');
    this.load.image('touch-throw', '/assets/img/ui/touch/throw.png');
  }

  create() {
    this.input.mouse?.disableContextMenu();
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
    this.slowLeftKeys = [
      Phaser.Input.Keyboard.KeyCodes.Z,
    ]
      .map((keyCode) => this.input.keyboard?.addKey(keyCode))
      .filter((key): key is Phaser.Input.Keyboard.Key => key !== undefined);
    this.slowRightKeys = [
      Phaser.Input.Keyboard.KeyCodes.C,
    ]
      .map((keyCode) => this.input.keyboard?.addKey(keyCode))
      .filter((key): key is Phaser.Input.Keyboard.Key => key !== undefined);
    this.spaceKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );
    this.kKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.K
    );
    this.qKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.Q
    );
    this.lKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.L
    );
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) {
        return;
      }
      if (this.touchControls?.isPointerOnControl(pointer)) {
        return;
      }
      if (pointer.leftButtonDown()) {
        this.triggerAttackOrPickup();
      } else if (pointer.rightButtonDown()) {
        this.playerEntity?.throwSword();
      }
    });
    // Ctrl + Wheel zoom (matches game.py lines 336-348)
    this.input.on(
      'wheel',
      (
        pointer: Phaser.Input.Pointer,
        _gameObjects: unknown[],
        _deltaX: number,
        deltaY: number
      ) => {
        const wheelEvent = pointer.event as WheelEvent | undefined;
        if (wheelEvent?.ctrlKey) {
          wheelEvent.preventDefault?.();
          if (deltaY < 0) {
            this.zoomIn();
          } else if (deltaY > 0) {
            this.zoomOut();
          }
        }
      }
    );
    this.backgroundImage = this.add
      .image(this.scale.width / 2, this.scale.height / 2, 'background')
      .setScrollFactor(0)
      .setDisplaySize(this.scale.width, this.scale.height);

    const mapData: unknown = this.cache.json.get('game-map');
    if (!isMapData(mapData)) {
      throw new Error('The game map at /assets/maps/0.json is missing or invalid.');
    }

    this.tilemap = new Tilemap();
    this.tilemap.loadFromData(mapData);

    this.tileAnimations = Object.fromEntries(
      TILE_ANIMATION_TYPES.map((type) => [type, new Animation(type, 4, 10)])
    );
    this.particles = new Particles();
    this.sparksEffect = [];
    this.swords = new Swords([0, 0], Math.random, this.sparksEffect);
    this.playerEntity = new Player([0, 0], this.particles, this.sparksEffect);
    this.playerEntity.swordsSystem = this.swords;
    this.touchControls = new TouchControls(this, {
      down: () => this.playerEntity?.dropThroughPlatform(),
      jump: () => this.playerEntity?.jump(),
      attack: () => this.triggerAttackOrPickup(),
      throw: () => this.playerEntity?.throwSword(),
    });

    const spawnResult = spawnEntities(
      this.tilemap,
      this.playerEntity,
      this.particles,
      this.sparksEffect
    );
    if (!spawnResult.playerPos) {
      throw new Error('The game map does not contain a player spawner (variant 0).');
    }
    this.enemies = spawnResult.enemies;
    for (const enemy of this.enemies) {
      enemy.playSfx = (name: string) => {
        if (this.sound && this.cache.audio.exists(name)) {
          this.sound.play(name);
        }
      };
    }

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (
        event.code === 'KeyA' ||
        event.code === 'ArrowLeft' ||
        event.code === 'KeyD' ||
        event.code === 'ArrowRight'
      ) {
        this.playerEntity?.checkDoubleTap(event.code);
      }
      if (event.code === 'F1' || event.code === 'Backquote') {
        toggleDebugMode();
      }
      // Keyboard zoom hotkeys (+/= zoom in, -/_ zoom out)
      if (
        event.code === 'NumpadAdd' ||
        event.code === 'Equal' ||
        event.key === '=' ||
        event.key === '+'
      ) {
        this.zoomIn();
      } else if (
        event.code === 'NumpadSubtract' ||
        event.code === 'Minus' ||
        event.key === '-' ||
        event.key === '_'
      ) {
        this.zoomOut();
      }
    });

    this.input.keyboard?.on('keyup', (event: KeyboardEvent) => {
      if (
        event.code === 'KeyA' ||
        event.code === 'ArrowLeft' ||
        event.code === 'KeyD' ||
        event.code === 'ArrowRight' ||
        event.code === 'KeyZ' ||
        event.code === 'KeyC'
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
    this.previousEnemyPositions = this.enemies.map((e) => [e.pos[0], e.pos[1]]);
    this.worldScroll = [...this.scroll];
    camera.setRoundPixels(true);
    camera.setZoom(this.currentZoom);
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
    this.playerSprite.setDepth(RENDER_DEPTH.ENTITIES);
    this.sparksGraphics = this.add.graphics().setDepth(RENDER_DEPTH.DEBUG);
    this.tilemap.frontRender(this, [0, 0], this.tileAnimations);

    this.soundSystem = new SoundSystem(this.sound);
    if (this.playerEntity) {
      this.playerEntity.playSfx = (name, options) =>
        this.soundSystem?.play(name, options);
    }
    if (this.swords) {
      this.swords.playSfx = (name, options) =>
        this.soundSystem?.play(name, options);
    }
    for (const enemy of this.enemies) {
      enemy.playSfx = (name, options) =>
        this.soundSystem?.play(name, options);
    }

    if (this.sound.locked) {
      const unlockAudio = () => {
        const soundWithContext = this.sound as { context?: AudioContext };
        if (soundWithContext.context && soundWithContext.context.state === 'suspended') {
          void soundWithContext.context.resume();
        }
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      };
      window.addEventListener('pointerdown', unlockAudio, { once: true });
      window.addEventListener('keydown', unlockAudio, { once: true });
    }
  }

  override update(_time: number, delta: number) {
    if (
      !this.playerSprite ||
      !this.playerEntity ||
      !this.tilemap
    ) {
      this.touchControls?.update();
      return;
    }

    const clampedDelta = Math.min(delta, MAX_FRAME_DELTA);
    this.tickAccumulator += clampedDelta;
    const tickDuration = 1000 / TICK_RATE;

    while (this.tickAccumulator >= tickDuration) {
      this.tickAccumulator -= tickDuration;
      this.fixedTick();
    }

    const alpha = Math.min(this.tickAccumulator / tickDuration, 1.0);
    this.renderInterpolated(alpha);
    this.touchControls?.update();
  }

  private fixedTick(): void {
    if (!this.playerEntity || !this.playerSprite || !this.tilemap) {
      return;
    }

    this.previousScroll = [...this.scroll];
    this.previousPlayerPosition = [...this.playerEntity.pos];
    this.previousEnemyPositions = this.enemies.map((e) => [e.pos[0], e.pos[1]]);

    if (Math.abs(this.targetZoom - this.currentZoom) > 0.0005) {
      this.currentZoom +=
        (this.targetZoom - this.currentZoom) * ZOOM_EASING_SPEED;
    } else {
      this.currentZoom = this.targetZoom;
    }
    this.displayWidth = WINDOW_WIDTH / this.currentZoom;
    this.displayHeight = WINDOW_HEIGHT / this.currentZoom;
    this.particles?.update();
    const swordHits =
      this.swords?.update(
        this.tilemap,
        [0, 0],
        this.playerEntity.pos,
        this.enemies
      ) ?? [];
    for (const enemy of this.enemies) {
      enemy.update(this.tilemap, [0, 0], this.playerEntity);

      // Enemy attack hit resolution against player (only active attacks deal damage, no contact damage)
      if (!enemy.dead) {
        // attackHitDetected: only deal damage once per attack swing/charge
        const attackLanded =
          enemy.attackHitDetected && !enemy.attackHasHitPlayer;
        if (attackLanded) {
          if (this.playerEntity.takeDamage(1)) {
            enemy.attackHasHitPlayer = true;
            const knockDir = this.playerEntity.pos[0] < enemy.pos[0] ? -1 : 1;
            this.playerEntity.applyKnockback(knockDir);
            this.sparksEffect.push(
              ...createHeartSparkParticles(
                [this.playerEntity.pos[0] + 22, this.playerEntity.pos[1] + 18],
                this.playerEntity.flip,
                8,
                { direction: 'up', gravity: 0.16 }
              )
            );
          }
        }
      }
    }

    // Player melee attack resolution against enemies
    if (this.playerEntity.attackHandler.attackState) {
      const playerAtkRect = this.playerEntity.getAttackRangeRect();
      if (playerAtkRect) {
        const damage = this.playerEntity.getAttackDamage();
        for (const enemy of this.enemies) {
          if (
            enemy.dead ||
            this.playerEntity.attackHandler.hitEntities.has(enemy) ||
            // Pink Star is invulnerable while actively attacking
            (enemy.enemyType === 'pink_star' && enemy.attackTimer > 0)
          ) {
            continue;
          }
          const eRect = enemy.rect();
          const intersects =
            playerAtkRect.x < eRect.x + eRect.width &&
            playerAtkRect.x + playerAtkRect.width > eRect.x &&
            playerAtkRect.y < eRect.y + eRect.height &&
            playerAtkRect.y + playerAtkRect.height > eRect.y;

          if (intersects) {
            this.playerEntity.attackHandler.hitEntities.add(enemy);
            enemy.takeDamage(damage);
            // Cancel any in-progress attack (clears effect particle)
            enemy.clearAttack();
            // Knockback: push enemy away from player
            const knockDir = enemy.pos[0] >= this.playerEntity.pos[0] ? 1 : -1;
            enemy.applyKnockback(knockDir, 1);
            this.sparksEffect.push(
              ...createHeartSparkParticles(
                [eRect.x + eRect.width / 2, eRect.y + eRect.height / 2],
                enemy.flip,
                getDamageSparkCount(damage),
                { direction: 'up', gravity: 0.16 }
              )
            );
          }
        }
      }
    }

    // Thrown sword hit results
    for (const result of swordHits) {
      if (result.type === 'hit') {
        const knockDir = result.enemy.pos[0] >= this.playerEntity.pos[0] ? 1 : -1;
        if ('applyKnockback' in result.enemy) {
          (result.enemy as Enemy).applyKnockback(knockDir, 1);
        }
        // Cancel in-progress attack (clears effect particle)
        if ('clearAttack' in result.enemy) {
          (result.enemy as Enemy).clearAttack();
        }
        const eRect = result.enemy.rect();
        this.sparksEffect.push(
          ...createHeartSparkParticles(
            [eRect.x + eRect.width / 2, result.sword.pos[1]],
            result.sword.flip,
            getDamageSparkCount(result.damage),
            { direction: 'up', gravity: 0.16 }
          )
        );
      } else if (result.type === 'deflection') {
        this.soundSystem?.play('sword/kicked');
        this.sparksEffect.push(
          new Sparks(
            [
              result.sword.pos[0] + (result.sword.flip ? 6 : 3),
              result.sword.pos[1],
            ],
            result.sword.flip,
            4, 7,
            [255, 255, 255],
            result.sword.flip ? 0 : -0.5,
            'diamond'
          )
        );
      }
    }
    for (let i = this.sparksEffect.length - 1; i >= 0; i--) {
      const sparks = this.sparksEffect[i];
      if (!sparks || sparks.update()) {
        this.sparksEffect.splice(i, 1);
      }
    }

    const slowMovingLeft = this.slowLeftKeys.some((key) => key.isDown);
    const slowMovingRight = this.slowRightKeys.some((key) => key.isDown);
    const movingLeft =
      this.leftKeys.some((key) => key.isDown) ||
      slowMovingLeft ||
      (this.touchControls?.movement.left ?? false);
    const movingRight =
      this.rightKeys.some((key) => key.isDown) ||
      slowMovingRight ||
      (this.touchControls?.movement.right ?? false);
    const isSlowDown = slowMovingLeft || slowMovingRight;
    const horizontalDirection = Number(movingRight) - Number(movingLeft);

    if (!this.playerEntity.throwingAnimation) {
      if (horizontalDirection !== 0) {
        this.playerEntity.runBoost = isSlowDown ? SLOW_WALK_RATIO : 1.0;
      } else {
        this.playerEntity.runBoost = 0;
      }
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

    let attackPressed = false;
    if (this.spaceKey && Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      attackPressed = true;
    }
    if (this.lKey && Phaser.Input.Keyboard.JustDown(this.lKey)) {
      attackPressed = true;
    }
    if (attackPressed) {
      this.triggerAttackOrPickup();
    }

    let throwPressed = false;
    if (this.qKey && Phaser.Input.Keyboard.JustDown(this.qKey)) {
      throwPressed = true;
    }
    if (this.kKey && Phaser.Input.Keyboard.JustDown(this.kKey)) {
      throwPressed = true;
    }
    if (throwPressed) {
      this.playerEntity.throwSword();
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

    const isHitAnimation =
      this.playerEntity.action === 'hit' ||
      this.playerEntity.action === 'sword/hit';
    const renderAnimation =
      isHitAnimation
        ? playerAnimation
        : (this.playerEntity.throwingAnimation ??
          this.playerEntity.landingAnimation ??
          playerAnimation);
    const animationChanged = renderAnimation !== this.playerRenderAnimation;
    // PhysicsEntity.update() already advances the animation when dead,
    // so only call update() here for living players (avoid double-advance).
    if (
      !this.playerEntity.dead &&
      renderAnimation !== this.playerEntity.throwingAnimation
    ) {
      renderAnimation.update();
    }
    const camera = this.cameras.main;
    const targetX =
      this.playerEntity.pos[0] + 32 - camera.width / 2;
    const targetY =
      this.playerEntity.pos[1] + 18 - camera.height / 2;
    this.scroll[0] += (targetX - this.scroll[0]) / CAMERA_SMOOTHING;
    this.scroll[1] += (targetY - this.scroll[1]) / CAMERA_SMOOTHING;
    // Clamp scroll to ±9 tiles horizontal, 2 tiles up / 2 tiles down from player center
    // (matches game.py lines 223-234)
    const playerCenterX = this.playerEntity.pos[0] + 32;
    const playerCenterY = this.playerEntity.pos[1] + 18;
    const displayWidth = camera.width;
    const displayHeight = camera.height;
    this.scroll[0] = Math.max(
      playerCenterX - CAMERA_BOUNDS_X - displayWidth / 2,
      Math.min(playerCenterX + CAMERA_BOUNDS_X - displayWidth / 2, this.scroll[0])
    );
    this.scroll[1] = Math.max(
      playerCenterY - CAMERA_BOUNDS_Y_UP - displayHeight / 2,
      Math.min(playerCenterY + CAMERA_BOUNDS_Y_DOWN - displayHeight / 2, this.scroll[1])
    );
    const worldTargetX =
      this.playerEntity.pos[0] + 32 - camera.width / 2;
    const worldTargetY =
      this.playerEntity.pos[1] + 18 - camera.height / 2;
    this.worldScroll[0] += (worldTargetX - this.worldScroll[0]) / 20;
    this.worldScroll[1] += (worldTargetY - this.worldScroll[1]) / 20;

    this.playerSprite.setFlipX(
      this.playerEntity.dead
        ? this.playerEntity.deathFlip
        : this.playerEntity.flip
    );
    this.tilemap.updateAnimations(this.tileAnimations);
    // When dead: always sync texture (PhysicsEntity advances the frame, indexChanged is reliable but let's be safe)
    if (this.playerEntity.dead || animationChanged || renderAnimation.indexChanged) {
      this.playerSprite.setTexture(renderAnimation.img());
    }
    this.playerRenderAnimation = renderAnimation;
  }

  private renderInterpolated(alpha: number): void {
    if (!this.playerEntity || !this.playerSprite) {
      return;
    }

    const renderedPlayerX =
      this.previousPlayerPosition[0] +
      (this.playerEntity.pos[0] - this.previousPlayerPosition[0]) *
      alpha;
    const renderedPlayerY =
      this.previousPlayerPosition[1] +
      (this.playerEntity.pos[1] - this.previousPlayerPosition[1]) *
      alpha;
    this.cameras.main.setScroll(
      this.previousScroll[0] +
      (this.scroll[0] - this.previousScroll[0]) * alpha,
      this.previousScroll[1] +
      (this.scroll[1] - this.previousScroll[1]) * alpha
    );
    this.cameras.main.setZoom(this.currentZoom);
    if (this.backgroundImage) {
      this.backgroundImage.setDisplaySize(
        this.scale.width / this.currentZoom,
        this.scale.height / this.currentZoom
      );
    }
    this.renderClouds();
    this.playerSprite.setPosition(renderedPlayerX, renderedPlayerY);

    // Visual state: the dead_hit sprite frames ARE the white art (same as enemies),
    // so just let the animation play — no tint needed.
    // Alive: blink (alpha) during invincibility iframes.
    if (!this.playerEntity.dead && this.playerEntity.invincibleTimer > 0) {
      const shouldBlink = this.playerEntity.invincibleTimer % 8 >= 4;
      this.playerSprite.setAlpha(shouldBlink ? 0.3 : 1);
    } else {
      this.playerSprite.setAlpha(1);
    }
    this.playerSprite.clearTint();

    this.swords?.render(this);
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      if (!enemy) {
        continue;
      }
      const prevPos = this.previousEnemyPositions[i] ?? enemy.pos;
      const interpX = prevPos[0] + (enemy.pos[0] - prevPos[0]) * alpha;
      const interpY = prevPos[1] + (enemy.pos[1] - prevPos[1]) * alpha;
      const offsetX = enemy.pos[0] - interpX;
      const offsetY = enemy.pos[1] - interpY;
      enemy.render(this, [offsetX, offsetY]);
    }
    this.playerEntity.attackHandler.render(this);
    this.particles?.render(this, [
      renderedPlayerX - this.playerEntity.pos[0],
      renderedPlayerY - this.playerEntity.pos[1],
    ]);
    this.sparksGraphics?.clear();
    if (this.sparksGraphics) {
      if (DEBUG_CONFIG.enabled) {
        if (DEBUG_CONFIG.showSwordSpawnRange) {
          // DEBUG: Visual outline of valid sword spawn range around player
          this.sparksGraphics.lineStyle(2, 0x00ff00, 0.85);
          const pX = this.playerEntity.pos[0];
          const pY = this.playerEntity.pos[1];
          const hRangeLeft = 7.5 * 32;
          const hRangeRight = 6.5 * 32;
          const vTop = 2.5 * 32;
          const vBottom = 3.5 * 32;
          const spawnBoxX = pX + 32 - hRangeLeft;
          const spawnBoxY = pY - vTop;
          const spawnBoxW = hRangeLeft + hRangeRight + 32;
          const spawnBoxH = vTop + vBottom + 32;
          this.sparksGraphics.strokeRect(spawnBoxX, spawnBoxY, spawnBoxW, spawnBoxH);
        }

        if (
          DEBUG_CONFIG.showEnemyDetectionRange ||
          DEBUG_CONFIG.showEnemyAttackRange
        ) {
          // DEBUG: Visual outlines for enemy detection range (red) and attack range (rect-in-rect, except pink_star)
          for (const enemy of this.enemies) {
            if (enemy.dead) {
              continue;
            }
            // 1. Detection range in red
            if (DEBUG_CONFIG.showEnemyDetectionRange) {
              const detRect = enemy.getDetectionRect();
              this.sparksGraphics.lineStyle(1.5, 0xff0000, 0.85);
              this.sparksGraphics.strokeRect(
                detRect.x,
                detRect.y,
                detRect.width,
                detRect.height
              );
            }

            // 2. Attack range (except pink_star) - inner rect
            if (DEBUG_CONFIG.showEnemyAttackRange) {
              const atkRect = enemy.getMeleeAttackRangeRect();
              if (atkRect) {
                this.sparksGraphics.lineStyle(2, 0xff3333, 0.95);
                this.sparksGraphics.strokeRect(
                  atkRect.x,
                  atkRect.y,
                  atkRect.width,
                  atkRect.height
                );
              }
            }
          }
        }

        if (DEBUG_CONFIG.showEntityBodyRects) {
          // Player body rect — yellow
          const pRect = this.playerEntity.rect();
          this.sparksGraphics.lineStyle(1.5, 0xffff00, 1);
          this.sparksGraphics.strokeRect(pRect.x, pRect.y, pRect.width, pRect.height);

          // Enemy body rects — cyan (alive), dark grey (dead)
          for (const enemy of this.enemies) {
            const eRect = enemy.rect();
            this.sparksGraphics.lineStyle(1.5, enemy.dead ? 0x444444 : 0x00ffff, 1);
            this.sparksGraphics.strokeRect(eRect.x, eRect.y, eRect.width, eRect.height);
          }
        }

        if (DEBUG_CONFIG.showPlayerAttackRange) {
          // Player melee attack range — orange (only visible during attack)
          const atkRect = this.playerEntity.getAttackRangeRect();
          if (atkRect) {
            this.sparksGraphics.lineStyle(2, 0xff8800, 1);
            this.sparksGraphics.strokeRect(atkRect.x, atkRect.y, atkRect.width, atkRect.height);
          }
        }

        if (DEBUG_CONFIG.showCameraBounds) {
          // Camera scroll clamp boundary — magenta box centered on player pivot
          // Horizontal: ±CAMERA_BOUNDS_X from playerCenterX
          // Vertical: -CAMERA_BOUNDS_Y_UP above / +CAMERA_BOUNDS_Y_DOWN below playerCenterY
          const cbCX = this.playerEntity.pos[0] + 32;
          const cbCY = this.playerEntity.pos[1] + 18;
          const cbX = cbCX - CAMERA_BOUNDS_X;
          const cbY = cbCY - CAMERA_BOUNDS_Y_UP;
          const cbW = CAMERA_BOUNDS_X * 2;
          const cbH = CAMERA_BOUNDS_Y_UP + CAMERA_BOUNDS_Y_DOWN;
          this.sparksGraphics.lineStyle(2, 0xff00ff, 0.9);
          this.sparksGraphics.strokeRect(cbX, cbY, cbW, cbH);
        }
      }

      for (const sparks of this.sparksEffect) {
        sparks.render(this.sparksGraphics);
      }
    }
  }

  private triggerAttackOrPickup() {
    if (!this.playerEntity) {
      return;
    }
    if (!this.playerEntity.swordState && this.swords) {
      this.playerEntity.pickupSword(this.swords.swords);
    } else if (this.playerEntity.swordState) {
      this.playerEntity.attack();
    }
  }

  private getCloudImageSource(key: string): CloudImageSource {
    const source = this.textures.get(key).getSourceImage();
    return { key, width: source.width, height: source.height };
  }

  private renderClouds() {
    this.clouds?.render(
      this,
      [Math.floor(this.worldScroll[0]), Math.floor(this.worldScroll[1])],
      1,
      this.currentZoom
    );
  }

  public zoomIn(): void {
    if (this.targetZoom < 2.0) {
      this.targetZoom = 2.0;
    } else if (this.targetZoom < 3.0) {
      this.targetZoom = 3.0;
    }
  }

  public zoomOut(): void {
    if (this.targetZoom > 2.0) {
      this.targetZoom = 2.0;
    } else if (this.targetZoom > 1.0) {
      this.targetZoom = 1.0;
    }
  }

  public getTargetZoom(): number {
    return this.targetZoom;
  }

  public getCurrentZoom(): number {
    return this.currentZoom;
  }

  public setTargetZoom(zoom: number): void {
    this.targetZoom = zoom;
  }

  public getDisplayWidth(): number {
    return this.displayWidth;
  }

  public getDisplayHeight(): number {
    return this.displayHeight;
  }

  public getZoomLevels(): readonly number[] {
    return ZOOM_LEVELS;
  }
}
