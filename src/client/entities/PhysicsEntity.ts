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
import type { Animation } from '../utils/Animation';
import type { Tilemap } from '../systems/Tilemap';

const createCollisionState = (): EntityCollision => ({
  right: false,
  left: false,
  bottom: false,
  regular: false,
});

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
    this.setAction('idle');
  }

  rect(): EntityRect {
    return {
      x: this.pos[0] + this.rectPosAdjustment[0],
      y: this.pos[1] + this.rectPosAdjustment[1],
      width: this.size[0],
      height: this.size[1],
    };
  }

  setAction(action: string) {
    if (this.action === action) {
      return;
    }

    const animationKey = `${this.type}/${action}`;
    const sourceAnimation = this.animations?.[animationKey];
    if (this.animations && !sourceAnimation) {
      throw new Error(`Missing animation "${animationKey}".`);
    }

    this.action = action;
    this.animationKey = animationKey;
    this.animation = sourceAnimation?.copy() ?? null;
  }

  update(
    tilemap: Pick<Tilemap, 'physicalRectsAround'>,
    movement: EntityPosition = [0, 0]
  ) {
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

    if (frameMovementX < 0) {
      this.flip = true;
    } else if (frameMovementX > 0) {
      this.flip = false;
    }

    const frameMovementY = this.dead ? 0 : movement[1] + this.velocity[1];
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

    this.velocity[1] = Math.min(this.velocity[1] + GRAVITY, MAX_FALL_SPEED);
  }
}
