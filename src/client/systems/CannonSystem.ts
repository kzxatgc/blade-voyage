import { RENDER_DEPTH, TICK_RATE } from '../../shared/constants.ts';
import type { EntityRect, TileData } from '../../shared/types.ts';
import type { Tilemap } from './Tilemap.ts';

export const CANNON_WARNING_TICKS = Math.round(TICK_RATE * 0.6);
export const CANNON_COOLDOWN_TICKS = TICK_RATE * 3;
export const CANNON_MAX_HEALTH = 3;
export const CANNON_ANIMATION_FRAME_TICKS = 3;
export const CANNON_BALL_SPEED = 5;
export const CANNON_LAUNCH_FRAME = 3;

const CANNON_WIDTH = 40;
const CANNON_HEIGHT = 26;
const CANNON_KNOCKBACK_POWER = 0.5;
const CANNON_KNOCKBACK_HORIZONTAL_SCALE = 2.3;
const CANNON_KNOCKBACK_DURATION = 30;
const CANNON_KNOCKBACK_REFERENCE_DURATION = 16;
const CANNON_FIRE_FRAME_COUNT = 6;
const CANNON_HIT_FRAME_TICKS = [8, 3, 4, 5] as const;
const CANNON_HIT_FRAME_COUNT = CANNON_HIT_FRAME_TICKS.length;
const CANNON_MUZZLE_FRAME_COUNT = 6;
const CANNON_BALL_SIZE = 16;
const CANNON_BALL_DESTROYED_FRAME_COUNT = 3;
const CANNON_BALL_EXPLOSION_FRAME_COUNT = 7;
const CANNON_BALL_MAX_FLIGHT_TICKS = TICK_RATE * 4;
const CANNON_DEBRIS_GRAVITY = 0.24;
const CANNON_DEBRIS_MAX_TICKS = TICK_RATE * 2;
const CANNON_WRECK_FLASH_TICKS = 3;
const CANNON_WRECK_GRAVITY = 0.24;
const CANNON_WRECK_BOUNCE_THRESHOLD = 0.65;
const CANNON_WRECK_HORIZONTAL_IMPULSE = 4.8;
const CANNON_WRECK_VERTICAL_IMPULSE = 9.6;
const CANNON_WRECK_SIDE_IMPULSE = 1.2;
const CANNON_DEBRIS_GROUNDED_HOLD_TICKS = Math.round(TICK_RATE * 0.5);
const CANNON_DEBRIS_FADE_TICKS = Math.round(TICK_RATE * 0.2);
const CANNON_DEBRIS_SETTLE_TICKS =
  CANNON_DEBRIS_GROUNDED_HOLD_TICKS + CANNON_DEBRIS_FADE_TICKS;
const CANNON_DEBRIS_FRAME_BOUNDS = [
  { x: 4, y: 5, width: 7, height: 5 },
  { x: 5, y: 5, width: 6, height: 6 },
  { x: 4, y: 5, width: 8, height: 5 },
] as const;
const CANNON_DEBRIS_MIN_COUNT = 6;
const CANNON_DEBRIS_COUNT_VARIATION = 4;
const CANNON_DEBRIS_MIN_FRAME_TICKS = 2;
const CANNON_DEBRIS_FRAME_TICK_VARIATION = 3;
const CANNON_DEBRIS_BURST = [
  { offsetX: -2, offsetY: 1, speedX: 2.2, speedY: -3 },
  { offsetX: 2, offsetY: -2, speedX: 1.3, speedY: -2.6 },
  { offsetX: 0, offsetY: 3, speedX: 2.8, speedY: -1.6 },
  { offsetX: -4, offsetY: -3, speedX: 0.8, speedY: -1.9 },
  { offsetX: 4, offsetY: 0, speedX: 1.7, speedY: -0.9 },
  { offsetX: -1, offsetY: -4, speedX: 2.5, speedY: -3.4 },
  { offsetX: 3, offsetY: 4, speedX: 2.4, speedY: -2.2 },
  { offsetX: -3, offsetY: 0, speedX: 1, speedY: -1.1 },
  { offsetX: 1, offsetY: -4, speedX: 2, speedY: -2.9 },
] as const;
const CANNON_WRECK_PART_SPECS = [
  {
    frame: 1,
    kind: 'body',
    mass: 3.8,
    side: 0,
    bounds: { x: 0, y: 1, width: 30, height: 19 },
    angularVelocity: 0.035,
    restitution: 0.08,
    groundFriction: 0.62,
  },
  {
    frame: 2,
    kind: 'holder',
    mass: 2,
    side: -1,
    bounds: { x: 8, y: 4, width: 14, height: 13 },
    angularVelocity: -0.13,
    restitution: 0.32,
    groundFriction: 0.48,
  },
  {
    frame: 3,
    kind: 'holder',
    mass: 2,
    side: 1,
    bounds: { x: 8, y: 6, width: 14, height: 11 },
    angularVelocity: 0.13,
    restitution: 0.32,
    groundFriction: 0.48,
  },
] as const;
const CANNON_HIT_JUMP_HEIGHT = 14;
const CANNON_BALL_EXPLOSION_TICKS =
  CANNON_BALL_EXPLOSION_FRAME_COUNT * CANNON_ANIMATION_FRAME_TICKS;
