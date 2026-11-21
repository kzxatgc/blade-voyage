import { PhysicsEntity } from '../entities/PhysicsEntity.ts';
import type { EntityPosition, EntityRect, EntitySize } from '../../shared/types.ts';
import { RENDER_DEPTH } from '../../shared/constants.ts';
import type { Tilemap } from './Tilemap.ts';
import { Animation } from '../utils/Animation.ts';

export const POTION_SPAWN_CHANCE = 1;
export const POTION_HORIZONTAL_TILE_RANGE = 3;
export const POTION_VERTICAL_TILE_RANGE = 2;
export const POTION_HEAL_AMOUNT = 1;

export interface PotionRenderImage {
  setOrigin(x: number, y: number): void;
  setPosition(x: number, y: number): void;
  setTexture(texture: string): void;
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
  }

  override update(tilemap: Pick<Tilemap, 'physicalRectsAround' | 'platformsAround'>) {
    super.update(tilemap, [0, 0]);
    if (!this.landed) {
      this.velocity[1] = Math.min(3.5, this.velocity[1] + 0.2);
    }
    if (this.collision.bottom) {
      this.landed = true;
      this.velocity[1] = 0;
    }
    this.animation?.update();
    this.timer += 1;
  }

  render(scene: PotionRenderScene, offset: readonly [number, number] = [0, 0]) {
    const texture = this.animation?.img() ?? 'potion/idle/0';
    const renderX = this.pos[0] - offset[0] + 8;
    const renderY = this.pos[1] - offset[1] + 8;
    if (!this.image) {
      this.image = scene.add.image(renderX, renderY, texture);
      this.image.setOrigin(0.5, 0.5);
      this.image.setDepth?.(RENDER_DEPTH.ENTITIES);
      this.imageTexture = texture;
    } else {
      if (this.imageTexture !== texture) {
        this.image.setTexture(texture);
        this.imageTexture = texture;
      }
      this.image.setPosition(renderX, renderY);
      this.image.setDepth?.(RENDER_DEPTH.ENTITIES);
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

  constructor(random: () => number = Math.random) {
    this.random = random;
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
      const horizontalRange = POTION_HORIZONTAL_TILE_RANGE * tileSize;
      const verticalRange = POTION_VERTICAL_TILE_RANGE * tileSize;
      availablePositions = availablePositions.filter((pos) => {
        const horizontalDistance = pos[0] - (playerX + 32);
        const verticalDistance = pos[1] - playerY;
        return (
          horizontalDistance >= -horizontalRange &&
          horizontalDistance <= horizontalRange &&
          verticalDistance >= -verticalRange &&
          verticalDistance <= verticalRange
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
      selected[1] - 14,
    ]);
    this.potions.push(potion);
    return potion;
  }

  update(
    tilemap: Tilemap,
    playerPos?: readonly [number, number]
  ): void {
    this.spawnPotion(tilemap, playerPos);
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
