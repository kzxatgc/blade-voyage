import { PhysicsEntity } from './PhysicsEntity.ts';
import type { EntityPosition, EntityRect, EntitySize } from '../../shared/types.ts';
import { Animation } from '../utils/Animation.ts';
import type { Tilemap } from '../systems/Tilemap.ts';
import type { Particles } from '../systems/Particles.ts';
import { GRASS_COLORS, RECT_POS_ADJUSTMENT, RENDER_DEPTH } from '../../shared/constants.ts';
import { Sparks } from '../systems/Sparks.ts';

export type EnemyName = 'pink_star' | 'crabby' | 'fierce_tooth';
export type EnemyParticleSystem = Pick<Particles, 'addParticle'>;

export interface EnemyPlayerTarget {
  pos: EntityPosition;
  rect(): EntityRect;
}

export const PARTICLE_POS_ADJUSTMENT: Record<
  EnemyName,
  [[number, number], number]
> = {
  pink_star: [[-3, -15], 10],
  crabby: [[21, -2], 9],
  fierce_tooth: [[0, -17], 8],
};

export const ATTACK_EFFECT_POS_ADJUSTMENT: Record<
  EnemyName,
  [[number, number], number]
> = {
  pink_star: [[8, 8], 10],
  crabby: [[-22, -22], 10],
  fierce_tooth: [[-20, 32], 5],
};

export const DIALOGUE_POS_ADJUSTMENT: Record<
  EnemyName,
  Record<'exclamation' | 'dead', [number, number, number]>
> = {
  pink_star: { exclamation: [3, -10, 0], dead: [-41, 34, 0] },
  crabby: { exclamation: [15, 8, -3], dead: [-24, 50, 0] },
  fierce_tooth: { exclamation: [7, -11, 0], dead: [-36, 31, 0] },
};

export const ENEMY_SIGHT_RANGE_X: Record<EnemyName, number> = {
  pink_star: 4.5 * 32, // 144px (4.5 tiles - long range charge attack)
  crabby: 2.5 * 32, // 80px (2.5 tiles - reduced by 1 tile for close melee)
  fierce_tooth: 2.5 * 32, // 80px (2.5 tiles - reduced by 1 tile for close melee)
};
export const ENEMY_SIGHT_RANGE_Y = 24; // 24px (jump/slope tolerance)
export const ENEMY_BEHIND_TOUCH_DIST: Record<EnemyName, number> = {
  pink_star: 36, // 36px (tuned rear awareness)
  crabby: 48, // 48px (1.5 tiles, perfectly symmetrical behind range in both directions)
  fierce_tooth: 48, // 48px (1.5 tiles, perfectly symmetrical behind range in both directions)
};
export const ENEMY_POST_ATTACK_COOLDOWN = 90; // 90 frames = 1.5s post-attack recovery window

