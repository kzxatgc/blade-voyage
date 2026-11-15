import { PhysicsEntity } from './PhysicsEntity.ts';
import type { EntityPosition, EntitySize } from '../../shared/types.ts';
import { Animation } from '../utils/Animation.ts';
import type { Tilemap } from '../systems/Tilemap.ts';
import type { Particles } from '../systems/Particles.ts';
import { GRASS_COLORS } from '../../shared/constants.ts';
import { Sparks } from '../systems/Sparks.ts';

export type EnemyName = 'pink_star' | 'crabby' | 'fierce_tooth';
export type EnemyParticleSystem = Pick<Particles, 'addParticle'>;

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
  pink_star: { exclamation: [3, -10, 0], dead: [-33, 28, 0] },
  crabby: { exclamation: [15, 8, -3], dead: [-23, 48, 0] },
  fierce_tooth: { exclamation: [7, -11, 0], dead: [-40, 33, 0] },
};

export const ENEMY_SIGHT_RANGE_X = 6.5 * 32; // 208px (~65% of half-screen)
export const ENEMY_SIGHT_RANGE_Y = 24; // 24px (jump/slope tolerance)
export const ENEMY_BEHIND_TOUCH_DIST = 24; // 24px (turns if bumped into)

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
          20,
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
          15,
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
          15,
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
  setFlipX?(flip: boolean): void;
  setVisible?(visible: boolean): void;
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
  attackTimer = 0;
  attackEffect: Animation | null = null;
  readonly particlePosAdjustment: [[number, number], number];
  readonly attackEffectPosAdjustment: [[number, number], number];
  readonly dialoguePosAdjustment: Record<
    'exclamation' | 'dead',
    [number, number, number]
  >;
  dialogueAnimation: Animation | null = null;
  dialogueType = '';
  dialogueExclamationSfxTriggered = false;
  particles?: EnemyParticleSystem | undefined;
  sparksEffect?: Sparks[] | undefined;
  playSfx?: ((name: string) => void) | undefined;
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
    const attackEffectAnim =
      this.animations?.[`enemy/${this.enemyType}/attack_effect`];
    if (attackEffectAnim) {
      this.attackEffect = attackEffectAnim.copy();
    }
  }

  checkPlayerDetection(
    tilemap: Tilemap,
    playerPos: readonly [number, number]
  ): boolean {
    if (
      this.dead ||
      this.anticipationState ||
      this.attackTimer > 0 ||
      this.knockback
    ) {
      return false;
    }

    const disX = playerPos[0] - this.pos[0];
    const disY = playerPos[1] - this.pos[1];

    if (Math.abs(disY) > ENEMY_SIGHT_RANGE_Y) {
      return false;
    }

    const facingPlayer = (this.flip && disX < 0) || (!this.flip && disX > 0);
    const absDistX = Math.abs(disX);

    // 1. Proximity touch awareness from behind
    if (!facingPlayer && absDistX <= ENEMY_BEHIND_TOUCH_DIST) {
      this.flip = !this.flip;
      this.anticipationState = true;
      this.walking = 0;
      return true;
    }

    // 2. Forward sight range
    if (!facingPlayer || absDistX > ENEMY_SIGHT_RANGE_X) {
      return false;
    }

    // 3. Line-of-sight raycast: check every 16px along the line of sight for solid obstacles
    const enemyEyeY = this.pos[1] + 16;
    const dir = this.flip ? -1 : 1;
    const steps = Math.floor(absDistX / 16);
    const startX = this.rect().x + (this.flip ? 0 : this.rect().width);

    for (let i = 1; i < steps; i++) {
      const checkX = startX + dir * (i * 16);
      if (tilemap.solidCheck([checkX, enemyEyeY])) {
        return false; // Solid wall blocks vision
      }
    }

    this.anticipationState = true;
    this.walking = 0;
    return true;
  }

  override update(
    tilemap: Tilemap,
    movement: EntityPosition = [0, 0],
    playerPos?: readonly [number, number]
  ) {
    if (playerPos) {
      this.checkPlayerDetection(tilemap, playerPos);
    }

    let moveX = movement[0];
    const moveY = movement[1];

    if (
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

        if (
          this.enemyType === 'pink_star' &&
          (this.collision.right || this.collision.left)
        ) {
          this.flip = !this.flip;
          this.velocity[0] = -this.velocity[0];
        }
        this.attackTimer -= 1;
        if (this.attackTimer === 0) {
          if (this.enemyType === 'pink_star') {
            this.attackEffect = null;
          }
          this.velocity[0] = 0;
          this.velocity[1] = 0;
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
    }
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

  render(scene: EnemyRenderScene, offset: readonly [number, number] = [0, 0]) {
    const texture =
      this.animation?.img() ?? `enemy/${this.enemyType}/idle/0`;
    const renderX = this.pos[0] - offset[0];
    const renderY = this.pos[1] - offset[1];
    const flipX = this.dead ? this.flip : !this.flip;

    if (!this.image) {
      this.image = scene.add.image(renderX, renderY, texture);
      this.image.setOrigin(0, 0);
      this.image.setFlipX?.(flipX);
      this.imageTexture = texture;
    } else {
      if (this.imageTexture !== texture) {
        this.image.setTexture(texture);
        this.imageTexture = texture;
      }
      this.image.setPosition(renderX, renderY);
      this.image.setFlipX?.(flipX);
    }

    if (this.dialogueAnimation && this.dialogueType) {
      const dialogueTexture = this.dialogueAnimation.img();
      const dType = this.dialogueType as 'exclamation' | 'dead';
      const adj = this.dialoguePosAdjustment[dType];
      const dialogueX =
        renderX + (this.flip ? this.size[0] + adj[0] : adj[1]);
      const dialogueY = renderY + adj[2];

      if (!this.dialogueImage) {
        this.dialogueImage = scene.add.image(
          dialogueX,
          dialogueY,
          dialogueTexture
        );
        this.dialogueImage.setOrigin(0, 0);
        this.dialogueImage.setFlipX?.(flipX);
        this.dialogueTexture = dialogueTexture;
      } else {
        if (this.dialogueTexture !== dialogueTexture) {
          this.dialogueImage.setTexture(dialogueTexture);
          this.dialogueTexture = dialogueTexture;
        }
        this.dialogueImage.setPosition(dialogueX, dialogueY);
        this.dialogueImage.setFlipX?.(flipX);
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
        this.attackEffectTexture = effectTexture;
      } else {
        if (this.attackEffectTexture !== effectTexture) {
          this.attackEffectImage.setTexture(effectTexture);
          this.attackEffectTexture = effectTexture;
        }
        this.attackEffectImage.setPosition(effectX, effectY);
        this.attackEffectImage.setFlipX?.(flipX);
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

