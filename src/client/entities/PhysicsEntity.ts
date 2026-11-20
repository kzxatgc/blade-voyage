import {
  GRAVITY,
  MAX_FALL_SPEED,
  RECT_POS_ADJUSTMENT,
} from '../../shared/constants.ts';
import { DEBUG_CONFIG } from '../../shared/debug.ts';
import type {
  EntityCollision,
  EntityPosition,
  EntityRect,
  EntitySize,
  EntityType,
} from '../../shared/types';
import { Animation } from '../utils/Animation.ts';
import type { Tilemap } from '../systems/Tilemap';
import type { PlaySfxOptions } from '../systems/Audio';

const createCollisionState = (): EntityCollision => ({
  right: false,
  left: false,
  bottom: false,
  regular: false,
});

const PALM_TREE_PLATFORM_TYPES = [
  'palm_tree/front/left',
  'palm_tree/front/regular',
  'palm_tree/front/right',
] as const;

const KNOCKBACK_HORIZONTAL_SCALE = 2.3;
const KNOCKBACK_DISTANCE_REFERENCE_DURATION = 16;

export class PhysicsEntity {
  readonly type: EntityType;
  readonly pos: EntityPosition;
  readonly size: EntitySize;
  readonly velocity: EntityPosition = [0, 0];
  readonly rectPosAdjustment: EntityPosition;
  readonly animations: Readonly<Record<string, Animation>> | undefined;
  animation: Animation | null = null;
  animationKey: string;
  action = '';
  flip = false;
  deathFlip = false;
  collision = createCollisionState();
  landedOn = { grass: false, palm_tree: false };
  standingOn = { grass: false, palm_tree: false };
  private skipPalmTreePlatformsOnce = false;
  knockback = false;
  knockbackVelocity: EntityPosition = [0, 0];
  knockbackTimer = 0;
  readonly knockbackDuration = 30;
  knockbackSfxTimer = 0;
  readonly knockbackSfxCooldown = 30;
  playSfx?: ((name: string, options?: PlaySfxOptions) => void) | undefined;
  health = 100;
  maxHealth = this.health;
  dead = false;
  wasLiving = true;
  justDied = false;
  deadHitAnimation = false;
  deadHitTimer = 0;
  invincibleTimer = 0;
  readonly invincibleDuration = 75;
  dialogueAnimation: Animation | null = null;
  dialogueType = '';

  constructor(
    type: EntityType,
    pos: EntityPosition,
    size: EntitySize = [20, 28],
    animations?: Readonly<Record<string, Animation>>
  ) {
    this.type = type;
    this.pos = [...pos];
    this.size = [...size];
    this.rectPosAdjustment = [...RECT_POS_ADJUSTMENT[type]];
    this.animations = animations;
    this.animationKey = `${type}/idle`;
    this.health = type === 'player' ? 4 : 100;
    this.maxHealth = this.health;
    this.setAction('idle');
  }

  checkDead() {
    if (this.health <= 0 && !this.dead) {
      this.dead = true;
      this.deathFlip = this.flip;
    }
  }

  takeDamage(amount: number): boolean {
    if (this.dead) {
      return false;
    }
    if (this.type === 'player') {
      if (this.invincibleTimer > 0) {
        return false;
      }
      if (DEBUG_CONFIG.enabled && DEBUG_CONFIG.playerInfiniteHealth) {
        this.invincibleTimer = this.invincibleDuration;
        return true;
      }
      this.health = Math.max(0, this.health - 1);
      this.invincibleTimer = this.invincibleDuration;
      this.checkDead();
      return true;
    }

    this.health = Math.max(0, this.health - amount);
    this.checkDead();
    return true;
  }

  generateDialogue(dialogueType: 'exclamation' | 'dead') {
    if (!this.dialogueAnimation) {
      this.dialogueType = dialogueType;
      this.dialogueAnimation = new Animation(
        `dialogue/${dialogueType}`,
        dialogueType === 'dead' ? 4 : 3,
        12,
        false
      );
    }
  }

  rect(): EntityRect {
    return {
      x: this.pos[0] + this.rectPosAdjustment[0],
      y: this.pos[1] + this.rectPosAdjustment[1],
      width: this.size[0],
      height: this.size[1],
    };
  }

  attackRangeRect(
    flip: boolean,
    sizeExpansion: readonly [number, number],
    posAdjustment: readonly [number, number] = [0, 0]
  ): EntityRect {
    return {
      x:
        this.pos[0] +
        this.rectPosAdjustment[0] +
        posAdjustment[0] -
        (flip ? sizeExpansion[0] : 0),
      y: this.pos[1] + this.rectPosAdjustment[1] + posAdjustment[1],
      width: this.size[0] + sizeExpansion[0],
      height: this.size[0] + sizeExpansion[1],
    };
  }