export function createDefaultEnemyAnimations(
  enemyType: EnemyName
): Record<string, Animation> {
  switch (enemyType) {
    case 'pink_star':
      return {
        'enemy/pink_star/idle': new Animation('enemy/pink_star/idle', 8, 6),
        'enemy/pink_star/run': new Animation('enemy/pink_star/run', 6, 6),
        'enemy/pink_star/anticipation': new Animation(
          'enemy/pink_star/anticipation',
          3,
          12,
          false
        ),
        'enemy/pink_star/attack': new Animation('enemy/pink_star/attack', 4, 6),
        'enemy/pink_star/hit': new Animation('enemy/pink_star/hit', 4, 4),
        'enemy/pink_star/dead_hit': new Animation(
          'enemy/pink_star/dead_hit',
          4,
          4
        ),
        'enemy/pink_star/dead': new Animation(
          'enemy/pink_star/dead',
          4,
          20,
          false
        ),
        'enemy/pink_star/attack_effect': new Animation(
          'enemy/pink_star/attack_effect',
          4,
          6
        ),
      };
    case 'crabby':
      return {
        'enemy/crabby/idle': new Animation('enemy/crabby/idle', 9, 6),
        'enemy/crabby/run': new Animation('enemy/crabby/run', 6, 6),
        'enemy/crabby/anticipation': new Animation(
          'enemy/crabby/anticipation',
          3,
          12,
          false
        ),
        'enemy/crabby/attack': new Animation('enemy/crabby/attack', 4, 6),
        'enemy/crabby/hit': new Animation('enemy/crabby/hit', 4, 4),
        'enemy/crabby/dead_hit': new Animation('enemy/crabby/dead_hit', 4, 4),
        'enemy/crabby/dead': new Animation('enemy/crabby/dead', 4, 20, false),
        'enemy/crabby/attack_effect': new Animation(
          'enemy/crabby/attack_effect',
          3,
          6,
          false
        ),
      };
    case 'fierce_tooth':
      return {
        'enemy/fierce_tooth/idle': new Animation(
          'enemy/fierce_tooth/idle',
          8,
          6
        ),
        'enemy/fierce_tooth/run': new Animation('enemy/fierce_tooth/run', 6, 6),
        'enemy/fierce_tooth/anticipation': new Animation(
          'enemy/fierce_tooth/anticipation',
          3,
          12,
          false
        ),
        'enemy/fierce_tooth/attack': new Animation(
          'enemy/fierce_tooth/attack',
          5,
          6
        ),
        'enemy/fierce_tooth/hit': new Animation(
          'enemy/fierce_tooth/hit',
          4,
          4
        ),
        'enemy/fierce_tooth/dead_hit': new Animation(
          'enemy/fierce_tooth/dead_hit',
          4,
          4
        ),
        'enemy/fierce_tooth/dead': new Animation(
          'enemy/fierce_tooth/dead',
          4,
          20,
          false
        ),
        'enemy/fierce_tooth/attack_effect': new Animation(
          'enemy/fierce_tooth/attack_effect',
          3,
          6,
          false
        ),
      };
  }
}

export interface EnemyRenderImage {
  setOrigin(x: number, y: number): void;
  setPosition(x: number, y: number): void;
  setTexture(texture: string): void;
  setTint?(tint: number): void;
  clearTint?(): void;
  setFlipX?(flip: boolean): void;
  setVisible?(visible: boolean): void;
  setDepth?(depth: number): void;
  destroy(): void;
}

export interface EnemyRenderScene {
  add: {
    image(x: number, y: number, texture: string): EnemyRenderImage;
  };
}

export class Enemy extends PhysicsEntity {
  readonly enemyType: EnemyName;
  walking = 0;
  anticipationState = false;
  /** True when advancing toward the player before reaching melee attack range. */
  chaseState = false;
  attackTimer = 0;
  attackCooldown = 0;
  attackEffect: Animation | null = null;
  /** True after this attack swing has already dealt damage to the player (reset each swing). */
  attackHasHitPlayer = false;
  readonly particlePosAdjustment: [[number, number], number];
  readonly attackEffectPosAdjustment: [[number, number], number];
  readonly dialoguePosAdjustment: Record<
    'exclamation' | 'dead',
    [number, number, number]
  >;
  dialogueExclamationSfxTriggered = false;
  attackHitDetected = false;
  contactCollisionDetected = false;
  particles?: EnemyParticleSystem | undefined;
  sparksEffect?: Sparks[] | undefined;
  random: () => number = Math.random;
  private image: EnemyRenderImage | null = null;
  private imageTexture: string | null = null;
  private dialogueImage: EnemyRenderImage | null = null;
  private dialogueTexture: string | null = null;
  private attackEffectImage: EnemyRenderImage | null = null;
  private attackEffectTexture: string | null = null;

  constructor(
    enemyType: EnemyName,
    pos: EntityPosition,
    size: EntitySize,
    animations?: Readonly<Record<string, Animation>>,
    particles?: EnemyParticleSystem,
    sparksEffect?: Sparks[]
  ) {
    super(
      `enemy/${enemyType}`,
      pos,
      size,
      animations ?? createDefaultEnemyAnimations(enemyType)
    );
    this.enemyType = enemyType;
    this.particlePosAdjustment = PARTICLE_POS_ADJUSTMENT[enemyType];
    this.attackEffectPosAdjustment = ATTACK_EFFECT_POS_ADJUSTMENT[enemyType];
    this.dialoguePosAdjustment = DIALOGUE_POS_ADJUSTMENT[enemyType];
    this.particles = particles;
    this.sparksEffect = sparksEffect;
  }

