import { PhysicsEntity } from '../entities/PhysicsEntity.ts';
import type { EntityPosition, EntityRect, EntitySize } from '../../shared/types.ts';
import { RENDER_DEPTH } from '../../shared/constants.ts';
import type { Tilemap } from './Tilemap.ts';
import { Animation } from '../utils/Animation.ts';
import { Sparks } from './Sparks.ts';

export const POTION_SPAWN_CHANCE = 0.001;
export const POTION_HORIZONTAL_TILE_RANGE_LEFT = 3;
export const POTION_HORIZONTAL_TILE_RANGE_RIGHT = 2;
export const POTION_VERTICAL_TILE_RANGE_TOP = 2.5;
export const POTION_VERTICAL_TILE_RANGE_BOTTOM = 3.5;
export const POTION_HEAL_AMOUNT = 1;
export const POTION_LIFETIME_TICKS = 2400;
export const POTION_BLINK_START_TICKS = 2100;

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

export class Potion extends PhysicsEntity {
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
        'potion/idle': new Animation('potion/idle', 7, 8),
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
    return this.timer >= POTION_LIFETIME_TICKS;
  }

  isBlinking(): boolean {
    if (this.timer < POTION_BLINK_START_TICKS) {
      return false;
    }
    const blinkRate = this.timer >= 280 ? 7 : 12;
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
    const texture = this.animation?.img() ?? 'potion/idle/0';
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

export class Potions {
  potions: Potion[] = [];
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

  spawnPotion(
    tilemap: Tilemap,
    playerPos?: readonly [number, number]
  ): Potion | null {
    if (this.potions.length > 0 || this.random() >= POTION_SPAWN_CHANCE) {
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

    if (availablePositions.length === 0) {
      return null;
    }

    const selectedIndex = Math.floor(this.random() * availablePositions.length);
    const selected = availablePositions[selectedIndex];
    if (!selected) {
      return null;
    }

    const potion = new Potion([
      selected[0] + tilemap.tileSize * 0.5 - 8,
      selected[1] - 21,
    ]);
    this.potions.push(potion);
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
    this.spawnPotion(tilemap, playerPos);
    this.potions = this.potions.filter((potion) => {
      if (potion.isExpired) {
        potion.destroy();
        return false;
      }
      return true;
    });
    for (const potion of this.potions) {
      potion.update(tilemap);
    }
  }

  collect(player: PotionPlayerTarget): boolean {
    if (player.health >= player.maxHealth) {
      return false;
    }

    const playerRect = player.rect();
    for (let index = this.potions.length - 1; index >= 0; index -= 1) {
      const potion = this.potions[index];
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
          player.health + POTION_HEAL_AMOUNT
        );
        potion.destroy();
        this.potions.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  render(scene: PotionRenderScene, offset: readonly [number, number] = [0, 0]) {
    for (const potion of this.potions) {
      potion.render(scene, offset);
    }
  }

  destroy() {
    for (const potion of this.potions) {
      potion.destroy();
    }
    this.potions = [];
  }
}