const CANNON_FIRE_ANIMATION_TICKS =
  CANNON_FIRE_FRAME_COUNT * CANNON_ANIMATION_FRAME_TICKS;
const CANNON_LAUNCH_DELAY_TICKS =
  CANNON_LAUNCH_FRAME * CANNON_ANIMATION_FRAME_TICKS;
const CANNON_HIT_ANIMATION_TICKS =
  CANNON_HIT_FRAME_TICKS.reduce((total, ticks) => total + ticks, 0);
const CANNON_MUZZLE_ANIMATION_TICKS =
  CANNON_MUZZLE_FRAME_COUNT * CANNON_ANIMATION_FRAME_TICKS;

export type CannonDirection = -1 | 1;
export type CannonAnimation = 'idle' | 'fire' | 'hit' | 'destroyed';
export type CannonBallState = 'flying' | 'exploding';
type CannonWreckPartSpec = (typeof CANNON_WRECK_PART_SPECS)[number];

type CannonTilemap = Pick<
  Tilemap,
  'tiles' | 'tileSize' | 'physicalRectsAround'
>;
type PlayerHitHandler = (knockbackDirection: CannonDirection) => void;
type WallImpactHandler = (position: readonly [number, number]) => void;
type CannonRenderImage = {
  texture: { key: string };
  setOrigin(x: number, y: number): CannonRenderImage;
  setAlpha(alpha: number): CannonRenderImage;
  setPosition(x: number, y: number): CannonRenderImage;
  setFlipX(flip: boolean): CannonRenderImage;
  setRotation(rotation: number): CannonRenderImage;
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
  x: number;
  readonly y: number;
  readonly direction: CannonDirection;
  knockbackVelocityX = 0;
  knockbackTicksRemaining = 0;
  readonly knockbackDuration = CANNON_KNOCKBACK_DURATION;
  health = CANNON_MAX_HEALTH;
  cycleTick = 0;
  activated = false;
  cooldownTicksRemaining = 0;
  fireTicksRemaining = 0;
  muzzleTicksRemaining = 0;
  hitTicksRemaining = 0;
  destructionFlashTicksRemaining = 0;
  destroyed = false;

  constructor(tile: TileData, tileSize: number) {
    if (tile.variant !== 0 && tile.variant !== 1) {
      throw new Error(
        `Cannon at ${tile.loc[0]};${tile.loc[1]} has invalid direction variant ${tile.variant}.`
      );
    }

    this.id = `${tile.loc[0]};${tile.loc[1]}`;
    this.x = tile.loc[0] * tileSize + (tileSize - CANNON_WIDTH) / 2;
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
      return 0;
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
      this.activated &&
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
    const ticksRemaining = this.hitTicksRemaining;
    if (ticksRemaining <= 0) {
      return 0;
    }

    const progress =
      (CANNON_HIT_ANIMATION_TICKS - ticksRemaining) /
      CANNON_HIT_ANIMATION_TICKS;
    return -Math.sin(progress * Math.PI) * CANNON_HIT_JUMP_HEIGHT;
  }

  get muzzleCenter(): [number, number] {
    return [
      this.direction > 0 ? this.x + CANNON_WIDTH : this.x,
      this.y + CANNON_HEIGHT / 2,
    ];
  }

  applyKnockback(direction: CannonDirection): void {
    this.knockbackVelocityX =
      direction * CANNON_KNOCKBACK_POWER * CANNON_KNOCKBACK_HORIZONTAL_SCALE;
    this.knockbackTicksRemaining = this.knockbackDuration;
  }

  advanceKnockback(): number {
    if (this.knockbackTicksRemaining <= 0) {
      return 0;
    }

    const progress = this.knockbackTicksRemaining / this.knockbackDuration;
    const distanceCorrection =
      (3 *
        this.knockbackDuration *
        (CANNON_KNOCKBACK_REFERENCE_DURATION + 1)) /
      ((2 * this.knockbackDuration + 1) * (this.knockbackDuration + 1));
    const displacement =
      this.knockbackVelocityX *
      progress *
      progress *
      distanceCorrection;
    this.knockbackTicksRemaining -= 1;
    if (this.knockbackTicksRemaining === 0) {
      this.knockbackVelocityX = 0;
    }
    return displacement;
  }

  stopKnockback(): void {
    this.knockbackTicksRemaining = 0;
    this.knockbackVelocityX = 0;
  }
}

