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
    assert.equal(entity.health, 3);
    assert.equal(entity.maxHealth, 3);
    assert.equal(entity.dead, false);

    const enemy = new PhysicsEntity('enemy/pink_star', [0, 0]);
    assert.equal(enemy.health, 100);
    assert.equal(enemy.maxHealth, 100);
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

    assert.throws(
      () => entity.setAction('run'),
      /Missing animation "player\/run"/
    );
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

  void it('moves horizontally and updates facing direction', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const Tilemap = await getTilemap();
    const entity = new PhysicsEntity('player', [100, 100]);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({ tiles: {}, off_grid_tiles: [] });

    entity.update(tilemap, [3, 0]);
    assert.equal(entity.pos[0], 103);
    assert.equal(entity.flip, false);

    entity.update(tilemap, [-3, 0]);
    assert.equal(entity.pos[0], 100);
    assert.equal(entity.flip, true);
  });

  void it('stops horizontal movement at a solid tile', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const Tilemap = await getTilemap();
    const entity = new PhysicsEntity('player', [120, 224]);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({
      tiles: {
        '5;7': { type: 'grass', variant: 4, loc: [5, 7] },
      },
      off_grid_tiles: [],
    });

    entity.update(tilemap, [20, 0]);

    assert.equal(entity.collision.right, true);
    assert.equal(entity.pos[0], 118);
    assert.equal(entity.rect().x + entity.rect().width, 160);
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

  void it('lands on a palm-tree platform when descending from above', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const Tilemap = await getTilemap();
    const entity = new PhysicsEntity('player', [185, 148]);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({
      tiles: {},
      off_grid_tiles: [
        {
          type: 'palm_tree/front/regular',
          depth: 'front',
          status: 'animated',
          pos: [200, 180],
        },
      ],
    });
    entity.velocity[1] = 3;

    entity.update(tilemap);

    assert.equal(entity.collision.bottom, true);
    assert.deepEqual(entity.landedOn, { grass: false, palm_tree: true });
    assert.equal(entity.pos[1], 148);
  });

  void it('does not land on palm-tree platforms from below or after passing their top', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const Tilemap = await getTilemap();
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({
      tiles: {},
      off_grid_tiles: [
        {
          type: 'palm_tree/front/regular',
          depth: 'front',
          status: 'animated',
          pos: [200, 180],
        },
      ],
    });

    const risingEntity = new PhysicsEntity('player', [185, 182]);
    risingEntity.velocity[1] = -8;
    risingEntity.update(tilemap);
    assert.equal(risingEntity.collision.bottom, false);
    assert.equal(risingEntity.landedOn.palm_tree, false);

    const fallingEntity = new PhysicsEntity('player', [185, 153]);
    fallingEntity.velocity[1] = 1;
    fallingEntity.update(tilemap);
    assert.equal(fallingEntity.collision.bottom, false);
    assert.equal(fallingEntity.landedOn.palm_tree, false);
  });

  void it('drops through a palm-tree platform for one update when requested', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const Tilemap = await getTilemap();
    const entity = new PhysicsEntity('player', [185, 148]);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({
      tiles: {},
      off_grid_tiles: [
        {
          type: 'palm_tree/front/regular',
          depth: 'front',
          status: 'animated',
          pos: [200, 180],
        },
      ],
    });
    entity.velocity[1] = 3;
    entity.update(tilemap);
    assert.equal(entity.landedOn.palm_tree, true);

    assert.equal(entity.dropThroughPlatform(), true);
    entity.update(tilemap);
    assert.equal(entity.collision.bottom, false);
    assert.equal(entity.landedOn.palm_tree, false);
    assert.ok(entity.pos[1] > 148);

    assert.equal(entity.dropThroughPlatform(), false);
  });

  void it('does not drop through when jumping from a palm-tree platform', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const Tilemap = await getTilemap();
    const entity = new PhysicsEntity('player', [185, 148]);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({
      tiles: {},
      off_grid_tiles: [
        {
          type: 'palm_tree/front/regular',
          depth: 'front',
          status: 'animated',
          pos: [200, 180],
        },
      ],
    });
    entity.velocity[1] = 3;
    entity.update(tilemap);
    entity.velocity[1] = -8;

    assert.equal(entity.dropThroughPlatform(), false);
    entity.update(tilemap);

    assert.equal(entity.collision.bottom, false);
    assert.equal(entity.landedOn.palm_tree, false);
    assert.ok(entity.pos[1] < 148);
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

  void it('computes directional attackRangeRect based on facing flip', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const entity = new PhysicsEntity('player', [100, 200], [20, 28]);
    // rectPosAdjustment['player'] = [22, 4]
    // pos [100, 200] -> base x = 122, base y = 204

    // Facing right (flip = false)
    const rightRect = entity.attackRangeRect(false, [25, 0]);
    assert.deepEqual(rightRect, {
      x: 122,
      y: 204,
      width: 45, // 20 + 25
      height: 20, // 20 + 0 (size[0] + sizeExpansion[1])
    });

    // Facing left (flip = true)
    const leftRect = entity.attackRangeRect(true, [25, 0]);
    assert.deepEqual(leftRect, {
      x: 97, // 122 - 25
      y: 204,
      width: 45,
      height: 20,
    });
  });

  void it('player and enemy die when health drops to 0', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const Tilemap = await getTilemap();
    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    for (const type of ['player', 'enemy/pink_star'] as const) {
      const entity = new PhysicsEntity(type, [100, 100], [20, 28]);
      entity.health = 0;
      entity.update(tm, [0, 0]);
      assert.equal(entity.dead, true);
    }
  });

  void it('justDied is true only on the first dead frame', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const Tilemap = await getTilemap();
    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    const entity = new PhysicsEntity('player', [100, 100], [20, 28]);
    entity.health = 0;
    entity.update(tm, [0, 0]);
    assert.equal(entity.justDied, true);

    entity.update(tm, [0, 0]);
    assert.equal(entity.justDied, false);
  });

  void it('dead entity does not move horizontally from input but falls with gravity', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const Tilemap = await getTilemap();
    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    const entity = new PhysicsEntity('player', [100, 100], [20, 28]);
    entity.health = 0;
    entity.update(tm, [0, 0]);
    const initialX = entity.pos[0];
    const initialY = entity.pos[1];

    entity.update(tm, [5, 0]); // attempt horizontal movement
    assert.equal(entity.pos[0], initialX); // no horizontal movement
    assert.ok(entity.pos[1] > initialY); // gravity still pulled entity downward
  });

  void it('transitions through dead_hit for 30 frames and generates dead dialogue', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const Animation = await getAnimation();
    const Tilemap = await getTilemap();
    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    const entity = new PhysicsEntity('enemy/pink_star', [100, 100], [20, 28], {
      'enemy/pink_star/idle': new Animation('enemy/pink_star/idle', 5, 6),
      'enemy/pink_star/dead_hit': new Animation('enemy/pink_star/dead_hit', 4, 4),
      'enemy/pink_star/dead': new Animation('enemy/pink_star/dead', 4, 20, false),
    });

    entity.health = 0;
    // Frame 1: just died, generates dead dialogue, deadHitAnimation starts
    entity.update(tm, [0, 0]);
    assert.equal(entity.action, 'dead_hit');
    assert.equal(entity.deadHitAnimation, true);
    assert.ok(entity.dialogueAnimation !== null);
    assert.equal(entity.dialogueType, 'dead');

    // Frames 2-30: stays in dead_hit (30 frames total)
    for (let f = 2; f <= 30; f++) {
      entity.update(tm, [0, 0]);
      assert.equal(entity.action, 'dead_hit');
    }

    // Frame 31: deadHitAnimation has finished, transitions to dead
    entity.update(tm, [0, 0]);
    assert.equal(entity.deadHitAnimation, false);
    assert.equal(entity.action, 'dead');
  });

  void it('player discrete damage loses 1 heart and grants 90-frame i-frames', async () => {
    const PhysicsEntity = await getPhysicsEntity();
    const Tilemap = await getTilemap();
    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    const player = new PhysicsEntity('player', [100, 100], [20, 28]);
    assert.equal(player.health, 3);
    assert.equal(player.invincibleTimer, 0);

    // Hit 1: takes damage, health becomes 2, gets 90 i-frames
    const hit1 = player.takeDamage(1);
    assert.equal(hit1, true);
    assert.equal(player.health, 2);
    assert.equal(player.invincibleTimer, 90);

    // Immediate second hit while i-frames active: ignored!
    const hitBlocked = player.takeDamage(1);
    assert.equal(hitBlocked, false);
    assert.equal(player.health, 2);

    // Update decrements invincibleTimer
    player.update(tm, [0, 0]);
    assert.equal(player.invincibleTimer, 89);

    // Fast-forward i-frames
    player.invincibleTimer = 0;

    // Hit 2
    assert.equal(player.takeDamage(1), true);
    assert.equal(player.health, 1);

    // Hit 3: fatal
    player.invincibleTimer = 0;
    assert.equal(player.takeDamage(1), true);
    assert.equal(player.health, 0);
    assert.equal(player.dead, true);
  });
});
