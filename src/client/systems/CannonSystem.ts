import { RENDER_DEPTH, TICK_RATE } from '../../shared/constants.ts';
import type { EntityRect, TileData } from '../../shared/types.ts';
import type { Tilemap } from './Tilemap.ts';

export const CANNON_WARNING_TICKS = Math.round(TICK_RATE * 0.6);
export const CANNON_FIRE_INTERVAL_TICKS = TICK_RATE * 3;
export const CANNON_MAX_HEALTH = 3;
export const CANNON_ANIMATION_FRAME_TICKS = 3;
export const CANNON_BALL_SPEED = 5;
export const CANNON_LAUNCH_FRAME = 3;

const CANNON_WIDTH = 40;
const CANNON_HEIGHT = 26;
const CANNON_FIRE_FRAME_COUNT = 6;
const CANNON_HIT_FRAME_TICKS = [8, 3, 4, 5] as const;
const CANNON_HIT_FRAME_COUNT = CANNON_HIT_FRAME_TICKS.length;
const CANNON_DESTROYED_FRAME_COUNT = 4;
const CANNON_MUZZLE_FRAME_COUNT = 6;
const CANNON_BALL_SIZE = 16;
const CANNON_BALL_EXPLOSION_FRAME_COUNT = 7;
const CANNON_BALL_MAX_FLIGHT_TICKS = TICK_RATE * 4;
const CANNON_HIT_JUMP_HEIGHT = 14;
const CANNON_BALL_EXPLOSION_TICKS =
  CANNON_BALL_EXPLOSION_FRAME_COUNT * CANNON_ANIMATION_FRAME_TICKS;
const CANNON_FIRE_ANIMATION_TICKS =
  CANNON_FIRE_FRAME_COUNT * CANNON_ANIMATION_FRAME_TICKS;
const CANNON_LAUNCH_DELAY_TICKS =
  CANNON_LAUNCH_FRAME * CANNON_ANIMATION_FRAME_TICKS;
const CANNON_HIT_ANIMATION_TICKS =
  CANNON_HIT_FRAME_TICKS.reduce((total, ticks) => total + ticks, 0);
const CANNON_DESTROYED_ANIMATION_TICKS =
  CANNON_DESTROYED_FRAME_COUNT * CANNON_ANIMATION_FRAME_TICKS;
const CANNON_MUZZLE_ANIMATION_TICKS =
  CANNON_MUZZLE_FRAME_COUNT * CANNON_ANIMATION_FRAME_TICKS;

export type CannonDirection = -1 | 1;
export type CannonAnimation = 'idle' | 'fire' | 'hit' | 'destroyed';
export type CannonBallState = 'flying' | 'exploding';

