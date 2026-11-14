import { PhysicsEntity } from './PhysicsEntity.ts';
import type { EntityPosition } from '../../shared/types.ts';
import type { Particles } from '../systems/Particles.ts';
import type { Tilemap } from '../systems/Tilemap.ts';
import { Animation } from '../utils/Animation.ts';

export type PlayerParticleSystem = Pick<Particles, 'addParticle'> & {
  spawnCooldown?: Record<string, number | null>;
};

export class Player extends PhysicsEntity {
  jumps = 2;
  airTime = 0;
  swordState = false;
  lastKey: string | null = null;
  lastPressTime = 0;
  runBoost = 0;
  wasInAir = false;
  justLanded = false;
  landingAnimation: Animation | null = null;
  private readonly particles: PlayerParticleSystem | undefined;

  constructor(pos: EntityPosition, particles?: PlayerParticleSystem) {
    super('player', pos, [20, 28], {
      'player/idle': new Animation('player/idle', 5, 6),
      'player/run': new Animation('player/run', 6, 7),
      'player/jump': new Animation('player/jump', 3, 6),
      'player/fall': new Animation('player/fall', 1, 6),
      'player/land': new Animation('player/land', 2, 6, false),
      'player/sword/idle': new Animation('player/sword/idle', 5, 6),
      'player/sword/run': new Animation('player/sword/run', 6, 7),
      'player/sword/jump': new Animation('player/sword/jump', 3, 6),
      'player/sword/fall': new Animation('player/sword/fall', 1, 6),
      'player/sword/land': new Animation('player/sword/land', 2, 6, false),
    });
    this.particles = particles;
    if (this.particles?.spawnCooldown) {
      this.particles.spawnCooldown['player/run_dust'] = 400;
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
    if (this.jumps > 0) {
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

  override update(
    tilemap: Pick<Tilemap, 'physicalRectsAround' | 'platformsAround'>,
    movement: EntityPosition = [0, 0]
  ) {
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

    const effectiveMovement: EntityPosition =
      this.runBoost > 1
        ? [movement[0] * this.runBoost, movement[1]]
        : this.runBoost > 0 && this.runBoost < 1
          ? [movement[0] * this.runBoost, movement[1]]
          : movement;

    super.update(tilemap, effectiveMovement);

    this.justLanded = this.wasInAir && this.collision.bottom;
    if (this.justLanded) {
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
      }
    } else {
      this.setAction(`${swordPrefix}idle`);
    }

    if (this.collision.bottom) {
      this.jumps = 2;
      this.airTime = 0;
    }

    this.wasInAir = !this.collision.bottom;
    this.airTime += 1;
  }
}
