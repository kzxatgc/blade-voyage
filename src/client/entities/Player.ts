import { PhysicsEntity } from './PhysicsEntity.ts';
import type { EntityPosition } from '../../shared/types';
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
}
