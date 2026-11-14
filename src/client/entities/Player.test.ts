/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const playerUrl = new URL('./Player.ts', import.meta.url).href;
const getPlayer = async () => (await import(playerUrl)).Player;

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
});
