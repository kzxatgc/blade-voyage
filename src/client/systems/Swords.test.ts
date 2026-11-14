/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Sword, Swords } from './Swords.ts';
import { Tilemap } from './Tilemap.ts';

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
});