export class CannonBall {
  readonly direction: CannonDirection;
  readonly cannon: Cannon;
  x: number;
  y: number;
  state: CannonBallState = 'flying';
  ageTicks = 0;
  effectTicksRemaining = 0;

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
    if (this.state === 'flying') return 0;
    return getFrameIndex(
      CANNON_BALL_EXPLOSION_TICKS,
      this.effectTicksRemaining,
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

  explodeOnPlayer(): void {
    if (this.state !== 'flying') {
      return;
    }
    this.state = 'exploding';
    this.effectTicksRemaining = CANNON_BALL_EXPLOSION_TICKS;
  }
}

export class CannonDebris {
  readonly direction: CannonDirection;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  ageTicks = 0;
  grounded = false;
  settleTicksRemaining = 0;
  groundedAnimationFrame = 0;
  readonly initialAnimationFrame: number;
  readonly animationFrameTicks: number;

  constructor(
    wall: EntityRect,
    impactCenterY: number,
    direction: CannonDirection,
    fragment: (typeof CANNON_DEBRIS_BURST)[number],
    random: () => number
  ) {
    this.direction = direction;
    this.initialAnimationFrame = Math.min(
      CANNON_BALL_DESTROYED_FRAME_COUNT - 1,
      Math.floor(random() * CANNON_BALL_DESTROYED_FRAME_COUNT)
    );
    this.animationFrameTicks =
      CANNON_DEBRIS_MIN_FRAME_TICKS +
      Math.min(
        CANNON_DEBRIS_FRAME_TICK_VARIATION - 1,
        Math.floor(random() * CANNON_DEBRIS_FRAME_TICK_VARIATION)
      );
    this.velocityX =
      -direction * fragment.speedX * (0.7 + random() * 0.6);
    this.velocityY = fragment.speedY * (0.75 + random() * 0.5);
    const frameBounds = this.frameBounds;
    const wallFaceX = direction > 0 ? wall.x : wall.x + wall.width;
    const horizontalContactOffset =
      direction > 0
        ? frameBounds.x + frameBounds.width
        : frameBounds.x;
    this.x =
      wallFaceX -
      horizontalContactOffset -
      direction * Math.abs(fragment.offsetX);
    this.y = Math.round(
      impactCenterY -
        frameBounds.y -
        frameBounds.height / 2 +
        fragment.offsetY
    );
  }

  get animationFrame(): number {
    if (this.grounded) {
      return this.groundedAnimationFrame;
    }
    return Math.min(
      CANNON_BALL_DESTROYED_FRAME_COUNT - 1,
      (this.initialAnimationFrame +
        Math.floor(this.ageTicks / this.animationFrameTicks)) %
        CANNON_BALL_DESTROYED_FRAME_COUNT
    );
  }

  get alpha(): number {
    if (
      !this.grounded ||
      this.settleTicksRemaining > CANNON_DEBRIS_FADE_TICKS
    ) {
      return 1;
    }
    return this.settleTicksRemaining / CANNON_DEBRIS_FADE_TICKS;
  }

  get bounds(): EntityRect {
    const frameBounds = this.frameBounds;
    return {
      x: this.x + frameBounds.x,
      y: this.y + frameBounds.y,
      width: frameBounds.width,
      height: frameBounds.height,
    };
  }

