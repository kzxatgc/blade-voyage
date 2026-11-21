/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Potion,
  PotionEffect,
  Potions,
  POTION_SPAWN_CHANCE,
  POTION_LIFETIME_TICKS,
  POTION_BLINK_START_TICKS,
  POTION_FAST_BLINK_START_TICKS,
} from './Potions.ts';
import { Tilemap } from './Tilemap.ts';
import type { Sparks } from './Sparks.ts';

void describe('Potions', () => {
  void it('uses 0.1 percent spawn chance and only allows one potion', () => {
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({
      tiles: {
        '3;8': { type: 'grass', variant: 0, loc: [3, 8] },
        '4;8': { type: 'grass', variant: 0, loc: [4, 8] },
      },
      off_grid_tiles: [],
    });

    const manager = new Potions(() => POTION_SPAWN_CHANCE / 2);
    assert.equal(manager.spawnPotion(tilemap, [100, 224]) !== null, true);
    assert.equal(manager.potions.length, 1);
    assert.equal(manager.spawnPotion(tilemap, [100, 224]), null);
  });

  void it('uses the sword-style celestial burst in pink and white when spawning', () => {
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({
      tiles: {
        '3;8': { type: 'grass', variant: 0, loc: [3, 8] },
      },
      off_grid_tiles: [],
    });
    const sparksEffect: Sparks[] = [];
    const manager = new Potions(() => 0.0001, sparksEffect);

    assert.ok(manager.spawnPotion(tilemap, [100, 224]) !== null);
    assert.equal(sparksEffect.length, 2);
    assert.equal(sparksEffect[0]?.shape, 'diamond');
    assert.equal(sparksEffect[0]?.sparks.length, 22);
    assert.equal(sparksEffect[0]?.speed, 2.8);
    assert.deepEqual(sparksEffect[0]?.size, [3, 3]);
    assert.deepEqual(sparksEffect[0]?.color, [255, 210, 215]);
    assert.equal(sparksEffect[0]?.direction, 'burst');
    assert.equal(sparksEffect[1]?.sparks.length, 13);
    assert.equal(sparksEffect[1]?.speed, 1.8);
    assert.deepEqual(sparksEffect[1]?.size, [2, 2]);
    assert.deepEqual(sparksEffect[1]?.color, [255, 255, 255]);
  });

  void it('heals one health point and removes the potion on pickup', () => {
    const potion = new Potion([100, 200]);
    const potions = new Potions();
    potions.potions = [potion];
    const player = {
      pos: [100, 200] as [number, number],
      health: 2,
      maxHealth: 4,
      rect: () => ({ x: 100, y: 200, width: 20, height: 28 }),
    };

    assert.equal(potions.collect(player), true);
    assert.equal(player.health, 3);
    assert.equal(potions.potions.length, 0);
    assert.equal(potions.effects.length, 1);
  });

  void it('destroys active pickup-effect sprites when the system is destroyed', () => {
    let spriteDestroyed = false;
    const playerRect = { x: 100, y: 200, width: 20, height: 28 };
    const potions = new Potions();
    potions.effects = [new PotionEffect({ rect: () => playerRect })];

    potions.render({
      add: {
        image: () => ({
          setOrigin() {},
          setPosition() {},
          setTexture() {},
          setDepth() {},
          destroy() {
            spriteDestroyed = true;
          },
        }),
      },
    });
    potions.destroy();

    assert.equal(spriteDestroyed, true);
    assert.equal(potions.effects.length, 0);
  });

  void it('keeps the pickup effect centered on the moving player', () => {
    let renderedPosition: [number, number] = [0, 0];
    const playerRect = { x: 100, y: 200, width: 20, height: 28 };
    const effect = new PotionEffect({ rect: () => playerRect });
    const scene = {
      add: {
        image(x: number, y: number) {
          renderedPosition = [x, y];
          return {
            setOrigin() {},
            setPosition(nextX: number, nextY: number) {
              renderedPosition = [nextX, nextY];
            },
            setTexture() {},
            setDepth() {},
            destroy() {},
          };
        },
      },
    };

    effect.render(scene);
    assert.deepEqual(renderedPosition, [110, 214]);

    playerRect.x = 150;
    playerRect.y = 250;
    effect.render(scene, [0, 0], [1.5, -2.5]);
    assert.deepEqual(renderedPosition, [161.5, 261.5]);
  });

  void it('does not collect a potion at full health', () => {
    const potion = new Potion([100, 200]);
    const potions = new Potions();
    potions.potions = [potion];
    const player = {
      pos: [100, 200] as [number, number],
      health: 4,
      maxHealth: 4,
      rect: () => ({ x: 100, y: 200, width: 20, height: 28 }),
    };

    assert.equal(potions.collect(player), false);
    assert.equal(potions.potions.length, 1);
  });

  void it('keeps a potion afloat without falling', () => {
    const potion = new Potion([100, 200]);

    assert.equal(potion.landed, true);
    assert.equal(potion.velocity[1], 0);
  });

  void it('blinks during the final 300 ticks and expires after its lifetime', () => {
    const potion = new Potion([100, 200]);

    potion.timer = POTION_BLINK_START_TICKS - 1;
    assert.equal(potion.isBlinking(), false);

    potion.timer = POTION_BLINK_START_TICKS;
    assert.equal(
      potion.isBlinking(),
      Math.floor(POTION_BLINK_START_TICKS / 12) % 2 === 0
    );

    potion.timer = POTION_FAST_BLINK_START_TICKS;
    assert.equal(potion.isBlinking(), Math.floor(potion.timer / 7) % 2 === 0);

    potion.timer = POTION_LIFETIME_TICKS - 1;
    assert.equal(potion.isExpired, false);
    potion.timer = POTION_LIFETIME_TICKS;
    assert.equal(potion.isExpired, true);
  });
});
