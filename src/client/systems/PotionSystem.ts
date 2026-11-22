import { PhysicsEntity } from '../entities/PhysicsEntity.ts';
import type { EntityPosition, EntityRect, EntitySize } from '../../shared/types.ts';
import { RENDER_DEPTH } from '../../shared/constants.ts';
import type { Tilemap } from './Tilemap.ts';
import { Animation } from '../utils/Animation.ts';
import { Sparks } from './Sparks.ts';

export const HEALTH_POTION_SPAWN_CHANCE = 0.001;
export const HEALTH_POTION_HORIZONTAL_TILE_RANGE_LEFT = 3;
export const HEALTH_POTION_HORIZONTAL_TILE_RANGE_RIGHT = 2;
export const HEALTH_POTION_VERTICAL_TILE_RANGE_TOP = 2.5;
export const HEALTH_POTION_VERTICAL_TILE_RANGE_BOTTOM = 3.5;
export const HEALTH_POTION_HEAL_AMOUNT = 1;
export const HEALTH_POTION_LIFETIME_TICKS = 2400;
export const HEALTH_POTION_BLINK_START_TICKS = 2100;
export const HEALTH_POTION_FAST_BLINK_START_TICKS =
  HEALTH_POTION_LIFETIME_TICKS - 120;

export const createFrenzyPotionIdleAnimation = (): Animation =>
  new Animation('potion/frenzy/idle', 7, 8);

export interface PotionRenderImage {
  setOrigin(x: number, y: number): void;
  setPosition(x: number, y: number): void;
  setTexture(texture: string): void;
  setVisible?(visible: boolean): void;
  setAlpha?(alpha: number): void;
  setDepth?(depth: number): void;
  destroy(): void;
}

export interface PotionRenderScene {
  add: {
    image(x: number, y: number, texture: string): PotionRenderImage;
  };
}

export interface PotionPlayerTarget {
  pos: EntityPosition;
  health: number;
  maxHealth: number;
  rect(): EntityRect;
  playSfx?: ((name: string) => void) | undefined;
}

export class HealthPotionEffect {
  timer = 0;
  private image: PotionRenderImage | null = null;
  private imageTexture: string | null = null;
  private readonly player: Pick<PotionPlayerTarget, 'rect'>;

  constructor(player: Pick<PotionPlayerTarget, 'rect'>) {
    this.player = player;
  }

  update(): boolean {
    this.timer += 1;
    return this.timer >= 24;
  }

  render(
    scene: PotionRenderScene,
    offset: readonly [number, number] = [0, 0],
    playerInterpolationOffset: readonly [number, number] = [0, 0]
  ) {
    const frame = Math.min(3, Math.floor(this.timer / 6));
    const texture = `potion/health-effect/${frame}`;
    const playerRect = this.player.rect();
    const renderX =
      playerRect.x +
      playerRect.width / 2 -
      offset[0] +
      playerInterpolationOffset[0];
    const renderY =
      playerRect.y +
      playerRect.height / 2 -
      offset[1] +
      playerInterpolationOffset[1];
    if (!this.image) {
      this.image = scene.add.image(renderX, renderY, texture);
      this.image.setOrigin(0.5, 0.5);
      this.image.setDepth?.(RENDER_DEPTH.EFFECTS);
      this.imageTexture = texture;
    } else {
      if (this.imageTexture !== texture) {
        this.image.setTexture(texture);
        this.imageTexture = texture;
      }
      this.image.setPosition(renderX, renderY);
      this.image.setDepth?.(RENDER_DEPTH.EFFECTS);
    }
  }

  destroy() {
    this.image?.destroy();
    this.image = null;
    this.imageTexture = null;
  }
}

export class HealthPotion extends PhysicsEntity {
  timer = 0;
  landed = false;
  private image: PotionRenderImage | null = null;
  private imageTexture: string | null = null;

