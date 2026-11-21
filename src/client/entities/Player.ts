import { PhysicsEntity } from './PhysicsEntity.ts';
import type { EntityPosition, EntityRect } from '../../shared/types.ts';
import { FIERY_BURST_COLORS } from '../../shared/constants.ts';
import { Attack } from '../systems/Attack.ts';
import type { Particles } from '../systems/Particles.ts';
import { Sparks } from '../systems/Sparks.ts';
import type { Tilemap } from '../systems/Tilemap.ts';
import { Animation } from '../utils/Animation.ts';

export interface PickupSwordTarget {
  readonly pos: EntityPosition;
  rect?(): EntityRect;
  destroy?(): void;
}

export interface PlayerSwordsSystem {
  throwSword(pos: EntityPosition, flip: boolean): unknown;
}

export type PlayerParticleSystem = Pick<Particles, 'addParticle'> & {
  spawnCooldown?: Record<string, number | null> | undefined;
  sfxFlags?: Record<string, boolean> | undefined;
};

const QUESTION_MARK_HEAD_OVERLAP = 4;
const QUESTION_MARK_FACING_RIGHT_OFFSET = 3;

export class Player extends PhysicsEntity {
  jumps = 2;
  airTime = 0;
  swordState = false;
  pendingThrow = false;
  throwingFrameTriggered = false;
  preRunBoost = 0;
  throwingAnimation: Animation | null = null;
  questionMarkAnimation: Animation | null = null;
  private questionMarkPendingUntilLanding = false;
  swordsSystem: PlayerSwordsSystem | undefined;
  sparksEffect: Sparks[] | undefined;
  lastKey: string | null = null;
  lastPressTime = 0;
  runBoost = 0;
  wasInAir = false;
  justLanded = false;
  landingAnimation: Animation | null = null;
  readonly attackHandler = new Attack(this);
  private readonly particles: PlayerParticleSystem | undefined;

  constructor(
    pos: EntityPosition,
    particles?: PlayerParticleSystem,
    sparksEffect?: Sparks[]
  ) {
    super('player', pos, [20, 28], {
      'player/idle': new Animation('player/idle', 5, 6),
      'player/run': new Animation('player/run', 6, 7),
      'player/jump': new Animation('player/jump', 3, 6),
      'player/fall': new Animation('player/fall', 1, 6),
      'player/land': new Animation('player/land', 2, 6, false),
      'player/throw_sword': new Animation('player/throw_sword', 3, 10, false),
      'player/sword/idle': new Animation('player/sword/idle', 5, 6),
      'player/sword/run': new Animation('player/sword/run', 6, 7),
      'player/sword/jump': new Animation('player/sword/jump', 3, 6),
      'player/sword/fall': new Animation('player/sword/fall', 1, 6),
      'player/sword/land': new Animation('player/sword/land', 2, 6, false),
      'player/sword/attack_1': new Animation('player/sword/attack_1', 3, 6, false),
      'player/sword/attack_2': new Animation('player/sword/attack_2', 3, 6, false),
      'player/sword/attack_3': new Animation('player/sword/attack_3', 3, 6, false),
      'player/sword/air_attack_1': new Animation('player/sword/air_attack_1', 3, 6, false),
      'player/sword/air_attack_2': new Animation('player/sword/air_attack_2', 3, 6, false),
      'player/hit': new Animation('player/hit', 4, 4),
      'player/sword/hit': new Animation('player/sword/hit', 4, 4),
      'player/dead_hit': new Animation('player/dead_hit', 4, 4),
      'player/dead': new Animation('player/dead', 4, 8, false),
      'player/sword/dead_hit': new Animation('player/sword/dead_hit', 4, 4),
      'player/sword/dead': new Animation('player/sword/dead', 4, 8, false),
    });
    this.particles = particles;
    this.sparksEffect = sparksEffect;
    if (this.particles?.spawnCooldown) {
      this.particles.spawnCooldown['player/run_dust'] = 400;
    }
  }

