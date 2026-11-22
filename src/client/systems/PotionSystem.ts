import { PhysicsEntity } from '../entities/PhysicsEntity.ts';
import type { EntityPosition, EntityRect, EntitySize } from '../../shared/types.ts';
import { RENDER_DEPTH, TICK_RATE } from '../../shared/constants.ts';
import { DEBUG_CONFIG } from '../../shared/debug.ts';
import type { Tilemap } from './Tilemap.ts';
import { Animation } from '../utils/Animation.ts';
import { Sparks } from './Sparks.ts';

export const HEALTH_POTION_SPAWN_CHANCE = 0.001;
export const FRENZY_POTION_SPAWN_CHANCE = 0.0025;
export const SHIELD_POTION_SPAWN_CHANCE = 0.001;
export const SHIELD_PARTICLE_COLORS = {
  lightGreen: [213, 255, 213],
  white: [255, 255, 255],
} as const;
export const DEBUG_POTION_SPAWN_CHANCE = 0.5;
export const POTION_HORIZONTAL_TILE_RANGE_LEFT = 3;
export const POTION_HORIZONTAL_TILE_RANGE_RIGHT = 2;
export const POTION_VERTICAL_TILE_RANGE_TOP = 2.5;
export const POTION_VERTICAL_TILE_RANGE_BOTTOM = 3.5;
export const HEALTH_POTION_HEAL_AMOUNT = 1;
const DEFAULT_POTION_LIFETIME_TICKS = 40 * TICK_RATE;
export const HEALTH_POTION_LIFETIME_TICKS = 40 * TICK_RATE;
export const FRENZY_POTION_LIFETIME_TICKS = 20 * TICK_RATE;
export const SHIELD_POTION_LIFETIME_TICKS = 30 * TICK_RATE;
export const POTION_BLINK_LEAD_TICKS = 300;
export const POTION_FAST_BLINK_LEAD_TICKS = 120;

export const createFrenzyPotionIdleAnimation = (): Animation =>
  new Animation('potion/frenzy/idle', 7, 8);

export const createShieldPotionIdleAnimation = (): Animation =>
  new Animation('potion/shield/idle', 7, 8);

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

export type PotionPlayerTarget = {
  rect(): EntityRect;
  playSfx?: ((name: string) => void) | undefined;
};

export type HealthPotionPlayerTarget = PotionPlayerTarget & {
  health: number;
  maxHealth: number;
};

export type FrenzyPotionPlayerTarget = PotionPlayerTarget & {
  activateFrenzy(): void;
};

export type ShieldPotionPlayerTarget = PotionPlayerTarget & {
  activateShield(): void;
};

class PotionPickupEffect {
  timer = 0;
  private image: PotionRenderImage | null = null;
  private imageTexture: string | null = null;
  private readonly player: Pick<PotionPlayerTarget, 'rect'>;
  private readonly texturePrefix: string;