  dropThroughPlatform(): boolean {
    if (
      this.dead ||
      this.velocity[1] < 0 ||
      !this.collision.bottom ||
      !this.landedOn.palm_tree
    ) {
      return false;
    }

    this.skipPalmTreePlatformsOnce = true;
    this.velocity[1] = Math.max(this.velocity[1], 1);
    return true;
  }

  applyKnockback(
    direction: number,
    power = 1.5,
    verticalPower = 0
  ): void {
    this.knockback = true;
    if (direction !== 0) {
      this.flip = direction > 0;
      if (this.dead) {
        this.deathFlip = this.flip;
      }
    }
    this.knockbackTimer = this.knockbackDuration;
    this.knockbackVelocity[0] =
      direction * power * KNOCKBACK_HORIZONTAL_SCALE;
    this.knockbackVelocity[1] = 0;
    if (verticalPower > 0) {
      this.velocity[1] = Math.min(this.velocity[1], -verticalPower);
    }
    if (this.knockbackSfxTimer <= 0) {
      if (this.health <= 0) {
        this.playSfx?.('player/dead_hit');
      } else {
        this.playSfx?.('player/hit');
      }
      this.knockbackSfxTimer = this.knockbackSfxCooldown;
    }
  }

  setAction(action: string) {
    if (this.action === action) {
      return;
    }

    const animationKey = `${this.type}/${action}`;
    let sourceAnimation = this.animations?.[animationKey];
    if (!sourceAnimation && (action === 'dead_hit' || action === 'dead')) {
      sourceAnimation =
        this.animations?.[`${this.type}/sword/hit`] ??
        this.animations?.[`${this.type}/hit`];
    }
    if (this.animations && !sourceAnimation) {
      throw new Error(`Missing animation "${animationKey}".`);
    }

    this.action = action;
    this.animationKey = animationKey;
    this.animation = sourceAnimation?.copy() ?? null;
  }

  update(
    tilemap: Pick<Tilemap, 'physicalRectsAround' | 'platformsAround'>,
    movement: EntityPosition = [0, 0]
  ) {
    const wasKnockedBack = this.knockback;
    const wasGrounded = this.collision.bottom;
    this.checkDead();
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= 1;
    }

    this.collision = createCollisionState();
    this.landedOn = { grass: false, palm_tree: false };
    this.standingOn = { grass: false, palm_tree: false };

    let knockbackX = 0;
    if (this.knockback) {
      if (this.knockbackSfxTimer > 0) {
        this.knockbackSfxTimer -= 1;
      }
      const duration = this.knockbackDuration;
      const progress = this.knockbackTimer / duration;
      // Preserve the 16-tick travel distance while extending the knockback.
      const distanceCorrection =
        (3 * duration * (KNOCKBACK_DISTANCE_REFERENCE_DURATION + 1)) /
        ((2 * duration + 1) * (duration + 1));
      knockbackX =
        this.knockbackVelocity[0] *
        progress *
        progress *
        distanceCorrection;
      this.knockbackTimer -= 1;
      if (this.knockbackTimer <= 0) {
        this.knockback = false;
        this.knockbackTimer = 0;
        this.knockbackVelocity[0] = 0;
        this.knockbackVelocity[1] = 0;
        this.knockbackSfxTimer = 0;
      }
    }
    const frameMovementX = this.dead
      ? knockbackX
      : movement[0] + this.velocity[0] + knockbackX;
    this.pos[0] += frameMovementX;
    let entityRect = this.rect();

    for (const tileRect of tilemap.physicalRectsAround(this.pos)) {
      const overlapsVertically =
        entityRect.y < tileRect.y + tileRect.height &&
        entityRect.y + entityRect.height > tileRect.y;
      const overlapsHorizontally =
        entityRect.x < tileRect.x + tileRect.width &&
        entityRect.x + entityRect.width > tileRect.x;

      if (!overlapsVertically || !overlapsHorizontally) {
        continue;
      }

      if (frameMovementX > 0) {
        entityRect = {
          ...entityRect,
          x: tileRect.x - entityRect.width,
        };
        this.collision.right = true;
      } else if (frameMovementX < 0) {
        entityRect = {
          ...entityRect,
          x: tileRect.x + tileRect.width,
        };
        this.collision.left = true;
      }

      this.pos[0] = entityRect.x - this.rectPosAdjustment[0];
    }

