import type { Tilemap } from './Tilemap.ts';
import { Enemy, type EnemyName, type EnemyParticleSystem } from '../entities/Enemy.ts';
import type {
  EntityCollision,
  EntityPosition,
  EntitySize,
  EntityType,
} from '../../shared/types.ts';
import { PHYSICAL_TILES, RECT_POS_ADJUSTMENT } from '../../shared/constants.ts';
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

type SpawnPlayer = {
  pos: EntityPosition;
  velocity?: EntityPosition;
  collision?: EntityCollision;
  standingOn?: { grass: boolean };
  airTime?: number;
  wasInAir?: boolean;
  justLanded?: boolean;
};

function findFloorY(tilemap: Tilemap, gridX: number, startGridY: number): number {
  for (let y = startGridY; y < startGridY + 20; y++) {
    const tile = tilemap.tiles[`${gridX};${y}`];
    if (tile && PHYSICAL_TILES.has(tile.type)) {
      while (y > 0) {
        const tileAbove = tilemap.tiles[`${gridX};${y - 1}`];
        if (!tileAbove || !PHYSICAL_TILES.has(tileAbove.type)) {
          break;
        }
        y--;
      }
      return y * tilemap.tileSize;
    }
  }
  return startGridY * tilemap.tileSize;
}

export function spawnEntities(
  tilemap: Tilemap,
  player?: SpawnPlayer,
  particles?: EnemyParticleSystem,
  sparksEffect?: Sparks[]
): SpawnEntitiesResult {
  const spawnerTiles = [
    ...tilemap
      .extract(
        [
          ['spawner', 0],
          ['spawner', 1],
          ['spawner', 2],
          ['spawner', 3],
        ],
        false
      )
      .map((spawner) => ({
        variant: spawner.variant,
        gridX: spawner.loc[0],
        startGridY: spawner.loc[1] + 1,
        x: spawner.loc[0] * tilemap.tileSize,
      })),
    ...tilemap.offGridTiles.flatMap((tile) => {
      if (
        tile.type !== 'spawner' ||
        tile.variant === undefined ||
        ![0, 1, 2, 3].includes(tile.variant)
      ) {
        return [];
      }

      return [
        {
          variant: tile.variant,
          gridX: Math.floor(tile.pos[0] / tilemap.tileSize),
          startGridY: Math.floor(tile.pos[1] / tilemap.tileSize) + 1,
          x: tile.pos[0],
        },
      ];
    }),
  ];

  let playerPos: EntityPosition | undefined;
  const enemies: Enemy[] = [];

  for (const spawner of spawnerTiles) {
    const floorGridX =
      spawner.variant === 0
        ? Math.floor(
            (spawner.x + RECT_POS_ADJUSTMENT.player[0]) / tilemap.tileSize
          )
        : spawner.gridX;
    const floorY = findFloorY(tilemap, floorGridX, spawner.startGridY);

    if (spawner.variant === 0) {
      const playerAdj = RECT_POS_ADJUSTMENT.player;
      const playerHeight = 28;
      const playerSpawnY = floorY - playerHeight - playerAdj[1];
      playerPos = [spawner.x, playerSpawnY];
      if (player) {
        player.pos[0] = playerPos[0];
        player.pos[1] = playerPos[1];
        if (player.velocity) {
          player.velocity[1] = 0;
        }
        if (player.collision) {
          player.collision.bottom = true;
        }
        if (player.standingOn) {
          player.standingOn.grass = true;
        }
        if (player.airTime !== undefined) {
          player.airTime = 0;
        }
        if (player.wasInAir !== undefined) {
          player.wasInAir = false;
        }
        if (player.justLanded !== undefined) {
          player.justLanded = false;
        }
      }
    } else {
      const enemyName = ENEMY_NAME[spawner.variant];
      const enemySize = ENEMY_SIZE[spawner.variant];
      if (enemyName && enemySize) {
        const enemyAdj = RECT_POS_ADJUSTMENT[`enemy/${enemyName}` as EntityType];
        const spawnY = floorY - enemySize[1] - enemyAdj[1];
        const spawnX = spawner.x;
        const enemy = new Enemy(
          enemyName,
          [spawnX, spawnY],
          enemySize,
          undefined,
          particles,
          sparksEffect
        );
        enemy.velocity[1] = 0;
        enemy.collision.bottom = true;
        enemy.standingOn.grass = true;
        enemies.push(enemy);
      }
    }
  }

  return playerPos !== undefined ? { playerPos, enemies } : { enemies };
}
