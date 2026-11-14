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
    assert.equal(player.justLanded, false);
    assert.equal(player.landingAnimation, null);
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

  void it('emits jump dust for each accepted jump', async () => {
    const Player = await getPlayer();
    const particleRecorder = createParticleRecorder();
    const player = new Player([160, 200], particleRecorder.spawner);
    player.flip = true;

    player.jump();
    player.jumps = 0;
    player.jump();

    assert.deepEqual(particleRecorder.calls, [
      { type: 'jump_dust', pos: [166, 213], flip: true },
    ]);
  });

  void it('emits run dust at the facing-dependent position', async () => {
    const Player = await getPlayer();
    const Tilemap = await getTilemap();
    const particleRecorder = createParticleRecorder();
    const player = new Player([100, 200], particleRecorder.spawner);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({ tiles: {}, off_grid_tiles: [] });

    player.update(tilemap, [2.5, 0]);

    assert.deepEqual(particleRecorder.calls, [
      {
        type: 'player/run_dust',
        pos: [player.pos[0] - 3, player.pos[1] + 12],
        flip: player.flip,
      },
    ]);
  });

  void it('paces run dust with a 350ms/200ms cooldown matching footsteps', async () => {
    const Player = await getPlayer();
    const Tilemap = await getTilemap();
    const { Particles } = await import('../systems/Particles.ts');
    let currentTime = 1000;
    const particles = new Particles(() => currentTime);
    const player = new Player([100, 200], particles);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({ tiles: {}, off_grid_tiles: [] });

    // Initial step at t=1000
    player.airTime = 0;
    player.update(tilemap, [2.5, 0]);
    assert.equal(particles.particles.length, 1);

    // Immediate next frame at t=1016 (within 350ms) - should not spawn dust
    currentTime = 1016;
    player.airTime = 0;
    player.update(tilemap, [2.5, 0]);
    assert.equal(particles.particles.length, 1);

    // At t=1399 (still within 400ms) - should not spawn dust
    currentTime = 1399;
    player.airTime = 0;
    player.update(tilemap, [2.5, 0]);
    assert.equal(particles.particles.length, 1);

    // At t=1400 (400ms elapsed) - should spawn second dust puff
    currentTime = 1400;
    player.airTime = 0;
    player.update(tilemap, [2.5, 0]);
    assert.equal(particles.particles.length, 2);

    // When runBoost >= 1, cooldown switches to 200ms
    player.runBoost = 1.0;
    currentTime = 1599;
    player.airTime = 0;
    player.update(tilemap, [2.5, 0]);
    assert.equal(particles.particles.length, 2);

    currentTime = 1600;
    player.airTime = 0;
    player.update(tilemap, [2.5, 0]);
    assert.equal(particles.particles.length, 3);
  });

  void it('double tap within 200ms activates run boost', async () => {
    const Player = await getPlayer();
    const player = new Player([100, 100]);
    player.checkDoubleTap('KeyA', 1000);
    player.checkDoubleTap('KeyA', 1100);
    assert.equal(player.runBoost, 1.5);
  });

  void it('double tap different keys does not activate boost', async () => {
    const Player = await getPlayer();
    const player = new Player([100, 100]);
    player.checkDoubleTap('KeyA', 1000);
    player.checkDoubleTap('KeyD', 1100);
    assert.notEqual(player.runBoost, 1.5);
  });

  void it('double tap exceeding 200ms does not activate boost', async () => {
    const Player = await getPlayer();
    const player = new Player([100, 100]);
    player.checkDoubleTap('KeyA', 1000);
    player.checkDoubleTap('KeyA', 1250);
    assert.notEqual(player.runBoost, 1.5);
  });

  void it('applies run boost multiplier to horizontal movement and changes animation imgDur', async () => {
    const Player = await getPlayer();
    const Tilemap = await getTilemap();
    const player = new Player([100, 200]);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({ tiles: {}, off_grid_tiles: [] });

    // Normal run: imgDur 7, movement unscaled
    player.update(tilemap, [2, 0]);
    assert.equal(player.pos[0], 102);
    assert.equal(player.animation?.imgDur, 7);

    // Boosted run: runBoost 1.5 -> movement 2 * 1.5 = 3, imgDur 5
    player.runBoost = 1.5;
    player.update(tilemap, [2, 0]);
    assert.equal(player.pos[0], 105);
    assert.equal(player.animation?.imgDur, 5);

    // Slow walk with Shift (3:5 speed ratio 0.6, 7:10 frame ratio): runBoost 0.6 -> movement 2 * 0.6 = 1.2, imgDur 7
    player.runBoost = 0.6;
    player.update(tilemap, [2, 0]);
    assert.equal(player.pos[0], 106.2);
    assert.equal(player.animation?.imgDur, 7);

    // Reset boost on keyup
    player.runBoost = 0;
    player.update(tilemap, [2, 0]);
    assert.equal(player.pos[0], 108.2);
    assert.equal(player.animation?.imgDur, 7);
  });

  void it('synchronizes run dust puffs to animation footstep contact frames 0 and 3', async () => {
    const Player = await getPlayer();
    const Tilemap = await getTilemap();
    const particleRecorder = createParticleRecorder();
    const player = new Player([100, 200], particleRecorder.spawner);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({ tiles: {}, off_grid_tiles: [] });

    // Fast run mode (imgDur = 5, footstep 1 at frame 0, footstep 2 at frame 3)
    player.runBoost = 1.0;
    player.airTime = 0;
    player.update(tilemap, [2.5, 0]);
    assert.equal(particleRecorder.calls.length, 1);

    // Advance animation ticks 1, 2, 3, 4 (within frame 0): no new dust
    for (let tick = 1; tick < 5; tick++) {
      player.airTime = 0;
      player.animation?.update();
      player.update(tilemap, [2.5, 0]);
      assert.equal(particleRecorder.calls.length, 1);
    }

    // Advance through frame 1 and frame 2 (ticks 5 to 14): no dust
    for (let tick = 5; tick < 15; tick++) {
      player.airTime = 0;
      player.animation?.update();
      player.update(tilemap, [2.5, 0]);
      assert.equal(particleRecorder.calls.length, 1);
    }

    // At tick 15, frame transitions to 3 (footstep 2 impact!): emits second dust puff
    player.airTime = 0;
    player.animation?.update();
    assert.equal(player.animation?.frameIndex, 3);
    player.update(tilemap, [2.5, 0]);
    assert.equal(particleRecorder.calls.length, 2);
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
    assert.equal(player.wasInAir, false);
  });

  void it('selects idle, run, jump, and fall animations from player state', async () => {
    const Player = await getPlayer();
    const Tilemap = await getTilemap();
    const player = new Player([100, 200]);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({ tiles: {}, off_grid_tiles: [] });

    player.update(tilemap);
    assert.equal(player.animationKey, 'player/idle');
    assert.equal(player.wasInAir, true);

    player.update(tilemap, [2.5, 0]);
    assert.equal(player.animationKey, 'player/run');

    player.jump();
    player.update(tilemap);
    assert.equal(player.animationKey, 'player/jump');

    player.velocity[1] = 1;
    player.update(tilemap);
    assert.equal(player.animationKey, 'player/fall');

    player.swordState = true;
    player.velocity[1] = 0;
    player.airTime = 0;
    player.update(tilemap, [2.5, 0]);
    assert.equal(player.animationKey, 'player/sword/run');
  });

  void it('starts the matching landing animation when landing from the air', async () => {
    const Player = await getPlayer();
    const Tilemap = await getTilemap();
    const particleRecorder = createParticleRecorder();
    const player = new Player([160, 224], particleRecorder.spawner);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({
      tiles: {
        '5;8': { type: 'grass', variant: 4, loc: [5, 8] },
      },
      off_grid_tiles: [],
    });
    player.wasInAir = true;
    player.velocity[1] = 3;

    player.update(tilemap);

    assert.equal(player.justLanded, true);
    assert.equal(player.landedOn.grass, true);
    assert.equal(player.landedOn.palm_tree, false);
    assert.equal(player.landingAnimation?.img(), 'player/land/0');
    assert.equal(player.landingAnimation?.loop, false);
    assert.deepEqual(particleRecorder.calls, [
      {
        type: 'land_dust',
        pos: [player.pos[0] + 5, player.pos[1] + 13],
        flip: player.flip,
      },
    ]);
  });

  void it('uses the sword landing animation and only marks the landing transition once', async () => {
    const Player = await getPlayer();
    const Tilemap = await getTilemap();
    const player = new Player([160, 224]);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({
      tiles: {
        '5;8': { type: 'grass', variant: 4, loc: [5, 8] },
      },
      off_grid_tiles: [],
    });
    player.wasInAir = true;
    player.velocity[1] = 3;
    player.swordState = true;

    player.update(tilemap);
    assert.equal(player.justLanded, true);
    assert.equal(player.landingAnimation?.img(), 'player/sword/land/0');

    player.update(tilemap);
    assert.equal(player.justLanded, false);
    assert.equal(player.landingAnimation?.img(), 'player/sword/land/0');
  });
});

const createParticleRecorder = () => {
  const calls: {
    type: string;
    pos: readonly [number, number];
    flip: boolean;
  }[] = [];
  return {
    calls,
    spawner: {
      addParticle(
        type: string,
        pos: readonly [number, number],
        flip: boolean
      ) {
        calls.push({ type, pos: [pos[0], pos[1]], flip });
      },
    },
  };
};
