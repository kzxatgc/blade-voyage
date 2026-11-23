/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MapData, TileData } from '../../shared/types.ts';
import {
  CannonSystem,
  CANNON_ANIMATION_FRAME_TICKS,
  CANNON_BALL_SPEED,
  CANNON_LAUNCH_FRAME,
  CANNON_WARNING_TICKS,
} from './CannonSystem.ts';
import { Tilemap } from './Tilemap.ts';

const CANNON_LAUNCH_DELAY_TICKS =
  CANNON_LAUNCH_FRAME * CANNON_ANIMATION_FRAME_TICKS;

const makeTilemap = (tiles: Record<string, TileData>): Tilemap => {
  const tilemap = new Tilemap();
  const mapData: MapData = { tiles, off_grid_tiles: [] };
  tilemap.loadFromData(mapData);
  return tilemap;
};

const cannonTile = (
  x: number,
  y: number,
  variant = 0
): TileData => ({
  type: 'cannon',
  variant,
  loc: [x, y],
});

class MockCannonImage {
  texture: { key: string };
  x: number;
  y: number;
  origin: [number, number] = [0, 0];
  depth = 0;
  flipX = false;
  tint: number | undefined;
  visible = true;
  destroyed = false;

  constructor(x: number, y: number, texture: string) {
    this.x = x;
    this.y = y;
    this.texture = { key: texture };
  }

  setOrigin(x: number, y: number) {
    this.origin = [x, y];
    return this;
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }

  setFlipX(flip: boolean) {
    this.flipX = flip;
    return this;
  }

  setDepth(depth: number) {
    this.depth = depth;
    return this;
  }

  setTint(color: number) {
    this.tint = color;
    return this;
  }

  clearTint() {
    this.tint = undefined;
    return this;
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    return this;
  }

  setTexture(texture: string) {
    this.texture.key = texture;
    return this;
  }

  destroy() {
    this.destroyed = true;
  }
}

