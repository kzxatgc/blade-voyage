/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MapData, TileData } from '../../shared/types.ts';
import { CannonSystem, CANNON_WARNING_TICKS } from './CannonSystem.ts';
import { Tilemap } from './Tilemap.ts';

const makeTilemap = (tiles: Record<string, TileData>): Tilemap => {
  const tilemap = new Tilemap();
  const mapData: MapData = { tiles, off_grid_tiles: [] };
  tilemap.loadFromData(mapData);
  return tilemap;
};

const cannonTile = (
  x: number,
  y: number,
  variant = 0
): TileData => ({
  type: 'cannon',
  variant,
  loc: [x, y],
});

void describe('CannonSystem', () => {
  void it('discovers cannons and maps variants to facing directions', () => {
    const system = new CannonSystem(
      makeTilemap({
        '2;3': cannonTile(2, 3),
        '5;3': cannonTile(5, 3, 1),
        '2;4': { type: 'grass', variant: 0, loc: [2, 4] },
      }),
      () => undefined
    );

    assert.equal(system.cannons.length, 2);
    assert.equal(system.cannons[0]?.direction, 1);
    assert.equal(system.cannons[1]?.direction, -1);
    assert.equal(system.cannons[0]?.bounds.y, 3 * 32 + 6);
  });

  void it('warns before firing and repeats shots at the configured interval', () => {
    const system = new CannonSystem(
      makeTilemap({ '2;3': cannonTile(2, 3) }),
      () => undefined
    );
    const cannon = system.cannons[0];
    assert.ok(cannon);
    assert.equal(cannon.warning, true);

    for (let tick = 0; tick < CANNON_WARNING_TICKS - 1; tick += 1) {
      system.update();
    }
    assert.equal(system.cannonBalls.length, 0);

    system.update();
    assert.equal(system.cannonBalls.length, 1);
    assert.equal(system.cannonBalls[0]?.direction, 1);
    assert.equal(cannon.animation, 'fire');
    assert.equal(cannon.muzzleFrame, 0);

    for (let tick = 0; tick < 179; tick += 1) {
      system.update();
    }
    assert.equal(system.cannonBalls.length, 1);

    system.update();
    assert.equal(system.cannonBalls.length, 2);
  });

  void it('explodes on terrain without damaging the player', () => {
    let playerHits = 0;
    const system = new CannonSystem(
      makeTilemap({
        '2;3': cannonTile(2, 3),
        '5;3': { type: 'grass', variant: 0, loc: [5, 3] },
      }),
      () => {
        playerHits += 1;
      }
    );

    for (let tick = 0; tick < CANNON_WARNING_TICKS + 10; tick += 1) {
      system.update();
    }

    assert.equal(playerHits, 0);
    assert.equal(system.cannonBalls[0]?.animation, 'explosion');
  });

  void it('damages only the player on projectile impact', () => {
    const hitDirections: number[] = [];
    const system = new CannonSystem(
      makeTilemap({ '2;3': cannonTile(2, 3) }),
      (direction) => {
        hitDirections.push(direction);
      }
    );

    for (let tick = 0; tick < CANNON_WARNING_TICKS; tick += 1) {
      system.update();
    }

    const ball = system.cannonBalls[0];
    assert.ok(ball);
    system.update({
      x: ball.x + 5,
      y: ball.y,
      width: 20,
      height: 24,
    });

    assert.deepEqual(hitDirections, [1]);
    assert.equal(ball.animation, 'explosion');
  });

  void it('takes three separate sword hits to destroy a cannon', () => {
    const system = new CannonSystem(
      makeTilemap({ '2;3': cannonTile(2, 3) }),
      () => undefined
    );
    const cannon = system.cannons[0];
    assert.ok(cannon);
    const bounds = cannon.bounds;
    const firstSwing = new Set<unknown>();

    assert.deepEqual(
      system
        .damageFromAttack(bounds, firstSwing)
        .map((result) => result.health),
      [2]
    );
    assert.deepEqual(system.damageFromAttack(bounds, firstSwing), []);
    assert.equal(cannon.health, 2);

    assert.equal(system.damageFromAttack(bounds, new Set())[0]?.health, 1);
    const finalHit = system.damageFromAttack(bounds, new Set())[0];
    assert.equal(finalHit?.health, 0);
    assert.equal(finalHit?.destroyed, true);
    assert.equal(cannon.animation, 'destroyed');

    for (let tick = 0; tick < 300; tick += 1) {
      system.update();
    }
    assert.equal(system.cannonBalls.length, 0);
  });
});
