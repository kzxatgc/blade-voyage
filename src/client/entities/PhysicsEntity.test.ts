/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const physicsEntityUrl = new URL('./PhysicsEntity.ts', import.meta.url).href;
const animationUrl = new URL('../utils/Animation.ts', import.meta.url).href;
const tilemapUrl = new URL('../systems/Tilemap.ts', import.meta.url).href;
const getPhysicsEntity = async () =>
  (await import(physicsEntityUrl)).PhysicsEntity;
const getAnimation = async () => (await import(animationUrl)).Animation;
const getTilemap = async () => (await import(tilemapUrl)).Tilemap;

void describe('PhysicsEntity', () => {
  void it('applies each entity type rectangle adjustment', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const cases = [
      ['player', [22, 4]],
      ['sword', [0, 0]],
      ['enemy/pink_star', [4, 6]],
      ['enemy/crabby', [20, 3]],
      ['enemy/fierce_tooth', [5, 8]],
    ] as const;

    for (const [type, [offsetX, offsetY]] of cases) {
      const entity = new PhysicsEntity(type, [100, 200], [20, 28]);
      assert.deepEqual(entity.rect(), {
        x: 100 + offsetX,
        y: 200 + offsetY,
        width: 20,
        height: 28,
      });
    }
  });

  void it('initializes movement, collision, action, and health state', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const entity = new PhysicsEntity('player', [0, 0]);

    assert.deepEqual(entity.velocity, [0, 0]);
    assert.deepEqual(entity.collision, {
      right: false,
      left: false,
      bottom: false,
      regular: false,
    });
    assert.equal(entity.action, 'idle');
    assert.equal(entity.animationKey, 'player/idle');
    assert.equal(entity.animation, null);
    assert.equal(entity.flip, false);
    assert.equal(entity.knockback, false);
    assert.equal(entity.health, 100);
    assert.equal(entity.maxHealth, 100);
    assert.equal(entity.dead, false);
  });

  void it('copies position and size and defaults to the source entity size', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const pos: [number, number] = [3, 5];
    const size: [number, number] = [12, 14];
    const entity = new PhysicsEntity('sword', pos, size);

    pos[0] = 100;
    size[0] = 100;
    assert.deepEqual(entity.pos, [3, 5]);
    assert.deepEqual(entity.size, [12, 14]);
    assert.deepEqual(new PhysicsEntity('player', [0, 0]).size, [20, 28]);
  });

  void it('sets an animation key and copies the selected animation', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const Animation = await getAnimation();
    const idleAnimation = new Animation('player/idle', 5, 6);
    const runAnimation = new Animation('player/run', 6, 10);
    const entity = new PhysicsEntity('player', [0, 0], [20, 28], {
      'player/idle': idleAnimation,
      'player/run': runAnimation,
    });

    assert.notEqual(entity.animation, idleAnimation);
    assert.equal(entity.animation?.img(), 'player/idle/0');

    entity.setAction('run');
    assert.equal(entity.animationKey, 'player/run');
    assert.notEqual(entity.animation, runAnimation);
    assert.equal(entity.animation?.img(), 'player/run/0');

    entity.setAction('run');
    assert.equal(entity.animation?.imgDur, 10);
  });

  void it('throws when a configured animation registry lacks the requested action', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const Animation = await getAnimation();
    const entity = new PhysicsEntity('player', [0, 0], [20, 28], {
      'player/idle': new Animation('player/idle', 5, 6),
    });

    assert.throws(() => entity.setAction('run'), /Missing animation "player\/run"/);
  });

  void it('applies gravity after vertical movement and caps fall speed', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const Tilemap = await getTilemap();
    const entity = new PhysicsEntity('player', [160, 0]);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({ tiles: {}, off_grid_tiles: [] });

    entity.update(tilemap);
    assert.equal(entity.velocity[1], 0.5);
    assert.equal(entity.pos[1], 0);

    entity.update(tilemap);
    assert.equal(entity.velocity[1], 1);
    assert.equal(entity.pos[1], 0.5);

    entity.velocity[1] = 4.8;
    entity.update(tilemap);
    assert.equal(entity.velocity[1], 5);
  });

  void it('lands on a physical tile and records the bottom collision', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const Tilemap = await getTilemap();
    const entity = new PhysicsEntity('player', [160, 222], [20, 28]);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({
      tiles: {
        '5;8': { type: 'grass', variant: 4, loc: [5, 8] },
      },
      off_grid_tiles: [],
    });
    entity.velocity[1] = 3;

    entity.update(tilemap);

    assert.equal(entity.collision.bottom, true);
    assert.equal(entity.collision.regular, false);
    assert.equal(entity.landedOn.grass, true);
    assert.equal(entity.pos[1], 224);
  });

  void it('resolves upward collisions and resets collision state each update', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const Tilemap = await getTilemap();
    const entity = new PhysicsEntity('player', [160, 264], [20, 28]);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({
      tiles: {
        '5;8': { type: 'grass', variant: 4, loc: [5, 8] },
      },
      off_grid_tiles: [],
    });
    entity.velocity[1] = -5;

    entity.update(tilemap);

    assert.equal(entity.collision.regular, true);
    assert.equal(entity.collision.bottom, false);
    assert.equal(entity.pos[1], 284);

    tilemap.loadFromData({ tiles: {}, off_grid_tiles: [] });
    entity.velocity[1] = 0;
    entity.update(tilemap);

    assert.deepEqual(entity.collision, {
      right: false,
      left: false,
      bottom: false,
      regular: false,
    });
    assert.deepEqual(entity.landedOn, { grass: false, palm_tree: false });
  });
});