  private get frameBounds(): (typeof CANNON_DEBRIS_FRAME_BOUNDS)[number] {
    const frame = this.animationFrame;
    return frame === 0
      ? CANNON_DEBRIS_FRAME_BOUNDS[0]
      : frame === 1
        ? CANNON_DEBRIS_FRAME_BOUNDS[1]
        : CANNON_DEBRIS_FRAME_BOUNDS[2];
  }
}

export class CannonWreckPart {
  readonly frame: CannonWreckPartSpec['frame'];
  readonly kind: CannonWreckPartSpec['kind'];
  readonly mass: number;
  readonly direction: CannonDirection;
  readonly flipX: boolean;
  readonly boundsOffset: CannonWreckPartSpec['bounds'];
  readonly restitution: number;
  readonly groundFriction: number;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  rotation = 0;
  angularVelocity: number;
  ageTicks = 0;
  grounded = false;

  constructor(
    cannon: Cannon,
    spec: CannonWreckPartSpec,
    direction: CannonDirection,
    random: () => number
  ) {
    const mirror = cannon.direction > 0 ? -1 : 1;
    const worldSide = spec.side * mirror;
    this.frame = spec.frame;
    this.kind = spec.kind;
    this.mass = spec.mass;
    this.direction = direction;
    this.flipX = cannon.direction > 0;
    this.boundsOffset = spec.bounds;
    this.restitution = spec.restitution;
    this.groundFriction = spec.groundFriction;
    this.x = cannon.x + CANNON_WIDTH / 2 + spec.side * 8 * mirror;
    this.y = cannon.y + CANNON_HEIGHT / 2;
    this.velocityX =
      (direction * CANNON_WRECK_HORIZONTAL_IMPULSE +
        worldSide * CANNON_WRECK_SIDE_IMPULSE) /
        spec.mass +
      (random() - 0.5) * 0.24;
    this.velocityY =
      -CANNON_WRECK_VERTICAL_IMPULSE / spec.mass +
      (random() - 0.5) * 0.2;
    this.angularVelocity =
      spec.angularVelocity * direction * (0.8 + random() * 0.4);
  }

