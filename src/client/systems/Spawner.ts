import type { Tilemap } from './Tilemap.ts';
import { Enemy, type EnemyName, type EnemyParticleSystem } from '../entities/Enemy.ts';
import type { EntityPosition, EntitySize } from '../../shared/types.ts';
import type { Sparks } from './Sparks.ts';

export { Enemy, type EnemyName, type EnemyParticleSystem };

export const ENEMY_NAME: Record<number, EnemyName> = {
  1: 'pink_star',
  2: 'crabby',
  3: 'fierce_tooth',
};

export const ENEMY_SIZE: Record<number, EntitySize> = {
  1: [26, 23],
  2: [32, 26],
  3: [24, 20],
};

export interface SpawnEntitiesResult {
  playerPos?: EntityPosition | undefined;
  enemies: Enemy[];
}

export function spawnEntities(
  tilemap: Tilemap,
  player?: { pos: EntityPosition },
  particles?: EnemyParticleSystem,
  sparksEffect?: Sparks[]
): SpawnEntitiesResult {
  const spawnerTiles = tilemap.extract(
    [
      ['spawner', 0],
      ['spawner', 1],
      ['spawner', 2],
      ['spawner', 3],
    ],
    false
  );

  let playerPos: EntityPosition | undefined;
  const enemies: Enemy[] = [];

  for (const spawner of spawnerTiles) {
    const worldPos: EntityPosition = [
      spawner.loc[0] * tilemap.tileSize,
      spawner.loc[1] * tilemap.tileSize,
    ];

    if (spawner.variant === 0) {
      playerPos = worldPos;
      if (player) {
        player.pos[0] = worldPos[0];
        player.pos[1] = worldPos[1];
      }
    } else {
      const enemyName = ENEMY_NAME[spawner.variant];
      const enemySize = ENEMY_SIZE[spawner.variant];
      if (enemyName && enemySize) {
        enemies.push(
          new Enemy(
            enemyName,
            worldPos,
            enemySize,
            undefined,
            particles,
            sparksEffect
          )
        );
      }
    }
  }

  return playerPos !== undefined ? { playerPos, enemies } : { enemies };
}
