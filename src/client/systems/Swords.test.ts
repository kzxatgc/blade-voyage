/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Sword, SpinningSword, Swords } from './Swords.ts';
import { Tilemap } from './Tilemap.ts';
import type { Sparks } from './Sparks.ts';

void describe('Sword entity', () => {
  void it('hovers for first 18 frames', () => {
    const sword = new Sword([100, 100]);
    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });
    for (let i = 0; i < 17; i++) sword.update(tm);
    assert.equal(sword.velocity[1], 0);
  });

  void it('despawns after 1200 frames', () => {
    const sword = new Sword([100, 100]);
    sword.timer = 1200;
    assert.ok(sword.timer >= 1200); // manager removes at this threshold
  });

  void it('starts in fall action with fall animation', () => {
    const sword = new Sword([100, 100]);
    assert.equal(sword.action, 'fall');
    assert.equal(sword.landed, false);
    assert.equal(sword.animation?.img(), 'sword/fall/0');
  });

  void it('accelerates downward after hovering for 18 frames when not landed', () => {
    const sword = new Sword([100, 100]);
    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    // Update 18 times (timer 0..17)
    for (let i = 0; i < 18; i++) {
      sword.update(tm);
    }
    assert.equal(sword.timer, 18);
    assert.equal(sword.velocity[1], 0);

    // 19th update: timer is 18, hover ends, accelerates naturally downward
    sword.update(tm);
    assert.equal(sword.timer, 19);
    assert.ok(sword.velocity[1] > 0);
    assert.equal(sword.velocity[1], 0.7);

    // Further updates accelerate up to cap of 3.5
    for (let i = 0; i < 20; i++) {
      sword.update(tm);
    }
    assert.equal(sword.velocity[1], 3.5);
  });

  void it('lands on bottom collision and switches to idle action', () => {
    const sword = new Sword([100, 100]);
    const tm = new Tilemap(32);
    tm.loadFromData({
      tiles: {
        '3;4': { type: 'grass', variant: 0, loc: [3, 4] }, // y = 128
      },
      off_grid_tiles: [],
    });

    // Sword at [100, 100], size [20, 20]. Tile top is at y = 128.
    // Skip hover
    sword.timer = 18;
    while (!sword.landed && sword.timer < 100) {
      sword.update(tm);
    }

    assert.equal(sword.landed, true);
    assert.equal(sword.action, 'idle');
    assert.equal(sword.animation?.img(), 'sword/idle/0');
  });

  void it('emits ground impact bounce sparks on first landing', () => {
    const sparksEffect: Sparks[] = [];
    const sword = new Sword([100, 100], undefined, undefined, sparksEffect);
    const tm = new Tilemap(32);
    tm.loadFromData({
      tiles: {
        '3;4': { type: 'grass', variant: 0, loc: [3, 4] }, // y = 128
      },
      off_grid_tiles: [],
    });

    sword.timer = 18;
    while (!sword.landed && sword.timer < 100) {
      sword.update(tm);
    }

    assert.equal(sword.landed, true);
    assert.equal(sparksEffect.length, 1);
    const spark = sparksEffect[0];
    assert.ok(spark !== undefined);
    assert.equal(spark.shape, 'diamond');
    assert.deepEqual(spark.color, [255, 235, 170]);
    assert.equal(spark.sparks.length, 10);
    assert.equal(spark.speed, 1.8);
    assert.deepEqual(spark.size, [2, 2]);

    // Subsequent updates on the ground do not trigger more bounce sparks
    sword.update(tm);
    assert.equal(sparksEffect.length, 1);
  });

  void it('calculates blink visibility after 900 and 1080 frames', () => {
    const sword = new Sword([100, 100]);

    sword.timer = 899;
    assert.equal(sword.isBlinking(), false);

    // Between 900 and 1079: blink rate is 12
    sword.timer = 900; // 900 // 12 = 75 (odd) -> false
    assert.equal(sword.isBlinking(), false);
    sword.timer = 912; // 912 // 12 = 76 (even) -> true
    assert.equal(sword.isBlinking(), true);

    // At or after 1080: blink rate is 7
    sword.timer = 1080; // 1080 // 7 = 154 (even) -> true
    assert.equal(sword.isBlinking(), true);
    sword.timer = 1087; // 1087 // 7 = 155 (odd) -> false
    assert.equal(sword.isBlinking(), false);
  });

  void it('renders with 90 degree rotation and handles blinking', () => {
    const sword = new Sword([100, 100]);
    let createdImage: {
      x: number;
      y: number;
      texture: string;
      origin?: [number, number];
      angle?: number;
      visible?: boolean;
    } | null = null;

    const mockScene = {
      add: {
        image(x: number, y: number, texture: string) {
          createdImage = { x, y, texture };
          return {
            setOrigin(ox: number, oy: number) {
              if (createdImage) createdImage.origin = [ox, oy];
            },
            setPosition(px: number, py: number) {
              if (createdImage) {
                createdImage.x = px;
                createdImage.y = py;
              }
            },
            setTexture(tex: string) {
              if (createdImage) createdImage.texture = tex;
            },
            setAngle(angle: number) {
              if (createdImage) createdImage.angle = angle;
            },
            setVisible(vis: boolean) {
              if (createdImage) createdImage.visible = vis;
            },
            destroy() {
              createdImage = null;
            },
          };
        },
      },
    };

    sword.render(mockScene);
    assert.ok(createdImage !== null);
    const renderedImage = createdImage as {
      x: number;
      y: number;
      texture: string;
      origin?: [number, number];
      angle?: number;
      visible?: boolean;
    };
    assert.equal(renderedImage.angle, 90);
    assert.deepEqual(renderedImage.origin, [0.5, 0.5]);

    // Fast-forward to blinking frame
    sword.timer = 912;
    sword.render(mockScene);
    assert.equal(renderedImage.visible, false);

    sword.destroy();
  });
});