  attack() {
    if (this.enemyType === 'pink_star') {
      this.attackTimer = 120;
      this.velocity[0] = this.flip ? -2 : 2;
      if (this.sparksEffect) {
        for (const color of GRASS_COLORS) {
          this.sparksEffect.push(
            new Sparks(
              [
                this.pos[0] + (this.flip ? 0 : this.size[0]),
                this.pos[1] + this.size[1],
              ],
              !this.flip,
              4,
              8,
              color,
              this.flip ? -0.2 : -0.6,
              'diamond'
            )
          );
        }
      }
    }
    if (this.enemyType === 'crabby') {
      this.attackTimer = 24;
    }
    if (this.enemyType === 'fierce_tooth') {
      this.attackTimer = 30;
    }
    const attackEffectAnim =
      this.animations?.[`enemy/${this.enemyType}/attack_effect`];
    if (attackEffectAnim) {
      this.attackEffect = attackEffectAnim.copy();
    }
  }

  /** Cancel an in-progress attack (clears effect particle + timer). */
  clearAttack() {
    this.attackEffect = null;
    this.attackTimer = 0;
    this.attackHasHitPlayer = false;
    this.chaseState = false;
    this.velocity[0] = 0;
    this.velocity[1] = 0;
  }

  override applyKnockback(direction: number, power = 2.3) {
    super.applyKnockback(direction, power);
    this.anticipationState = false;
    this.chaseState = false;
    this.dialogueExclamationSfxTriggered = false;

    if (this.dialogueType === 'exclamation') {
      this.dialogueAnimation = null;
      this.dialogueType = '';
      this.dialogueImage?.destroy();
      this.dialogueImage = null;
      this.dialogueTexture = null;
    }
  }

  checkPlayerDetection(
    tilemap: Tilemap,
    playerPos: readonly [number, number],
    playerTarget?: EnemyPlayerTarget
  ): boolean {
    if (
      this.dead ||
      this.anticipationState ||
      this.attackTimer > 0 ||
      this.attackCooldown > 0 ||
      this.knockback
    ) {
      return false;
    }

    const bodyRect = this.rect();
    const disY = playerPos[1] - this.pos[1];

    if (Math.abs(disY) > ENEMY_SIGHT_RANGE_Y) {
      this.chaseState = false;
      return false;
    }

    let disX = playerPos[0] - this.pos[0];
    let bodyCenterOffset = 0;
    if (playerTarget) {
      const pRect = playerTarget.rect();
      const pCenter = pRect.x + pRect.width / 2;
      const eCenter = bodyRect.x + bodyRect.width / 2;
      disX = pCenter - eCenter;
      bodyCenterOffset = bodyRect.width / 2;
    }

    const facingPlayer = (this.flip && disX < 0) || (!this.flip && disX > 0);
    const absDistX = Math.abs(disX);

    // 1. Proximity touch awareness from behind
    const behindDist = ENEMY_BEHIND_TOUCH_DIST[this.enemyType];
    if (!facingPlayer && absDistX <= behindDist + bodyCenterOffset) {
      this.flip = !this.flip;
      if (
        this.enemyType === 'pink_star' ||
        this.isPlayerInMeleeRange(playerPos, playerTarget)
      ) {
        this.anticipationState = true;
        this.chaseState = false;
        this.walking = 0;
      } else {
        this.chaseState = true;
        this.walking = 0;
      }
      return true;
    }

    // 2. Forward sight range
    const sightRangeX = ENEMY_SIGHT_RANGE_X[this.enemyType];
    if (!facingPlayer || absDistX > sightRangeX + bodyCenterOffset) {
      this.chaseState = false;
      return false;
    }

    // 3. Line-of-sight raycast: check every 16px along the line of sight for solid obstacles
    const enemyEyeY = this.pos[1] + 16;
    const dir = this.flip ? -1 : 1;
    const steps = Math.floor(absDistX / 16);
    const startX = bodyRect.x + (this.flip ? 0 : bodyRect.width);

    for (let i = 1; i < steps; i++) {
      const checkX = startX + dir * (i * 16);
      if (tilemap.solidCheck([checkX, enemyEyeY])) {
        this.chaseState = false;
        return false; // Solid wall blocks vision
      }
    }

    if (
      this.enemyType === 'pink_star' ||
      this.isPlayerInMeleeRange(playerPos, playerTarget)
    ) {
      this.anticipationState = true;
      this.chaseState = false;
      this.walking = 0;
    } else {
      this.chaseState = true;
      this.walking = 0;
    }
    return true;
  }

