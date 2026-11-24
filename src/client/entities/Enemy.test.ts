/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Enemy,
  PARTICLE_POS_ADJUSTMENT,
  ATTACK_EFFECT_POS_ADJUSTMENT,
  DIALOGUE_POS_ADJUSTMENT,
  ENEMY_BEHIND_TOUCH_DIST,
  ENEMY_SIGHT_RANGE_X,
  ENEMY_POST_ATTACK_COOLDOWN,
} from './Enemy.ts';
import { Tilemap } from '../systems/Tilemap.ts';
import { Sparks } from '../systems/Sparks.ts';

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

  void it('positions dead dialogue beside the head for every enemy facing', () => {
    const enemyConfigs = [
      ['pink_star', [26, 23]],
      ['crabby', [32, 26]],
      ['fierce_tooth', [24, 20]],
    ] as const;

    for (const [type, size] of enemyConfigs) {
      for (const deathFacing of [false, true]) {
        const enemy = new Enemy(type, [100, 100], [size[0], size[1]]);
        enemy.flip = deathFacing;
        enemy.generateDialogue('exclamation');
        enemy.health = 0;
        enemy.update(new Tilemap(32));

        const images: { x: number; y: number; flipX?: boolean }[] = [];
        const mockScene = {
          add: {
            image(x: number, y: number) {
              const image = {
                x,
                y,
                flipX: false,
                setOrigin() {},
                setPosition(nextX: number, nextY: number) {
                  image.x = nextX;
                  image.y = nextY;
                },
                setTexture() {},
                setFlipX(flipX: boolean) {
                  image.flipX = flipX;
                },
                setVisible() {},
                destroy() {},
              };
              images.push(image);
              return image;
            },
          },
        };

        enemy.render(mockScene);

        const deadAdjustment = DIALOGUE_POS_ADJUSTMENT[type].dead;
        const dialogueFacing = !deathFacing;
        assert.equal(enemy.deathFlip, deathFacing);
        assert.equal(enemy.dialogueType, 'dead');
        assert.equal(images[0]?.flipX, !deathFacing);
        assert.equal(images[1]?.flipX, false);
        assert.equal(
          images[1]?.x,
          100 +
            (dialogueFacing
              ? size[0] + deadAdjustment[0]
              : deadAdjustment[1])
        );
        assert.equal(images[1]?.y, 100 + deadAdjustment[2]);
        enemy.destroy();
      }
    }
  });

  void it('clears an exclamation when hit and does not restore it after knockback', () => {
    const enemy = new Enemy('pink_star', [100, 100], [26, 23]);
    enemy.random = () => 1;
    enemy.anticipationState = true;
    enemy.generateDialogue('exclamation');
    enemy.applyKnockback(1);

    assert.equal(enemy.dialogueAnimation, null);
    assert.equal(enemy.dialogueType, '');
    assert.equal(enemy.anticipationState, false);

    const tilemap = new Tilemap(32);
    tilemap.loadFromData({ tiles: {}, off_grid_tiles: [] });
    for (let frame = 0; frame <= enemy.knockbackDuration; frame += 1) {
      enemy.update(tilemap);
    }

    assert.equal(enemy.dialogueAnimation, null);
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

    // Player is to the left (-50px > 48px behind range, enemy is facing right)
    enemy.update(tm, [0, 0], [110, 195]);
    assert.equal(enemy.anticipationState, false);

    // Reset walking and test player too far vertically (45px > 24px)
    enemy.walking = 1;
    enemy.update(tm, [0, 0], [210, 240]);
    assert.equal(enemy.anticipationState, false);
  });

  void it('detects player immediately while patrolling mid-walk', () => {
    const enemy = new Enemy('pink_star', [160, 195], [26, 23]);
    enemy.walking = 60; // in the middle of a walk
    enemy.flip = false;

    const tm = new Tilemap(32);
    tm.loadFromData({
      tiles: {
        '4;7': { type: 'grass', variant: 0, loc: [4, 7] },
        '5;7': { type: 'grass', variant: 0, loc: [5, 7] },
      },
      off_grid_tiles: [],
    });

    enemy.update(tm, [0, 0], [220, 195]);
    assert.equal(enemy.anticipationState, true);
    assert.equal(enemy.walking, 0); // walking cancelled
  });

  void it('detects player within tuned 4.5 tiles (144px) and ignores beyond 144px', () => {
    assert.equal(ENEMY_SIGHT_RANGE_X.pink_star, 144);
    assert.equal(ENEMY_SIGHT_RANGE_X.crabby, 80);
    assert.equal(ENEMY_SIGHT_RANGE_X.fierce_tooth, 80);
    assert.equal(ENEMY_POST_ATTACK_COOLDOWN, 90);

    const enemy = new Enemy('pink_star', [160, 195], [26, 23]);
    enemy.walking = 10;
    enemy.flip = false;

    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    // Player at 140px to the right (<= 144px): detected!
    enemy.update(tm, [0, 0], [160 + 140, 195]);
    assert.equal(enemy.anticipationState, true);

    // Reset and test player at 150px to the right (> 144px): ignored!
    const enemy2 = new Enemy('pink_star', [160, 195], [26, 23]);
    enemy2.walking = 10;
    enemy2.flip = false;
    enemy2.update(tm, [0, 0], [160 + 150, 195]);
    assert.equal(enemy2.anticipationState, false);
  });

  void it('blocks detection if a solid wall is between enemy and player', () => {
    const enemy = new Enemy('pink_star', [160, 195], [26, 23]);
    enemy.walking = 10;
    enemy.flip = false;

    const tm = new Tilemap(32);
    // Enemy is around col 5 (x=160), Player is at col 9 (x=300). Solid wall at col 7 (x=224, y=192).
    tm.loadFromData({
      tiles: {
        '7;6': { type: 'grass', variant: 0, loc: [7, 6] },
      },
      off_grid_tiles: [],
    });

    enemy.update(tm, [0, 0], [300, 195]);
    assert.equal(enemy.anticipationState, false); // wall blocks vision!
  });

  void it('detects player touching enemy from behind and turns around', () => {
    const enemy = new Enemy('pink_star', [160, 195], [26, 23]);
    enemy.walking = 10;
    enemy.flip = false; // facing right

    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    // Player touches from behind (15px to the left <= 1.5-tile range)
    enemy.update(tm, [0, 0], [145, 195]);
    assert.equal(enemy.flip, true); // turned around!
    assert.equal(enemy.anticipationState, true);
    assert.equal(enemy.walking, 0);

    // Crabby has 48px rear awareness (1.5 tiles)
    const crabby = new Enemy('crabby', [160, 195], [32, 26]);
    crabby.walking = 10;
    crabby.flip = false;
    // 35px behind: within 48px -> turns around and triggers anticipation
    crabby.update(tm, [0, 0], [125, 195]);
    assert.equal(crabby.flip, true);
    assert.equal(crabby.anticipationState, true);

    // Crabby: 60px behind (> 48px) -> not detected
    const crabbyFar = new Enemy('crabby', [160, 195], [32, 26]);
    crabbyFar.walking = 0;
    crabbyFar.flip = false;
    crabbyFar.update(tm, [0, 0], [100, 195]);
    assert.equal(crabbyFar.flip, false);
    assert.equal(crabbyFar.anticipationState, false);
  });

  void it('uses 40px for Pink Star rear awareness', () => {
    assert.equal(ENEMY_BEHIND_TOUCH_DIST.pink_star, 40);

    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    const withinRange = new Enemy('pink_star', [160, 195], [26, 23]);
    withinRange.flip = false;
    const detectedWithinRange = withinRange.checkPlayerDetection(
      tm,
      [160 - 40, 195]
    );
    assert.equal(detectedWithinRange, true);
    assert.equal(withinRange.flip, true);
    assert.equal(withinRange.anticipationState, true);

    const outsideRange = new Enemy('pink_star', [160, 195], [26, 23]);
    outsideRange.flip = false;
    const detectedOutsideRange = outsideRange.checkPlayerDetection(
      tm,
      [160 - 41, 195]
    );
    assert.equal(detectedOutsideRange, false);
    assert.equal(outsideRange.flip, false);
    assert.equal(outsideRange.anticipationState, false);
  });

  void it('resets walking to 0 and sets hit action on knockback', () => {
    const enemy = new Enemy('pink_star', [160, 195], [26, 23]);
    enemy.walking = 20;
    enemy.applyKnockback(1);
    assert.ok(Math.abs(enemy.knockbackVelocity[0] - 3.45) < 0.000001);
    assert.equal(enemy.velocity[1], 0);

    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    enemy.update(tm);
    assert.equal(enemy.walking, 0);
    assert.equal(enemy.action, 'hit');
  });

  void it('uses the regular hit knockback on fatal hits', () => {
    const regularEnemy = new Enemy('pink_star', [160, 195], [26, 23]);
    regularEnemy.applyKnockback(1);

    const enemy = new Enemy('pink_star', [160, 195], [26, 23]);
    enemy.takeDamage(enemy.health);
    enemy.applyKnockback(1);

    assert.equal(enemy.dead, true);
    assert.equal(enemy.velocity[1], regularEnemy.velocity[1]);
    assert.equal(enemy.knockbackVelocity[0], regularEnemy.knockbackVelocity[0]);
  });

  void it('clears the attack wind effect when the enemy dies mid-attack', () => {
    const enemy = new Enemy('pink_star', [160, 195], [26, 23]);
    enemy.attack();
    assert.notEqual(enemy.attackEffect, null);

    enemy.health = 1;
    enemy.takeDamage(1);

    assert.equal(enemy.dead, true);
    assert.equal(enemy.attackEffect, null);
    assert.equal(enemy.attackTimer, 0);
    enemy.attack();
    assert.equal(enemy.attackEffect, null);
  });

  void it('clears attack wind effects when the player target dies', () => {
    const enemy = new Enemy('pink_star', [160, 195], [26, 23]);
    const tilemap = new Tilemap(32);
    enemy.attack();
    assert.notEqual(enemy.attackEffect, null);

    enemy.update(
      tilemap,
      [0, 0],
      {
        pos: [160, 195],
        dead: true,
        rect: () => enemy.rect(),
      }
    );

    assert.equal(enemy.attackEffect, null);
    assert.equal(enemy.attackTimer, 0);
  });

  void it('pink_star attack sets attackTimer to 120, velocity to 2, and spawns grass sparks', () => {
    const sparksEffect: Sparks[] = [];
    const enemy = new Enemy('pink_star', [100, 100], [26, 23], undefined, undefined, sparksEffect);
    enemy.flip = false;
    enemy.attack();

    assert.equal(enemy.attackTimer, 120);
    assert.equal(enemy.velocity[0], 2);
    assert.ok(enemy.attackEffect !== null);
    assert.equal(sparksEffect.length, 2); // 2 colors in GRASS_COLORS

    // Facing left
    enemy.flip = true;
    enemy.attack();
    assert.equal(enemy.velocity[0], -2);
  });

  void it('pink_star charges during attack, bounces on wall collision, and resets when attackTimer ends', () => {
    const enemy = new Enemy('pink_star', [160, 195], [26, 23]);
    enemy.flip = false;
    enemy.attack();
    assert.equal(enemy.attackTimer, 120);
    assert.equal(enemy.velocity[0], 2);

    const tm = new Tilemap(32);
    // Row 7 ground (Y = 224), wall at col 6 row 6 (X = 192..224, Y = 192..224)
    tm.loadFromData({
      tiles: {
        '4;7': { type: 'grass', variant: 0, loc: [4, 7] },
        '5;7': { type: 'grass', variant: 0, loc: [5, 7] },
        '6;6': { type: 'grass', variant: 0, loc: [6, 6] },
      },
      off_grid_tiles: [],
    });

    // Tick 1: charges forward at velocity 2
    enemy.update(tm);
    assert.equal(enemy.action, 'attack');
    assert.equal(enemy.attackTimer, 119);

    // Charge until enemy hits the wall at column 6
    while (!enemy.flip && enemy.attackTimer > 0) {
      enemy.update(tm);
    }

    assert.equal(enemy.flip, true); // bounced against wall & reversed
    assert.equal(enemy.velocity[0], -2);

    // Run until attack ends
    enemy.attackTimer = 1;
    enemy.update(tm);
    assert.equal(enemy.attackTimer, 0);
    assert.equal(enemy.attackEffect, null);
    assert.deepEqual(enemy.velocity, [0, 0]);
    assert.equal(enemy.attackCooldown, 90);
  });

  void it('pink_star detects attack hit when charging into player, but not while idle', () => {
    const enemy = new Enemy('pink_star', [100, 100], [26, 23]);
    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    const pRect = enemy.rect();
    const overlappingPlayer = {
      pos: [pRect.x, pRect.y] as [number, number],
      rect() {
        return { x: pRect.x, y: pRect.y, width: 20, height: 28 };
      },
    };

    // Idle overlap: attackHitDetected is false (no contact damage)
    enemy.update(tm, [0, 0], overlappingPlayer);
    assert.equal(enemy.attackHitDetected, false);

    // Active charge attack overlap: attackHitDetected becomes true
    enemy.attack();
    enemy.update(tm, [0, 0], overlappingPlayer);
    assert.equal(enemy.attackHitDetected, true);
  });

  void it('anticipation state sets action, generates exclamation dialogue, triggers SFX on frame 1, and calls attack when done', () => {
    const enemy = new Enemy('pink_star', [160, 195], [26, 23]);
    enemy.anticipationState = true;

    const sfxPlayed: string[] = [];
    enemy.playSfx = (sfx: string) => {
      sfxPlayed.push(sfx);
    };

    const tm = new Tilemap(32);
    tm.loadFromData({
      tiles: {
        '5;7': { type: 'grass', variant: 0, loc: [5, 7] },
      },
      off_grid_tiles: [],
    });

    // Tick 1: starts anticipation, generates exclamation dialogue
    enemy.update(tm);
    assert.equal(enemy.action, 'anticipation');
    assert.ok(enemy.dialogueAnimation !== null);
    assert.equal(enemy.dialogueType, 'exclamation');
    assert.equal(enemy.dialogueExclamationSfxTriggered, false);

    // When dialogue animation reaches frame 12 (frameIndex 1, duration is 12)
    if (enemy.dialogueAnimation) {
      enemy.dialogueAnimation.frame = 12;
    }
    enemy.update(tm);
    assert.equal(enemy.dialogueExclamationSfxTriggered, true);
    assert.deepEqual(sfxPlayed, ['dialogue/exclamation']);

    // When main animation completes: anticipation finishes, calls attack()
    if (enemy.animation) {
      enemy.animation.done = true;
    }
    enemy.update(tm);
    assert.equal(enemy.anticipationState, false);
    assert.equal(enemy.dialogueAnimation, null);
    assert.equal(enemy.dialogueExclamationSfxTriggered, false);
    assert.equal(enemy.attackTimer, 120); // attack() was called!
  });

  void it('renders exclamation dialogue and attack effect sprites', () => {
    const enemy = new Enemy('pink_star', [100, 100], [26, 23]);
    enemy.anticipationState = true;
    enemy.generateDialogue('exclamation');
    enemy.attack(); // creates attackEffect

    const createdImages: {
      texture: string;
      x: number;
      y: number;
      flipX?: boolean;
      destroyed?: boolean;
    }[] = [];
    const mockScene = {
      add: {
        image(x: number, y: number, texture: string) {
          const img = {
            texture,
            x,
            y,
            flipX: false,
            destroyed: false,
            setOrigin() {},
            setPosition(nx: number, ny: number) {
              img.x = nx;
              img.y = ny;
            },
            setTexture(t: string) {
              img.texture = t;
            },
            setFlipX(f: boolean) {
              img.flipX = f;
            },
            setVisible() {},
            destroy() {
              img.destroyed = true;
            },
          };
          createdImages.push(img);
          return img;
        },
      },
    };

    enemy.render(mockScene);
    // Should create 3 images: base enemy, dialogue, and attack_effect
    assert.equal(createdImages.length, 3);
    assert.ok(createdImages[0]?.texture.startsWith('enemy/pink_star/'));
    assert.ok(createdImages[1]?.texture.startsWith('dialogue/exclamation'));
    assert.ok(createdImages[2]?.texture.startsWith('enemy/pink_star/attack_effect'));

    enemy.health = 1;
    enemy.takeDamage(1);
    assert.equal(createdImages[2]?.destroyed, true);

    enemy.destroy();
  });

  void it('crabby attack timer is 24', () => {
    const enemy = new Enemy('crabby', [100, 100], [32, 26]);
    enemy.attack();
    assert.equal(enemy.attackTimer, 24);
  });

  void it('fierce_tooth attack timer is 30', () => {
    const enemy = new Enemy('fierce_tooth', [100, 100], [24, 20]);
    enemy.attack();
    assert.equal(enemy.attackTimer, 30);
  });

  void it('uses the facing direction for directional enemy attacks', () => {
    const enemy = new Enemy('fierce_tooth', [100, 100], [24, 20]);
    const targetRect = { x: 80, y: 108, width: 20, height: 28 };

    enemy.flip = false;
    assert.equal(enemy.getAttackKnockbackDirection(targetRect), 1);
    enemy.flip = true;
    assert.equal(enemy.getAttackKnockbackDirection(targetRect), -1);
  });

  void it("uses the target side for Crabby's bidirectional attack", () => {
    const enemy = new Enemy('crabby', [100, 100], [32, 26]);
    enemy.flip = true;
    assert.equal(
      enemy.getAttackKnockbackDirection({
        x: 140,
        y: 103,
        width: 20,
        height: 28,
      }),
      1
    );
    assert.equal(
      enemy.getAttackKnockbackDirection({
        x: 100,
        y: 103,
        width: 20,
        height: 28,
      }),
      -1
    );
    assert.equal(
      enemy.getAttackKnockbackDirection({
        x: 126,
        y: 103,
        width: 20,
        height: 28,
      }),
      -1
    );
  });

  void it('crabby melee attack detects hits during active frames (>= 12) with range 40', () => {
    const enemy = new Enemy('crabby', [100, 100], [32, 26]);
    enemy.flip = false; // facing right
    enemy.attack();
    assert.equal(enemy.attackTimer, 24);
    assert.ok(enemy.attackEffect !== null);

    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    // Range rect: flip=false, expansion [40, 0].
    // enemy pos: 100, 100. rectPosAdjustment for crabby is [20, 3].
    // rect.x = 120, width = 32 + 40 = 72. (covers x: 120..192, y: 103..129)
    // Place mock player at x: 150, y: 105, width: 20, height: 28
    const mockPlayer = {
      pos: [150, 105] as [number, number],
      rect() {
        return { x: 150, y: 105, width: 20, height: 28 };
      },
    };

    // Frame 1 (timer becomes 23 >= 12): hitbox is active and intersects player!
    enemy.update(tm, [0, 0], mockPlayer);
    assert.equal(enemy.action, 'attack');
    assert.equal(enemy.attackTimer, 23);
    assert.equal(enemy.attackHitDetected, true);

    // When timer drops below 12: hitbox is no longer active
    enemy.attackTimer = 11;
    enemy.update(tm, [0, 0], mockPlayer);
    assert.equal(enemy.attackHitDetected, false);

    // When attackEffect finishes: attackEffect is cleared
    if (enemy.attackEffect) {
      enemy.attackEffect.done = true;
    }
    enemy.update(tm, [0, 0], mockPlayer);
    assert.equal(enemy.attackEffect, null);
  });

  void it('fierce_tooth melee attack detects hits during active frames (>= 15) with range 26', () => {
    const enemy = new Enemy('fierce_tooth', [100, 100], [24, 20]);
    enemy.flip = false;
    enemy.attack();
    assert.equal(enemy.attackTimer, 30);
    assert.ok(enemy.attackEffect !== null);

    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    // fierce_tooth rectPosAdjustment is [5, 8]. rect: x=105, y=108, w=24+26=50.
    const mockPlayer = {
      pos: [130, 108] as [number, number],
      rect() {
        return { x: 130, y: 108, width: 20, height: 28 };
      },
    };

    // Frame 1 (timer becomes 29 >= 15): hitbox is active and intersects player!
    enemy.update(tm, [0, 0], mockPlayer);
    assert.equal(enemy.action, 'attack');
    assert.equal(enemy.attackTimer, 29);
    assert.equal(enemy.attackHitDetected, true);

    // Below frame 15: hitbox inactive
    enemy.attackTimer = 14;
    enemy.update(tm, [0, 0], mockPlayer);
    assert.equal(enemy.attackHitDetected, false);
  });

  void it('detects contact collision when player body overlaps enemy body rect', () => {
    const enemy = new Enemy('crabby', [100, 100], [32, 26]);
    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    // Overlapping player rect directly on crabby rect
    const crabbyRect = enemy.rect();
    const overlappingPlayer = {
      pos: [crabbyRect.x, crabbyRect.y] as [number, number],
      rect() {
        return { x: crabbyRect.x, y: crabbyRect.y, width: 20, height: 28 };
      },
    };

    enemy.update(tm, [0, 0], overlappingPlayer);
    assert.equal(enemy.contactCollisionDetected, true);

    // Far player: no contact collision
    const farPlayer = {
      pos: [500, 500] as [number, number],
      rect() {
        return { x: 500, y: 500, width: 20, height: 28 };
      },
    };
    enemy.update(tm, [0, 0], farPlayer);
    assert.equal(enemy.contactCollisionDetected, false);
  });

  void it('attackCooldown prevents player detection until 90 frames elapse', () => {
    const enemy = new Enemy('crabby', [100, 100], [32, 26]);
    enemy.flip = false;
    const tm = new Tilemap(32);
    tm.loadFromData({ tiles: {}, off_grid_tiles: [] });

    const playerNear = {
      pos: [140, 100] as [number, number],
      rect() {
        return { x: 140, y: 100, width: 20, height: 28 };
      },
    };

    // Simulate an attack finishing
    enemy.attack();
    assert.equal(enemy.attackTimer, 24);
    enemy.attackTimer = 1;
    enemy.update(tm, [0, 0], playerNear);
    assert.equal(enemy.attackTimer, 0);
    assert.equal(enemy.attackCooldown, 90);

    // Player remains directly in front (40px away, within 144px vision)
    // While attackCooldown is active (e.g., 89 frames remaining), player is NOT detected
    enemy.update(tm, [0, 0], playerNear);
    assert.equal(enemy.attackCooldown, 89);
    assert.equal(enemy.anticipationState, false);

    // Fast-forward cooldown to 2
    enemy.attackCooldown = 2;
    enemy.update(tm, [0, 0], playerNear);
    // On this tick, attackCooldown decrements to 1 (> 0), so player is still not detected
    assert.equal(enemy.attackCooldown, 1);
    assert.equal(enemy.anticipationState, false);

    // Next tick: cooldown decrements to 0, player is immediately detected!
    enemy.update(tm, [0, 0], playerNear);
    assert.equal(enemy.attackCooldown, 0);
    assert.equal(enemy.anticipationState, true);
  });

  void it('default anticipation animation duration is 12 (36 ticks / 0.6s telegraph) for all enemies', () => {
    const pinkStar = new Enemy('pink_star', [100, 100], [26, 23]);
    const psAnticipation = pinkStar.animations?.['enemy/pink_star/anticipation'];
    assert.ok(psAnticipation);
    assert.equal(psAnticipation.imgDur, 12);
    assert.equal(psAnticipation.frameCount, 3); // 3 * 12 = 36 ticks (0.6s)

    const crabby = new Enemy('crabby', [100, 100], [32, 26]);
    const crabbyAnticipation = crabby.animations?.['enemy/crabby/anticipation'];
    assert.ok(crabbyAnticipation);
    assert.equal(crabbyAnticipation.imgDur, 12);
    assert.equal(crabbyAnticipation.frameCount, 3); // 3 * 12 = 36 ticks (0.6s)

    const fierceTooth = new Enemy('fierce_tooth', [100, 100], [24, 20]);
    const ftAnticipation = fierceTooth.animations?.['enemy/fierce_tooth/anticipation'];
    assert.ok(ftAnticipation);
    assert.equal(ftAnticipation.imgDur, 12);
    assert.equal(ftAnticipation.frameCount, 3); // 3 * 12 = 36 ticks (0.6s)
  });

  void it('computes detection rect and melee attack rect correctly', () => {
    // 1. Crabby facing right (flip = false) - sight range 80px (2.5 tiles), rear awareness 48px
    const crabby = new Enemy('crabby', [200, 200], [32, 26]);
    crabby.flip = false;
    // Crabby rectPosAdjustment is [20, 3]. pos [200, 200] -> bodyRect x 220, y 203, size [32, 26].
    const detRight = crabby.getDetectionRect();
    assert.deepEqual(detRight, {
      x: 220 - 48, // 172 (48px behind Crabby)
      y: 203 - 24, // 179
      width: 80 + 32 + 48, // 160 (5 tiles)
      height: 26 + 48, // 74
    });

    // When facing left (flip = true), Crabby detection rect has the EXACT same 48px behind distance on the right
    crabby.flip = true;
    const detLeft = crabby.getDetectionRect();
    assert.deepEqual(detLeft, {
      x: 220 - 80, // 140 (80px forward)
      y: 203 - 24, // 179
      width: 80 + 32 + 48, // 160 (right edge at 300, exactly 48px behind Crabby body at 252)
      height: 26 + 48, // 74
    });

    const crabbyAtkRight = crabby.getMeleeAttackRangeRect();
    assert.ok(crabbyAtkRight !== null);
    // Symmetrical dual-claw coverage: extends 25px both back and front -> x = 220 - 25 = 195, w = 32 + 50 = 82
    assert.deepEqual(crabbyAtkRight, {
      x: 195,
      y: 203,
      width: 82,
      height: 26,
    });

    // When facing left (flip = true), Crabby attack hitbox is identical (symmetrical front & back)
    crabby.flip = true;
    const crabbyAtkLeft = crabby.getMeleeAttackRangeRect();
    assert.deepEqual(crabbyAtkLeft, crabbyAtkRight);

    // 2. Fierce Tooth facing left (flip = true) - sight range 80px (2.5 tiles), rear awareness 48px
    const fierceTooth = new Enemy('fierce_tooth', [200, 200], [24, 20]);
    fierceTooth.flip = true;
    // FT rectPosAdjustment is [5, 8]. pos [200, 200] -> bodyRect x 205, y 208, size [24, 20].
    const ftDetLeft = fierceTooth.getDetectionRect();
    assert.deepEqual(ftDetLeft, {
      x: 205 - 80, // 125 (80px forward)
      y: 208 - 24, // 184
      width: 80 + 24 + 48, // 152
      height: 20 + 48, // 68
    });

    const ftAtk = fierceTooth.getMeleeAttackRangeRect();
    assert.ok(ftAtk !== null);
    // facing left (flip = true), expansion [31, 0] -> x = 205 - 31 = 174, w = 24 + 31 = 55
    assert.deepEqual(ftAtk, {
      x: 174,
      y: 208,
      width: 55,
      height: 24,
    });

    // 3. Pink Star has no melee swing box
    const pinkStar = new Enemy('pink_star', [200, 200], [26, 23]);
    assert.equal(pinkStar.getMeleeAttackRangeRect(), null);
  });

  void it('crabby advances toward player when in sight outside melee range and anticipates once in range', () => {
    const crabby = new Enemy('crabby', [100, 195], [32, 26]);
    crabby.flip = false; // facing right

    const tm = new Tilemap(32);
    // Provide floor for 10 tiles (x: 0 to 320) at row 7 (y = 224)
    const tiles: Record<string, { type: string; variant: number; loc: [number, number] }> = {};
    for (let c = 0; c < 10; c++) {
      tiles[`${c};7`] = { type: 'grass', variant: 0, loc: [c, 7] };
    }
    tm.loadFromData({ tiles, off_grid_tiles: [] });

    // Player is 60px to the right (within 80px sight, but outside ~25px melee range)
    const playerTarget = {
      pos: [160, 195] as [number, number],
      rect: () => ({ x: 182, y: 199, width: 20, height: 28 }),
    };

    crabby.update(tm, [0, 0], playerTarget);
    // Should be advancing (chaseState) and not yet anticipating
    assert.equal(crabby.chaseState, true);
    assert.equal(crabby.anticipationState, false);
    assert.equal(crabby.action, 'run');

    // Now player moves into close melee range (e.g. at x = 120)
    const closePlayer = {
      pos: [110, 195] as [number, number],
      rect: () => ({ x: 132, y: 199, width: 20, height: 28 }),
    };
    crabby.update(tm, [0, 0], closePlayer);
    assert.equal(crabby.chaseState, false);
    assert.equal(crabby.anticipationState, true);
    assert.equal(crabby.action, 'anticipation');
  });

  void it('fierce_tooth advances toward player when in sight outside melee range and anticipates once in range', () => {
    const fierceTooth = new Enemy('fierce_tooth', [100, 195], [24, 20]);
    fierceTooth.flip = false; // facing right

    const tm = new Tilemap(32);
    const tiles: Record<string, { type: string; variant: number; loc: [number, number] }> = {};
    for (let c = 0; c < 10; c++) {
      tiles[`${c};7`] = { type: 'grass', variant: 0, loc: [c, 7] };
    }
    tm.loadFromData({ tiles, off_grid_tiles: [] });

    // Player is 65px ahead (within 80px sight, outside 31px jaw snap)
    const playerTarget = {
      pos: [165, 195] as [number, number],
      rect: () => ({ x: 187, y: 199, width: 20, height: 28 }),
    };

    fierceTooth.update(tm, [0, 0], playerTarget);
    assert.equal(fierceTooth.chaseState, true);
    assert.equal(fierceTooth.anticipationState, false);
    assert.equal(fierceTooth.action, 'run');

    // Player enters jaw snap range
    const closePlayer = {
      pos: [115, 195] as [number, number],
      rect: () => ({ x: 125, y: 199, width: 20, height: 28 }),
    };
    fierceTooth.update(tm, [0, 0], closePlayer);
    assert.equal(fierceTooth.chaseState, false);
    assert.equal(fierceTooth.anticipationState, true);
    assert.equal(fierceTooth.action, 'anticipation');
  });

  void it('chasing enemy stops at platform edge and does not walk off cliff', () => {
    const crabby = new Enemy('crabby', [100, 195], [32, 26]);
    crabby.flip = false;

    const tm = new Tilemap(32);
    // Floor ends immediately at column 3 (x: 96-127), no floor ahead at col 4
    tm.loadFromData({
      tiles: {
        '3;7': { type: 'grass', variant: 0, loc: [3, 7] },
      },
      off_grid_tiles: [],
    });

    const playerTarget = {
      pos: [160, 195] as [number, number],
      rect: () => ({ x: 182, y: 199, width: 20, height: 28 }),
    };

    const initialX = crabby.pos[0];
    crabby.update(tm, [0, 0], playerTarget);
    // Ledge detected: moveX becomes 0, crabby stops and does not walk off
    assert.equal(crabby.pos[0], initialX);
  });
});
