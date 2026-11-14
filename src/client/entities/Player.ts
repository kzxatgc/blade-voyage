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

  constructor(pos: EntityPosition) {
    super('player', pos, [20, 28], {
      'player/idle': new Animation('player/idle', 5, 6),
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

    if (this.collision.bottom) {
      this.jumps = 2;
      this.airTime = 0;
    }

    this.airTime += 1;
  }
}