  rectIntersects(a: EntityRect, b: EntityRect): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  getDetectionRect(): EntityRect {
    const forward = ENEMY_SIGHT_RANGE_X[this.enemyType];
    const behind = ENEMY_BEHIND_TOUCH_DIST[this.enemyType];
    const bodyRect = this.rect();
    const x = this.flip ? bodyRect.x - forward : bodyRect.x - behind;
    const width = forward + bodyRect.width + behind;
    const y = bodyRect.y - ENEMY_SIGHT_RANGE_Y;
    const height = bodyRect.height + ENEMY_SIGHT_RANGE_Y * 2;
    return { x, y, width, height };
  }

  getMeleeAttackRangeRect(): EntityRect | null {
    if (this.enemyType === 'crabby') {
      const bodyRect = this.rect();
      return {
        x: bodyRect.x - 25,
        y: bodyRect.y,
        width: bodyRect.width + 50,
        height: bodyRect.height,
      };
    }
    if (this.enemyType === 'fierce_tooth') {
      return this.attackRangeRect(this.flip, [31, 0]);
    }
    return null;
  }

  isPlayerInMeleeRange(
    playerPos: readonly [number, number],
    playerTarget?: EnemyPlayerTarget
  ): boolean {
    if (this.enemyType === 'pink_star') {
      return true;
    }
    const rangeRect = this.getMeleeAttackRangeRect();
    if (!rangeRect) {
      return true;
    }
    if (playerTarget) {
      return this.rectIntersects(rangeRect, playerTarget.rect());
    }
    const targetRect: EntityRect = {
      x: playerPos[0] + RECT_POS_ADJUSTMENT.player[0],
      y: playerPos[1] + RECT_POS_ADJUSTMENT.player[1],
      width: 20,
      height: 28,
    };
    if (this.rectIntersects(rangeRect, targetRect)) {
      return true;
    }
    // Also check unadjusted fallback for raw coordinate tests without player entity
    const rawRect: EntityRect = {
      x: playerPos[0],
      y: playerPos[1],
      width: 20,
      height: 28,
    };
    return this.rectIntersects(rangeRect, rawRect);
  }

