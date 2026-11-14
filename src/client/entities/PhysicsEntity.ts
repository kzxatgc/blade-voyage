import { RECT_POS_ADJUSTMENT } from '../../shared/constants.ts';
import type {
  EntityCollision,
  EntityPosition,
  EntityRect,
  EntitySize,
  EntityType,
} from '../../shared/types';
import type { Animation } from '../utils/Animation';

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
}