  override checkDead() {
    const wasDead = this.dead;
    super.checkDead();
    if (!wasDead && this.dead) {
      this.attackHandler.cancelAttack();
    }
  }

  checkDoubleTap(key: string, currentTime = performance.now()) {
    if (this.lastKey === key && currentTime - this.lastPressTime < 200) {
      this.runBoost = 1.5;
    }
    this.lastKey = key;
    this.lastPressTime = currentTime;
  }

  jump() {
    if (!this.dead && this.jumps > 0) {
      this.playSfx?.('player/jump');
      this.particles?.addParticle(
        'jump_dust',
        [this.pos[0] + 6, this.pos[1] + 13],
        this.flip
      );
      this.velocity[1] = -8;
      this.airTime = 5;
      this.jumps -= 1;
    }
  }

  throwSword(): boolean {
    if (!this.dead && this.swordState && !this.pendingThrow) {
      this.preRunBoost = this.runBoost;
      this.throwingFrameTriggered = false;
      this.pendingThrow = true;
      return true;
    }
    return false;
  }

  attack(): boolean {
    if (
      !this.dead &&
      this.swordState &&
      !this.pendingThrow &&
      !this.throwingAnimation
    ) {
      return this.attackHandler.triggerAttack(this.airTime);
    }
    return false;
  }

  showQuestionMark(): void {
    this.questionMarkPendingUntilLanding = false;
    this.questionMarkAnimation = new Animation(
      'dialogue/question',
      5,
      8,
      false
    );
  }

  showQuestionMarkWhenGrounded(): void {
    if (this.dead) {
      return;
    }

    if (this.collision.bottom) {
      this.showQuestionMark();
    } else {
      this.questionMarkPendingUntilLanding = true;
    }
  }

  questionMarkPosition(renderedPosition: EntityPosition): [number, number] {
    return [
      renderedPosition[0] +
        this.rectPosAdjustment[0] +
        this.size[0] +
        QUESTION_MARK_FACING_RIGHT_OFFSET,
      renderedPosition[1] - QUESTION_MARK_HEAD_OVERLAP,
    ];
  }

  getAttackRangeRect(): EntityRect | null {
    if (!this.attackHandler.attackState) {
      return null;
    }
    const isAir = this.attackHandler.currentAttackType.includes('air');
    const sizeExpansion: [number, number] = isAir ? [19, 60] : [25, 0];
    return this.attackRangeRect(this.flip, sizeExpansion);
  }

  getAttackDamage(): number {
    return this.attackHandler.currentAttackType.includes('air') ? 30 : 20;
  }

  override setAction(action: string) {
    // When dead, use sword-prefixed animation if holding sword
    if (this.swordState && (action === 'dead_hit' || action === 'dead')) {
      super.setAction(`sword/${action}`);
      return;
    }
    super.setAction(action);
  }

  getPickupableSword(
    swords: PickupSwordTarget[]
  ): PickupSwordTarget | undefined {
    if (this.swordState || this.pendingThrow || this.throwingAnimation) {
      return undefined;
    }

    const playerRect = this.rect();
    const playerBounds = this.getPlayerPickupBounds(playerRect);
    return swords.find((sword) =>
      this.overlapsSwordPickup(playerRect, playerBounds, sword)
    );
  }