void describe('CannonSystem', () => {
  void it('discovers cannons and maps variants to facing directions', () => {
    const system = new CannonSystem(
      makeTilemap({
        '2;3': cannonTile(2, 3),
        '5;3': cannonTile(5, 3, 1),
        '2;4': { type: 'grass', variant: 0, loc: [2, 4] },
      }),
      () => undefined
    );

    assert.equal(system.cannons.length, 2);
    assert.equal(system.cannons[0]?.direction, 1);
    assert.equal(system.cannons[1]?.direction, -1);
    assert.equal(system.cannons[0]?.bounds.y, 3 * 32 + 6);
  });

  void it('warns before firing and repeats shots at the configured interval', () => {
    const system = new CannonSystem(
      makeTilemap({ '2;3': cannonTile(2, 3) }),
      () => undefined
    );
    const cannon = system.cannons[0];
    assert.ok(cannon);
    assert.equal(cannon.warning, true);

    for (let tick = 0; tick < CANNON_WARNING_TICKS - 1; tick += 1) {
      system.update();
    }
    assert.equal(system.cannonBalls.length, 0);

    system.update();
    assert.equal(system.cannonBalls.length, 0);
    assert.equal(cannon.animation, 'fire');
    assert.equal(cannon.animationFrame, 0);
    assert.equal(cannon.muzzleFrame, undefined);

    for (let tick = 0; tick < CANNON_LAUNCH_DELAY_TICKS - 1; tick += 1) {
      system.update();
    }
    assert.equal(cannon.animationFrame, CANNON_LAUNCH_FRAME - 1);
    assert.equal(cannon.muzzleFrame, undefined);
    assert.equal(system.cannonBalls.length, 0);

    system.update();
    assert.equal(system.cannonBalls.length, 1);
    assert.equal(system.cannonBalls[0]?.direction, 1);
    assert.equal(cannon.animationFrame, CANNON_LAUNCH_FRAME);
    assert.equal(cannon.muzzleFrame, 0);

    for (let tick = 0; tick < 179; tick += 1) {
      system.update();
    }
    assert.equal(system.cannonBalls.length, 1);

    system.update();
    assert.equal(system.cannonBalls.length, 2);
  });

  void it('renders the cannon, warning, muzzle, and projectile in the selected direction', () => {
    const images: MockCannonImage[] = [];
    const scene = {
      add: {
        image(x: number, y: number, texture: string) {
          const image = new MockCannonImage(x, y, texture);
          images.push(image);
          return image;
        },
      },
    };
    const system = new CannonSystem(
      makeTilemap({ '2;3': cannonTile(2, 3) }),
      () => undefined
    );

    system.render(scene);
    const cannonImage = images[0];
    assert.ok(cannonImage);
    assert.equal(cannonImage.texture.key, 'cannon/idle/0');
    assert.equal(cannonImage.flipX, true);
    assert.equal(cannonImage.tint, 0xffb347);

    for (
      let tick = 0;
      tick < CANNON_WARNING_TICKS + CANNON_LAUNCH_DELAY_TICKS;
      tick += 1
    ) {
      system.update();
    }
    system.render(scene);

    assert.equal(
      cannonImage.texture.key,
      `cannon/fire/${CANNON_LAUNCH_FRAME}`
    );
    const muzzleImage = images.find((image) =>
      image.texture.key.startsWith('cannon/muzzle/')
    );
    assert.ok(muzzleImage);
    assert.equal(muzzleImage.texture.key, 'cannon/muzzle/0');
    assert.equal(muzzleImage.flipX, true);
    const cannonBallImage = images.find(
      (image) => image.texture.key === 'cannon/ball/idle/0'
    );
    assert.ok(cannonBallImage);
  });

  void it('keeps left-facing cannons and muzzle effects unflipped', () => {
    const images: MockCannonImage[] = [];
    const scene = {
      add: {
        image(x: number, y: number, texture: string) {
          const image = new MockCannonImage(x, y, texture);
          images.push(image);
          return image;
        },
      },
    };
    const system = new CannonSystem(
      makeTilemap({ '2;3': cannonTile(2, 3, 1) }),
      () => undefined
    );

    system.render(scene);
    const cannonImage = images[0];
    assert.ok(cannonImage);
    assert.equal(cannonImage.flipX, false);

    for (
      let tick = 0;
      tick < CANNON_WARNING_TICKS + CANNON_LAUNCH_DELAY_TICKS;
      tick += 1
    ) {
      system.update();
    }
    system.render(scene);

    const muzzleImage = images.find((image) =>
      image.texture.key.startsWith('cannon/muzzle/')
    );
    assert.ok(muzzleImage);
    assert.equal(muzzleImage.flipX, false);
  });

  void it('launches from the muzzle and travels outward in both directions', () => {
    for (const [variant, direction] of [
      [0, 1],
      [1, -1],
    ] as const) {
      const system = new CannonSystem(
        makeTilemap({ '2;3': cannonTile(2, 3, variant) }),
        () => undefined
      );

      for (
        let tick = 0;
        tick < CANNON_WARNING_TICKS + CANNON_LAUNCH_DELAY_TICKS;
        tick += 1
      ) {
        system.update();
      }

      const cannon = system.cannons[0];
      const ball = system.cannonBalls[0];
      assert.ok(cannon);
      assert.ok(ball);
      assert.equal(ball.direction, direction);
      assert.equal(
        ball.x + ball.bounds.width / 2,
        cannon.muzzleCenter[0]
      );

      const launchX = ball.x;
      system.update();
      assert.equal(ball.x, launchX + direction * CANNON_BALL_SPEED);
    }
  });

  void it('explodes on terrain without damaging the player', () => {
    let playerHits = 0;
    const system = new CannonSystem(
      makeTilemap({
        '2;3': cannonTile(2, 3),
        '5;3': { type: 'grass', variant: 0, loc: [5, 3] },
      }),
      () => {
        playerHits += 1;
      }
    );

    for (
      let tick = 0;
      tick < CANNON_WARNING_TICKS + CANNON_LAUNCH_DELAY_TICKS + 10;
      tick += 1
    ) {
      system.update();
    }

    assert.equal(playerHits, 0);
    assert.equal(system.cannonBalls[0]?.animation, 'explosion');
  });

  void it('damages only the player on projectile impact', () => {
    const hitDirections: number[] = [];
    const system = new CannonSystem(
      makeTilemap({ '2;3': cannonTile(2, 3) }),
      (direction) => {
        hitDirections.push(direction);
      }
    );

    for (
      let tick = 0;
      tick < CANNON_WARNING_TICKS + CANNON_LAUNCH_DELAY_TICKS;
      tick += 1
    ) {
      system.update();
    }

    const ball = system.cannonBalls[0];
    assert.ok(ball);
    system.update({
      x: ball.x + 5,
      y: ball.y,
      width: 20,
      height: 24,
    });

    assert.deepEqual(hitDirections, [1]);
    assert.equal(ball.animation, 'explosion');
  });

  void it('takes three separate sword hits to destroy a cannon', () => {
    const system = new CannonSystem(
      makeTilemap({ '2;3': cannonTile(2, 3) }),
      () => undefined
    );
    const cannon = system.cannons[0];
    assert.ok(cannon);
    const bounds = cannon.bounds;
    const firstSwing = new Set<unknown>();

    assert.deepEqual(
      system
        .damageFromAttack(bounds, firstSwing)
        .map((result) => result.health),
      [2]
    );
    assert.deepEqual(system.damageFromAttack(bounds, firstSwing), []);
    assert.equal(cannon.health, 2);

    assert.equal(system.damageFromAttack(bounds, new Set())[0]?.health, 1);
    const finalHit = system.damageFromAttack(bounds, new Set())[0];
    assert.equal(finalHit?.health, 0);
    assert.equal(finalHit?.destroyed, true);
    assert.equal(cannon.animation, 'destroyed');

    for (let tick = 0; tick < 300; tick += 1) {
      system.update();
    }
    assert.equal(system.cannonBalls.length, 0);
  });

  void it('jumps and holds the supplied white silhouette frame on impact', () => {
    const images: MockCannonImage[] = [];
    const scene = {
      add: {
        image(x: number, y: number, texture: string) {
          const image = new MockCannonImage(x, y, texture);
          images.push(image);
          return image;
        },
      },
    };
    const system = new CannonSystem(
      makeTilemap({ '2;3': cannonTile(2, 3) }),
      () => undefined
    );
    const cannon = system.cannons[0];
    assert.ok(cannon);

    system.render(scene);
    system.damageFromAttack(cannon.bounds, new Set());
    system.render(scene);

    const cannonImage = images[0];
    assert.ok(cannonImage);
    assert.equal(cannonImage.texture.key, 'cannon/hit/0');
    assert.equal(cannonImage.y, cannon.y);
    assert.equal(cannonImage.tint, undefined);
    assert.equal(images.length, 1);

    system.update();
    system.render(scene);
    assert.ok(cannonImage.y < cannon.y);
    assert.equal(cannonImage.texture.key, 'cannon/hit/0');

    for (let tick = 0; tick < 6; tick += 1) {
      system.update();
    }
    system.render(scene);
    assert.equal(cannonImage.texture.key, 'cannon/hit/0');

    system.update();
    system.render(scene);
    assert.equal(cannonImage.texture.key, 'cannon/hit/1');

    for (let tick = 0; tick < 3; tick += 1) {
      system.update();
    }
    system.render(scene);
    assert.equal(cannonImage.texture.key, 'cannon/hit/2');

    for (let tick = 0; tick < 4; tick += 1) {
      system.update();
    }
    system.render(scene);
    assert.equal(cannonImage.texture.key, 'cannon/hit/3');

    for (let tick = 0; tick < 5; tick += 1) {
      system.update();
    }
    system.render(scene);
    assert.equal(cannonImage.y, cannon.y);
    assert.equal(cannonImage.texture.key, 'cannon/idle/0');
  });
});
