import { TICK_RATE } from '../../shared/constants.ts';
import type { EntityRect, TileData } from '../../shared/types.ts';
import type { Tilemap } from './Tilemap.ts';

export const CANNON_WARNING_TICKS = Math.round(TICK_RATE * 0.6);
export const CANNON_FIRE_INTERVAL_TICKS = TICK_RATE * 3;
export const CANNON_MAX_HEALTH = 3;
export const CANNON_ANIMATION_FRAME_TICKS = 3;
export const CANNON_BALL_SPEED = 5;

const CANNON_WIDTH = 40;
const CANNON_HEIGHT = 26;
const CANNON_FIRE_FRAME_COUNT = 6;
const CANNON_HIT_FRAME_COUNT = 4;
const CANNON_DESTROYED_FRAME_COUNT = 4;
const CANNON_MUZZLE_FRAME_COUNT = 6;
const CANNON_BALL_SIZE = 16;
const CANNON_BALL_EXPLOSION_FRAME_COUNT = 7;
const CANNON_BALL_MAX_FLIGHT_TICKS = TICK_RATE * 4;
const CANNON_BALL_EXPLOSION_TICKS =
  CANNON_BALL_EXPLOSION_FRAME_COUNT * CANNON_ANIMATION_FRAME_TICKS;
const CANNON_FIRE_ANIMATION_TICKS =
  CANNON_FIRE_FRAME_COUNT * CANNON_ANIMATION_FRAME_TICKS;
const CANNON_HIT_ANIMATION_TICKS =
  CANNON_HIT_FRAME_COUNT * CANNON_ANIMATION_FRAME_TICKS;
const CANNON_DESTROYED_ANIMATION_TICKS =
  CANNON_DESTROYED_FRAME_COUNT * CANNON_ANIMATION_FRAME_TICKS;
const CANNON_MUZZLE_ANIMATION_TICKS =
  CANNON_MUZZLE_FRAME_COUNT * CANNON_ANIMATION_FRAME_TICKS;

export type CannonDirection = -1 | 1;
export type CannonAnimation = 'idle' | 'fire' | 'hit' | 'destroyed';
export type CannonBallState = 'flying' | 'exploding';

type CannonTilemap = Pick<Tilemap, 'tiles' | 'tileSize' | 'physicalRectsAround'>;
type PlayerHitHandler = (knockbackDirection: CannonDirection) => void;

export class Cannon {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly direction: CannonDirection;
  health = CANNON_MAX_HEALTH;
  cycleTick = 0;
  fireTicksRemaining = 0;
  muzzleTicksRemaining = 0;
  hitTicksRemaining = 0;
  destructionTicksRemaining = 0;
  destroyed = false;

  constructor(tile: TileData, tileSize: number) {
    if (tile.variant !== 0 && tile.variant !== 1) {
      throw new Error(
        `Cannon at ${tile.loc[0]};${tile.loc[1]} has invalid direction variant ${tile.variant}.`
      );
    }

    this.id = `${tile.loc[0]};${tile.loc[1]}`;
    this.x = tile.loc[0] * tileSize;
    this.y =
      tile.loc[1] * tileSize + Math.max(0, tileSize - CANNON_HEIGHT);
    this.direction = tile.variant === 0 ? 1 : -1;
  }

  get animation(): CannonAnimation {
    if (this.destroyed) {
      return 'destroyed';
    }
    if (this.hitTicksRemaining > 0) {
      return 'hit';
    }
    if (this.fireTicksRemaining > 0) {
      return 'fire';
    }
    return 'idle';
  }

  get animationFrame(): number {
    if (this.destroyed) {
      return getFrameIndex(
        CANNON_DESTROYED_ANIMATION_TICKS,
        this.destructionTicksRemaining,
        CANNON_DESTROYED_FRAME_COUNT
      );
    }
    if (this.hitTicksRemaining > 0) {
      return getFrameIndex(
        CANNON_HIT_ANIMATION_TICKS,
        this.hitTicksRemaining,
        CANNON_HIT_FRAME_COUNT
      );
    }
    if (this.fireTicksRemaining > 0) {
      return getFrameIndex(
        CANNON_FIRE_ANIMATION_TICKS,
        this.fireTicksRemaining,
        CANNON_FIRE_FRAME_COUNT
      );
    }
    return 0;
  }

  get warning(): boolean {
    return (
      !this.destroyed &&
      this.hitTicksRemaining === 0 &&
      this.cycleTick < CANNON_WARNING_TICKS
    );
  }

  get warningFlash(): boolean {
    return this.warning && this.cycleTick % 8 < 4;
  }

  get muzzleFrame(): number | undefined {
    if (this.muzzleTicksRemaining <= 0) {
      return undefined;
    }
    return getFrameIndex(
      CANNON_MUZZLE_ANIMATION_TICKS,
      this.muzzleTicksRemaining,
      CANNON_MUZZLE_FRAME_COUNT
    );
  }

  get bounds(): EntityRect {
    return { x: this.x, y: this.y, width: CANNON_WIDTH, height: CANNON_HEIGHT };
  }

  get muzzleCenter(): [number, number] {
    return [
      this.direction > 0 ? this.x + CANNON_WIDTH : this.x,
      this.y + CANNON_HEIGHT / 2,
    ];
  }
}

export class CannonBall {
  readonly direction: CannonDirection;
  readonly cannon: Cannon;
  x: number;
  y: number;
  state: CannonBallState = 'flying';
  ageTicks = 0;
  explosionTicksRemaining = 0;