  override update(
    tilemap: Tilemap,
    movement: EntityPosition = [0, 0],
    player?: EnemyPlayerTarget | readonly [number, number]
  ) {
    this.attackHitDetected = false;
    this.contactCollisionDetected = false;

    if (this.attackCooldown > 0) {
      this.attackCooldown -= 1;
    }

    let playerPos: readonly [number, number] | undefined;
    let playerTarget: EnemyPlayerTarget | undefined;

    if (player) {
      if ('pos' in player) {
        playerPos = player.pos;
        playerTarget = player;
      } else {
        playerPos = player;
      }
    }

    if (playerPos) {
      this.checkPlayerDetection(tilemap, playerPos, playerTarget);
    }

    let moveX = movement[0];
    const moveY = movement[1];

    if (
      this.chaseState &&
      !this.anticipationState &&
      !this.attackTimer &&
      !this.knockback &&
      !this.dead &&
      playerPos
    ) {
      const enemyCenterX = this.rect().x + this.rect().width / 2;
      const playerCenterX = playerTarget
        ? playerTarget.rect().x + playerTarget.rect().width / 2
        : playerPos[0] + RECT_POS_ADJUSTMENT.player[0] + 10;
      this.flip = playerCenterX < enemyCenterX;

      const rect = this.rect();
      const centerX = rect.x + rect.width / 2;
      const checkX = centerX + (this.flip ? -14 : 14);
      const checkY = this.pos[1] + 30;
      const hasFloor = tilemap.solidCheck([checkX, checkY]);
      const hitWall =
        (this.flip && this.collision.left) || (!this.flip && this.collision.right);

      if (hasFloor && !hitWall) {
        moveX = moveX + (this.flip ? -0.8 : 0.8);
      } else {
        moveX = 0;
      }
    } else if (
      this.walking > 0 &&
      !this.anticipationState &&
      !this.attackTimer &&
      !this.knockback &&
      !this.dead
    ) {
      const rect = this.rect();
      const centerX = rect.x + rect.width / 2;
      const checkX = centerX + (this.flip ? -14 : 14);
      const checkY = this.pos[1] + 30;

      if (tilemap.solidCheck([checkX, checkY])) {
        if (this.collision.right || this.collision.left) {
          this.flip = !this.flip;
        } else {
          if (this.random() < 0.005) {
            this.flip = !this.flip;
          }
          moveX = moveX + (this.flip ? -0.5 : 0.5);
        }
      } else {
        this.flip = !this.flip;
      }

      this.walking = Math.max(0, this.walking - 1);
    } else if (
      !this.dead &&
      !this.anticipationState &&
      !this.attackTimer &&
      this.random() < 0.01
    ) {
      this.walking = Math.floor(this.random() * (120 - 30 + 1)) + 30;
    }

    super.update(tilemap, [moveX, moveY]);

    if (!this.dead) {
      this.animation?.update();

      if (this.knockback) {
        this.setAction('hit');
        this.walking = 0;
      } else if (this.attackTimer > 0) {
        this.setAction('attack');
        this.attackEffect?.update();

        if (this.enemyType === 'crabby') {
          if (this.attackTimer >= 12 && playerTarget) {
            const rangeRect = this.getMeleeAttackRangeRect()!;
            if (this.rectIntersects(rangeRect, playerTarget.rect())) {
              this.attackHitDetected = true;
            }
          }
          if (this.attackEffect?.done) {
            this.attackEffect = null;
          }
        }

        if (this.enemyType === 'fierce_tooth') {
          if (this.attackTimer >= 15 && playerTarget) {
            const rangeRect = this.getMeleeAttackRangeRect()!;
            if (this.rectIntersects(rangeRect, playerTarget.rect())) {
              this.attackHitDetected = true;
            }
          }
          if (this.attackEffect?.done) {
            this.attackEffect = null;
          }
        }

        if (this.enemyType === 'pink_star') {
          if (playerTarget && this.rectIntersects(this.rect(), playerTarget.rect())) {
            this.attackHitDetected = true;
          }
          if (this.collision.right || this.collision.left) {
            this.flip = !this.flip;
            this.velocity[0] = -this.velocity[0];
          }
        }
        this.attackTimer -= 1;
        if (this.attackTimer === 0) {
          if (this.enemyType === 'pink_star') {
            this.attackEffect = null;
          }
          this.velocity[0] = 0;
          this.velocity[1] = 0;
          this.attackHasHitPlayer = false;
          this.attackCooldown = ENEMY_POST_ATTACK_COOLDOWN;
        }
      } else if (this.anticipationState) {
        this.setAction('anticipation');
        this.generateDialogue('exclamation');
        if (
          !this.dialogueExclamationSfxTriggered &&
          this.dialogueAnimation &&
          Math.floor(
            this.dialogueAnimation.frame / this.dialogueAnimation.imgDur
          ) === 1
        ) {
          this.dialogueExclamationSfxTriggered = true;
          this.playSfx?.('dialogue/exclamation');
        }
        this.dialogueAnimation?.update();
        if (this.animation?.done) {
          this.anticipationState = false;
          this.dialogueAnimation = null;
          this.dialogueExclamationSfxTriggered = false;
          this.attack();
        }
      } else if (moveX !== 0) {
        this.setAction('run');
        this.particles?.addParticle(
          'enemy/run_dust',
          [
            this.pos[0] +
              (this.flip
                ? this.particlePosAdjustment[0][0]
                : this.particlePosAdjustment[0][1]),
            this.pos[1] + this.particlePosAdjustment[1],
          ],
          this.flip
        );
      } else {
        this.setAction('idle');
      }

      if (playerTarget && this.rectIntersects(this.rect(), playerTarget.rect())) {
        this.contactCollisionDetected = true;
      }
    }
  }

