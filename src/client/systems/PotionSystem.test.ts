/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEBUG_POTION_SPAWN_CHANCE,
  FRENZY_POTION_SPAWN_CHANCE,
  FrenzyPotion,
  FrenzyPotionEffect,
  HealthPotion,
  HealthPotionEffect,
  PotionSystem,
  SHIELD_POTION_SPAWN_CHANCE,
  SHIELD_PARTICLE_COLORS,
  createShieldParticleBurst,
  ShieldPotion,
  HEALTH_POTION_SPAWN_CHANCE,
  HEALTH_POTION_LIFETIME_TICKS,
  FRENZY_POTION_LIFETIME_TICKS,
  SHIELD_POTION_LIFETIME_TICKS,
  POTION_BLINK_LEAD_TICKS,
  POTION_FAST_BLINK_LEAD_TICKS,
  createFrenzyPotionIdleAnimation,
  createShieldPotionIdleAnimation,
} from './PotionSystem.ts';
import { Tilemap } from './Tilemap.ts';
import type { Sparks } from './Sparks.ts';
import { DEBUG_CONFIG, setDebugMode } from '../../shared/debug.ts';
import { TICK_RATE } from '../../shared/constants.ts';

void describe('PotionSystem', () => {
  void it('creates a seven-frame Frenzy Potion idle animation at the potion cadence', () => {
    const animation = createFrenzyPotionIdleAnimation();
    const potion = new FrenzyPotion([100, 200]);

    assert.equal(animation.img(), 'potion/frenzy/idle/0');
    assert.equal(potion.animation?.img(), 'potion/frenzy/idle/0');
    for (let tick = 0; tick < 8; tick += 1) {
      animation.update();
    }
    assert.equal(animation.img(), 'potion/frenzy/idle/1');
    assert.equal(animation.frameCount, 7);
    assert.equal(animation.imgDur, 8);
  });

  void it('creates a seven-frame Shield Potion idle animation at the potion cadence', () => {
    const animation = createShieldPotionIdleAnimation();
    const potion = new ShieldPotion([100, 200]);

    assert.equal(animation.img(), 'potion/shield/idle/0');
    assert.equal(potion.animation?.img(), 'potion/shield/idle/0');
    for (let tick = 0; tick < 8; tick += 1) {
      animation.update();
    }
    assert.equal(animation.img(), 'potion/shield/idle/1');
    assert.equal(animation.frameCount, 7);
    assert.equal(animation.imgDur, 8);
  });

  void it('spawns each potion type on a separate nearby grass tile', () => {
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({
      tiles: {
        '3;8': { type: 'grass', variant: 0, loc: [3, 8] },
        '4;8': { type: 'grass', variant: 0, loc: [4, 8] },
        '5;8': { type: 'grass', variant: 0, loc: [5, 8] },
      },
      off_grid_tiles: [],
    });

    const previousDebugEnabled = DEBUG_CONFIG.enabled;
    setDebugMode(false);
    try {
      const manager = new PotionSystem(() => 0.0001);
      assert.equal(
        manager.spawnHealthPotion(tilemap, [100, 224]) !== null,
        true
      );
      assert.equal(
        manager.spawnFrenzyPotion(tilemap, [100, 224]) !== null,
        true
      );
      assert.equal(
        manager.spawnShieldPotion(tilemap, [100, 224]) !== null,
        true
      );
      assert.equal(manager.healthPotions.length, 1);
      assert.equal(manager.frenzyPotions.length, 1);
      assert.equal(manager.shieldPotions.length, 1);
      assert.notDeepEqual(
        manager.healthPotions[0]?.pos,
        manager.frenzyPotions[0]?.pos
      );
      assert.notDeepEqual(
        manager.shieldPotions[0]?.pos,
        manager.healthPotions[0]?.pos
      );
      assert.notDeepEqual(
        manager.shieldPotions[0]?.pos,
        manager.frenzyPotions[0]?.pos
      );
      assert.equal(manager.spawnHealthPotion(tilemap, [100, 224]), null);
      assert.equal(manager.spawnFrenzyPotion(tilemap, [100, 224]), null);
      assert.equal(manager.spawnShieldPotion(tilemap, [100, 224]), null);
    } finally {
      setDebugMode(previousDebugEnabled);
    }
  });

  void it('boosts potion spawn chances only while debug mode is enabled', () => {
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({
      tiles: {
        '3;8': { type: 'grass', variant: 0, loc: [3, 8] },
        '4;8': { type: 'grass', variant: 0, loc: [4, 8] },
        '5;8': { type: 'grass', variant: 0, loc: [5, 8] },
      },
      off_grid_tiles: [],
    });
    const previousDebugEnabled = DEBUG_CONFIG.enabled;
    const previousSpawnRateBoost = DEBUG_CONFIG.boostPotionSpawnRates;
    try {
      setDebugMode(true);
      DEBUG_CONFIG.boostPotionSpawnRates = false;
      assert.equal(HEALTH_POTION_SPAWN_CHANCE, 0.001);
      assert.equal(FRENZY_POTION_SPAWN_CHANCE, 0.0025);
      assert.equal(SHIELD_POTION_SPAWN_CHANCE, 0.001);
      const normalRates = new PotionSystem(() => 0.002);
      assert.equal(normalRates.spawnHealthPotion(tilemap), null);
      assert.notEqual(normalRates.spawnFrenzyPotion(tilemap), null);
      assert.equal(normalRates.spawnShieldPotion(tilemap), null);

      setDebugMode(true);
      DEBUG_CONFIG.boostPotionSpawnRates = true;
      const debugRates = new PotionSystem(() => 0.49);
      assert.notEqual(debugRates.spawnHealthPotion(tilemap), null);
      assert.notEqual(debugRates.spawnFrenzyPotion(tilemap), null);
      assert.notEqual(debugRates.spawnShieldPotion(tilemap), null);
      assert.equal(DEBUG_POTION_SPAWN_CHANCE, 0.5);

      setDebugMode(false);
      const normalRatesWhenDebugDisabled = new PotionSystem(() => 0.002);
      assert.equal(normalRatesWhenDebugDisabled.spawnHealthPotion(tilemap), null);
      assert.notEqual(normalRatesWhenDebugDisabled.spawnFrenzyPotion(tilemap), null);
      assert.equal(normalRatesWhenDebugDisabled.spawnShieldPotion(tilemap), null);
    } finally {
      setDebugMode(previousDebugEnabled);
      DEBUG_CONFIG.boostPotionSpawnRates = previousSpawnRateBoost;
    }
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
    const manager = new PotionSystem(() => 0.0001, sparksEffect);

    assert.ok(manager.spawnHealthPotion(tilemap, [100, 224]) !== null);
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

  void it('uses white and light-blue sparks when a Frenzy Potion spawns', () => {
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({
      tiles: {
        '3;8': { type: 'grass', variant: 0, loc: [3, 8] },
      },
      off_grid_tiles: [],
    });
    const sparksEffect: Sparks[] = [];
    const manager = new PotionSystem(() => 0.0001, sparksEffect);

    assert.ok(manager.spawnFrenzyPotion(tilemap) !== null);
    assert.equal(sparksEffect.length, 2);
    assert.deepEqual(sparksEffect[0]?.color, [195, 233, 255]);
    assert.deepEqual(sparksEffect[1]?.color, [255, 255, 255]);
  });

  void it('uses light-green-dominant sparks when a Shield Potion spawns', () => {
    const tilemap = new Tilemap(32);
    tilemap.loadFromData({
      tiles: {
        '3;8': { type: 'grass', variant: 0, loc: [3, 8] },
      },
      off_grid_tiles: [],
    });
    const sparksEffect: Sparks[] = [];
    const manager = new PotionSystem(() => 0.0001, sparksEffect);

    assert.ok(manager.spawnShieldPotion(tilemap) !== null);
    assert.equal(sparksEffect.length, 2);
    assert.equal(sparksEffect[0]?.shape, 'diamond');
    assert.equal(sparksEffect[0]?.sparks.length, 22);
    assert.equal(sparksEffect[0]?.speed, 2.8);
    assert.deepEqual(sparksEffect[0]?.size, [3, 3]);
    assert.deepEqual(sparksEffect[0]?.color, SHIELD_PARTICLE_COLORS.lightGreen);
    assert.equal(sparksEffect[0]?.direction, 'burst');
    assert.equal(sparksEffect[1]?.sparks.length, 13);
    assert.equal(sparksEffect[1]?.speed, 1.8);
    assert.deepEqual(sparksEffect[1]?.size, [2, 2]);
    assert.deepEqual(sparksEffect[1]?.color, SHIELD_PARTICLE_COLORS.white);
    assert.ok(
      (sparksEffect[0]?.sparks.length ?? 0) >
        (sparksEffect[1]?.sparks.length ?? 0)
    );
  });

  void it('makes shield pickup and break bursts visibly distinct', () => {
    const pickup = createShieldParticleBurst([100, 200], 'pickup', () => 0.5);
    const shieldBreak = createShieldParticleBurst(
      [100, 200],
      'break',
      () => 0.5
    );

    assert.equal(pickup[0]?.color, SHIELD_PARTICLE_COLORS.lightGreen);
    assert.equal(pickup[0]?.sparks.length, 28);
    assert.equal(pickup[0]?.speed, 2.6);
    assert.equal(pickup[1]?.color, SHIELD_PARTICLE_COLORS.white);
    assert.equal(pickup[1]?.sparks.length, 6);
    assert.equal(shieldBreak[0]?.color, SHIELD_PARTICLE_COLORS.lightGreen);
    assert.equal(shieldBreak[0]?.sparks.length, 40);
    assert.equal(shieldBreak[0]?.speed, 4);
    assert.equal(shieldBreak[1]?.color, SHIELD_PARTICLE_COLORS.white);
    assert.equal(shieldBreak[1]?.sparks.length, 8);
    assert.ok(
      (pickup[0]?.sparks.length ?? 0) > (pickup[1]?.sparks.length ?? 0)
    );
    assert.ok(
      (shieldBreak[0]?.sparks.length ?? 0) >
        (shieldBreak[1]?.sparks.length ?? 0)
    );
  });

  void it('heals one health point and removes the potion on pickup', () => {
    const potion = new HealthPotion([100, 200]);
    const potions = new PotionSystem();
    potions.healthPotions = [potion];
    const playedSounds: string[] = [];
    const player = {
      pos: [100, 200] as [number, number],
      health: 2,
      maxHealth: 4,
      rect: () => ({ x: 100, y: 200, width: 20, height: 28 }),
      playSfx: (name: string) => playedSounds.push(name),
    };

    assert.equal(potions.collectHealthPotion(player), true);
    assert.equal(player.health, 3);
    assert.equal(potions.healthPotions.length, 0);
    assert.equal(potions.healthPotionEffects.length, 1);
    assert.deepEqual(playedSounds, ['player/pickup_health_potion']);
  });

  void it('collects Frenzy without requiring health stats and plays feedback', () => {
    const potion = new FrenzyPotion([100, 200]);
    const potions = new PotionSystem();
    potions.frenzyPotions = [potion];
    const playedSounds: string[] = [];
    let activationCount = 0;
    const player = {
      rect: () => ({ x: 100, y: 200, width: 20, height: 28 }),
      activateFrenzy: () => {
        activationCount += 1;
      },
      playSfx: (name: string) => playedSounds.push(name),
    };

    assert.equal(potions.collectFrenzyPotion(player), true);
    assert.equal(activationCount, 1);
    assert.equal(potions.frenzyPotions.length, 0);
    assert.equal(potions.frenzyPotionEffects.length, 1);
    assert.deepEqual(playedSounds, ['player/pickup_health_potion']);
  });

  void it('collects Shield without requiring health stats and emits light-green-dominant sparks', () => {
    const potion = new ShieldPotion([100, 200]);
    const sparksEffect: Sparks[] = [];
    const potions = new PotionSystem(Math.random, sparksEffect);
    potions.shieldPotions = [potion];
    const playedSounds: string[] = [];
    let activationCount = 0;
    const player = {
      rect: () => ({ x: 100, y: 200, width: 20, height: 28 }),
      activateShield: () => {
        activationCount += 1;
      },
      playSfx: (name: string) => playedSounds.push(name),
    };

    assert.equal(potions.collectShieldPotion(player), true);
    assert.equal(activationCount, 1);
    assert.equal(potions.shieldPotions.length, 0);
    assert.equal(sparksEffect.length, 2);
    assert.deepEqual(sparksEffect[0]?.color, SHIELD_PARTICLE_COLORS.lightGreen);
    assert.deepEqual(sparksEffect[1]?.color, SHIELD_PARTICLE_COLORS.white);
    assert.ok(
      (sparksEffect[0]?.sparks.length ?? 0) >
        (sparksEffect[1]?.sparks.length ?? 0)
    );
    assert.deepEqual(playedSounds, ['player/pickup_health_potion']);
  });

  void it('does not activate or play feedback when Shield is not collected', () => {
    const potions = new PotionSystem();
    potions.shieldPotions = [new ShieldPotion([100, 200])];
    let activationCount = 0;
    const playedSounds: string[] = [];
    const player = {
      rect: () => ({ x: 500, y: 500, width: 20, height: 28 }),
      activateShield: () => {
        activationCount += 1;
      },
      playSfx: (name: string) => playedSounds.push(name),
    };

    assert.equal(potions.collectShieldPotion(player), false);
    assert.equal(activationCount, 0);
    assert.deepEqual(playedSounds, []);
    assert.equal(potions.shieldPotions.length, 1);
  });

  void it('does not activate or play feedback when Frenzy is not collected', () => {
    const potions = new PotionSystem();
    potions.frenzyPotions = [new FrenzyPotion([100, 200])];
    let activationCount = 0;
    const playedSounds: string[] = [];
    const player = {
      rect: () => ({ x: 500, y: 500, width: 20, height: 28 }),
      activateFrenzy: () => {
        activationCount += 1;
      },
      playSfx: (name: string) => playedSounds.push(name),
    };

    assert.equal(potions.collectFrenzyPotion(player), false);
    assert.equal(activationCount, 0);
    assert.equal(potions.frenzyPotionEffects.length, 0);
    assert.deepEqual(playedSounds, []);
    assert.equal(potions.frenzyPotions.length, 1);
  });

  void it('destroys active pickup-effect sprites when the system is destroyed', () => {
    let destroyedSprites = 0;
    const playerRect = { x: 100, y: 200, width: 20, height: 28 };
    const potions = new PotionSystem();
    potions.healthPotionEffects = [
      new HealthPotionEffect({ rect: () => playerRect }),
    ];
    potions.frenzyPotions = [new FrenzyPotion([100, 200])];
    potions.shieldPotions = [new ShieldPotion([140, 200])];
    potions.frenzyPotionEffects = [
      new FrenzyPotionEffect({ rect: () => playerRect }),
    ];

    potions.render({
      add: {
        image: () => ({
          setOrigin() {},
          setPosition() {},
          setTexture() {},
          setDepth() {},
          destroy() {
            destroyedSprites += 1;
          },
        }),
      },
    });
    potions.destroy();

    assert.equal(destroyedSprites, 4);
    assert.equal(potions.healthPotionEffects.length, 0);
    assert.equal(potions.frenzyPotions.length, 0);
    assert.equal(potions.shieldPotions.length, 0);
    assert.equal(potions.frenzyPotionEffects.length, 0);
  });

  void it('keeps the pickup effect centered on the moving player', () => {
    let renderedPosition: [number, number] = [0, 0];
    const playerRect = { x: 100, y: 200, width: 20, height: 28 };
    const effect = new HealthPotionEffect({ rect: () => playerRect });
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

  void it('renders the Frenzy pickup effect with its gold-effect textures', () => {
    const textures: string[] = [];
    const effect = new FrenzyPotionEffect({
      rect: () => ({ x: 100, y: 200, width: 20, height: 28 }),
    });
    const scene = {
      add: {
        image(_x: number, _y: number, texture: string) {
          textures.push(texture);
          return {
            setOrigin() {},
            setPosition() {},
            setTexture(nextTexture: string) {
              textures.push(nextTexture);
            },
            setDepth() {},
            destroy() {},
          };
        },
      },
    };

    effect.render(scene);
    for (let tick = 0; tick < 6; tick += 1) {
      effect.update();
    }
    effect.render(scene);

    assert.deepEqual(textures, [
      'potion/frenzy-effect/0',
      'potion/frenzy-effect/1',
    ]);
  });

  void it('does not collect a potion at full health', () => {
    const potion = new HealthPotion([100, 200]);
    const potions = new PotionSystem();
    potions.healthPotions = [potion];
    const player = {
      pos: [100, 200] as [number, number],
      health: 4,
      maxHealth: 4,
      rect: () => ({ x: 100, y: 200, width: 20, height: 28 }),
      playSfx: () => assert.fail('Full-health potion must not play pickup sound'),
    };

    assert.equal(potions.collectHealthPotion(player), false);
    assert.equal(potions.healthPotions.length, 1);
  });

  void it('keeps a potion afloat without falling', () => {
    const potion = new HealthPotion([100, 200]);

    assert.equal(potion.landed, true);
    assert.equal(potion.velocity[1], 0);
  });

  void it('uses each potion lifetime and starts blinking 300 ticks before expiry', () => {
    assert.equal(HEALTH_POTION_LIFETIME_TICKS, 40 * TICK_RATE);
    assert.equal(SHIELD_POTION_LIFETIME_TICKS, 30 * TICK_RATE);
    assert.equal(FRENZY_POTION_LIFETIME_TICKS, 20 * TICK_RATE);

    const potions = [
      [new HealthPotion([100, 200]), HEALTH_POTION_LIFETIME_TICKS],
      [new FrenzyPotion([140, 200]), FRENZY_POTION_LIFETIME_TICKS],
      [new ShieldPotion([180, 200]), SHIELD_POTION_LIFETIME_TICKS],
    ] as const;

    for (const [potion, lifetimeTicks] of potions) {
      assert.equal(potion.lifetimeTicks, lifetimeTicks);
      assert.equal(
        potion.blinkStartTicks,
        lifetimeTicks - POTION_BLINK_LEAD_TICKS
      );
      assert.equal(
        potion.fastBlinkStartTicks,
        lifetimeTicks - POTION_FAST_BLINK_LEAD_TICKS
      );
    }
  });

  void it('blinks during the final 300 ticks and expires after its lifetime', () => {
    const potion = new HealthPotion([100, 200]);

    potion.timer = potion.blinkStartTicks - 1;
    assert.equal(potion.isBlinking(), false);

    potion.timer = potion.blinkStartTicks;
    assert.equal(
      potion.isBlinking(),
      Math.floor(potion.blinkStartTicks / 12) % 2 === 0
    );

    potion.timer = potion.fastBlinkStartTicks;
    assert.equal(potion.isBlinking(), Math.floor(potion.timer / 7) % 2 === 0);

    potion.timer = potion.lifetimeTicks - 1;
    assert.equal(potion.isExpired, false);
    potion.timer = potion.lifetimeTicks;
    assert.equal(potion.isExpired, true);
  });

  void it('expires all potion types and destroys their active sprites', () => {
    const tilemap = new Tilemap(32);
    const healthPotion = new HealthPotion([100, 200]);
    const frenzyPotion = new FrenzyPotion([140, 200]);
    const shieldPotion = new ShieldPotion([180, 200]);
    let destroyedSprites = 0;
    const scene = {
      add: {
        image() {
          return {
            setOrigin() {},
            setPosition() {},
            setTexture() {},
            setDepth() {},
            setVisible() {},
            destroy() {
              destroyedSprites += 1;
            },
          };
        },
      },
    };
    const potions = new PotionSystem(() => 1);
    potions.healthPotions = [healthPotion];
    potions.frenzyPotions = [frenzyPotion];
    potions.shieldPotions = [shieldPotion];
    healthPotion.render(scene);
    frenzyPotion.render(scene);
    shieldPotion.render(scene);
    healthPotion.timer = healthPotion.lifetimeTicks;
    frenzyPotion.timer = frenzyPotion.lifetimeTicks;
    shieldPotion.timer = shieldPotion.lifetimeTicks;

    potions.update(tilemap);

    assert.equal(potions.healthPotions.length, 0);
    assert.equal(potions.frenzyPotions.length, 0);
    assert.equal(potions.shieldPotions.length, 0);
    assert.equal(destroyedSprites, 3);
  });
});