  constructor(cannon: Cannon) {
    this.cannon = cannon;
    this.direction = cannon.direction;
    this.x =
      cannon.direction > 0
        ? cannon.x + CANNON_WIDTH - CANNON_BALL_SIZE / 2
        : cannon.x - CANNON_BALL_SIZE / 2;
    this.y = cannon.y + (CANNON_HEIGHT - CANNON_BALL_SIZE) / 2;
  }

  get animation(): 'idle' | 'explosion' {
    return this.state === 'exploding' ? 'explosion' : 'idle';
  }

  get animationFrame(): number {
    if (this.state === 'flying') {
      return 0;
    }
    return getFrameIndex(
      CANNON_BALL_EXPLOSION_TICKS,
      this.explosionTicksRemaining,
      CANNON_BALL_EXPLOSION_FRAME_COUNT
    );
  }

  get bounds(): EntityRect {
    return {
      x: this.x,
      y: this.y,
      width: CANNON_BALL_SIZE,
      height: CANNON_BALL_SIZE,
    };
  }

  explode(): void {
    if (this.state === 'exploding') {
      return;
    }
    this.state = 'exploding';
    this.explosionTicksRemaining = CANNON_BALL_EXPLOSION_TICKS;
  }
}

export type CannonHitResult = {
  cannon: Cannon;
  health: number;
  destroyed: boolean;
};

export class CannonSystem {
  readonly cannons: Cannon[];
  readonly cannonBalls: CannonBall[] = [];
  private readonly tilemap: CannonTilemap;
  private readonly onPlayerHit: PlayerHitHandler;

  constructor(tilemap: CannonTilemap, onPlayerHit: PlayerHitHandler) {
    this.tilemap = tilemap;
    this.onPlayerHit = onPlayerHit;
    this.cannons = Object.values(tilemap.tiles)
      .filter((tile) => tile.type === 'cannon')
      .map((tile) => new Cannon(tile, tilemap.tileSize));
  }

  update(playerRect?: EntityRect): void {
    this.updateCannonBalls(playerRect);

    for (const cannon of this.cannons) {
      this.updateCannon(cannon);
    }
  }

  damageFromAttack(
    attackRect: EntityRect,
    hitEntities: Set<unknown>
  ): CannonHitResult[] {
    const results: CannonHitResult[] = [];

    for (const cannon of this.cannons) {
      if (
        cannon.destroyed ||
        hitEntities.has(cannon) ||
        !intersects(attackRect, cannon.bounds)
      ) {
        continue;
      }

      hitEntities.add(cannon);
      cannon.health = Math.max(0, cannon.health - 1);
      cannon.destroyed = cannon.health === 0;
      if (cannon.destroyed) {
        cannon.destructionTicksRemaining = CANNON_DESTROYED_ANIMATION_TICKS;
        cannon.fireTicksRemaining = 0;
        cannon.muzzleTicksRemaining = 0;
      } else {
        cannon.hitTicksRemaining = CANNON_HIT_ANIMATION_TICKS;
        cannon.fireTicksRemaining = 0;
        cannon.muzzleTicksRemaining = 0;
      }
      results.push({
        cannon,
        health: cannon.health,
        destroyed: cannon.destroyed,
      });
    }

    return results;
  }

  private updateCannon(cannon: Cannon): void {
    if (cannon.destroyed) {
      cannon.destructionTicksRemaining = Math.max(
        0,
        cannon.destructionTicksRemaining - 1
      );
      return;
    }

    if (cannon.hitTicksRemaining > 0) {
      cannon.hitTicksRemaining -= 1;
      return;
    }

    cannon.fireTicksRemaining = Math.max(0, cannon.fireTicksRemaining - 1);
    cannon.muzzleTicksRemaining = Math.max(0, cannon.muzzleTicksRemaining - 1);
    cannon.cycleTick = (cannon.cycleTick + 1) % CANNON_FIRE_INTERVAL_TICKS;
    if (cannon.cycleTick !== CANNON_WARNING_TICKS) {
      return;
    }

    cannon.fireTicksRemaining = CANNON_FIRE_ANIMATION_TICKS;
    cannon.muzzleTicksRemaining = CANNON_MUZZLE_ANIMATION_TICKS;
    this.cannonBalls.push(new CannonBall(cannon));
  }

  private updateCannonBalls(playerRect: EntityRect | undefined): void {
    for (let index = this.cannonBalls.length - 1; index >= 0; index -= 1) {
      const cannonBall = this.cannonBalls[index];
      if (!cannonBall) {
        continue;
      }

      if (cannonBall.state === 'exploding') {
        cannonBall.explosionTicksRemaining -= 1;
        if (cannonBall.explosionTicksRemaining <= 0) {
          this.cannonBalls.splice(index, 1);
        }
        continue;
      }

      cannonBall.ageTicks += 1;
      cannonBall.x += cannonBall.direction * CANNON_BALL_SPEED;
      const ballBounds = cannonBall.bounds;
      const hitTerrain = this.tilemap
        .physicalRectsAround([cannonBall.x, cannonBall.y])
        .some((terrain) => intersects(ballBounds, terrain));

      if (hitTerrain) {
        cannonBall.explode();
      } else if (playerRect && intersects(ballBounds, playerRect)) {
        this.onPlayerHit(cannonBall.direction);
        cannonBall.explode();
      } else if (cannonBall.ageTicks >= CANNON_BALL_MAX_FLIGHT_TICKS) {
        this.cannonBalls.splice(index, 1);
      }
    }
  }
}

function getFrameIndex(
  animationTicks: number,
  ticksRemaining: number,
  frameCount: number
): number {
  const ticksElapsed = animationTicks - ticksRemaining;
  return Math.min(
    frameCount - 1,
    Math.floor(ticksElapsed / CANNON_ANIMATION_FRAME_TICKS)
  );
}

function intersects(first: EntityRect, second: EntityRect): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}
