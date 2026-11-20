/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Sparks } from '../systems/Sparks.ts';

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

  void it('does not jump after the player is dead', async () => {
    const Player = await getPlayer();
    const player = new Player([160, 200]);
    player.dead = true;

    player.jump();

    assert.equal(player.dead, true);
    assert.equal(player.velocity[1], 0);
    assert.equal(player.jumps, 2);
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

  void it('uses the hit animation for 30 knockback frames while invincibility lasts 75', async () => {
    const Player = await getPlayer();
    const Tilemap = await getTilemap();
    const player = new Player([100, 200]);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({ tiles: {}, off_grid_tiles: [] });

    player.takeDamage(1);
    player.applyKnockback(1);
    assert.equal(player.velocity[1], 0);
    assert.equal(player.invincibleTimer, 75);
    const initialX = player.pos[0];
    let previousFrameDistance = Number.POSITIVE_INFINITY;

    for (let frame = 0; frame < player.knockbackDuration; frame++) {
      const frameStartX = player.pos[0];
      player.update(tilemap, [2.5, 0]);
      const frameDistance = player.pos[0] - frameStartX;
      assert.ok(frameDistance < previousFrameDistance);
      previousFrameDistance = frameDistance;
      assert.equal(player.animationKey, 'player/hit');
    }

    assert.equal(player.knockback, false);
    assert.equal(player.invincibleTimer, 75 - player.knockbackDuration);
    assert.ok(Math.abs(player.pos[0] - (initialX + 29.325)) < 0.001);
    player.airTime = 0;
    player.update(tilemap, [2.5, 0]);
    assert.equal(player.animationKey, 'player/run');
    assert.equal(player.invincibleTimer, 75 - player.knockbackDuration - 1);

    const swordPlayer = new Player([100, 200]);
    swordPlayer.swordState = true;
    swordPlayer.applyKnockback(-1);
    swordPlayer.update(tilemap, [2.5, 0]);
    assert.equal(swordPlayer.animationKey, 'player/sword/hit');
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

  void it('picks up sword when overlapping', async () => {
    const Player = await getPlayer();
    const player = new Player([100, 200]);
    const sword = {
      pos: [100, 200] as [number, number],
      rect: () => ({ x: 100, y: 200, width: 20, height: 20 }),
    };
    const swords = [sword];

    assert.equal(player.getPickupableSword(swords), sword);
    assert.equal(swords.length, 1);
    assert.equal(player.pickupSword(swords), true);
    assert.equal(player.swordState, true);
    assert.equal(swords.length, 0);
    assert.equal(player.animation?.img(), 'player/sword/idle/0');
  });

  void it('does not report a distant sword as pickupable', async () => {
    const Player = await getPlayer();
    const player = new Player([100, 200]);
    const sword = {
      pos: [500, 200] as [number, number],
      rect: () => ({ x: 500, y: 200, width: 20, height: 20 }),
    };

    assert.equal(player.getPickupableSword([sword]), undefined);
  });

  void it('does not pick up if already has sword', async () => {
    const Player = await getPlayer();
    const player = new Player([100, 200]);
    player.swordState = true;
    const swords = [
      { pos: [100, 200], rect: () => ({ x: 100, y: 200, width: 20, height: 20 }) },
    ];
    const lenBefore = swords.length;
    player.pickupSword(swords);
    assert.equal(swords.length, lenBefore);
  });

  void it('attacks when swordState is active', async () => {
    const Player = await getPlayer();
    const Tilemap = await getTilemap();
    const player = new Player([100, 200]);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({ tiles: {}, off_grid_tiles: [] });

    // Cannot attack without sword
    assert.equal(player.attack(), false);

    // Pick up sword
    player.swordState = true;
    assert.equal(player.attack(), true);
    assert.equal(player.attackHandler.attackState, true);

    // During update, switches to sword attack action
    player.update(tilemap);
    assert.ok(player.action.startsWith('sword/attack_'));
  });

  void it('clears the attack effect when the player dies mid-attack', async () => {
    const Player = await getPlayer();
    const player = new Player([100, 200]);
    player.swordState = true;
    assert.equal(player.attack(), true);
    assert.notEqual(player.attackHandler.effect, null);

    player.health = 1;
    player.takeDamage(1);

    assert.equal(player.dead, true);
    assert.equal(player.attackHandler.attackState, false);
    assert.equal(player.attackHandler.effect, null);
  });

  void it('triggers air attack when player is in the air', async () => {
    const Player = await getPlayer();
    const Tilemap = await getTilemap();
    const player = new Player([100, 200]);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({ tiles: {}, off_grid_tiles: [] });

    player.swordState = true;
    player.airTime = 5;
    assert.equal(player.attack(), true);
    assert.ok(
      player.attackHandler.currentAttackType === 'air_attack_1' ||
        player.attackHandler.currentAttackType === 'air_attack_2'
    );
    player.update(tilemap);
    assert.ok(player.action.startsWith('sword/air_attack_'));
  });

  void it('manages sword throw mechanics and projectile spawning', async () => {
    const Player = await getPlayer();
    const Tilemap = await getTilemap();
    const player = new Player([100, 200]);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({ tiles: {}, off_grid_tiles: [] });

    // Cannot throw without sword
    assert.equal(player.throwSword(), false);
    assert.equal(player.pendingThrow, false);

    // Equip sword
    player.swordState = true;
    player.runBoost = 1.0;

    const thrownCalls: { pos: readonly [number, number]; flip: boolean }[] = [];
    player.swordsSystem = {
      throwSword(pos: readonly [number, number], flip: boolean) {
        thrownCalls.push({ pos, flip });
      },
    };

    // Trigger throw
    assert.equal(player.throwSword(), true);
    assert.equal(player.pendingThrow, true);
    assert.equal(player.preRunBoost, 1.0);

    // Cannot trigger second throw while pending
    assert.equal(player.throwSword(), false);

    // Update 1: starts throwing animation, slows down
    player.update(tilemap);
    assert.ok(player.throwingAnimation !== null);
    assert.equal(player.runBoost, 0.2);
    assert.equal(thrownCalls.length, 0);

    // Fast-forward throwing animation frames until frameIndex >= 1
    // Animation has 3 frames, imgDur 10. Frame 10 is frameIndex 1.
    while (!player.throwingFrameTriggered && player.throwingAnimation) {
      player.update(tilemap);
    }

    assert.equal(player.throwingFrameTriggered, true);
    assert.equal(player.swordState, false);
    assert.equal(player.pendingThrow, false);
    assert.equal(thrownCalls.length, 1);
    // facing right (flip = false) -> pos[0] + 24, pos[1] + 10
    const firstCall = thrownCalls[0];
    assert.ok(firstCall !== undefined);
    assert.equal(firstCall.pos[1], player.pos[1] + 10);
    assert.equal(firstCall.flip, false);

    // Finish remaining frames of throwing animation
    while (player.throwingAnimation) {
      player.update(tilemap);
    }

    assert.equal(player.throwingAnimation, null);
    // runBoost restored to preRunBoost (1.0)
    assert.equal(player.runBoost, 1.0);
  });

  void it('emits fiery burst sparks when sword is thrown', async () => {
    const Player = await getPlayer();
    const Tilemap = await getTilemap();
    const sparksEffect: Sparks[] = [];
    const player = new Player([100, 200], undefined, sparksEffect);
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({ tiles: {}, off_grid_tiles: [] });

    player.swordState = true;
    player.swordsSystem = {
      throwSword: () => {},
    };

    player.throwSword();
    assert.equal(sparksEffect.length, 0);

    // First update starts throwingAnimation from pendingThrow
    player.update(tilemap);
    assert.ok(player.throwingAnimation !== null);

    // Update until throwingFrameTriggered
    while (!player.throwingFrameTriggered && player.throwingAnimation) {
      player.update(tilemap);
    }

    assert.equal(player.throwingFrameTriggered, true);
    // FIERY_BURST_COLORS has 5 colors -> 5 Sparks emitted
    assert.equal(sparksEffect.length, 5);
    for (const spark of sparksEffect) {
      assert.equal(spark.shape, 'diamond');
      assert.deepEqual(spark.size, [3, 2]);
      assert.equal(spark.direction, Math.PI * 0.85);
      assert.equal(spark.sparks.length, 3);
    }
  });

  void it('computes attackRangeRect and attackDamage for ground and air attacks', async () => {
    const Player = await getPlayer();
    const player = new Player([100, 100], [20, 28]);
    assert.equal(player.getAttackRangeRect(), null);

    // 1. Ground attack: damage is 20, range expansion [25, 0]
    player.swordState = true;
    player.airTime = 0;
    player.attack();
    assert.equal(player.attackHandler.attackState, true);
    assert.equal(player.getAttackDamage(), 20);

    const groundRect = player.getAttackRangeRect();
    assert.ok(groundRect !== null);
    // player rectPosAdjustment is [22, 4], size is [20, 28] -> base x 122, base y 104
    // facing right (flip = false), expansion [25, 0] -> w = 20 + 25 = 45
    assert.deepEqual(groundRect, {
      x: 122,
      y: 104,
      width: 45,
      height: 20,
    });

    // 2. Air attack: damage is 30, range expansion [19, 60]
    const airPlayer = new Player([100, 100], [20, 28]);
    airPlayer.swordState = true;
    airPlayer.airTime = 5;
    airPlayer.attack();
    assert.equal(airPlayer.attackHandler.attackState, true);
    assert.equal(airPlayer.getAttackDamage(), 30);

    const airRect = airPlayer.getAttackRangeRect();
    assert.ok(airRect !== null);
    // facing right (flip = false), expansion [19, 60] -> w = 20 + 19 = 39, h = 20 + 60 = 80
    assert.deepEqual(airRect, {
      x: 122,
      y: 104,
      width: 39,
      height: 80,
    });
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
