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
  TILE_SIZE,
  WINDOW_HEIGHT,
  WINDOW_WIDTH,
  ZOOM_EASING_SPEED,
  ZOOM_LEVELS,
} from '../../shared/constants';
import {
  ENDING_LEVEL,
  getLevelDefinition,
  getLevelMapCacheKey,
  getNextLevel,
  PLAYABLE_LEVELS,
} from '../../shared/levels';
import { isMapData } from '../../shared/mapData';
import { Player, SHIELD_DURATION_TICKS } from '../entities/Player';
import { CloudImageSource, Clouds } from '../systems/Clouds';
import { Particles } from '../systems/Particles';
import { Swords } from '../systems/Swords';
import { CannonSystem, type CannonDirection } from '../systems/CannonSystem';
import {
  PotionSystem,
  POTION_HORIZONTAL_TILE_RANGE_LEFT,
  POTION_HORIZONTAL_TILE_RANGE_RIGHT,
  POTION_VERTICAL_TILE_RANGE_TOP,
  POTION_VERTICAL_TILE_RANGE_BOTTOM,
  createShieldParticleBurst,
} from '../systems/PotionSystem';
import {
  createHeartSparkParticles,
  getDamageSparkCount,
  Sparks,
} from '../systems/Sparks';
import { Tilemap } from '../systems/Tilemap';
import { Enemy, spawnEntities } from '../systems/Spawner';
import { Animation } from '../utils/Animation';
import { DEBUG_CONFIG } from '../../shared/debug';
import type { EntityRect } from '../../shared/types';
import { SoundSystem } from '../systems/Audio';
import { TouchControls } from '../systems/TouchControls';
import {
  HEALTH_GAIN_PULSE_DURATION_MS,
  HEALTH_GAIN_PULSE_SCALE,
  getHealthSpriteFrame,
  HEALTH_INDICATOR_SIZE_CSS,
  HEALTH_SPRITE_KEY,
} from '../systems/HealthHud';
import {
  getBuffIndicatorOrder,
  type BuffIndicatorId,
} from '../systems/BuffHud';
import {
  FRENZY_HUD_ICON_GAP_CSS,
  FRENZY_HUD_ICON_SIZE_CSS,
  FRENZY_HUD_SPRITE_KEY,
  getFrenzyHudFrame,
  getFrenzyHudTopAlignedCenterY,
} from '../systems/FrenzyHud';
import {
  getShieldHudFrame,
  getShieldHudTopAlignedCenterY,
  isShieldHudVisible,
  SHIELD_HUD_ICON_GAP_CSS,
  SHIELD_HUD_ICON_SIZE_CSS,
  SHIELD_HUD_SPRITE_KEY,
} from '../systems/ShieldHud';
import {
  getShieldActiveFrame,
  getShieldBreakFrame,
  SHIELD_BREAK_DURATION_TICKS,
  SHIELD_EFFECT_DISPLAY_SIZE,
  SHIELD_EFFECT_OFFSET_Y,
  SHIELD_EFFECT_SPRITE_KEY,
} from '../systems/ShieldEffect';
import {
  FRENZY_SWORD_EFFECT_DEACTIVATION_DURATION_TICKS,
  FRENZY_SWORD_EFFECT_FRAME_SIZE,
  FRENZY_SWORD_EFFECT_SPRITE_KEY,
  getFrenzySwordEffectDeactivationFrame,
  getFrenzySwordEffectFrame,
  getFrenzySwordEffectTransform,
} from '../systems/FrenzySwordEffect';
import { FRENZY_DURATION_TICKS } from '../systems/Attack';
import { getTimedEffectWarningAlpha } from '../systems/TimedEffectWarning';
import { shouldShowAttackCooldownIndicator } from '../systems/AttackCooldownHud';
import { IrisTransition, type IrisFocus } from '../systems/IrisTransition';
import {
  getResponsiveSettingsScale,
  SETTINGS_BUTTON_MARGIN_CSS,
} from '../systems/SettingsUI';
import {
  ActionPromptHUD,
  type ActionPromptOptions,
} from '../systems/ActionPromptHUD';

const TILE_ANIMATION_TYPES = [
  'palm_tree/front/left',
  'palm_tree/front/regular',
  'palm_tree/front/right',
  'palm_tree/back/left',
  'palm_tree/back/regular',
  'palm_tree/back/right',
];
type WaterReflectionSize = 'small' | 'medium' | 'big';

const WATER_SURFACE_RATIO = 0.67;
const WATER_REFLECTION_SURFACE_OFFSET = 6;
const WATER_REFLECTION_SIZES: readonly WaterReflectionSize[] = [
  'big',
  'big',
  'big',
];
const WATER_REFLECTION_FRAME_DURATION = TICK_RATE / 10;
const WATER_REFLECTION_SCALE = 3;
const WATER_REFLECTION_MAX_WIDTH_RATIO = 0.4;
const PLAYER_MOVE_SPEED = 2.0;
const PLAYER_HIT_SHAKE_DURATION_MS = 100;
const PLAYER_HIT_SHAKE_INTENSITY = 0.003;
const BUFF_INDICATOR_SHIFT_DURATION_MS = 180;
const ATTACK_COOLDOWN_INDICATOR_SQUARES = 4;
const ATTACK_COOLDOWN_INDICATOR_SIZE = 2;
const ATTACK_COOLDOWN_INDICATOR_GAP = 1;
const ATTACK_COOLDOWN_READY_COLOR = 0xffd700;
const ATTACK_COOLDOWN_INDICATOR_WIDTH =
  ATTACK_COOLDOWN_INDICATOR_SQUARES * ATTACK_COOLDOWN_INDICATOR_SIZE +
  (ATTACK_COOLDOWN_INDICATOR_SQUARES - 1) * ATTACK_COOLDOWN_INDICATOR_GAP;

