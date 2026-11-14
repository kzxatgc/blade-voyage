import { PhysicsEntity } from './PhysicsEntity.ts';
import type { EntityPosition } from '../../shared/types.ts';
import type { Tilemap } from '../systems/Tilemap.ts';
import { Animation } from '../utils/Animation.ts';

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

  constructor(pos: EntityPosition) {
    super('player', pos, [20, 28], {
      'player/idle': new Animation('player/idle', 5, 6),
      'player/run': new Animation('player/run', 6, 6),
      'player/jump': new Animation('player/jump', 3, 6),
      'player/fall': new Animation('player/fall', 1, 6),
      'player/land': new Animation('player/land', 2, 6, false),
      'player/sword/idle': new Animation('player/sword/idle', 5, 6),
      'player/sword/run': new Animation('player/sword/run', 6, 6),
      'player/sword/jump': new Animation('player/sword/jump', 3, 6),
      'player/sword/fall': new Animation('player/sword/fall', 1, 6),
      'player/sword/land': new Animation('player/sword/land', 2, 6, false),
    });
  }

  jump() {
    if (this.jumps > 0) {
      this.velocity[1] = -8;
      this.airTime = 5;
      this.jumps -= 1;
    }
  }

  override update(
    tilemap: Pick<Tilemap, 'physicalRectsAround'>,
    movement: EntityPosition = [0, 0]
  ) {
    super.update(tilemap, movement);

    this.justLanded = this.wasInAir && this.collision.bottom;
    if (this.justLanded) {
      const landingKey = `player/${this.swordState ? 'sword/' : ''}land`;
      const landingAnimation = this.animations?.[landingKey];
      if (!landingAnimation) {
        throw new Error(`Missing animation "${landingKey}".`);
      }
      this.landingAnimation = landingAnimation.copy();
    } else if (this.landingAnimation?.done) {
      this.landingAnimation = null;
    }

    const swordPrefix = this.swordState ? 'sword/' : '';
    if (this.airTime > 4) {
      this.setAction(`${swordPrefix}${this.velocity[1] > 0 ? 'fall' : 'jump'}`);
    } else if (Math.abs(movement[0]) > 0) {
      this.setAction(`${swordPrefix}run`);
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