  render(scene: EnemyRenderScene, offset: readonly [number, number] = [0, 0]) {
    const texture =
      this.animation?.img() ?? `enemy/${this.enemyType}/idle/0`;
    const renderX = this.pos[0] - offset[0];
    const renderY = this.pos[1] - offset[1];
    const flipX = this.dead ? !this.deathFlip : !this.flip;

    if (!this.image) {
      this.image = scene.add.image(renderX, renderY, texture);
      this.image.setOrigin(0, 0);
      this.image.setFlipX?.(flipX);
      this.image.setDepth?.(RENDER_DEPTH.ENTITIES);
      this.imageTexture = texture;
    } else {
      if (this.imageTexture !== texture) {
        this.image.setTexture(texture);
        this.imageTexture = texture;
      }
      this.image.setPosition(renderX, renderY);
      this.image.setFlipX?.(flipX);
      this.image.setDepth?.(RENDER_DEPTH.ENTITIES);
    }

    // Hit flash: white on the first frame of invincibility, then blink every 4 frames
    if (this.invincibleTimer > 0) {
      const t = this.invincibleTimer;
      const isWhiteFrame = t > this.invincibleDuration - 2 || t % 8 < 4;
      if (isWhiteFrame) {
        this.image.setTint?.(0xffffff);
      } else {
        this.image.clearTint?.();
      }
    } else {
      this.image.clearTint?.();
    }

    if (this.dialogueAnimation && this.dialogueType) {
      const dialogueTexture = this.dialogueAnimation.img();
      const dType = this.dialogueType as 'exclamation' | 'dead';
      const adj = this.dialoguePosAdjustment[dType];
      const dialogueFacing = this.dead ? !this.deathFlip : this.flip;
      const dialogueX =
        renderX +
        (dialogueFacing ? this.size[0] + adj[0] : adj[1]);
      const dialogueY = renderY + adj[2];

      if (!this.dialogueImage) {
        this.dialogueImage = scene.add.image(
          dialogueX,
          dialogueY,
          dialogueTexture
        );
        this.dialogueImage.setOrigin(0, 0);
        this.dialogueImage.setFlipX?.(dType === 'dead' ? false : flipX);
        this.dialogueImage.setDepth?.(RENDER_DEPTH.EFFECTS);
        this.dialogueTexture = dialogueTexture;
      } else {
        if (this.dialogueTexture !== dialogueTexture) {
          this.dialogueImage.setTexture(dialogueTexture);
          this.dialogueTexture = dialogueTexture;
        }
        this.dialogueImage.setPosition(dialogueX, dialogueY);
        this.dialogueImage.setFlipX?.(dType === 'dead' ? false : flipX);
        this.dialogueImage.setDepth?.(RENDER_DEPTH.EFFECTS);
        this.dialogueImage.setVisible?.(true);
      }
    } else if (this.dialogueImage) {
      this.dialogueImage.destroy();
      this.dialogueImage = null;
      this.dialogueTexture = null;
    }

    if (this.attackEffect) {
      const effectTexture = this.attackEffect.img();
      const effectAdj = this.attackEffectPosAdjustment;
      const effectX =
        renderX + (this.flip ? effectAdj[0][0] : effectAdj[0][1]);
      const effectY = renderY + effectAdj[1];

      if (!this.attackEffectImage) {
        this.attackEffectImage = scene.add.image(
          effectX,
          effectY,
          effectTexture
        );
        this.attackEffectImage.setOrigin(0, 0);
        this.attackEffectImage.setFlipX?.(flipX);
        this.attackEffectImage.setDepth?.(RENDER_DEPTH.EFFECTS);
        this.attackEffectTexture = effectTexture;
      } else {
        if (this.attackEffectTexture !== effectTexture) {
          this.attackEffectImage.setTexture(effectTexture);
          this.attackEffectTexture = effectTexture;
        }
        this.attackEffectImage.setPosition(effectX, effectY);
        this.attackEffectImage.setFlipX?.(flipX);
        this.attackEffectImage.setDepth?.(RENDER_DEPTH.EFFECTS);
        this.attackEffectImage.setVisible?.(true);
      }
    } else if (this.attackEffectImage) {
      this.attackEffectImage.destroy();
      this.attackEffectImage = null;
      this.attackEffectTexture = null;
    }
  }

  destroy() {
    this.image?.destroy();
    this.image = null;
    this.imageTexture = null;
    this.dialogueImage?.destroy();
    this.dialogueImage = null;
    this.dialogueTexture = null;
    this.attackEffectImage?.destroy();
    this.attackEffectImage = null;
    this.attackEffectTexture = null;
  }
}