  get bounds(): EntityRect {
    return {
      x: this.x - 15 + this.boundsOffset.x,
      y: this.y - 10 + this.boundsOffset.y,
      width: this.boundsOffset.width,
      height: this.boundsOffset.height,
    };
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
  readonly cannonDebris: CannonDebris[] = [];
  readonly cannonWreckParts: CannonWreckPart[] = [];
  private readonly tilemap: CannonTilemap;
  private readonly onPlayerHit: PlayerHitHandler;
  private readonly onWallImpact: WallImpactHandler | undefined;
  private readonly random: () => number;
  private readonly cannonImages = new Map<Cannon, CannonRenderImage>();
  private readonly cannonWreckPartImages = new Map<
    CannonWreckPart,
    CannonRenderImage
  >();
  private readonly muzzleImages = new Map<Cannon, CannonRenderImage>();
  private readonly cannonBallImages = new Map<CannonBall, CannonRenderImage>();
  private readonly cannonDebrisImages = new Map<CannonDebris, CannonRenderImage>();

  constructor(
    tilemap: CannonTilemap,
    onPlayerHit: PlayerHitHandler,
    random: () => number = Math.random,
    onWallImpact?: WallImpactHandler
  ) {
    this.tilemap = tilemap;
    this.onPlayerHit = onPlayerHit;
    this.random = random;
    this.onWallImpact = onWallImpact;
    this.cannons = Object.values(tilemap.tiles)
      .filter((tile) => tile.type === 'cannon')
      .map((tile) => new Cannon(tile, tilemap.tileSize));
  }

  update(playerRect?: EntityRect, activationRect?: EntityRect): void {
    this.updateTerrainDebris();
    this.updateCannonWreckParts();
    this.updateCannonBalls(playerRect);

    for (const cannon of this.cannons) {
      this.updateCannon(cannon, activationRect);
    }
  }

  damageFromAttack(
    attackRect: EntityRect,
    hitEntities: Set<unknown>,
    attackerX: number
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
      const knockbackDirection: CannonDirection =
        cannon.x + CANNON_WIDTH / 2 >= attackerX ? 1 : -1;
      cannon.applyKnockback(knockbackDirection);
      cannon.health = Math.max(0, cannon.health - 1);
      cannon.destroyed = cannon.health === 0;
      if (cannon.destroyed) {
        cannon.destructionFlashTicksRemaining = CANNON_WRECK_FLASH_TICKS;
        cannon.fireTicksRemaining = 0;
        cannon.muzzleTicksRemaining = 0;
        cannon.stopKnockback();
        for (const spec of CANNON_WRECK_PART_SPECS) {
          this.cannonWreckParts.push(
            new CannonWreckPart(cannon, spec, knockbackDirection, this.random)
          );
        }
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
      const cannonTexture = cannon.destroyed
        ? 'cannon/destroyed/0'
        : `cannon/${cannon.animation}/${cannon.animationFrame}`;
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
      cannonImage.setVisible(
        !cannon.destroyed || cannon.destructionFlashTicksRemaining > 0
      );
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
      const impactEffect = cannonBall.state !== 'flying';
      const centeredImpact = cannonBall.state === 'exploding';
      const cannonBallTexture =
        cannonBall.state === 'flying'
          ? 'cannon/ball/idle/0'
          : `cannon/ball/${cannonBall.animation}/${cannonBall.animationFrame}`;
      const cannonBallImage = this.cannonBallImages.get(cannonBall) ??
        scene.add
          .image(cannonBall.x, cannonBall.y, cannonBallTexture)
          .setDepth(impactEffect ? RENDER_DEPTH.EFFECTS : RENDER_DEPTH.ENTITIES);
      this.cannonBallImages.set(cannonBall, cannonBallImage);
      if (cannonBallImage.texture.key !== cannonBallTexture) {
        cannonBallImage.setTexture(cannonBallTexture);
      }
      cannonBallImage
        .setOrigin(centeredImpact ? 0.5 : 0, centeredImpact ? 0.5 : 0)
        .setPosition(
          cannonBall.x + (centeredImpact ? CANNON_BALL_SIZE / 2 : 0),
          cannonBall.y + (centeredImpact ? CANNON_BALL_SIZE / 2 : 0)
        )
        .setFlipX(cannonBall.direction < 0)
        .setDepth(impactEffect ? RENDER_DEPTH.EFFECTS : RENDER_DEPTH.ENTITIES)
        .setVisible(true);
    }

    const activeDebris = new Set(this.cannonDebris);
    for (const [debris, image] of this.cannonDebrisImages) {
      if (!activeDebris.has(debris)) {
        image.destroy();
        this.cannonDebrisImages.delete(debris);
      }
    }

    for (const debris of this.cannonDebris) {
      const texture = `cannon/ball/destroyed/${debris.animationFrame}`;
      const image = this.cannonDebrisImages.get(debris) ??
        scene.add
          .image(debris.x, debris.y, texture)
          .setOrigin(0, 0)
          .setDepth(RENDER_DEPTH.EFFECTS);
      this.cannonDebrisImages.set(debris, image);
      if (image.texture.key !== texture) {
        image.setTexture(texture);
      }
      image
        .setPosition(debris.x, debris.y)
        .setAlpha(debris.alpha)
        .setFlipX(debris.direction < 0)
        .setDepth(RENDER_DEPTH.EFFECTS)
        .setVisible(true);
    }

    const activeCannonWreckParts = new Set(this.cannonWreckParts);
    for (const [part, image] of this.cannonWreckPartImages) {
      if (!activeCannonWreckParts.has(part)) {
        image.destroy();
        this.cannonWreckPartImages.delete(part);
      }
    }

    for (const part of this.cannonWreckParts) {
      const texture = `cannon/destroyed/${part.frame}`;
      const image = this.cannonWreckPartImages.get(part) ??
        scene.add
          .image(part.x, part.y, texture)
          .setOrigin(0.5, 0.5)
          .setDepth(RENDER_DEPTH.EFFECTS);
      this.cannonWreckPartImages.set(part, image);
      if (image.texture.key !== texture) {
        image.setTexture(texture);
      }
      image
        .setPosition(part.x, part.y)
        .setFlipX(part.flipX)
        .setRotation(part.rotation)
        .setDepth(RENDER_DEPTH.EFFECTS)
        .setVisible(true);
    }
  }

  destroy(): void {
    for (const images of [
      this.cannonImages,
      this.muzzleImages,
      this.cannonBallImages,
      this.cannonDebrisImages,
      this.cannonWreckPartImages,
    ]) {
      for (const image of images.values()) {
        image.destroy();
      }
      images.clear();
    }
  }

  private updateCannon(cannon: Cannon, activationRect?: EntityRect): void {
    const knockbackDisplacement = cannon.advanceKnockback();
    if (knockbackDisplacement !== 0) {
      const nextX = cannon.x + knockbackDisplacement;
      if (this.intersectsTerrain({ ...cannon.bounds, x: nextX })) {
        cannon.stopKnockback();
      } else {
        cannon.x = nextX;
      }
    }

    if (cannon.destroyed) {
      cannon.destructionFlashTicksRemaining = Math.max(
        0,
        cannon.destructionFlashTicksRemaining - 1
      );
      return;
    }

    cannon.fireTicksRemaining = Math.max(0, cannon.fireTicksRemaining - 1);
    cannon.muzzleTicksRemaining = Math.max(0, cannon.muzzleTicksRemaining - 1);
    cannon.cooldownTicksRemaining = Math.max(
      0,
      cannon.cooldownTicksRemaining - 1
    );

    if (cannon.hitTicksRemaining > 0) {
      cannon.hitTicksRemaining -= 1;
      return;
    }

    if (cannon.cooldownTicksRemaining > 0) {
      return;
    }

    if (!cannon.activated) {
      if (
        activationRect !== undefined &&
        !intersects(cannon.bounds, activationRect)
      ) {
        return;
      }

      cannon.activated = true;
      cannon.cycleTick = 0;
    }

    cannon.cycleTick += 1;
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
    cannon.activated = false;
    cannon.cycleTick = 0;
    cannon.cooldownTicksRemaining = CANNON_COOLDOWN_TICKS;
  }

  private updateCannonBalls(playerRect: EntityRect | undefined): void {
    for (let index = this.cannonBalls.length - 1; index >= 0; index -= 1) {
      const cannonBall = this.cannonBalls[index];
      if (!cannonBall) {
        continue;
      }

      if (cannonBall.state !== 'flying') {
        cannonBall.effectTicksRemaining -= 1;
        if (cannonBall.effectTicksRemaining <= 0) {
          this.cannonBalls.splice(index, 1);
        }
        continue;
      }

      cannonBall.ageTicks += 1;
      cannonBall.x += cannonBall.direction * CANNON_BALL_SPEED;
      const ballBounds = cannonBall.bounds;
      const terrainHit = this.findTerrainCollision(
        ballBounds,
        cannonBall.direction
      );

      if (terrainHit) {
        this.cannonBalls.splice(index, 1);
        const wallFaceX =
          cannonBall.direction > 0
            ? terrainHit.x
            : terrainHit.x + terrainHit.width;
        this.onWallImpact?.([
          wallFaceX,
          ballBounds.y + ballBounds.height / 2,
        ]);
        const debrisCount =
          CANNON_DEBRIS_MIN_COUNT +
          Math.min(
            CANNON_DEBRIS_COUNT_VARIATION - 1,
            Math.floor(this.random() * CANNON_DEBRIS_COUNT_VARIATION)
          );
        for (const fragment of CANNON_DEBRIS_BURST.slice(0, debrisCount)) {
          this.cannonDebris.push(
            new CannonDebris(
              terrainHit,
              ballBounds.y + ballBounds.height / 2,
              cannonBall.direction,
              fragment,
              this.random
            )
          );
        }
      } else if (playerRect && intersects(ballBounds, playerRect)) {
        this.onPlayerHit(cannonBall.direction);
        cannonBall.explodeOnPlayer();
      } else if (cannonBall.ageTicks >= CANNON_BALL_MAX_FLIGHT_TICKS) {
        this.cannonBalls.splice(index, 1);
      }
    }
  }

  private updateTerrainDebris(): void {
    for (let index = this.cannonDebris.length - 1; index >= 0; index -= 1) {
      const debris = this.cannonDebris[index];
      if (!debris) continue;

      if (debris.grounded) {
        debris.settleTicksRemaining -= 1;
        if (debris.settleTicksRemaining <= 0) {
          this.cannonDebris.splice(index, 1);
        }
        continue;
      }

      const previousBounds = debris.bounds;
      debris.ageTicks += 1;
      if (debris.ageTicks >= CANNON_DEBRIS_MAX_TICKS) {
        this.cannonDebris.splice(index, 1);
        continue;
      }

      const previousX = debris.x;
      debris.x += debris.velocityX;
      if (this.intersectsTerrain(debris.bounds)) {
        debris.x = previousX;
        debris.velocityX *= -0.25;
      }

      const previousY = debris.y;
      debris.velocityY += CANNON_DEBRIS_GRAVITY;
      debris.y += debris.velocityY;
      const bounds = debris.bounds;
      const verticalCollisions = this.tilemap
        .physicalRectsAround([bounds.x, bounds.y])
        .filter((terrain) => intersects(bounds, terrain));
      if (verticalCollisions.length > 0) {
        if (debris.velocityY > 0) {
          const previousBottom =
            previousBounds.y + previousBounds.height;
          const landingSurface = verticalCollisions
            .filter(
              (terrain) =>
                previousBottom <= terrain.y &&
                bounds.y + bounds.height >= terrain.y &&
                bounds.x < terrain.x + terrain.width &&
                bounds.x + bounds.width > terrain.x
            )
            .sort((a, b) => a.y - b.y)[0];

          if (landingSurface) {
            debris.y =
              landingSurface.y -
              (bounds.y - debris.y) -
              bounds.height;
            debris.velocityY = 0;
            debris.velocityX = 0;
            debris.groundedAnimationFrame = debris.animationFrame;
            debris.grounded = true;
            debris.settleTicksRemaining = CANNON_DEBRIS_SETTLE_TICKS;
          } else {
            debris.y = previousY;
            debris.velocityY = 0;
          }
        } else {
          debris.y = previousY;
          debris.velocityY = 0;
        }
      }
    }
  }

  private updateCannonWreckParts(): void {
    for (
      let index = this.cannonWreckParts.length - 1;
      index >= 0;
      index -= 1
    ) {
      const part = this.cannonWreckParts[index];
      if (!part) {
        continue;
      }

      if (part.grounded) {
        continue;
      }

      part.ageTicks += 1;

      const previousX = part.x;
      part.x += part.velocityX;
      if (this.intersectsTerrain(part.bounds)) {
        part.x = previousX;
        part.velocityX *= -part.restitution;
        part.angularVelocity *= -0.5;
      }

      const previousY = part.y;
      part.velocityY += CANNON_WRECK_GRAVITY;
      part.y += part.velocityY;
      const bounds = part.bounds;
      const verticalCollisions = this.tilemap
        .physicalRectsAround([bounds.x, bounds.y])
        .filter((terrain) => intersects(bounds, terrain));

      if (verticalCollisions.length > 0) {
        if (part.velocityY > 0) {
          const previousBottom =
            previousY -
            10 +
            part.boundsOffset.y +
            part.boundsOffset.height;
          const landingSurface = verticalCollisions
            .filter(
              (terrain) =>
                previousBottom <= terrain.y &&
                bounds.y + bounds.height >= terrain.y &&
                bounds.x < terrain.x + terrain.width &&
                bounds.x + bounds.width > terrain.x
            )
            .sort((a, b) => a.y - b.y)[0];

          if (landingSurface) {
            part.y -= bounds.y + bounds.height - landingSurface.y;
            const bounceSpeed = Math.abs(part.velocityY) * part.restitution;
            part.velocityX *= part.groundFriction;
            part.angularVelocity *= 0.72;
            if (bounceSpeed > CANNON_WRECK_BOUNCE_THRESHOLD) {
              part.velocityY = -bounceSpeed;
            } else {
              part.velocityY = 0;
              part.velocityX = 0;
              part.angularVelocity = 0;
              part.grounded = true;
            }
          } else {
            part.y = previousY;
            part.velocityY = 0;
          }
        } else {
          part.y = previousY;
          part.velocityY = Math.abs(part.velocityY) * part.restitution;
        }
      }

      part.rotation += part.angularVelocity;
      part.angularVelocity *= part.grounded ? 0.72 : 0.995;
      part.velocityX *= 0.998;
    }
  }

  private intersectsTerrain(bounds: EntityRect): boolean {
    return this.tilemap
      .physicalRectsAround([bounds.x, bounds.y])
      .some((terrain) => intersects(bounds, terrain));
  }

  private findTerrainCollision(
    bounds: EntityRect,
    direction: CannonDirection
  ): EntityRect | undefined {
    const collisions = this.tilemap
      .physicalRectsAround([bounds.x, bounds.y])
      .filter((terrain) => intersects(bounds, terrain));

    return collisions.sort((first, second) =>
      direction > 0
        ? first.x - second.x
        : second.x + second.width - (first.x + first.width)
    )[0];
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
