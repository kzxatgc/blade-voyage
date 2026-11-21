/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Potion, Potions, POTION_SPAWN_CHANCE } from './Potions.ts';
import { Tilemap } from './Tilemap.ts';

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
});