  pickupSword(swords: PickupSwordTarget[]): boolean {
    const sword = this.getPickupableSword(swords);
    if (!sword) {
      return false;
    }

    const swordIndex = swords.indexOf(sword);
    if (swordIndex < 0) {
      return false;
    }

    swords.splice(swordIndex, 1);
    sword.destroy?.();
    this.swordState = true;
    this.playSfx?.('player/pickup_sword');
    const currentBaseAction = this.action.replace(/^sword\//, '');
    this.action = '';
    this.setAction(`sword/${currentBaseAction}`);
    this.animation?.update();
    return true;
  }

  private getPlayerPickupBounds(playerRect: EntityRect): EntityRect {
    return {
      x: Math.min(playerRect.x, this.pos[0]),
      y: Math.min(playerRect.y, this.pos[1]),
      width:
        Math.max(playerRect.x + playerRect.width, this.pos[0] + this.size[0]) -
        Math.min(playerRect.x, this.pos[0]),
      height:
        Math.max(
          playerRect.y + playerRect.height,
          this.pos[1] + this.size[1]
        ) - Math.min(playerRect.y, this.pos[1]),
    };
  }

  private overlapsSwordPickup(
    playerRect: EntityRect,
    playerBounds: EntityRect,
    sword: PickupSwordTarget
  ): boolean {
    const swordRect: EntityRect =
      typeof sword.rect === 'function'
        ? sword.rect()
        : {
            x: sword.pos[0],
            y: sword.pos[1],
            width: 20,
            height: 20,
          };
    const overlapsPhysical =
      playerRect.x < swordRect.x + swordRect.width &&
      playerRect.x + playerRect.width > swordRect.x &&
      playerRect.y < swordRect.y + swordRect.height &&
      playerRect.y + playerRect.height > swordRect.y;
    const overlapsBounds =
      playerBounds.x < swordRect.x + swordRect.width &&
      playerBounds.x + playerBounds.width > swordRect.x &&
      playerBounds.y < swordRect.y + swordRect.height &&
      playerBounds.y + playerBounds.height > swordRect.y;

    return overlapsPhysical || overlapsBounds;
  }

  override update(
    tilemap: Pick<Tilemap, 'physicalRectsAround' | 'platformsAround'>,
    movement: EntityPosition = [0, 0]
  ) {
    const wasKnockedBack = this.knockback;

    if (this.pendingThrow && !this.throwingAnimation) {
      const throwAnim = this.animations?.['player/throw_sword'];
      if (throwAnim) {
        this.throwingAnimation = throwAnim.copy();
        this.playSfx?.('player/throw_sword');
      }
    }

    if (this.throwingAnimation) {
      this.runBoost = 0.2;
    }

    const runAnimation = this.animations?.['player/run'];
    const swordRunAnimation = this.animations?.['player/sword/run'];

    const targetImgDur = this.runBoost >= 1 ? 5 : 7;
    if (runAnimation) {
      if (runAnimation.imgDur !== targetImgDur) {
        runAnimation.imgDur = targetImgDur;
        runAnimation.frame = runAnimation.frame % (targetImgDur * runAnimation.frameCount);
      }
    }
    if (swordRunAnimation) {
      if (swordRunAnimation.imgDur !== targetImgDur) {
        swordRunAnimation.imgDur = targetImgDur;
        swordRunAnimation.frame = swordRunAnimation.frame % (targetImgDur * swordRunAnimation.frameCount);
      }
    }
    if (this.animation && (this.action === 'run' || this.action === 'sword/run')) {
      if (this.animation.imgDur !== targetImgDur) {
        this.animation.imgDur = targetImgDur;
        this.animation.frame = this.animation.frame % (targetImgDur * this.animation.frameCount);
      }
    }

    if (this.particles?.spawnCooldown) {
      this.particles.spawnCooldown['player/run_dust'] =
        this.runBoost >= 1 ? 200 : this.runBoost > 0 ? 300 : 400;
    }

    const effectiveMovement: EntityPosition = this.knockback
      ? [0, movement[1]]
      : this.runBoost > 1
        ? [movement[0] * this.runBoost, movement[1]]
        : this.runBoost > 0 && this.runBoost < 1
          ? [movement[0] * this.runBoost, movement[1]]
          : movement;

    super.update(tilemap, effectiveMovement);

    if (
      !this.dead &&
      this.questionMarkPendingUntilLanding &&
      this.collision.bottom
    ) {
      this.showQuestionMark();
    }
    this.questionMarkAnimation?.update();
    if (this.questionMarkAnimation?.done) {
      this.questionMarkAnimation = null;
    }

    if (this.dead) {
      this.throwingAnimation = null;
      this.landingAnimation = null;
      return;
    }

    if (this.throwingAnimation) {
      this.throwingAnimation.update();
      if (
        this.throwingAnimation.frameIndex >= 1 &&
        !this.throwingFrameTriggered
      ) {
        this.throwingFrameTriggered = true;
        this.swordState = false;
        this.pendingThrow = false;
        const throwX = this.pos[0] + (this.flip ? -6 : 24);
        const throwY = this.pos[1] + 10;
        this.swordsSystem?.throwSword([throwX, throwY], this.flip);
        for (const color of FIERY_BURST_COLORS) {
          this.sparksEffect?.push(
            new Sparks(
              [this.pos[0] + (this.flip ? -4 : 44), this.pos[1] + 10],
              this.flip,
              Math.random() * 2 + 2,
              3,
              color,
              Math.PI * 0.85,
              'diamond',
              [3, 2]
            )
          );
        }
      }

      if (this.throwingAnimation.done) {
        this.throwingAnimation = null;
        this.runBoost = this.preRunBoost;
      } else {
        this.runBoost = 0.2;
      }
    }

    this.justLanded = this.wasInAir && this.collision.bottom;
    if (this.justLanded) {
      if (this.landedOn.palm_tree) {
        this.playSfx?.('player/land/palm_tree');
      } else if (this.landedOn.grass) {
        this.playSfx?.('player/land/grass');
      }
      const landingKey = `player/${this.swordState ? 'sword/' : ''}land`;
      const landingAnimation = this.animations?.[landingKey];
      if (!landingAnimation) {
        throw new Error(`Missing animation "${landingKey}".`);
      }
      this.landingAnimation = landingAnimation.copy();
      this.particles?.addParticle(
        'land_dust',
        [this.pos[0] + (this.flip ? 6 : 5), this.pos[1] + 13],
        this.flip
      );
    } else if (this.landingAnimation?.done) {
      this.landingAnimation = null;
    }

    const swordPrefix = this.swordState ? 'sword/' : '';
    if (wasKnockedBack || this.knockback) {
      this.setAction(`${swordPrefix}hit`);
    } else if (this.attackHandler.attackState) {
      this.attackHandler.setAction();
    } else {
      if (this.airTime > 4) {
        this.setAction(`${swordPrefix}${this.velocity[1] > 0 ? 'fall' : 'jump'}`);
      } else if (Math.abs(movement[0]) > 0) {
        const wasNotRunning = this.action !== `${swordPrefix}run`;
        this.setAction(`${swordPrefix}run`);

        const currentAnimation = this.animation;
        const isFootstepFrame =
          wasNotRunning ||
          (currentAnimation !== null &&
            (currentAnimation.frameIndex === 0 || currentAnimation.frameIndex === 3) &&
            currentAnimation.frame % currentAnimation.imgDur === 0);

        if (isFootstepFrame) {
          this.particles?.addParticle(
            'player/run_dust',
            [this.pos[0] + (this.flip ? 13 : -3), this.pos[1] + 12],
            this.flip
          );
          // SFX fires on each footstep frame (Devvit animation-frame cadence),
          // not on every frame the particle cooldown fires (Python root cadence).
          if (this.standingOn.palm_tree) {
            this.playSfx?.('player/run/palm_tree');
          } else {
            this.playSfx?.('player/run/grass');
          }
        }
      } else {
        this.setAction(`${swordPrefix}idle`);
      }
    }

    if (this.collision.bottom) {
      this.jumps = 2;
      this.airTime = 0;
    }

    this.wasInAir = !this.collision.bottom;
    this.airTime += 1;
    this.attackHandler.update();
  }
}
