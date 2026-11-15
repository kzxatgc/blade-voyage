/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ENEMY_NAME, ENEMY_SIZE, spawnEntities } from './Spawner.ts';
import { Tilemap } from './Tilemap.ts';
import { Player } from '../entities/Player.ts';

void describe('Spawner', () => {
  void it('maps variant 1 to pink_star', () => {
    assert.equal(ENEMY_NAME[1], 'pink_star');
  });

  void it('maps variant 2 to crabby with size 32x26', () => {
    assert.equal(ENEMY_NAME[2], 'crabby');
    assert.deepEqual(ENEMY_SIZE[2], [32, 26]);
  });

  void it('maps variant 3 to fierce_tooth', () => {
    assert.equal(ENEMY_NAME[3], 'fierce_tooth');
    assert.deepEqual(ENEMY_SIZE[3], [24, 20]);
  });

  void it('spawns player at variant 0 and enemies at variants 1-3', () => {
    const tm = new Tilemap(32);
    tm.loadFromData({
      tiles: {
        '2;3': { type: 'spawner', variant: 0, loc: [2, 3] },
        '5;4': { type: 'spawner', variant: 1, loc: [5, 4] },
        '8;4': { type: 'spawner', variant: 2, loc: [8, 4] },
        '11;4': { type: 'spawner', variant: 3, loc: [11, 4] },
      },
      off_grid_tiles: [],
    });

    const player = { pos: [0, 0] as [number, number] };
    const result = spawnEntities(tm, player);

    assert.deepEqual(result.playerPos, [64, 96]);
    assert.deepEqual(player.pos, [64, 96]);

    assert.equal(result.enemies.length, 3);

    const [pinkStar, crabby, fierceTooth] = result.enemies;
    assert.ok(pinkStar !== undefined);
    assert.equal(pinkStar.enemyType, 'pink_star');
    assert.deepEqual(pinkStar.pos, [160, 131]);
    assert.deepEqual(pinkStar.size, [26, 23]);
    assert.equal(pinkStar.collision.bottom, true);
    assert.equal(pinkStar.standingOn.grass, true);

    assert.ok(crabby !== undefined);
    assert.equal(crabby.enemyType, 'crabby');
    assert.deepEqual(crabby.pos, [256, 131]);
    assert.deepEqual(crabby.size, [32, 26]);
    assert.equal(crabby.collision.bottom, true);
    assert.equal(crabby.standingOn.grass, true);

    assert.ok(fierceTooth !== undefined);
    assert.equal(fierceTooth.enemyType, 'fierce_tooth');
    assert.deepEqual(fierceTooth.pos, [352, 132]);
    assert.deepEqual(fierceTooth.size, [24, 20]);
    assert.equal(fierceTooth.collision.bottom, true);
    assert.equal(fierceTooth.standingOn.grass, true);
  });

  void it('spawns entities flush with ground and prevents initial falling or landing effects', () => {
    const tm = new Tilemap(32);
    tm.loadFromData({
      tiles: {
        '2;3': { type: 'spawner', variant: 0, loc: [2, 3] },
        '2;4': { type: 'grass', variant: 1, loc: [2, 4] },
        '5;3': { type: 'spawner', variant: 1, loc: [5, 3] },
        '5;4': { type: 'grass', variant: 1, loc: [5, 4] },
      },
      off_grid_tiles: [],
    });

    const player = new Player([0, 0]);
    const result = spawnEntities(tm, player);

    // Initial spawn check
    assert.deepEqual(player.pos, [64, 96]);
    assert.equal(player.collision.bottom, true);
    assert.equal(player.standingOn.grass, true);
    assert.equal(player.airTime, 0);
    assert.equal(player.justLanded, false);

    const [pinkStar] = result.enemies;
    assert.ok(pinkStar);
    assert.deepEqual(pinkStar.pos, [160, 99]);
    assert.equal(pinkStar.collision.bottom, true);
    assert.equal(pinkStar.standingOn.grass, true);

    // Frame 1 update
    player.update(tm);
    assert.equal(player.justLanded, false);
    assert.equal(player.landingAnimation, null);
    assert.equal(player.collision.bottom, true);
    assert.deepEqual(player.pos, [64, 96]);

    pinkStar.update(tm);
    assert.equal(pinkStar.collision.bottom, true);
    assert.deepEqual(pinkStar.pos, [160, 99]);

    // Frame 2 update
    player.update(tm);
    assert.equal(player.justLanded, false);
    assert.equal(player.landingAnimation, null);
    assert.equal(player.collision.bottom, true);
    assert.deepEqual(player.pos, [64, 96]);
  });
});