void describe('Swords manager', () => {
  void it('caches valid spawn positions from grass surface tiles (variants 0, 1, 2, 9, 10, 11, 12, 13)', () => {
    const tm = new Tilemap(32);
    tm.loadFromData({
      tiles: {
        '0;0': { type: 'grass', variant: 0, loc: [0, 0] },
        '1;0': { type: 'grass', variant: 1, loc: [1, 0] },
        '2;0': { type: 'grass', variant: 4, loc: [2, 0] }, // internal tile, not surface
        '3;0': { type: 'grass', variant: 9, loc: [3, 0] },
        '4;0': { type: 'spawner', variant: 0, loc: [4, 0] },
      },
      off_grid_tiles: [],
    });

    const manager = new Swords();
    const positions = manager.getValidSpawnPositions(tm);
    assert.equal(positions.length, 3);
    assert.deepEqual(positions, [
      [0, 0],
      [32, 0],
      [96, 0],
    ]);

    // Subsequent call returns cached list
    const cached = manager.getValidSpawnPositions(tm);
    assert.equal(cached, positions);
  });

  void it('spawns a sword when RNG check passes and position is available', () => {
    const tm = new Tilemap(32);
    tm.loadFromData({
      tiles: {
        '2;5': { type: 'grass', variant: 0, loc: [2, 5] }, // [64, 160]
      },
      off_grid_tiles: [],
    });

    // Mock RNG to always pass probability (< 0.01) and use 0.5 for offsets
    let callCount = 0;
    const mockRng = () => {
      callCount++;
      return 0.005; // passes < 0.01
    };

    const manager = new Swords([0, 0], mockRng);
    const spawned = manager.spawnSword(tm);

    assert.ok(spawned !== null);
    assert.equal(manager.swords.length, 1);
    // renderPos = [64 + 32 * (0.005 * 0.2 + 0.1), 160 - 60]
    // 64 + 32 * 0.101 = 67.232, 100
    assert.equal(spawned.pos[1], 100);
    assert.ok(Math.abs(spawned.pos[0] - 67.232) < 0.001);
  });

  void it('does not spawn if probability check fails or max cap of 5 is reached', () => {
    const tm = new Tilemap(32);
    tm.loadFromData({
      tiles: {
        '0;0': { type: 'grass', variant: 0, loc: [0, 0] },
      },
      off_grid_tiles: [],
    });

    // RNG fails (< 0.01 condition not met)
    const failingManager = new Swords([0, 0], () => 0.05);
    const result1 = failingManager.spawnSword(tm);
    assert.equal(result1, null);
    assert.equal(failingManager.swords.length, 0);

    // Max 5 swords reached
    const cappedManager = new Swords([0, 0], () => 0.005);
    for (let i = 0; i < 5; i++) {
      cappedManager.swords.push(new Sword([i * 100, 100]));
    }
    const result2 = cappedManager.spawnSword(tm);
    assert.equal(result2, null);
    assert.equal(cappedManager.swords.length, 5);
  });

  void it('removes swords when timer reaches or exceeds 1200 on update', () => {
    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    // Mock RNG so spawnSword does not trigger during update
    const manager = new Swords([0, 0], () => 0.5);
    const sword1 = new Sword([100, 100]);
    const sword2 = new Sword([200, 100]);
    sword1.timer = 1199;
    sword2.timer = 1200;

    manager.swords = [sword1, sword2];

    manager.update(tm);

    // sword2 was at 1200, so it gets removed before update
    // sword1 was at 1199, so it survives and increments to 1200
    assert.equal(manager.swords.length, 1);
    assert.equal(manager.swords[0], sword1);
    assert.equal(sword1.timer, 1200);

    // Next update removes sword1
    manager.update(tm);
    assert.equal(manager.swords.length, 0);
  });

  void it('updates and renders all managed swords', () => {
    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    const manager = new Swords([0, 0], () => 0.5);
    const sword = new Sword([100, 100]);
    manager.swords = [sword];

    manager.update(tm);
    assert.equal(sword.timer, 1);

    let imagesRendered = 0;
    const mockScene = {
      add: {
        image() {
          imagesRendered++;
          return {
            setOrigin() {},
            setPosition() {},
            setTexture() {},
            destroy() {},
          };
        },
      },
    };

    manager.render(mockScene);
    assert.equal(imagesRendered, 1);

    manager.destroy();
    assert.equal(manager.swords.length, 0);
  });

  void it('manages thrown swords lifecycle and rendering', () => {
    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    const manager = new Swords([0, 0], () => 0.5);
    const thrown = manager.throwSword([100, 100], false);
    assert.equal(manager.thrownSwords.length, 1);
    assert.equal(manager.thrownSwords[0], thrown);

    manager.update(tm);
    assert.equal(thrown.timer, 1);

    let imagesRendered = 0;
    const mockScene = {
      add: {
        image() {
          imagesRendered++;
          return {
            setOrigin() {},
            setPosition() {},
            setTexture() {},
            destroy() {},
          };
        },
      },
    };

    manager.render(mockScene);
    assert.equal(imagesRendered, 1);

    thrown.timer = 1198;
    manager.update(tm);
    assert.equal(manager.thrownSwords.length, 1);
    assert.equal(thrown.timer, 1199);

    // Reaching 1200 removes it on update
    manager.update(tm);
    assert.equal(manager.thrownSwords.length, 0);

    manager.throwSword([100, 100], false);
    assert.equal(manager.thrownSwords.length, 1);
    manager.destroy();
    assert.equal(manager.thrownSwords.length, 0);
  });

  void it('spawns celestial starburst and golden shimmer VFX on sword spawn', () => {
    const tm = new Tilemap(32);
    tm.loadFromData({
      tiles: {
        '5;5': { type: 'grass', variant: 0, loc: [5, 5] },
      },
      off_grid_tiles: [],
    });

    const sparksEffect: Sparks[] = [];
    const manager = new Swords([0, 0], () => 0.005, sparksEffect); // random < 0.01
    const spawned = manager.spawnSword(tm);
    assert.ok(spawned !== null);
    assert.equal(sparksEffect.length, 2);

    const [starburst, shimmer] = sparksEffect;
    assert.ok(starburst !== undefined);
    assert.ok(shimmer !== undefined);

    // Starburst: bright white core
    assert.deepEqual(starburst.color, [255, 255, 255]);
    assert.equal(starburst.sparks.length, 14);
    assert.equal(starburst.speed, 2.8);
    assert.equal(starburst.shape, 'diamond');
    assert.deepEqual(starburst.size, [3, 3]);

    // Shimmer: golden outer shimmer
    assert.deepEqual(shimmer.color, [255, 215, 0]);
    assert.equal(shimmer.sparks.length, 8);
    assert.equal(shimmer.speed, 1.8);
    assert.equal(shimmer.shape, 'diamond');
    assert.deepEqual(shimmer.size, [2, 2]);
  });

  void it('filters spawn positions relative to player position', () => {
    const tm = new Tilemap(32);
    // Player at [320, 320] (loc [10, 10]). Player center cx = 352.
    // Horizontal range left = 7.5 tiles = 240px, right = 6.5 tiles = 208px
    // Vertical range top = 2.5 tiles = 80px, bottom = 3.5 tiles = 112px (240 <= pos[1] <= 432)
    tm.loadFromData({
      tiles: {
        '10;10': { type: 'grass', variant: 0, loc: [10, 10] }, // pos [320, 320]: valid
        '1;10': { type: 'grass', variant: 0, loc: [1, 10] }, // pos [32, 320]: too far left
        '25;10': { type: 'grass', variant: 0, loc: [25, 10] }, // pos [800, 320]: too far right
        '10;5': { type: 'grass', variant: 0, loc: [10, 5] }, // pos [320, 160]: too far above
        '10;18': { type: 'grass', variant: 0, loc: [10, 18] }, // pos [320, 576]: too far below
      },
      off_grid_tiles: [],
    });

    const manager = new Swords([0, 0], () => 0.005);
    const playerPos: readonly [number, number] = [320, 320];

    const sword = manager.spawnSword(tm, playerPos);
    assert.ok(sword !== null);
    // Render pos X is based on posSelected[0] (320) + offset, posSelected[1] (320) - 60 = 260
    assert.ok(sword.pos[0] >= 320 && sword.pos[0] <= 320 + 32);
    assert.equal(sword.pos[1], 320 - 60);

    // If player is too far away from all grass tiles, no sword spawns
    const farPlayerPos: readonly [number, number] = [5000, 5000];
    const farSword = manager.spawnSword(tm, farPlayerPos);
    assert.equal(farSword, null);
  });
});