    if (!this.dead) {
      if (this.knockback) {
        // During knockback: face toward the attacker (opposite to push direction)
        // knockbackVelocity[0] > 0 means pushed right → attacker is on the left → face left (flip=true)
        // knockbackVelocity[0] < 0 means pushed left → attacker is on the right → face right (flip=false)
        if (this.knockbackVelocity[0] !== 0) {
          this.flip = this.knockbackVelocity[0] > 0;
        }
      } else if (!wasKnockedBack) {
        if (frameMovementX < 0) {
          this.flip = true;
        } else if (frameMovementX > 0) {
          this.flip = false;
        }
      }
    }

    const frameMovementY = this.dead
      ? this.velocity[1]
      : movement[1] + this.velocity[1];
    this.pos[1] += frameMovementY;
    entityRect = this.rect();

    for (const tileRect of tilemap.physicalRectsAround(this.pos)) {
      const overlapsHorizontally =
        entityRect.x < tileRect.x + tileRect.width &&
        entityRect.x + entityRect.width > tileRect.x;

      if (!overlapsHorizontally) {
        continue;
      }

      if (frameMovementY >= 0) {
        const isDescendingIntoTile =
          frameMovementY > 0 &&
          entityRect.y < tileRect.y + tileRect.height &&
          entityRect.y + entityRect.height > tileRect.y;
        const isRestingOnTile =
          frameMovementY === 0 &&
          wasGrounded &&
          entityRect.y < tileRect.y + tileRect.height &&
          Math.abs(entityRect.y + entityRect.height - tileRect.y) < 1;

        if (isDescendingIntoTile || isRestingOnTile) {
          entityRect = {
            ...entityRect,
            y: tileRect.y - entityRect.height,
          };
          this.collision.bottom = true;
          this.landedOn.grass = true;
          this.standingOn.grass = true;
          this.pos[1] = entityRect.y - this.rectPosAdjustment[1];
        }
      } else if (frameMovementY < 0) {
        const intersectsCeiling =
          entityRect.y < tileRect.y + tileRect.height &&
          entityRect.y + entityRect.height > tileRect.y;

        if (intersectsCeiling) {
          entityRect = {
            ...entityRect,
            y: tileRect.y + tileRect.height,
          };
          this.collision.regular = true;
          this.pos[1] = entityRect.y - this.rectPosAdjustment[1];
        }
      }
    }

    const skipPalmTreePlatforms = this.skipPalmTreePlatformsOnce;
    this.skipPalmTreePlatformsOnce = false;
    if (frameMovementY >= 0 && !skipPalmTreePlatforms) {
      for (const platformType of PALM_TREE_PLATFORM_TYPES) {
        for (const platform of tilemap.platformsAround(this.pos, platformType)) {
          const overlapsHorizontally =
            entityRect.x < platform.x + platform.width &&
            entityRect.x + entityRect.width > platform.x;

          if (!overlapsHorizontally) {
            continue;
          }

          const isDescending =
            frameMovementY > 0 &&
            entityRect.y < platform.y + platform.height &&
            entityRect.y + entityRect.height > platform.y &&
            entityRect.y + entityRect.height - frameMovementY <= platform.y;
          const isResting =
            frameMovementY === 0 &&
            wasGrounded &&
            entityRect.y < platform.y + platform.height &&
            Math.abs(entityRect.y + entityRect.height - platform.y) < 1;

          if (!isDescending && !isResting) {
            continue;
          }

          entityRect = {
            ...entityRect,
            y: platform.y - entityRect.height,
          };
          this.collision.bottom = true;
          this.landedOn.palm_tree = true;
          this.standingOn.palm_tree = true;
          this.pos[1] = entityRect.y - this.rectPosAdjustment[1];
        }
      }
    }

    this.velocity[1] = Math.min(this.velocity[1] + GRAVITY, MAX_FALL_SPEED);
    if (this.collision.bottom && this.velocity[1] > 0) {
      this.velocity[1] = 0;
    }

    this.checkDead();
    this.justDied = this.wasLiving && this.dead;

    if (this.dead) {
      if (this.justDied) {
        this.deadHitAnimation = true;
        this.dialogueAnimation = null;
        this.generateDialogue('dead');
      }
      if (this.deadHitAnimation) {
        this.setAction('dead_hit');
        this.deadHitTimer += 1;
        if (this.deadHitTimer >= 30) {
          this.deadHitAnimation = false;
        }
      } else {
        this.setAction('dead');
      }
      if (this.dialogueAnimation) {
        this.dialogueAnimation.update();
        if (this.dialogueAnimation.done) {
          this.dialogueAnimation = null;
        }
      }
      this.animation?.update();
    }

    this.wasLiving = !this.dead;
  }
}