  constructor(
    player: Pick<PotionPlayerTarget, 'rect'>,
    texturePrefix: string
  ) {
    this.player = player;
    this.texturePrefix = texturePrefix;
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
    const texture = `${this.texturePrefix}/${frame}`;
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

export class HealthPotionEffect extends PotionPickupEffect {
  constructor(player: Pick<PotionPlayerTarget, 'rect'>) {
    super(player, 'potion/health-effect');
  }
}

export class FrenzyPotionEffect extends PotionPickupEffect {
  constructor(player: Pick<PotionPlayerTarget, 'rect'>) {
    super(player, 'potion/frenzy-effect');
  }
}

export class PotionEntity extends PhysicsEntity {
  timer = 0;
  landed = false;
  readonly lifetimeTicks: number;
  readonly blinkStartTicks: number;
  readonly fastBlinkStartTicks: number;
  private image: PotionRenderImage | null = null;
  private imageTexture: string | null = null;

  constructor(
    pos: EntityPosition,
    size: EntitySize,
    animations: Readonly<Record<string, Animation>>,
    lifetimeTicks = DEFAULT_POTION_LIFETIME_TICKS
  ) {
    super('potion', pos, size, animations);
    this.lifetimeTicks = lifetimeTicks;
    this.blinkStartTicks = Math.max(
      0,
      lifetimeTicks - POTION_BLINK_LEAD_TICKS
    );
    this.fastBlinkStartTicks = Math.max(
      0,
      lifetimeTicks - POTION_FAST_BLINK_LEAD_TICKS
    );
    this.landed = true;
    this.velocity[1] = 0;
  }

  override update(_tilemap: Pick<Tilemap, 'physicalRectsAround' | 'platformsAround'>) {
    this.animation?.update();
    this.timer += 1;
  }

  get isExpired(): boolean {
    return this.timer >= this.lifetimeTicks;
  }

  isBlinking(): boolean {
    if (this.timer < this.blinkStartTicks) {
      return false;
    }
    const blinkRate =
      this.timer >= this.fastBlinkStartTicks ? 7 : 12;
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

export class HealthPotion extends PotionEntity {
  constructor(
    pos: EntityPosition,
    size: EntitySize = [12, 14],
    animations: Readonly<Record<string, Animation>> = {
      'potion/idle': new Animation('potion/health/idle', 7, 8),
    },
    lifetimeTicks = HEALTH_POTION_LIFETIME_TICKS
  ) {
    super(pos, size, animations, lifetimeTicks);
  }
}

export class FrenzyPotion extends PotionEntity {
  constructor(
    pos: EntityPosition,
    size: EntitySize = [12, 14],
    animations: Readonly<Record<string, Animation>> = {
      'potion/idle': createFrenzyPotionIdleAnimation(),
    },
    lifetimeTicks = FRENZY_POTION_LIFETIME_TICKS
  ) {
    super(pos, size, animations, lifetimeTicks);
  }
}

export class ShieldPotion extends PotionEntity {
  constructor(
    pos: EntityPosition,
    size: EntitySize = [12, 14],
    animations: Readonly<Record<string, Animation>> = {
      'potion/idle': createShieldPotionIdleAnimation(),
    },
    lifetimeTicks = SHIELD_POTION_LIFETIME_TICKS
  ) {
    super(pos, size, animations, lifetimeTicks);
  }
}

export class PotionSystem {
  healthPotions: HealthPotion[] = [];
  frenzyPotions: FrenzyPotion[] = [];
  shieldPotions: ShieldPotion[] = [];
  healthPotionEffects: HealthPotionEffect[] = [];
  frenzyPotionEffects: FrenzyPotionEffect[] = [];
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

  private getSpawnPosition(
    tilemap: Tilemap,
    playerPos?: readonly [number, number]
  ): readonly [number, number] | null {
    let availablePositions = this.getValidSpawnPositions(tilemap);
    if (availablePositions.length === 0) {
      return null;
    }

    if (playerPos) {
      const playerX = playerPos[0];
      const playerY = playerPos[1];
      const tileSize = tilemap.tileSize;
      const horizontalRangeLeft =
        POTION_HORIZONTAL_TILE_RANGE_LEFT * tileSize;
      const horizontalRangeRight =
        POTION_HORIZONTAL_TILE_RANGE_RIGHT * tileSize;
      const verticalRangeTop =
        POTION_VERTICAL_TILE_RANGE_TOP * tileSize;
      const verticalRangeBottom =
        POTION_VERTICAL_TILE_RANGE_BOTTOM * tileSize;
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

    const existingPotions: PotionEntity[] = [
      ...this.healthPotions,
      ...this.frenzyPotions,
      ...this.shieldPotions,
    ];
    availablePositions = availablePositions.filter(
      (pos) =>
        !existingPotions.some(
          (potion) =>
            potion.pos[0] + 8 === pos[0] + tilemap.tileSize * 0.5 &&
            potion.pos[1] === pos[1] - 21
        )
    );
    if (availablePositions.length === 0) {
      return null;
    }

    const selectedIndex = Math.floor(this.random() * availablePositions.length);
    return availablePositions[selectedIndex] ?? null;
  }

  private getSpawnChance(chance: number): number {
    return DEBUG_CONFIG.enabled && DEBUG_CONFIG.boostPotionSpawnRates
      ? DEBUG_POTION_SPAWN_CHANCE
      : chance;
  }

  private addSpawnSparks(
    potion: PotionEntity,
    primaryColor: readonly [number, number, number],
    secondaryColor: readonly [number, number, number]
  ): void {
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
        primaryColor,
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
        secondaryColor,
        'burst',
        'diamond',
        [2, 2],
        this.random
      )
    );
  }

  private spawnPotion<T extends PotionEntity>(
    potions: T[],
    tilemap: Tilemap,
    playerPos: readonly [number, number] | undefined,
    spawnChance: number,
    primaryColor: readonly [number, number, number],
    secondaryColor: readonly [number, number, number],
    createPotion: (position: EntityPosition) => T
  ): T | null {
    if (
      potions.length > 0 ||
      this.random() >= this.getSpawnChance(spawnChance)
    ) {
      return null;
    }

    const selected = this.getSpawnPosition(tilemap, playerPos);
    if (!selected) {
      return null;
    }

    const potion = createPotion([
      selected[0] + tilemap.tileSize * 0.5 - 8,
      selected[1] - 21,
    ]);
    potions.push(potion);
    this.addSpawnSparks(potion, primaryColor, secondaryColor);
    return potion;
  }

  spawnHealthPotion(
    tilemap: Tilemap,
    playerPos?: readonly [number, number]
  ): HealthPotion | null {
    return this.spawnPotion(
      this.healthPotions,
      tilemap,
      playerPos,
      HEALTH_POTION_SPAWN_CHANCE,
      [255, 210, 215],
      [255, 255, 255],
      (position) => new HealthPotion(position)
    );
  }

  spawnFrenzyPotion(
    tilemap: Tilemap,
    playerPos?: readonly [number, number]
  ): FrenzyPotion | null {
    return this.spawnPotion(
      this.frenzyPotions,
      tilemap,
      playerPos,
      FRENZY_POTION_SPAWN_CHANCE,
      [195, 233, 255],
      [255, 255, 255],
      (position) => new FrenzyPotion(position)
    );
  }

  spawnShieldPotion(
    tilemap: Tilemap,
    playerPos?: readonly [number, number]
  ): ShieldPotion | null {
    return this.spawnPotion(
      this.shieldPotions,
      tilemap,
      playerPos,
      SHIELD_POTION_SPAWN_CHANCE,
      SHIELD_PARTICLE_COLORS.lightGreen,
      SHIELD_PARTICLE_COLORS.white,
      (position) => new ShieldPotion(position)
    );
  }

  private updatePotions<T extends PotionEntity>(
    potions: T[],
    tilemap: Tilemap
  ): T[] {
    const activePotions = potions.filter((potion) => {
      if (potion.isExpired) {
        potion.destroy();
        return false;
      }
      return true;
    });
    for (const potion of activePotions) {
      potion.update(tilemap);
    }
    return activePotions;
  }

  private updateEffects<T extends PotionPickupEffect>(
    effects: T[]
  ): T[] {
    return effects.filter((effect) => {
      if (effect.update()) {
        effect.destroy();
        return false;
      }
      return true;
    });
  }

  update(
    tilemap: Tilemap,
    playerPos?: readonly [number, number]
  ): void {
    this.spawnHealthPotion(tilemap, playerPos);
    this.spawnFrenzyPotion(tilemap, playerPos);
    this.spawnShieldPotion(tilemap, playerPos);
    this.healthPotions = this.updatePotions(this.healthPotions, tilemap);
    this.frenzyPotions = this.updatePotions(this.frenzyPotions, tilemap);
    this.shieldPotions = this.updatePotions(this.shieldPotions, tilemap);
    this.healthPotionEffects = this.updateEffects(this.healthPotionEffects);
    this.frenzyPotionEffects = this.updateEffects(this.frenzyPotionEffects);
  }

  private getOverlappingPotionIndex(
    potions: readonly PotionEntity[],
    playerRect: EntityRect
  ): number {
    for (let index = potions.length - 1; index >= 0; index -= 1) {
      const potion = potions[index];
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
        return index;
      }
    }
    return -1;
  }

  private collectPotion<T extends PotionEntity>(
    potions: T[],
    player: PotionPlayerTarget,
    onCollect: () => void
  ): boolean {
    const index = this.getOverlappingPotionIndex(potions, player.rect());
    const potion = potions[index];
    if (index < 0 || !potion) {
      return false;
    }

    onCollect();
    potion.destroy();
    potions.splice(index, 1);
    return true;
  }

  collectHealthPotion(player: HealthPotionPlayerTarget): boolean {
    if (player.health >= player.maxHealth) {
      return false;
    }

    return this.collectPotion(this.healthPotions, player, () => {
      player.health = Math.min(
        player.maxHealth,
        player.health + HEALTH_POTION_HEAL_AMOUNT
      );
      this.healthPotionEffects.push(new HealthPotionEffect(player));
      player.playSfx?.('player/pickup_health_potion');
    });
  }

  collectFrenzyPotion(player: FrenzyPotionPlayerTarget): boolean {
    return this.collectPotion(this.frenzyPotions, player, () => {
      player.activateFrenzy();
      this.frenzyPotionEffects.push(new FrenzyPotionEffect(player));
      player.playSfx?.('player/pickup_health_potion');
    });
  }

  collectShieldPotion(player: ShieldPotionPlayerTarget): boolean {
    return this.collectPotion(this.shieldPotions, player, () => {
      player.activateShield();
      const playerRect = player.rect();
      const center: [number, number] = [
        playerRect.x + playerRect.width / 2,
        playerRect.y + playerRect.height / 2,
      ];
      this.sparksEffect?.push(
        new Sparks(
          center,
          false,
          2.8,
          32,
          SHIELD_PARTICLE_COLORS.lightGreen,
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
          1.2,
          8,
          SHIELD_PARTICLE_COLORS.white,
          'burst',
          'diamond',
          [1.5, 1.5],
          this.random
        )
      );
      player.playSfx?.('player/pickup_health_potion');
    });
  }

  private renderPotions<T extends PotionEntity>(
    potions: readonly T[],
    scene: PotionRenderScene,
    offset: readonly [number, number]
  ): void {
    for (const potion of potions) {
      potion.render(scene, offset);
    }
  }

  private renderEffects<T extends PotionPickupEffect>(
    effects: readonly T[],
    scene: PotionRenderScene,
    offset: readonly [number, number],
    playerInterpolationOffset: readonly [number, number]
  ): void {
    for (const effect of effects) {
      effect.render(scene, offset, playerInterpolationOffset);
    }
  }

  render(
    scene: PotionRenderScene,
    offset: readonly [number, number] = [0, 0],
    playerInterpolationOffset: readonly [number, number] = [0, 0]
  ) {
    this.renderPotions(this.healthPotions, scene, offset);
    this.renderPotions(this.frenzyPotions, scene, offset);
    this.renderPotions(this.shieldPotions, scene, offset);
    this.renderEffects(
      this.healthPotionEffects,
      scene,
      offset,
      playerInterpolationOffset
    );
    this.renderEffects(
      this.frenzyPotionEffects,
      scene,
      offset,
      playerInterpolationOffset
    );
  }

  private destroyAll(items: readonly { destroy(): void }[]): void {
    for (const item of items) {
      item.destroy();
    }
  }

  destroy(): void {
    this.destroyAll(this.healthPotions);
    this.healthPotions = [];
    this.destroyAll(this.frenzyPotions);
    this.frenzyPotions = [];
    this.destroyAll(this.shieldPotions);
    this.shieldPotions = [];
    this.destroyAll(this.healthPotionEffects);
    this.healthPotionEffects = [];
    this.destroyAll(this.frenzyPotionEffects);
    this.frenzyPotionEffects = [];
  }
}