export class Game extends Phaser.Scene {
  private leftKeys: Phaser.Input.Keyboard.Key[] = [];
  private playerEntity?: Player;
  private playerSprite?: Phaser.GameObjects.Image;
  private playerQuestionMarkSprite?: Phaser.GameObjects.Image;
  private attackCooldownIndicators: Phaser.GameObjects.Rectangle[] = [];
  private attackCooldownIndicatorRechargedSquares: number | undefined;
  private healthIndicator: Phaser.GameObjects.Image | undefined;
  private healthIndicatorRoot: Phaser.GameObjects.Container | undefined;
  private healthIndicatorFrame = -1;
  private healthIndicatorHealth: number | undefined;
  private healthIndicatorPulseTween: Phaser.Tweens.Tween | undefined;
  private frenzyIndicator: Phaser.GameObjects.Image | undefined;
  private frenzyIndicatorFrame = -1;
  private shieldIndicator: Phaser.GameObjects.Image | undefined;
  private shieldIndicatorFrame = -1;
  private buffIndicatorOrder: BuffIndicatorId[] = [];
  private shieldEffectSprite: Phaser.GameObjects.Image | undefined;
  private shieldBreakElapsedTicks = -1;
  private shieldBreakPosition: [number, number] | undefined;
  private frenzySwordEffectSprite: Phaser.GameObjects.Image | undefined;
  private frenzySwordEffectElapsedTicks = -1;
  private frenzySwordEffectFadeElapsedTicks = -1;
  private healthIndicatorZoom = 0;
  private actionPromptHUD?: ActionPromptHUD;
  private rightKeys: Phaser.Input.Keyboard.Key[] = [];
  private jumpKeys: Phaser.Input.Keyboard.Key[] = [];
  private downKeys: Phaser.Input.Keyboard.Key[] = [];
  private kKey: Phaser.Input.Keyboard.Key | undefined;
  private lKey: Phaser.Input.Keyboard.Key | undefined;
  private tilemap?: Tilemap;
  private tileAnimations: Record<string, Animation> = {};
  private cannonSystem?: CannonSystem;
  private particles?: Particles;
  private swords?: Swords;
  private potionSystem?: PotionSystem;
  private enemies: Enemy[] = [];
  private sparksEffect: Sparks[] = [];
  private sparksGraphics?: Phaser.GameObjects.Graphics;
  private pickupHintEnabled = true;
  private tickAccumulator = 0;
  private scroll: [number, number] = [0, 0];
  private previousScroll: [number, number] = [0, 0];
  private previousPlayerPosition: [number, number] = [0, 0];
  private previousEnemyPositions: [number, number][] = [];
  private settingsPaused = false;
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
  private waterSurface?: Phaser.GameObjects.TileSprite;
  private waterReflections: {
    image: Phaser.GameObjects.Image;
    animation: Animation;
    width: number;
    height: number;
  }[] = [];
  private selectedLevelNumber = 1;
  private levelTransitionScheduled = false;
  private levelTransitionTimer: Phaser.Time.TimerEvent | undefined;
  private swordKickQuestionMarkTimer: Phaser.Time.TimerEvent | undefined;
  private deathTransitionScheduled = false;
  private openIrisOnStart = false;
  private irisTransition?: IrisTransition;

  constructor() {
    super('Game');
  }

  private layoutHealthIndicator(
    previousBuffOrder?: readonly BuffIndicatorId[]
  ): void {
    if (!this.healthIndicator || !this.healthIndicatorRoot) {
      return;
    }

    const width = this.scale.width;
    const height = this.scale.height;
    const canvasBounds = this.game.canvas.getBoundingClientRect();
    const canvasWidth = canvasBounds.width > 0 ? canvasBounds.width : width;
    const canvasHeight = canvasBounds.height > 0 ? canvasBounds.height : height;
    const unitScale = Math.min(width / canvasWidth, height / canvasHeight);
    const responsiveScale = getResponsiveSettingsScale(canvasWidth);
    const iconSize = HEALTH_INDICATOR_SIZE_CSS * unitScale * responsiveScale;
    const frenzyIconSize =
      FRENZY_HUD_ICON_SIZE_CSS * unitScale * responsiveScale;
    const frenzyIconGap = FRENZY_HUD_ICON_GAP_CSS * unitScale * responsiveScale;
    const shieldIconSize =
      SHIELD_HUD_ICON_SIZE_CSS * unitScale * responsiveScale;
    const shieldIconGap = SHIELD_HUD_ICON_GAP_CSS * unitScale * responsiveScale;
    const margin =
      SETTINGS_BUTTON_MARGIN_CSS * unitScale * responsiveScale;
    const zoom = this.cameras.main.zoom;

    this.healthIndicatorRoot
      .setPosition(width / 2, height / 2)
      .setScale(1 / zoom);
    this.healthIndicator
      .setPosition(
        -width / 2 + margin + iconSize / 2,
        -height / 2 + margin + iconSize / 2
      )
      .setDisplaySize(iconSize, iconSize);
    let previousIconRight = -width / 2 + margin + iconSize;
    for (const buff of this.buffIndicatorOrder) {
      const indicator =
        buff === 'frenzy' ? this.frenzyIndicator : this.shieldIndicator;
      if (!indicator) {
        continue;
      }

      const buffSize = buff === 'frenzy' ? frenzyIconSize : shieldIconSize;
      const buffGap = buff === 'frenzy' ? frenzyIconGap : shieldIconGap;
      const buffY =
        buff === 'frenzy'
          ? getFrenzyHudTopAlignedCenterY(
              -height / 2 + margin,
              iconSize,
              frenzyIconSize
            )
          : getShieldHudTopAlignedCenterY(
              -height / 2 + margin,
              iconSize,
              shieldIconSize
            );
      const buffX = previousIconRight + buffGap + buffSize / 2;
      const shouldAnimate =
        previousBuffOrder?.includes(buff) === true &&
        indicator.visible &&
        Math.abs(indicator.x - buffX) > 0.5;

      indicator.setDisplaySize(buffSize, buffSize);
      this.tweens.killTweensOf(indicator);
      if (shouldAnimate) {
        this.tweens.add({
          targets: indicator,
          x: buffX,
          y: buffY,
          duration: BUFF_INDICATOR_SHIFT_DURATION_MS,
          ease: 'Sine.Out',
        });
      } else {
        indicator.setPosition(buffX, buffY);
      }
      previousIconRight = buffX + buffSize / 2;
    }
    this.healthIndicatorZoom = zoom;
  }

  private updateBuffIndicatorOrder(
    activeBuffs: readonly BuffIndicatorId[]
  ): void {
    const previousOrder = this.buffIndicatorOrder;
    const nextOrder = getBuffIndicatorOrder(previousOrder, activeBuffs);
    if (
      nextOrder.length === previousOrder.length &&
      nextOrder.every((buff, index) => buff === previousOrder[index])
    ) {
      return;
    }

    this.buffIndicatorOrder = nextOrder;
    this.layoutHealthIndicator(previousOrder);
  }

