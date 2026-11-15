/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Enemy, PARTICLE_POS_ADJUSTMENT, ATTACK_EFFECT_POS_ADJUSTMENT, DIALOGUE_POS_ADJUSTMENT } from './Enemy.ts';
import { Tilemap } from '../systems/Tilemap.ts';

void describe('Enemy entity', () => {
  void it('initializes pink_star with default properties and adjustments', () => {
    const enemy = new Enemy('pink_star', [100, 100], [26, 23]);

    assert.equal(enemy.enemyType, 'pink_star');
    assert.equal(enemy.type, 'enemy/pink_star');
    assert.deepEqual(enemy.pos, [100, 100]);
    assert.deepEqual(enemy.size, [26, 23]);
    assert.equal(enemy.walking, 0);
    assert.equal(enemy.anticipationState, false);
    assert.equal(enemy.attackTimer, 0);
    assert.equal(enemy.health, 100);
    assert.equal(enemy.dead, false);
    assert.equal(enemy.action, 'idle');
    assert.equal(enemy.animationKey, 'enemy/pink_star/idle');
    assert.equal(enemy.animation?.img(), 'enemy/pink_star/idle/0');

    assert.deepEqual(enemy.particlePosAdjustment, PARTICLE_POS_ADJUSTMENT['pink_star']);
    assert.deepEqual(enemy.attackEffectPosAdjustment, ATTACK_EFFECT_POS_ADJUSTMENT['pink_star']);
    assert.deepEqual(enemy.dialoguePosAdjustment, DIALOGUE_POS_ADJUSTMENT['pink_star']);
  });

  void it('initializes crabby with size 32x26', () => {
    const enemy = new Enemy('crabby', [200, 200], [32, 26]);

    assert.equal(enemy.enemyType, 'crabby');
    assert.equal(enemy.type, 'enemy/crabby');
    assert.deepEqual(enemy.size, [32, 26]);
    assert.equal(enemy.animationKey, 'enemy/crabby/idle');
    assert.equal(enemy.animation?.img(), 'enemy/crabby/idle/0');
  });

  void it('initializes fierce_tooth with size 24x20', () => {
    const enemy = new Enemy('fierce_tooth', [300, 300], [24, 20]);

    assert.equal(enemy.enemyType, 'fierce_tooth');
    assert.equal(enemy.type, 'enemy/fierce_tooth');
    assert.deepEqual(enemy.size, [24, 20]);
    assert.equal(enemy.animationKey, 'enemy/fierce_tooth/idle');
    assert.equal(enemy.animation?.img(), 'enemy/fierce_tooth/idle/0');
  });

  void it('generates dialogue animations and ignores duplicate generation calls', () => {
    const enemy = new Enemy('pink_star', [100, 100], [26, 23]);

    assert.equal(enemy.dialogueAnimation, null);
    enemy.generateDialogue('exclamation');
    const dialogue = enemy.dialogueAnimation as unknown as { img(): string } | null;
    assert.ok(dialogue !== null);
    assert.equal(enemy.dialogueType, 'exclamation');
    assert.equal(dialogue?.img(), 'dialogue/exclamation/0');

    // Generating while dialogue is active does not overwrite
    enemy.generateDialogue('dead');
    assert.equal(enemy.dialogueType, 'exclamation');
  });

  void it('renders enemy and flips horizontally based on facing direction', () => {
    const enemy = new Enemy('pink_star', [100, 100], [26, 23]);
    let flipped = false;
    let renderedPos: [number, number] = [0, 0];

    const mockScene = {
      add: {
        image(x: number, y: number) {
          renderedPos = [x, y];
          return {
            setOrigin() {},
            setPosition(nx: number, ny: number) {
              renderedPos = [nx, ny];
            },
            setTexture() {},
            setFlipX(f: boolean) {
              flipped = f;
            },
            destroy() {},
          };
        },
      },
    };

    // When facing right (flip = false), enemy sprite is flipped (not flip = true)
    enemy.flip = false;
    enemy.render(mockScene);
    assert.equal(flipped, true);
    assert.deepEqual(renderedPos, [100, 100]);

    // When facing left (flip = true), enemy sprite is not flipped (not flip = false)
    enemy.flip = true;
    enemy.render(mockScene);
    assert.equal(flipped, false);

    // Destroy cleans up image
    enemy.destroy();
  });

  void it('flips at cliff edge when no solid ground ahead', () => {
    const enemy = new Enemy('pink_star', [160, 200], [26, 23]);
    enemy.walking = 10;
    enemy.flip = false; // facing right
    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] }); // no ground anywhere
    const flipBefore = enemy.flip;
    enemy.update(tm);
    assert.notEqual(enemy.flip, flipBefore); // should flip
  });

  void it('patrols at 0.5 speed and emits run dust when ground exists ahead', () => {
    const enemy = new Enemy('pink_star', [160, 195], [26, 23]);
    enemy.walking = 10;
    enemy.flip = false; // facing right
    enemy.random = () => 0.5; // > 0.005 so no random flip

    const tm = new Tilemap(32);
    // Continuous ground platform at row 7 (y = 224..256), enemy rests on top at pos[1] = 195
    tm.loadFromData({
      tiles: {
        '4;7': { type: 'grass', variant: 0, loc: [4, 7] },
        '5;7': { type: 'grass', variant: 0, loc: [5, 7] },
        '6;7': { type: 'grass', variant: 0, loc: [6, 7] },
      },
      off_grid_tiles: [],
    });

    let particleAdded = false;
    let particleType = '';
    let particlePos: [number, number] = [0, 0];
    let particleFlip = false;
    enemy.particles = {
      addParticle(type, pos, flip) {
        particleAdded = true;
        particleType = type;
        particlePos = [pos[0], pos[1]];
        particleFlip = flip;
      },
    };

    const initialX = enemy.pos[0];
    enemy.update(tm);

    assert.equal(enemy.flip, false);
    assert.equal(enemy.walking, 9);
    assert.equal(enemy.action, 'run');
    assert.equal(enemy.pos[0], initialX + 0.5);
    assert.equal(particleAdded, true);
    assert.equal(particleType, 'enemy/run_dust');
    assert.equal(particleFlip, false);
    // For pink_star flip=false: pos[0] + particlePosAdjustment[0][1] = initialX + 0.5 - 15
    assert.equal(particlePos[0], enemy.pos[0] + PARTICLE_POS_ADJUSTMENT.pink_star[0][1]);
    assert.equal(particlePos[1], enemy.pos[1] + PARTICLE_POS_ADJUSTMENT.pink_star[1]);
  });

  void it('flips on wall collision from previous frame without moving horizontally', () => {
    const enemy = new Enemy('pink_star', [160, 195], [26, 23]);
    enemy.walking = 10;
    enemy.flip = false;
    enemy.collision.right = true; // hit right wall previously

    const tm = new Tilemap(32);
    tm.loadFromData({
      tiles: {
        '5;7': { type: 'grass', variant: 0, loc: [5, 7] },
      },
      off_grid_tiles: [],
    });

    const initialX = enemy.pos[0];
    enemy.update(tm);

    assert.equal(enemy.flip, true); // flipped
    assert.equal(enemy.pos[0], initialX); // did not move horizontally this frame
    assert.equal(enemy.walking, 9);
  });

  void it('randomly flips direction when patrol random check triggers', () => {
    const enemy = new Enemy('pink_star', [160, 195], [26, 23]);
    enemy.walking = 10;
    enemy.flip = false;
    enemy.random = () => 0.001; // < 0.005 triggers random flip

    const tm = new Tilemap(32);
    tm.loadFromData({
      tiles: {
        '4;7': { type: 'grass', variant: 0, loc: [4, 7] },
        '5;7': { type: 'grass', variant: 0, loc: [5, 7] },
        '6;7': { type: 'grass', variant: 0, loc: [6, 7] },
      },
      off_grid_tiles: [],
    });

    const initialX = enemy.pos[0];
    enemy.update(tm);

    assert.equal(enemy.flip, true); // flipped to left
    assert.equal(enemy.pos[0], initialX - 0.5); // moved in the new flipped direction
  });

  void it('starts a new walking bout when idle with random probability < 0.01', () => {
    const enemy = new Enemy('pink_star', [160, 195], [26, 23]);
    enemy.walking = 0;
    enemy.random = () => 0.005; // < 0.01 triggers start of walking

    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    enemy.update(tm);
    // random value 0.005 * 91 = 0.455 -> floor = 0 + 30 = 30 frames
    assert.equal(enemy.walking, 30);
    assert.equal(enemy.action, 'idle'); // started walking bout, movement starts next frame
  });

  void it('transitions to anticipation state when walking ends facing player within 16px vertically', () => {
    const enemy = new Enemy('pink_star', [160, 195], [26, 23]);
    enemy.walking = 1; // 1 frame remaining
    enemy.flip = false; // facing right
    enemy.random = () => 0.5;

    const tm = new Tilemap(32);
    tm.loadFromData({
      tiles: {
        '4;7': { type: 'grass', variant: 0, loc: [4, 7] },
        '5;7': { type: 'grass', variant: 0, loc: [5, 7] },
        '6;7': { type: 'grass', variant: 0, loc: [6, 7] },
      },
      off_grid_tiles: [],
    });

    // Player is to the right (+50px) and within 10px vertically
    const playerPos: [number, number] = [210, 200];
    enemy.update(tm, [0, 0], playerPos);

    assert.equal(enemy.walking, 0);
    assert.equal(enemy.anticipationState, true);
  });

  void it('does not trigger anticipation if player is behind or too far vertically', () => {
    const enemy = new Enemy('pink_star', [160, 195], [26, 23]);
    enemy.walking = 1;
    enemy.flip = false; // facing right
    enemy.random = () => 0.5;

    const tm = new Tilemap(32);
    tm.loadFromData({
      tiles: {
        '4;7': { type: 'grass', variant: 0, loc: [4, 7] },
        '5;7': { type: 'grass', variant: 0, loc: [5, 7] },
        '6;7': { type: 'grass', variant: 0, loc: [6, 7] },
      },
      off_grid_tiles: [],
    });

    // Player is to the left (-50px, enemy is facing right)
    enemy.update(tm, [0, 0], [110, 195]);
    assert.equal(enemy.anticipationState, false);

    // Reset walking and test player too far vertically (30px > 16px)
    enemy.walking = 1;
    enemy.update(tm, [0, 0], [210, 240]);
    assert.equal(enemy.anticipationState, false);
  });

  void it('resets walking to 0 and sets hit action on knockback', () => {
    const enemy = new Enemy('pink_star', [160, 195], [26, 23]);
    enemy.walking = 20;
    enemy.knockback = true;

    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    enemy.update(tm);
    assert.equal(enemy.walking, 0);
    assert.equal(enemy.action, 'hit');
  });
});