  constructor(
    pos: EntityPosition,
    size: EntitySize = [12, 14],
    animations?: Readonly<Record<string, Animation>>
  ) {
    super(
      'potion',
      pos,
      size,
      animations ?? {
        'potion/idle': new Animation('potion/health/idle', 7, 8),
      }
    );
    this.landed = true;
    this.velocity[1] = 0;
  }

  override update(_tilemap: Pick<Tilemap, 'physicalRectsAround' | 'platformsAround'>) {
    this.animation?.update();
    this.timer += 1;
  }

  get isExpired(): boolean {
    return this.timer >= HEALTH_POTION_LIFETIME_TICKS;
  }

  isBlinking(): boolean {
    if (this.timer < HEALTH_POTION_BLINK_START_TICKS) {
      return false;
    }
    const blinkRate =
      this.timer >= HEALTH_POTION_FAST_BLINK_START_TICKS ? 7 : 12;
    return Math.floor(this.timer / blinkRate) % 2 === 0;
  }

  get isBlinkHidden(): boolean {
    return this.isBlinking();
  }

  render(scene: PotionRenderScene, offset: readonly [number, number] = [0, 0]) {
    if (this.isBlinking()) {
      this.image?.setVisible?.(false);
      return;
    }
    const texture = this.animation?.img() ?? 'potion/health/idle/0';
    const renderX = this.pos[0] - offset[0] + 8;
    const bobY = Math.floor(Math.sin(this.timer * 0.12) * 2);
    const renderY = this.pos[1] - offset[1] + 8 + bobY;
    if (!this.image) {
      this.image = scene.add.image(renderX, renderY, texture);
      this.image.setOrigin(0.5, 0.5);
      this.image.setDepth?.(RENDER_DEPTH.ENTITIES);
      this.image.setVisible?.(true);
      this.imageTexture = texture;
    } else {
      if (this.imageTexture !== texture) {
        this.image.setTexture(texture);
        this.imageTexture = texture;
      }
      this.image.setPosition(renderX, renderY);
      this.image.setDepth?.(RENDER_DEPTH.ENTITIES);
      this.image.setVisible?.(true);
    }
  }

  destroy() {
    this.image?.destroy();
    this.image = null;
  }
}

export class PotionSystem {
  healthPotions: HealthPotion[] = [];
  healthPotionEffects: HealthPotionEffect[] = [];
  private validSpawnPos: readonly (readonly [number, number])[] | null = null;
  private readonly random: () => number;
  private readonly sparksEffect: Sparks[] | undefined;

  constructor(
    random: () => number = Math.random,
    sparksEffect?: Sparks[]
  ) {
    this.random = random;
    this.sparksEffect = sparksEffect;
  }

  getValidSpawnPositions(
    tilemap: Tilemap
  ): readonly (readonly [number, number])[] {
    if (this.validSpawnPos === null) {
      const surfaceVariants = [0, 1, 2, 9, 10, 11, 12, 13].map(
        (variant) => ['grass', variant] as const
      );
      this.validSpawnPos = tilemap
        .extract(surfaceVariants, true)
        .map((tile) => [
          tile.loc[0] * tilemap.tileSize,
          tile.loc[1] * tilemap.tileSize,
        ]);
    }
    return this.validSpawnPos;
  }