  private renderShieldEffect(
    renderedPlayerX: number,
    renderedPlayerY: number
  ): void {
    const player = this.playerEntity;
    const sprite = this.shieldEffectSprite;
    if (!player || !sprite) {
      return;
    }

    let frame: number | undefined;
    let position: [number, number] | undefined;
    let alpha = 1;
    if (player.shieldTicksRemaining > 0 && !player.dead) {
      const elapsedTicks = SHIELD_DURATION_TICKS - player.shieldTicksRemaining;
      frame = getShieldActiveFrame(elapsedTicks);
      alpha = getTimedEffectWarningAlpha(
        player.shieldTicksRemaining,
        SHIELD_DURATION_TICKS
      );
      const playerRect = player.rect();
      position = [
        playerRect.x +
          playerRect.width / 2 +
          renderedPlayerX -
          player.pos[0],
        playerRect.y +
          playerRect.height / 2 +
          renderedPlayerY -
          player.pos[1],
      ];
    } else if (
      this.shieldBreakElapsedTicks >= 0 &&
      this.shieldBreakPosition
    ) {
      frame = getShieldBreakFrame(this.shieldBreakElapsedTicks);
      position = this.shieldBreakPosition;
    }

    if (frame === undefined || !position) {
      sprite.setVisible(false);
      return;
    }

    sprite
      .setFrame(frame)
      .setAlpha(alpha)
      .setPosition(position[0], position[1] + SHIELD_EFFECT_OFFSET_Y)
      .setVisible(true);
  }

  private renderFrenzySwordEffect(
    renderedPlayerX: number,
    renderedPlayerY: number
  ): void {
    const player = this.playerEntity;
    const sprite = this.frenzySwordEffectSprite;
    const playerSprite = this.playerSprite;
    if (!player || !sprite || !playerSprite || player.dead || !player.swordState) {
      sprite?.setVisible(false);
      return;
    }

    let frame: number | undefined;
    let alpha = 1;
    if (player.attackHandler.isFrenzyActive) {
      frame = getFrenzySwordEffectFrame(
        this.frenzySwordEffectElapsedTicks >= 0
          ? this.frenzySwordEffectElapsedTicks
          : player.attackHandler.frenzyElapsedTicks
      );
      const frenzyElapsedTicks = player.attackHandler.frenzyElapsedTicks;
      alpha = getTimedEffectWarningAlpha(
        FRENZY_DURATION_TICKS - frenzyElapsedTicks,
        FRENZY_DURATION_TICKS
      );
    } else if (this.frenzySwordEffectFadeElapsedTicks >= 0) {
      frame = getFrenzySwordEffectDeactivationFrame(
        this.frenzySwordEffectFadeElapsedTicks
      );
    }

    if (frame === undefined) {
      sprite.setVisible(false);
      return;
    }

    const transform = getFrenzySwordEffectTransform(
      playerSprite.texture.key,
      player.flip
    );
    if (transform === null) {
      sprite.setVisible(false);
      return;
    }
    if (transform === undefined) {
      throw new Error(
        `Missing Frenzy sword effect pose for "${playerSprite.texture.key}".`
      );
    }

    sprite.setFrame(frame).setAlpha(alpha).setFlipX(player.flip);
    if (transform.cropWidth < FRENZY_SWORD_EFFECT_FRAME_SIZE) {
      sprite.setCrop(
        transform.cropX,
        0,
        transform.cropWidth,
        FRENZY_SWORD_EFFECT_FRAME_SIZE
      );
    } else {
      sprite.setCrop();
    }

    sprite
      .setRotation(transform.rotation)
      .setDisplaySize(transform.displaySize, transform.displaySize)
      .setPosition(
        renderedPlayerX + transform.offsetX,
        renderedPlayerY + transform.offsetY
      )
      .setVisible(true);
  }

  private pulseHealthIndicator(): void {
    const indicator = this.healthIndicator;
    if (!indicator) {
      return;
    }

    this.healthIndicatorPulseTween?.stop();
    this.layoutHealthIndicator();
    const baseScaleX = indicator.scaleX;
    const baseScaleY = indicator.scaleY;
    this.healthIndicatorPulseTween = this.tweens.add({
      targets: indicator,
      scaleX: baseScaleX * HEALTH_GAIN_PULSE_SCALE,
      scaleY: baseScaleY * HEALTH_GAIN_PULSE_SCALE,
      duration: HEALTH_GAIN_PULSE_DURATION_MS,
      ease: 'Back.Out',
      yoyo: true,
      onComplete: () => {
        indicator.setScale(baseScaleX, baseScaleY);
        this.healthIndicatorPulseTween = undefined;
      },
    });
  }

  init(data: unknown): void {
    this.levelTransitionScheduled = false;
    this.levelTransitionTimer?.remove(false);
    this.levelTransitionTimer = undefined;
    this.swordKickQuestionMarkTimer?.remove(false);
    this.swordKickQuestionMarkTimer = undefined;
    this.potionSystem?.destroy();
    this.deathTransitionScheduled = false;
    this.healthIndicatorPulseTween?.stop();
    this.healthIndicatorPulseTween = undefined;
    this.healthIndicator = undefined;
    this.healthIndicatorRoot = undefined;
    this.healthIndicatorFrame = -1;
    this.healthIndicatorHealth = undefined;
    this.frenzyIndicator = undefined;
    this.frenzyIndicatorFrame = -1;
    this.shieldIndicator = undefined;
    this.shieldIndicatorFrame = -1;
    this.buffIndicatorOrder = [];
    this.shieldEffectSprite = undefined;
    this.shieldBreakElapsedTicks = -1;
    this.shieldBreakPosition = undefined;
    this.frenzySwordEffectSprite = undefined;
    this.frenzySwordEffectElapsedTicks = -1;
    this.frenzySwordEffectFadeElapsedTicks = -1;
    this.healthIndicatorZoom = 0;
    this.settingsPaused = false;
    this.tickAccumulator = 0;
    this.openIrisOnStart =
      typeof data === 'object' &&
      data !== null &&
      'openIris' in data &&
      data.openIris === true;
    if (typeof data !== 'object' || data === null || !('levelNumber' in data)) {
      this.selectedLevelNumber = 1;
      return;
    }

    const levelNumber = data.levelNumber;
    if (
      typeof levelNumber !== 'number' ||
      !getLevelDefinition(levelNumber)
    ) {
      throw new Error(
        `The selected level "${String(levelNumber)}" is unavailable.`
      );
    }

    this.selectedLevelNumber = levelNumber;
  }

  preload(): void {
    const level = getLevelDefinition(this.selectedLevelNumber);
    if (!level) {
      throw new Error(`Level ${this.selectedLevelNumber} is not configured.`);
    }

    const cacheKey = getLevelMapCacheKey(level.number);
    if (this.cache.json.exists(cacheKey)) {
      return;
    }

    this.load.setPath('../assets');
    this.load.json(cacheKey, level.mapFile);
  }