type CannonTilemap = Pick<Tilemap, 'tiles' | 'tileSize' | 'physicalRectsAround'>;
type PlayerHitHandler = (knockbackDirection: CannonDirection) => void;
type CannonRenderImage = {
  texture: { key: string };
  setOrigin(x: number, y: number): CannonRenderImage;
  setPosition(x: number, y: number): CannonRenderImage;
  setFlipX(flip: boolean): CannonRenderImage;
  setDepth(depth: number): CannonRenderImage;
  setTint(color: number): CannonRenderImage;
  clearTint(): CannonRenderImage;
  setVisible(visible: boolean): CannonRenderImage;
  setTexture(texture: string): CannonRenderImage;
  destroy(): void;
};
type CannonRenderScene = {
  add: {
    image(x: number, y: number, texture: string): CannonRenderImage;
  };
};

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
      return getCannonHitFrame(this.hitTicksRemaining);
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

  get hitJumpOffset(): number {
    const ticksRemaining = this.destroyed
      ? this.destructionTicksRemaining
      : this.hitTicksRemaining;
    if (ticksRemaining <= 0) {
      return 0;
    }

    const animationTicks = this.destroyed
      ? CANNON_DESTROYED_ANIMATION_TICKS
      : CANNON_HIT_ANIMATION_TICKS;
    const progress =
      (animationTicks - ticksRemaining) / animationTicks;
    return -Math.sin(progress * Math.PI) * CANNON_HIT_JUMP_HEIGHT;
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
  private readonly cannonImages = new Map<Cannon, CannonRenderImage>();
  private readonly muzzleImages = new Map<Cannon, CannonRenderImage>();
  private readonly cannonBallImages = new Map<CannonBall, CannonRenderImage>();

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

  render(scene: CannonRenderScene): void {
    for (const cannon of this.cannons) {
      const cannonTexture = `cannon/${cannon.animation}/${cannon.animationFrame}`;
      const cannonImage = this.cannonImages.get(cannon) ??
        scene.add
          .image(cannon.x, cannon.y, cannonTexture)
          .setOrigin(0, 0)
          .setDepth(RENDER_DEPTH.FRONT_TILES + 0.1);
      this.cannonImages.set(cannon, cannonImage);
      if (cannonImage.texture.key !== cannonTexture) {
        cannonImage.setTexture(cannonTexture);
      }
      cannonImage
        .setPosition(cannon.x, cannon.y + cannon.hitJumpOffset)
        .setFlipX(cannon.direction > 0);
      if (cannon.warningFlash) {
        cannonImage.setTint(0xffb347);
      } else {
        cannonImage.clearTint();
      }

      const muzzleFrame = cannon.muzzleFrame;
      if (muzzleFrame === undefined) {
        this.muzzleImages.get(cannon)?.setVisible(false);
        continue;
      }

      const muzzleTexture = `cannon/muzzle/${muzzleFrame}`;
      const muzzleImage = this.muzzleImages.get(cannon) ??
        scene.add
          .image(cannon.muzzleCenter[0], cannon.muzzleCenter[1], muzzleTexture)
          .setOrigin(0.5, 0.5)
          .setDepth(RENDER_DEPTH.EFFECTS);
      this.muzzleImages.set(cannon, muzzleImage);
      if (muzzleImage.texture.key !== muzzleTexture) {
        muzzleImage.setTexture(muzzleTexture);
      }
      muzzleImage
        .setPosition(cannon.muzzleCenter[0], cannon.muzzleCenter[1])
        .setFlipX(cannon.direction > 0)
        .setVisible(true);
    }

    const activeCannonBalls = new Set(this.cannonBalls);
    for (const [cannonBall, image] of this.cannonBallImages) {
      if (!activeCannonBalls.has(cannonBall)) {
        image.destroy();
        this.cannonBallImages.delete(cannonBall);
      }
    }

    for (const cannonBall of this.cannonBalls) {
      const exploding = cannonBall.state === 'exploding';
      const cannonBallTexture = exploding
        ? `cannon/ball/explosion/${cannonBall.animationFrame}`
        : 'cannon/ball/idle/0';
      const cannonBallImage = this.cannonBallImages.get(cannonBall) ??
        scene.add
          .image(cannonBall.x, cannonBall.y, cannonBallTexture)
          .setDepth(exploding ? RENDER_DEPTH.EFFECTS : RENDER_DEPTH.ENTITIES);
      this.cannonBallImages.set(cannonBall, cannonBallImage);
      if (cannonBallImage.texture.key !== cannonBallTexture) {
        cannonBallImage.setTexture(cannonBallTexture);
      }
      cannonBallImage
        .setOrigin(exploding ? 0.5 : 0, exploding ? 0.5 : 0)
        .setPosition(
          cannonBall.x + (exploding ? CANNON_BALL_SIZE / 2 : 0),
          cannonBall.y + (exploding ? CANNON_BALL_SIZE / 2 : 0)
        )
        .setFlipX(cannonBall.direction < 0)
        .setDepth(exploding ? RENDER_DEPTH.EFFECTS : RENDER_DEPTH.ENTITIES)
        .setVisible(true);
    }
  }

  destroy(): void {
    for (const images of [
      this.cannonImages,
      this.muzzleImages,
      this.cannonBallImages,
    ]) {
      for (const image of images.values()) {
        image.destroy();
      }
      images.clear();
    }
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
    if (cannon.cycleTick === CANNON_WARNING_TICKS) {
      cannon.fireTicksRemaining = CANNON_FIRE_ANIMATION_TICKS;
    }

    if (
      cannon.fireTicksRemaining !==
      CANNON_FIRE_ANIMATION_TICKS - CANNON_LAUNCH_DELAY_TICKS
    ) {
      return;
    }

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

function getCannonHitFrame(ticksRemaining: number): number {
  let ticksElapsed = CANNON_HIT_ANIMATION_TICKS - ticksRemaining;
  for (const [frame, frameTicks] of CANNON_HIT_FRAME_TICKS.entries()) {
    if (ticksElapsed < frameTicks) {
      return frame;
    }
    ticksElapsed -= frameTicks;
  }
  return CANNON_HIT_FRAME_COUNT - 1;
}

function intersects(first: EntityRect, second: EntityRect): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}
