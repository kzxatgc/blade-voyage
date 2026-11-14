/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const playerUrl = new URL('./Player.ts', import.meta.url).href;
const getPlayer = async () => (await import(playerUrl)).Player;
const tilemapUrl = new URL('../systems/Tilemap.ts', import.meta.url).href;
const getTilemap = async () => (await import(tilemapUrl)).Tilemap;

void describe('Player', () => {
  void it('initializes player gameplay state', async () => {
    const Player = await getPlayer();
    const player = new Player([100, 200]);

    assert.equal(player.jumps, 2);
    assert.equal(player.airTime, 0);
    assert.equal(player.swordState, false);
    assert.equal(player.lastKey, null);
    assert.equal(player.lastPressTime, 0);
    assert.equal(player.runBoost, 0);
  });

  void it('has player type', async () => {
    const Player = await getPlayer();
    const player = new Player([100, 200]);

    assert.equal(player.type, 'player');
  });

  void it('starts with the idle animation', async () => {
    const Player = await getPlayer();
    const player = new Player([100, 200]);

    assert.equal(player.animation?.img(), 'player/idle/0');
  });

  void it('applies horizontal movement to the player position', async () => {
    const Player = await getPlayer();
    const Tilemap = await getTilemap();
    const player = new Player([100, 200]);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({ tiles: {}, off_grid_tiles: [] });

    player.update(tilemap, [2.5, 0]);

    assert.equal(player.pos[0], 102.5);
    assert.equal(player.flip, false);
  });

  void it('jumps and consumes the two available jumps', async () => {
    const Player = await getPlayer();
    const player = new Player([160, 200]);

    player.jump();
    assert.equal(player.velocity[1], -8);
    assert.equal(player.airTime, 5);
    assert.equal(player.jumps, 1);

    player.jump();
    assert.equal(player.jumps, 0);

    player.jump();
    assert.equal(player.jumps, 0);
    assert.equal(player.velocity[1], -8);
  });

  void it('restores both jumps after landing and advances airtime', async () => {
    const Player = await getPlayer();
    const Tilemap = await getTilemap();
    const player = new Player([100, 160]);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({
      tiles: {
        '3;6': { type: 'grass', variant: 4, loc: [3, 6] },
      },
      off_grid_tiles: [],
    });
    player.jumps = 0;

    player.update(tilemap);
    assert.equal(player.airTime, 1);
    assert.equal(player.jumps, 0);

    player.update(tilemap);
    assert.equal(player.collision.bottom, true);
    assert.equal(player.jumps, 2);
    assert.equal(player.airTime, 1);
  });
});