  create() {
    this.input.enabled = true;
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
    this.kKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.K
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
    this.createWaterBackground();

    const level = getLevelDefinition(this.selectedLevelNumber);
    if (!level) {
      throw new Error(`Level ${this.selectedLevelNumber} is not configured.`);
    }
    const mapData: unknown = this.cache.json.get(
      getLevelMapCacheKey(this.selectedLevelNumber)
    );
    if (!isMapData(mapData)) {
      throw new Error(
        `The map for level ${this.selectedLevelNumber} at /assets/${level.mapFile} is missing or invalid.`
      );
    }

    this.tilemap = new Tilemap();
    this.tilemap.loadFromData(mapData);
    if (this.selectedLevelNumber === ENDING_LEVEL.number) {
      this.tilemap.autoTile();
    }

    this.tileAnimations = Object.fromEntries(
      TILE_ANIMATION_TYPES.map((type) => [
        type,
        new Animation(
          type,
          4,
          type.startsWith('water_reflect/')
            ? WATER_REFLECTION_FRAME_DURATION
            : 10
        ),
      ])
    );
    this.particles = new Particles();
    this.sparksEffect = [];
    this.swords = new Swords([0, 0], Math.random, this.sparksEffect);
    this.potionSystem = new PotionSystem(Math.random, this.sparksEffect);
    this.playerEntity = new Player([0, 0], this.particles, this.sparksEffect);
    this.playerEntity.swordsSystem = this.swords;
    this.cannonSystem = new CannonSystem(
      this.tilemap,
      (direction) => {
        this.handlePlayerDamage(direction);
      },
      Math.random,
      (impact) => {
        this.sparksEffect.push(
          new Sparks(
            impact,
            false,
            2.94,
            6,
            [255, 226, 145],
            'burst',
            'diamond',
            [2.4, 1.1]
          ),
          new Sparks(
            impact,
            false,
            2.52,
            6,
            [255, 125, 40],
            'burst',
            'diamond',
            [2.2, 0.8]
          ),
          new Sparks(
            impact,
            false,
            2.1,
            6,
            [0, 0, 0],
            'burst',
            'diamond',
            [1.8, 0.7]
          )
        );
      }
    );
    this.touchControls = new TouchControls(this, {
      down: () => this.playerEntity?.dropThroughPlatform(),
      jump: () => this.playerEntity?.jump(),
      attack: () => this.triggerAttackOrPickup(),
      throw: () => this.playerEntity?.throwSword(),
      setActionButtonPressed: (button, pressed) => {
        this.actionPromptHUD?.setTouchButtonPressed(button, pressed);
      },
      setSoundEnabled: (enabled) => this.sound.setMute(!enabled),
      setPickupHintEnabled: (enabled) => {
        this.pickupHintEnabled = enabled;
      },
      setGamePaused: (paused) => {
        this.settingsPaused = paused;
        this.tickAccumulator = 0;
      },
      playUiClick: () => {
        this.sound.play('settings-click', { volume: 0.45 });
      },
      returnToLevelPicker: (focus) => this.returnToLevelPicker(focus),
      levelLabel:
        this.selectedLevelNumber === ENDING_LEVEL.number
          ? 'ALL LEVEL CLEARED!'
          : `LV ${String(this.selectedLevelNumber).padStart(2, '0')}`,
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
    this.shieldEffectSprite = this.add
      .image(
        this.playerEntity.pos[0] + 32,
        this.playerEntity.pos[1] + 18,
        SHIELD_EFFECT_SPRITE_KEY,
        0
      )
      .setOrigin(0.5, 0.5)
      .setDisplaySize(SHIELD_EFFECT_DISPLAY_SIZE, SHIELD_EFFECT_DISPLAY_SIZE)
      .setDepth(RENDER_DEPTH.EFFECTS)
      .setVisible(false);
    this.frenzySwordEffectSprite = this.add
      .image(
        this.playerEntity.pos[0] + 32,
        this.playerEntity.pos[1] + 20,
        FRENZY_SWORD_EFFECT_SPRITE_KEY,
        0
      )
      .setOrigin(0.5, 0.5)
      .setDepth(RENDER_DEPTH.WEAPON_EFFECTS)
      .setVisible(false);
    this.playerQuestionMarkSprite = this.add
      .image(0, 0, 'dialogue/question/0')
      .setOrigin(0, 0)
      .setDepth(RENDER_DEPTH.ENTITIES)
      .setVisible(false);
    this.attackCooldownIndicators = Array.from(
      { length: ATTACK_COOLDOWN_INDICATOR_SQUARES },
      () =>
        this.add
          .rectangle(
            0,
            0,
            ATTACK_COOLDOWN_INDICATOR_SIZE,
            ATTACK_COOLDOWN_INDICATOR_SIZE,
            0x000000
          )
          .setDepth(RENDER_DEPTH.EFFECTS)
          .setVisible(false)
    );
    this.attackCooldownIndicatorRechargedSquares = undefined;
    this.healthIndicator = this.add
      .image(0, 0, HEALTH_SPRITE_KEY, 0)
      .setOrigin(0.5, 0.5);
    this.healthIndicatorRoot = this.add
      .container(0, 0, [this.healthIndicator])
      .setScrollFactor(0)
      .setDepth(RENDER_DEPTH.HUD);
    this.frenzyIndicator = this.add
      .image(0, 0, FRENZY_HUD_SPRITE_KEY, 0)
      .setOrigin(0.5, 0.5)
      .setVisible(false);
    this.shieldIndicator = this.add
      .image(0, 0, SHIELD_HUD_SPRITE_KEY, 0)
      .setOrigin(0.5, 0.5)
      .setVisible(false);
    this.healthIndicatorRoot.add(this.frenzyIndicator);
    this.healthIndicatorRoot.add(this.shieldIndicator);
    this.healthIndicatorFrame = 0;
    this.shieldIndicatorFrame = -1;
    this.layoutHealthIndicator();
    this.scale.on('resize', this.layoutHealthIndicator, this);
    this.events.once('shutdown', () => {
      this.potionSystem?.destroy();
      this.playerEntity?.attackHandler.cancelAttack();
    });
    this.events.once('shutdown', () => this.cannonSystem?.destroy());
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.layoutHealthIndicator, this);
    });
    this.actionPromptHUD = new ActionPromptHUD(this);
    this.actionPromptHUD.setWorldToScreen(({ x, y }) => {
      const currentCamera = this.cameras.main;
      const originX = currentCamera.width * currentCamera.originX;
      const originY = currentCamera.height * currentCamera.originY;
      const screenX =
        currentCamera.x +
        originX +
        (x - currentCamera.scrollX - originX) * currentCamera.zoomX;
      const screenY =
        currentCamera.y +
        originY +
        (y - currentCamera.scrollY - originY) * currentCamera.zoomY;
      return {
        x: screenX,
        y: screenY,
      };
    });
    this.events.once('shutdown', () => this.actionPromptHUD?.destroy());
    this.sparksGraphics = this.add.graphics().setDepth(RENDER_DEPTH.DEBUG);
    this.tilemap.frontRender(
      this,
      [0, 0],
      this.tileAnimations,
      new Set(['cannon'])
    );

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