  spawnHealthPotion(
    tilemap: Tilemap,
    playerPos?: readonly [number, number]
  ): HealthPotion | null {
    if (
      this.healthPotions.length > 0 ||
      this.random() >= HEALTH_POTION_SPAWN_CHANCE
    ) {
      return null;
    }

    let availablePositions = this.getValidSpawnPositions(tilemap);
    if (availablePositions.length === 0) {
      return null;
    }

    if (playerPos) {
      const playerX = playerPos[0];
      const playerY = playerPos[1];
      const tileSize = tilemap.tileSize;
      const horizontalRangeLeft =
        HEALTH_POTION_HORIZONTAL_TILE_RANGE_LEFT * tileSize;
      const horizontalRangeRight =
        HEALTH_POTION_HORIZONTAL_TILE_RANGE_RIGHT * tileSize;
      const verticalRangeTop =
        HEALTH_POTION_VERTICAL_TILE_RANGE_TOP * tileSize;
      const verticalRangeBottom =
        HEALTH_POTION_VERTICAL_TILE_RANGE_BOTTOM * tileSize;
      availablePositions = availablePositions.filter((pos) => {
        const horizontalDistance = pos[0] - (playerX + 32);
        const verticalDistance = pos[1] - playerY;
        return (
          horizontalDistance >= -horizontalRangeLeft &&
          horizontalDistance <= horizontalRangeRight &&
          verticalDistance >= -verticalRangeTop &&
          verticalDistance <= verticalRangeBottom
        );
      });
    }

    if (availablePositions.length === 0) {
      return null;
    }

    const selectedIndex = Math.floor(this.random() * availablePositions.length);
    const selected = availablePositions[selectedIndex];
    if (!selected) {
      return null;
    }

    const potion = new HealthPotion([
      selected[0] + tilemap.tileSize * 0.5 - 8,
      selected[1] - 21,
    ]);
    this.healthPotions.push(potion);
    const center: [number, number] = [
      potion.pos[0] + 6,
      potion.pos[1] + 7,
    ];
    this.sparksEffect?.push(
      new Sparks(
        center,
        false,
        2.8,
        22,
        [255, 210, 215],
        'burst',
        'diamond',
        [3, 3],
        this.random
      )
    );
    this.sparksEffect?.push(
      new Sparks(
        center,
        false,
        1.8,
        13,
        [255, 255, 255],
        'burst',
        'diamond',
        [2, 2],
        this.random
      )
    );
    return potion;
  }

  update(
    tilemap: Tilemap,
    playerPos?: readonly [number, number]
  ): void {
    this.spawnHealthPotion(tilemap, playerPos);
    this.healthPotions = this.healthPotions.filter((potion) => {
      if (potion.isExpired) {
        potion.destroy();
        return false;
      }
      return true;
    });
    for (const potion of this.healthPotions) {
      potion.update(tilemap);
    }
    this.healthPotionEffects = this.healthPotionEffects.filter((effect) => {
      if (effect.update()) {
        effect.destroy();
        return false;
      }
      return true;
    });
  }

  collectHealthPotion(player: PotionPlayerTarget): boolean {
    if (player.health >= player.maxHealth) {
      return false;
    }

    const playerRect = player.rect();
    for (
      let index = this.healthPotions.length - 1;
      index >= 0;
      index -= 1
    ) {
      const potion = this.healthPotions[index];
      if (!potion) {
        continue;
      }
      const potionRect = potion.rect();
      const overlaps =
        playerRect.x < potionRect.x + potionRect.width &&
        playerRect.x + playerRect.width > potionRect.x &&
        playerRect.y < potionRect.y + potionRect.height &&
        playerRect.y + playerRect.height > potionRect.y;
      if (overlaps) {
        player.health = Math.min(
          player.maxHealth,
          player.health + HEALTH_POTION_HEAL_AMOUNT
        );
        this.healthPotionEffects.push(new HealthPotionEffect(player));
        player.playSfx?.('player/pickup_health_potion');
        potion.destroy();
        this.healthPotions.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  render(
    scene: PotionRenderScene,
    offset: readonly [number, number] = [0, 0],
    playerInterpolationOffset: readonly [number, number] = [0, 0]
  ) {
    for (const potion of this.healthPotions) {
      potion.render(scene, offset);
    }
    for (const effect of this.healthPotionEffects) {
      effect.render(scene, offset, playerInterpolationOffset);
    }
  }

  destroy() {
    for (const potion of this.healthPotions) {
      potion.destroy();
    }
    this.healthPotions = [];
    for (const effect of this.healthPotionEffects) {
      effect.destroy();
    }
    this.healthPotionEffects = [];
  }
}