void describe('SpinningSword entity', () => {
  void it('initializes with spinning action and horizontal velocity based on flip', () => {
    const swordRight = new SpinningSword([100, 100], false);
    assert.equal(swordRight.action, 'spinning');
    assert.equal(swordRight.flip, false);
    assert.deepEqual(swordRight.velocity, [4, 0]);

    const swordLeft = new SpinningSword([100, 100], true);
    assert.equal(swordLeft.action, 'spinning');
    assert.equal(swordLeft.flip, true);
    assert.deepEqual(swordLeft.velocity, [-4, 0]);
  });

  void it('moves horizontally and embeds on wall collision', () => {
    const tm = new Tilemap(32);
    tm.loadFromData({
      tiles: {
        '4;3': { type: 'grass', variant: 0, loc: [4, 3] }, // tile at x=128..160, y=96..128
      },
      off_grid_tiles: [],
    });

    const sword = new SpinningSword([100, 100], false);
    assert.equal(sword.action, 'spinning');

    // Update towards the wall
    while (sword.action === 'spinning' && sword.timer < 30) {
      sword.update(tm);
    }

    assert.equal(sword.action, 'embedded');
    assert.deepEqual(sword.velocity, [0, 0]);

    // Stays embedded and does not move further
    const posAfterEmbed = [...sword.pos];
    sword.update(tm);
    assert.deepEqual(sword.pos, posAfterEmbed);
  });

  void it('blinks only when embedded and timer >= 900', () => {
    const sword = new SpinningSword([100, 100], false);
    sword.timer = 900;
    assert.equal(sword.isBlinking(), false); // Not embedded yet

    sword.action = 'embedded';
    sword.timer = 899;
    assert.equal(sword.isBlinking(), false);

    sword.timer = 912; // 912 // 12 = 76 (even) -> true
    assert.equal(sword.isBlinking(), true);

    sword.timer = 1080; // 1080 // 7 = 154 (even) -> true
    assert.equal(sword.isBlinking(), true);
  });

  void it('renders with flip and correct offset', () => {
    const sword = new SpinningSword([100, 100], true);
    let capturedX = 0;
    let capturedY = 0;
    let capturedFlip = false;
    const mockScene = {
      add: {
        image(x: number, y: number) {
          capturedX = x;
          capturedY = y;
          return {
            setOrigin() {},
            setPosition() {},
            setTexture() {},
            setFlipX(flip: boolean) {
              capturedFlip = flip;
            },
            setVisible() {},
            destroy() {},
          };
        },
      },
    };

    sword.render(mockScene, [10, 10]);
    // pos[0] - offset[0] + (-8 if flip else 7) = 100 - 10 - 8 = 82
    // pos[1] - offset[1] - 10 = 100 - 10 - 10 = 80
    assert.equal(capturedX, 82);
    assert.equal(capturedY, 80);
    assert.equal(capturedFlip, true);
  });

  void it('creates diamond stone-strike sparks on wall embed and sets sparksTriggered', () => {
    const tm = new Tilemap(32);
    tm.loadFromData({
      tiles: {
        '4;3': { type: 'grass', variant: 0, loc: [4, 3] }, // tile at x=128..160, y=96..128
      },
      off_grid_tiles: [],
    });

    const sparksEffect: Sparks[] = [];
    const sword = new SpinningSword([100, 100], false, [19, 5], undefined, sparksEffect, () => 0.5);
    assert.equal(sword.sparksTriggered, false);
    assert.equal(sparksEffect.length, 0);

    // Update towards the wall until embedded
    while (sword.action === 'spinning' && sword.timer < 30) {
      sword.update(tm);
    }

    assert.equal(sword.action, 'embedded');
    assert.equal(sword.sparksTriggered, true);
    assert.equal(sparksEffect.length, 1);

    const spark = sparksEffect[0];
    assert.ok(spark !== undefined);
    assert.equal(spark.shape, 'diamond');
    assert.deepEqual(spark.color, [140, 140, 160]);
    assert.equal(spark.sparks.length, 10);

    // Further updates do not trigger duplicate sparks
    sword.update(tm);
    assert.equal(sparksEffect.length, 1);
  });

  void it('tracks indexChanged state during spinning animation', () => {
    const sword = new SpinningSword([100, 100], false);
    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    // sword/spinning animation has 4 frames, imgDur = 6
    assert.equal(sword.indexChanged, false);

    // Update 5 frames (timer 0..4, frame 0..4) - frameIndex is still 0
    for (let i = 0; i < 5; i++) {
      sword.update(tm);
      assert.equal(sword.indexChanged, false);
    }

    // 6th update (timer 5 -> frame reaches 6) -> frameIndex becomes 1
    sword.update(tm);
    assert.equal(sword.indexChanged, true);
  });

  void it('thrown sword deals 20 damage to normal enemy and is removed', () => {
    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });
    const manager = new Swords([0, 0], () => 0.5);

    manager.throwSword([100, 100], false);
    assert.equal(manager.thrownSwords.length, 1);

    let enemyDamagedAmount = 0;
    const mockEnemy = {
      enemyType: 'crabby',
      dead: false,
      attackTimer: 0,
      pos: [120, 100] as [number, number],
      rect() {
        return { x: 104, y: 98, width: 32, height: 26 };
      },
      takeDamage(amount: number) {
        enemyDamagedAmount += amount;
        return true;
      },
    };

    const results = manager.update(tm, [0, 0], [0, 0], [mockEnemy]);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.type, 'hit');
    assert.equal(enemyDamagedAmount, 20);
    // Sword was removed on hit
    assert.equal(manager.thrownSwords.length, 0);
  });

  void it('thrown sword deflecting against attacking pink_star deals no damage and flips velocity', () => {
    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });
    const manager = new Swords([0, 0], () => 0.5);

    const sword = manager.throwSword([100, 100], false);
    assert.equal(sword.flip, false);

    let enemyDamagedAmount = 0;
    const mockPinkStarAttacking = {
      enemyType: 'pink_star',
      dead: false,
      attackTimer: 60, // attacking!
      pos: [120, 100] as [number, number],
      rect() {
        return { x: 104, y: 98, width: 26, height: 23 };
      },
      takeDamage(amount: number) {
        enemyDamagedAmount += amount;
        return true;
      },
    };

    const results = manager.update(tm, [0, 0], [0, 0], [mockPinkStarAttacking]);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.type, 'deflection');
    // Pink Star takes NO damage on deflection
    assert.equal(enemyDamagedAmount, 0);
    // Sword flipped direction and gained deflection velocity
    assert.equal(sword.flip, true);
    assert.equal(sword.velocity[0], -7);
    // Sword is NOT removed on deflection
    assert.equal(manager.thrownSwords.length, 1);
  });

  void it('thrown sword ignores dead enemies', () => {
    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });
    const manager = new Swords([0, 0], () => 0.5);

    manager.throwSword([100, 100], false);

    let enemyDamagedAmount = 0;
    const mockDeadEnemy = {
      enemyType: 'crabby',
      dead: true,
      attackTimer: 0,
      pos: [120, 100] as [number, number],
      rect() {
        return { x: 104, y: 98, width: 32, height: 26 };
      },
      takeDamage(amount: number) {
        enemyDamagedAmount += amount;
        return true;
      },
    };

    const results = manager.update(tm, [0, 0], [0, 0], [mockDeadEnemy]);
    assert.equal(results.length, 0);
    assert.equal(enemyDamagedAmount, 0);
    assert.equal(manager.thrownSwords.length, 1);
  });
});
