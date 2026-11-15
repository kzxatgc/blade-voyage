import {
  GRAVITY,
  MAX_FALL_SPEED,
  RECT_POS_ADJUSTMENT,
} from '../../shared/constants.ts';
import type {
  EntityCollision,
  EntityPosition,
  EntityRect,
  EntitySize,
  EntityType,
} from '../../shared/types';
import { Animation } from '../utils/Animation.ts';
import type { Tilemap } from '../systems/Tilemap';

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
  collision = createCollisionState();
  landedOn = { grass: false, palm_tree: false };
  private skipPalmTreePlatformsOnce = false;
  knockback = false;
  knockbackVelocity: EntityPosition = [0, 0];
  knockbackTimer = 0;
  readonly knockbackDuration = 30;
  knockbackSfxTimer = 0;
  readonly knockbackSfxCooldown = 30;
  health = 100;
  maxHealth = this.health;
  dead = false;
  wasLiving = true;
  justDied = false;
  deadHitAnimation = false;
  deadHitTimer = 0;
  invincibleTimer = 0;
  readonly invincibleDuration = 90;
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
    this.health = type === 'player' ? 3 : 100;
    this.maxHealth = this.health;
    this.setAction('idle');
  }

  checkDead() {
    if (this.health <= 0) {
      this.dead = true;
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
    this.checkDead();
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= 1;
    }

    this.collision = createCollisionState();
    this.landedOn = { grass: false, palm_tree: false };

    const frameMovementX = this.dead ? 0 : movement[0] + this.velocity[0];
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
      if (frameMovementX < 0) {
        this.flip = true;
      } else if (frameMovementX > 0) {
        this.flip = false;
      }
    }

    const frameMovementY = this.dead
      ? this.velocity[1]
      : movement[1] + this.velocity[1];
    this.pos[1] += frameMovementY;
    entityRect = this.rect();

    for (const tileRect of tilemap.physicalRectsAround(this.pos)) {
      const intersects =
        entityRect.x < tileRect.x + tileRect.width &&
        entityRect.x + entityRect.width > tileRect.x &&
        entityRect.y < tileRect.y + tileRect.height &&
        entityRect.y + entityRect.height > tileRect.y;

      if (!intersects) {
        continue;
      }

      if (frameMovementY > 0) {
        entityRect = {
          ...entityRect,
          y: tileRect.y - entityRect.height,
        };
        this.collision.bottom = true;
        this.landedOn.grass = true;
      } else if (frameMovementY < 0) {
        entityRect = {
          ...entityRect,
          y: tileRect.y + tileRect.height,
        };
        this.collision.regular = true;
      }

      this.pos[1] = entityRect.y - this.rectPosAdjustment[1];
    }

    const skipPalmTreePlatforms = this.skipPalmTreePlatformsOnce;
    this.skipPalmTreePlatformsOnce = false;
    if (frameMovementY > 0 && !skipPalmTreePlatforms) {
      for (const platformType of PALM_TREE_PLATFORM_TYPES) {
        for (const platform of tilemap.platformsAround(this.pos, platformType)) {
          const intersects =
            entityRect.x < platform.x + platform.width &&
            entityRect.x + entityRect.width > platform.x &&
            entityRect.y < platform.y + platform.height &&
            entityRect.y + entityRect.height > platform.y;
          const previousBottom =
            entityRect.y + entityRect.height - frameMovementY;

          if (!intersects || previousBottom > platform.y) {
            continue;
          }

          entityRect = {
            ...entityRect,
            y: platform.y - entityRect.height,
          };
          this.collision.bottom = true;
          this.landedOn.palm_tree = true;
          this.pos[1] = entityRect.y - this.rectPosAdjustment[1];
        }
      }
    }

    this.velocity[1] = Math.min(this.velocity[1] + GRAVITY, MAX_FALL_SPEED);

    this.checkDead();
    this.justDied = this.wasLiving && this.dead;

    if (this.dead) {
      if (this.justDied) {
        this.deadHitAnimation = true;
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