    this.irisTransition = new IrisTransition(this);
    if (this.openIrisOnStart) {
      this.irisTransition.startOpening(this.getPlayerScreenFocus());
    }
  }

  override update(_time: number, delta: number) {
    this.irisTransition?.update(delta);
    if (this.settingsPaused && !this.irisTransition?.isActive) {
      this.touchControls?.update();
      return;
    }

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

    const frenzyWasActive = this.playerEntity.attackHandler.isFrenzyActive;
    const swordWasHeld = this.playerEntity.swordState;
    if (this.shieldBreakElapsedTicks >= 0) {
      this.shieldBreakElapsedTicks += 1;
      if (this.shieldBreakElapsedTicks >= SHIELD_BREAK_DURATION_TICKS) {
        this.shieldBreakElapsedTicks = -1;
        this.shieldBreakPosition = undefined;
      }
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
    this.potionSystem?.update(
      this.tilemap,
      this.playerEntity.pos,
      this.playerEntity.rect()
    );
    this.potionSystem?.collectHealthPotion(this.playerEntity);
    this.potionSystem?.collectFrenzyPotion(this.playerEntity);
    this.potionSystem?.collectShieldPotion(this.playerEntity);
    const swordHits =
      this.swords?.update(
        this.tilemap,
        [0, 0],
        this.playerEntity.pos,
        this.enemies,
        this.selectedLevelNumber !== ENDING_LEVEL.number,
        () => this.getSwordSpawnObstacleRects()
      ) ?? [];
    for (const enemy of this.enemies) {
      enemy.update(this.tilemap, [0, 0], this.playerEntity);

      // Enemy attack hit resolution against player (only active attacks deal damage, no contact damage)
      if (!enemy.dead) {
        // attackHitDetected: only deal damage once per attack swing/charge
        const attackLanded =
          enemy.attackHitDetected && !enemy.attackHasHitPlayer;
        if (attackLanded) {
          const knockDirection: CannonDirection =
            this.playerEntity.pos[0] < enemy.pos[0] ? -1 : 1;
          if (this.handlePlayerDamage(knockDirection)) {
            enemy.attackHasHitPlayer = true;
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
            enemy.applyKnockback(knockDir);
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
        const cannonHits =
          this.cannonSystem?.damageFromAttack(
            playerAtkRect,
            this.playerEntity.attackHandler.hitEntities,
            this.playerEntity.pos[0]
          ) ?? [];
        for (const { cannon, destroyed } of cannonHits) {
          const impact: [number, number] = [
            cannon.x + cannon.bounds.width / 2,
            cannon.y + cannon.bounds.height / 2,
          ];
          for (let burst = 0; burst < 3; burst += 1) {
            const emitSparks = () => {
              const densityScale = burst === 0 ? 1 : 0.6;
              this.sparksEffect.push(
                new Sparks(
                  impact,
                  false,
                  destroyed ? 4 : 3.2,
                  Math.round((destroyed ? 22 : 16) * densityScale),
                  [255, 246, 210],
                  'burst',
                  'diamond',
                  [3, 1.2]
                ),
                new Sparks(
                  impact,
                  false,
                  destroyed ? 3 : 2.4,
                  Math.round((destroyed ? 16 : 12) * densityScale),
                  [255, 176, 74],
                  'burst',
                  'diamond',
                  [2, 1]
                )
              );
            };
            if (burst === 0) {
              emitSparks();
            } else {
              this.time.delayedCall(burst * 45, emitSparks);
            }
          }
          this.cameras.main.shake(
            destroyed ? 120 : 100,
            destroyed ? 0.005 : 0.0035
          );
        }
      }
    }

    // Thrown sword hit results
    for (const result of swordHits) {
      if (result.type === 'hit') {
        const knockDir = result.enemy.pos[0] >= this.playerEntity.pos[0] ? 1 : -1;
        // Clear attack velocity before applying the hit response.
        if ('clearAttack' in result.enemy) {
          (result.enemy as Enemy).clearAttack();
        }
        if ('applyKnockback' in result.enemy) {
          (result.enemy as Enemy).applyKnockback(knockDir);
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
        if (
          result.enemy.enemyType === 'pink_star' &&
          !this.swordKickQuestionMarkTimer
        ) {
          this.swordKickQuestionMarkTimer = this.time.delayedCall(1000, () => {
            this.swordKickQuestionMarkTimer = undefined;
            this.playerEntity?.showQuestionMarkWhenGrounded();
          });
        }
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
    this.checkForLevelCompletion();

    const controlsEnabled =
      !this.playerEntity.dead && !this.irisTransition?.isActive;
    const movingLeft =
      (controlsEnabled && this.leftKeys.some((key) => key.isDown)) ||
      (controlsEnabled && (this.touchControls?.movement.left ?? false));
    const movingRight =
      (controlsEnabled && this.rightKeys.some((key) => key.isDown)) ||
      (controlsEnabled && (this.touchControls?.movement.right ?? false));
    const horizontalDirection = Number(movingRight) - Number(movingLeft);

    if (!this.playerEntity.throwingAnimation) {
      if (horizontalDirection !== 0) {
        this.playerEntity.runBoost = 1.0;
      } else {
        this.playerEntity.runBoost = 0;
      }
    }
    let jumpPressed = false;
    for (const key of this.jumpKeys) {
      jumpPressed = Phaser.Input.Keyboard.JustDown(key) || jumpPressed;
    }
    if (controlsEnabled && jumpPressed) {
      this.playerEntity.jump();
    }
    let dropThroughPressed = false;
    for (const key of this.downKeys) {
      dropThroughPressed =
        Phaser.Input.Keyboard.JustDown(key) || dropThroughPressed;
    }
    if (controlsEnabled && dropThroughPressed) {
      this.playerEntity.dropThroughPlatform();
    }

    const attackPressed =
      this.lKey !== undefined && Phaser.Input.Keyboard.JustDown(this.lKey);
    if (controlsEnabled && attackPressed) {
      this.triggerAttackOrPickup();
    }

    const throwPressed =
      this.kKey !== undefined && Phaser.Input.Keyboard.JustDown(this.kKey);
    if (controlsEnabled && throwPressed) {
      this.playerEntity.throwSword();
    }

    this.playerEntity.update(this.tilemap, [
      horizontalDirection * PLAYER_MOVE_SPEED,
      0,
    ]);
    this.cannonSystem?.update(this.playerEntity.rect());
    if (
      this.playerEntity.attackHandler.isFrenzyActive &&
      this.playerEntity.swordState &&
      !this.playerEntity.dead
    ) {
      this.frenzySwordEffectFadeElapsedTicks = -1;
      if (!frenzyWasActive || !swordWasHeld) {
        this.frenzySwordEffectElapsedTicks = 0;
      } else if (this.frenzySwordEffectElapsedTicks >= 0) {
        this.frenzySwordEffectElapsedTicks += 1;
      }
    } else if (frenzyWasActive) {
      this.frenzySwordEffectElapsedTicks = -1;
      this.frenzySwordEffectFadeElapsedTicks = 0;
    } else if (this.frenzySwordEffectFadeElapsedTicks >= 0) {
      this.frenzySwordEffectElapsedTicks = -1;
      this.frenzySwordEffectFadeElapsedTicks += 1;
      if (
        this.frenzySwordEffectFadeElapsedTicks >=
        FRENZY_SWORD_EFFECT_DEACTIVATION_DURATION_TICKS
      ) {
        this.frenzySwordEffectFadeElapsedTicks = -1;
      }
    }
    this.checkForDeathTransition();
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
    for (const reflection of this.waterReflections) {
      reflection.animation.update();
      if (reflection.animation.indexChanged) {
        reflection.image.setTexture(reflection.animation.img());
      }
    }
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

    const healthFrame = getHealthSpriteFrame(
      this.playerEntity.health,
      this.playerEntity.maxHealth
    );
    if (healthFrame !== this.healthIndicatorFrame) {
      this.healthIndicator?.setFrame(healthFrame);
      this.healthIndicatorFrame = healthFrame;
    }
    if (
      this.healthIndicatorHealth !== undefined &&
      this.playerEntity.health > this.healthIndicatorHealth
    ) {
      this.pulseHealthIndicator();
    }
    this.healthIndicatorHealth = this.playerEntity.health;
    const attackHandler = this.playerEntity.attackHandler;
    const showFrenzyIndicator =
      attackHandler.isFrenzyActive && !this.playerEntity.dead;
    this.frenzyIndicator?.setVisible(showFrenzyIndicator);
    if (showFrenzyIndicator) {
      const frenzyFrame = getFrenzyHudFrame(
        attackHandler.frenzyProgress,
        attackHandler.frenzyElapsedTicks
      );
      if (frenzyFrame !== this.frenzyIndicatorFrame) {
        this.frenzyIndicator?.setFrame(frenzyFrame);
        this.frenzyIndicatorFrame = frenzyFrame;
      }
    }
    const showShieldIndicator = isShieldHudVisible(
      this.playerEntity.shieldTicksRemaining,
      this.playerEntity.dead
    );
    this.shieldIndicator?.setVisible(showShieldIndicator);
    const activeBuffs: BuffIndicatorId[] = [];
    if (showFrenzyIndicator) {
      activeBuffs.push('frenzy');
    }
    if (showShieldIndicator) {
      activeBuffs.push('shield');
    }
    this.updateBuffIndicatorOrder(activeBuffs);
    if (showShieldIndicator) {
      const shieldElapsedTicks =
        SHIELD_DURATION_TICKS - this.playerEntity.shieldTicksRemaining;
      const shieldFrame = getShieldHudFrame(
        this.playerEntity.shieldTicksRemaining / SHIELD_DURATION_TICKS,
        shieldElapsedTicks
      );
      if (shieldFrame !== this.shieldIndicatorFrame) {
        this.shieldIndicator?.setFrame(shieldFrame);
        this.shieldIndicatorFrame = shieldFrame;
      }
    }

    const renderedPlayerX =
      this.previousPlayerPosition[0] +
      (this.playerEntity.pos[0] - this.previousPlayerPosition[0]) *
      alpha;
    const renderedPlayerY =
      this.previousPlayerPosition[1] +
      (this.playerEntity.pos[1] - this.previousPlayerPosition[1]) *
      alpha;
    // Keep 32px tiles at whole-pixel widths during eased zoom transitions.
    const renderZoom =
      Math.round(this.currentZoom * TILE_SIZE) / TILE_SIZE;
    const interpolatedScrollX =
      this.previousScroll[0] +
      (this.scroll[0] - this.previousScroll[0]) * alpha;
    const interpolatedScrollY =
      this.previousScroll[1] +
      (this.scroll[1] - this.previousScroll[1]) * alpha;
    this.cameras.main.setZoom(renderZoom);
    this.cameras.main.setScroll(
      Math.round(interpolatedScrollX * renderZoom) / renderZoom,
      Math.round(interpolatedScrollY * renderZoom) / renderZoom
    );
    if (this.currentZoom !== this.healthIndicatorZoom) {
      this.layoutHealthIndicator();
    }
    if (this.backgroundImage) {
      this.backgroundImage.setDisplaySize(
        this.scale.width / this.currentZoom,
        this.scale.height / this.currentZoom
      );
    }
    this.renderWaterBackground();
    this.renderClouds();
    this.playerSprite.setPosition(renderedPlayerX, renderedPlayerY);
    this.renderShieldEffect(renderedPlayerX, renderedPlayerY);
    this.renderFrenzySwordEffect(renderedPlayerX, renderedPlayerY);
    const questionAnimation = this.playerEntity.questionMarkAnimation;
    if (questionAnimation && this.playerQuestionMarkSprite) {
      const questionTexture = questionAnimation.img();
      const questionPosition = this.playerEntity.questionMarkPosition([
        renderedPlayerX,
        renderedPlayerY,
      ]);
      if (this.playerQuestionMarkSprite.texture.key !== questionTexture) {
        this.playerQuestionMarkSprite.setTexture(questionTexture);
      }
      this.playerQuestionMarkSprite
        .setPosition(questionPosition[0], questionPosition[1])
        .setVisible(true);
    } else {
      this.playerQuestionMarkSprite?.setVisible(false);
    }
    const showAttackCooldownIndicator = shouldShowAttackCooldownIndicator(
      this.playerEntity.swordState,
      this.playerEntity.dead,
      this.playerEntity.attackHandler.isFrenzyActive
    );
    if (showAttackCooldownIndicator) {
      const isReady = this.playerEntity.attackHandler.isReady;
      const rechargedSquares = isReady
        ? ATTACK_COOLDOWN_INDICATOR_SQUARES
        : Math.min(
            ATTACK_COOLDOWN_INDICATOR_SQUARES - 1,
            Math.floor(
              this.playerEntity.attackHandler.cooldownProgress *
                ATTACK_COOLDOWN_INDICATOR_SQUARES
            )
          );
      if (
        this.attackCooldownIndicatorRechargedSquares !== rechargedSquares
      ) {
        for (let index = 0; index < this.attackCooldownIndicators.length; index += 1) {
          this.attackCooldownIndicators[index]?.setFillStyle(
            isReady
              ? ATTACK_COOLDOWN_READY_COLOR
              : index < rechargedSquares
                ? 0xffffff
                : 0x000000
          );
        }
        this.attackCooldownIndicatorRechargedSquares = rechargedSquares;
      }

      const firstSquareCenterX =
        renderedPlayerX +
        32 -
        ATTACK_COOLDOWN_INDICATOR_WIDTH / 2 +
        ATTACK_COOLDOWN_INDICATOR_SIZE / 2;
      for (let index = 0; index < this.attackCooldownIndicators.length; index += 1) {
        this.attackCooldownIndicators[index]
          ?.setSize(
            ATTACK_COOLDOWN_INDICATOR_SIZE,
            ATTACK_COOLDOWN_INDICATOR_SIZE
          )
          .setPosition(
            firstSquareCenterX +
              index *
                (ATTACK_COOLDOWN_INDICATOR_SIZE +
                  ATTACK_COOLDOWN_INDICATOR_GAP),
            renderedPlayerY - 2
          )
          .setVisible(true);
      }
    } else {
      for (const square of this.attackCooldownIndicators) {
        square.setVisible(false);
      }
      this.attackCooldownIndicatorRechargedSquares = undefined;
    }

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
    this.cannonSystem?.render(this);
    this.potionSystem?.render(this, [0, 0], [
      renderedPlayerX - this.playerEntity.pos[0],
      renderedPlayerY - this.playerEntity.pos[1],
    ]);
    this.updateActionPromptHUD();
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

          const swords = this.swords;
          const tilemap = this.tilemap;
          const blockedSpawnAreas =
            swords && tilemap
              ? swords.getBlockedSpawnAreas(
                  tilemap,
                  this.playerEntity.pos,
                  this.enemies,
                  () => this.getSwordSpawnObstacleRects()
                )
              : [];
          this.sparksGraphics.fillStyle(0xff3355, 0.22);
          this.sparksGraphics.lineStyle(2, 0xff3355, 0.95);
          for (const area of blockedSpawnAreas) {
            this.sparksGraphics.fillRect(
              area.x,
              area.y,
              area.width,
              area.height
            );
            this.sparksGraphics.strokeRect(
              area.x,
              area.y,
              area.width,
              area.height
            );
          }
        }

        if (DEBUG_CONFIG.showPotionSpawnRange) {
          const pX = this.playerEntity.pos[0];
          const pY = this.playerEntity.pos[1];
          const hRangeLeft = POTION_HORIZONTAL_TILE_RANGE_LEFT * 32;
          const hRangeRight = POTION_HORIZONTAL_TILE_RANGE_RIGHT * 32;
          const vTop = POTION_VERTICAL_TILE_RANGE_TOP * 32;
          const vBottom = POTION_VERTICAL_TILE_RANGE_BOTTOM * 32;
          const spawnBoxX = pX + 32 - hRangeLeft;
          const spawnBoxY = pY - vTop;
          const spawnBoxW = hRangeLeft + hRangeRight + 32;
          const spawnBoxH = vTop + vBottom + 32;
          this.sparksGraphics.lineStyle(2, 0x00ffff, 0.85);
          this.sparksGraphics.strokeRect(
            spawnBoxX,
            spawnBoxY,
            spawnBoxW,
            spawnBoxH
          );

          const potionSystem = this.potionSystem;
          const tilemap = this.tilemap;
          const blockedPotionAreas =
            potionSystem && tilemap
              ? potionSystem.getBlockedSpawnAreas(
                  tilemap,
                  this.playerEntity.pos,
                  this.playerEntity.rect()
                )
              : [];
          this.sparksGraphics.fillStyle(0xff3355, 0.22);
          this.sparksGraphics.lineStyle(2, 0xff3355, 0.95);
          for (const area of blockedPotionAreas) {
            this.sparksGraphics.fillRect(
              area.x,
              area.y,
              area.width,
              area.height
            );
            this.sparksGraphics.strokeRect(
              area.x,
              area.y,
              area.width,
              area.height
            );
          }
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

  private getSwordSpawnObstacleRects(): EntityRect[] {
    const cannonSystem = this.cannonSystem;
    if (!cannonSystem) {
      return [];
    }

    return [
      ...cannonSystem.cannons
        .filter((cannon) => !cannon.destroyed)
        .map((cannon) => cannon.bounds),
      ...cannonSystem.cannonWreckParts.map((part) => part.bounds),
    ];
  }

  private triggerAttackOrPickup() {
    const player = this.playerEntity;
    if (!player || player.dead) {
      return;
    }
    if (!player.swordState && this.swords) {
      if (player.pickupSword(this.swords.swords)) {
        if (player.attackHandler.isFrenzyActive) {
          this.frenzySwordEffectElapsedTicks = 0;
          this.frenzySwordEffectFadeElapsedTicks = -1;
        }
        const playerAnimation = player.animation;
        if (!playerAnimation) {
          throw new Error('The player animation is not configured.');
        }

        const isHitAnimation =
          player.action === 'hit' || player.action === 'sword/hit';
        const renderAnimation = isHitAnimation
          ? playerAnimation
          : (player.landingAnimation ?? playerAnimation);
        this.playerSprite?.setTexture(renderAnimation.img());
        this.playerRenderAnimation = renderAnimation;
      }
    } else if (player.swordState) {
      player.attack();
    }
  }

  private checkForLevelCompletion(): void {
    if (
      this.selectedLevelNumber === ENDING_LEVEL.number ||
      this.levelTransitionScheduled ||
      this.deathTransitionScheduled ||
      this.playerEntity?.dead ||
      this.enemies.length === 0 ||
      this.enemies.some((enemy) => !enemy.dead)
    ) {
      return;
    }

    this.levelTransitionScheduled = true;
    const nextLevel = getNextLevel(this.selectedLevelNumber);
    this.levelTransitionTimer = this.time.delayedCall(1000, () => {
      this.levelTransitionTimer = undefined;
      if (this.playerEntity?.dead || this.deathTransitionScheduled) {
        return;
      }

      const transition = this.irisTransition;
      if (!transition) {
        throw new Error('The game iris transition was not initialized.');
      }
      transition.startClosing(this.getPlayerScreenFocus(), () => {
        this.scene.restart({
          levelNumber: nextLevel.number,
          openIris: true,
        });
      });
    });
  }

  private checkForDeathTransition(): void {
    const player = this.playerEntity;
    if (
      this.deathTransitionScheduled ||
      !player?.dead ||
      player.deadHitAnimation ||
      !player.animation?.done ||
      player.dialogueAnimation
    ) {
      return;
    }

    this.levelTransitionTimer?.remove(false);
    this.levelTransitionTimer = undefined;
    const transition = this.irisTransition;
    if (!transition) {
      throw new Error('The game iris transition was not initialized.');
    }
    this.deathTransitionScheduled = transition.startClosing(
      this.getPlayerScreenFocus(),
      () => {
        this.scene.restart({
          levelNumber: this.selectedLevelNumber,
          openIris: true,
        });
      }
    );
  }

  private handlePlayerDamage(knockDirection: CannonDirection): boolean {
    const player = this.playerEntity;
    if (!player?.takeDamage(1)) {
      return false;
    }

    this.cameras.main.shake(
      PLAYER_HIT_SHAKE_DURATION_MS,
      PLAYER_HIT_SHAKE_INTENSITY
    );
    player.applyKnockback(
      knockDirection,
      1.5,
      player.dead ? 2.5 : 0
    );

    if (player.dead) {
      for (const enemy of this.enemies) {
        enemy.cancelAttack();
      }
    }

    if (player.lastHitWasShielded) {
      const playerRect = player.rect();
      const shieldBreakPosition: [number, number] = [
        playerRect.x + playerRect.width / 2,
        playerRect.y + playerRect.height / 2,
      ];
      this.shieldBreakElapsedTicks = 0;
      this.shieldBreakPosition = shieldBreakPosition;
      this.sparksEffect.push(
        ...createShieldParticleBurst(shieldBreakPosition, 'break')
      );
    } else {
      this.sparksEffect.push(
        ...createHeartSparkParticles(
          [player.pos[0] + 22, player.pos[1] + 18],
          player.flip,
          8,
          { direction: 'up', gravity: 0.16 }
        )
      );
    }
    return true;
  }

  private returnToLevelPicker(focus: IrisFocus): void {
    const focusLevel =
      PLAYABLE_LEVELS.find(
        (level) => level.number === this.selectedLevelNumber
      ) ?? PLAYABLE_LEVELS[PLAYABLE_LEVELS.length - 1];
    if (!focusLevel) {
      throw new Error('Cannot return to the level picker without a playable level.');
    }

    const transition = this.irisTransition;
    if (!transition) {
      throw new Error('The game iris transition was not initialized.');
    }
    transition.startClosing(focus, () => {
      this.scene.start('LevelSelectScene', {
        skipEntrance: true,
        openOnLevelNumber: focusLevel.number,
      });
    });
  }

  private getPlayerScreenFocus(): IrisFocus {
    const player = this.playerEntity;
    if (!player) {
      throw new Error('Cannot focus an iris transition without a player.');
    }

    const camera = this.cameras.main;
    const originX = camera.width * camera.originX;
    const originY = camera.height * camera.originY;
    return {
      x:
        camera.x +
        originX +
        (player.pos[0] + 32 - camera.scrollX - originX) * camera.zoomX,
      y:
        camera.y +
        originY +
        (player.pos[1] + 18 - camera.scrollY - originY) * camera.zoomY,
    };
  }

  private updateActionPromptHUD(): void {
    const hud = this.actionPromptHUD;
    const player = this.playerEntity;
    if (!hud) {
      return;
    }

    if (!this.pickupHintEnabled || !player || player.dead) {
      hud.hide();
      return;
    }

    const holdingSword = player.swordState;
    const pickupableSword = holdingSword
      ? undefined
      : player.getPickupableSword(this.swords?.swords ?? []);
    if (!holdingSword && !pickupableSword) {
      hud.hide();
      return;
    }

    const touchControlsEnabled =
      this.touchControls?.areTouchControlsEnabled ?? false;
    const additionalInputs: NonNullable<
      ActionPromptOptions['additionalInputs']
    > = [];
    const additionalRows: NonNullable<
      ActionPromptOptions['additionalRows']
    > = [];
    const keyLabel = touchControlsEnabled ? 'A' : 'L';
    const actionText = holdingSword ? 'ATTACK' : 'PICKUP';
    if (touchControlsEnabled) {
      if (holdingSword) {
        additionalRows.push({
          actionText: 'THROW',
          inputs: [{ inputType: 'key', keyLabel: 'B' }],
        });
      }
    } else {
      additionalInputs.push(
        { inputType: 'mouse', mouseButton: 'left' }
      );
      if (holdingSword) {
        additionalRows.push({
          actionText: 'THROW',
          inputs: [
            { inputType: 'key', keyLabel: 'K', keyCode: 'KeyK' },
            { inputType: 'mouse', mouseButton: 'right' },
          ],
        });
      }
    }

    hud.show({
      inputType: 'key',
      keyLabel,
      ...(!touchControlsEnabled ? { keyCode: 'KeyL' } : {}),
      actionText,
      additionalInputs,
      additionalRows,
    });
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
      this.cameras.main.zoom
    );
  }

  private createWaterBackground(): void {
    this.waterSurface = this.add
      .tileSprite(0, 0, 1, 1, 'background/water')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(RENDER_DEPTH.WATER);

    this.waterReflections = WATER_REFLECTION_SIZES.map((size, index) => {
      const animation = new Animation(
        `water_reflect/${size}`,
        4,
        WATER_REFLECTION_FRAME_DURATION
      );
      animation.frame =
        (index % animation.frameCount) * animation.imgDur;
      const source = this.textures.get(animation.img()).getSourceImage();
      const image = this.add
        .image(0, 0, animation.img())
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(RENDER_DEPTH.WATER_REFLECTIONS);

      return {
        image,
        animation,
        width: source.width,
        height: source.height,
      };
    });

    this.renderWaterBackground();
  }

  private renderWaterBackground(): void {
    const waterSurface = this.waterSurface;
    if (!waterSurface) {
      return;
    }

    const { width, height } = this.scale;
    const zoom = this.cameras.main.zoom;
    const centerX = width / 2;
    const centerY = height / 2;
    const surfaceY = height * WATER_SURFACE_RATIO;
    const sceneX = (screenX: number) =>
      centerX + (screenX - centerX) / zoom;
    const sceneY = (screenY: number) =>
      centerY + (screenY - centerY) / zoom;
    const reflectionWidths = this.waterReflections.map((reflection) =>
      Math.min(
        reflection.width * WATER_REFLECTION_SCALE,
        width * WATER_REFLECTION_MAX_WIDTH_RATIO
      )
    );
    waterSurface
      .setPosition(sceneX(0), sceneY(surfaceY))
      .setDisplaySize(width / zoom, (height - surfaceY) / zoom)
      .setTileScale(1 / zoom);

    this.waterReflections.forEach((reflection, index) => {
      const reflectionWidth = reflectionWidths[index];
      if (reflectionWidth === undefined) {
        throw new Error('Unable to calculate a water reflection width.');
      }
      const reflectionScale = reflectionWidth / reflection.width;
      const reflectionCenterX =
        (width * index) / (this.waterReflections.length - 1);
      reflection.image
        .setPosition(
          sceneX(reflectionCenterX - reflectionWidth / 2),
          sceneY(surfaceY + WATER_REFLECTION_SURFACE_OFFSET)
        )
        .setDisplaySize(
          reflectionWidth / zoom,
          (reflection.height * reflectionScale) / zoom
        );
    });
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
