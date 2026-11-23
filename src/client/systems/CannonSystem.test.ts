/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MapData, TileData } from '../../shared/types.ts';
import {
  CannonSystem,
  CANNON_ANIMATION_FRAME_TICKS,
  CANNON_BALL_SPEED,
  CANNON_COOLDOWN_TICKS,
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
  alpha = 1;
  flipX = false;
  rotation = 0;
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

  setAlpha(alpha: number) {
    this.alpha = alpha;
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

  setRotation(rotation: number) {
    this.rotation = rotation;
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
    assert.equal(system.cannons[0]?.x, 2 * 32 - 4);
    assert.equal(system.cannons[1]?.x, 5 * 32 - 4);
    assert.equal(system.cannons[0]?.bounds.y, 3 * 32 + 6);
  });

  void it('activates a cannon when its bounds enter the camera viewport', () => {
    const system = new CannonSystem(
      makeTilemap({ '2;3': cannonTile(2, 3) }),
      () => undefined
    );
    const cannon = system.cannons[0];
    assert.ok(cannon);
    const outsideViewport = { x: 200, y: 0, width: 128, height: 160 };
    const cameraViewport = { x: 0, y: 0, width: 128, height: 160 };

    for (let tick = 0; tick < CANNON_WARNING_TICKS + 10; tick += 1) {
      system.update(undefined, outsideViewport);
    }
    assert.equal(system.cannonBalls.length, 0);
    assert.equal(cannon.warning, false);
    assert.equal(cannon.activated, false);

    system.update(undefined, cameraViewport);
    assert.equal(cannon.activated, true);
    assert.equal(cannon.warning, true);
  });

  void it('finishes its warning and fires after leaving the camera viewport', () => {
    const system = new CannonSystem(
      makeTilemap({ '2;3': cannonTile(2, 3) }),
      () => undefined
    );
    const cannon = system.cannons[0];
    assert.ok(cannon);
    const cameraViewport = { x: 0, y: 0, width: 128, height: 160 };
    const outsideViewport = { x: 200, y: 0, width: 128, height: 160 };

    system.update(undefined, cameraViewport);
    for (
      let tick = 0;
      tick < CANNON_WARNING_TICKS + CANNON_LAUNCH_DELAY_TICKS - 1;
      tick += 1
    ) {
      system.update(undefined, outsideViewport);
    }

    assert.equal(system.cannonBalls.length, 1);
    assert.equal(cannon.activated, false);
    assert.equal(cannon.cooldownTicksRemaining, CANNON_COOLDOWN_TICKS);
    assert.equal(cannon.warning, false);
  });

  void it('enforces a cooldown before rearming while the cannon stays visible', () => {
    const system = new CannonSystem(
      makeTilemap({ '2;3': cannonTile(2, 3) }),
      () => undefined
    );
    const cannon = system.cannons[0];
    assert.ok(cannon);
    assert.equal(cannon.warning, false);

    system.update();
    assert.equal(cannon.warning, true);
    for (let tick = 0; tick < CANNON_WARNING_TICKS - 2; tick += 1) {
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

    assert.equal(cannon.cooldownTicksRemaining, CANNON_COOLDOWN_TICKS);
    for (let tick = 0; tick < CANNON_COOLDOWN_TICKS - 1; tick += 1) {
      system.update();
    }
    assert.equal(system.cannonBalls.length, 1);
    assert.equal(cannon.activated, false);
    assert.equal(cannon.cooldownTicksRemaining, 1);

    system.update();
    assert.equal(system.cannonBalls.length, 1);
    assert.equal(cannon.cooldownTicksRemaining, 0);
    assert.equal(cannon.warning, true);

    for (
      let tick = 0;
      tick < CANNON_WARNING_TICKS + CANNON_LAUNCH_DELAY_TICKS - 1;
      tick += 1
    ) {
      system.update();
    }
    assert.equal(system.cannonBalls.length, 2);
  });

  void it('does not reset cooldown when the camera repeatedly leaves and re-enters', () => {
    const system = new CannonSystem(
      makeTilemap({ '2;3': cannonTile(2, 3) }),
      () => undefined
    );
    const cannon = system.cannons[0];
    assert.ok(cannon);
    const cameraViewport = { x: 0, y: 0, width: 128, height: 160 };
    const outsideViewport = { x: 200, y: 0, width: 128, height: 160 };

    for (
      let tick = 0;
      tick < CANNON_WARNING_TICKS + CANNON_LAUNCH_DELAY_TICKS;
      tick += 1
    ) {
      system.update(undefined, cameraViewport);
    }
    assert.equal(system.cannonBalls.length, 1);

    for (let tick = 0; tick < CANNON_COOLDOWN_TICKS - 1; tick += 1) {
      system.update(
        undefined,
        tick % 2 === 0 ? outsideViewport : cameraViewport
      );
    }
    assert.equal(cannon.cooldownTicksRemaining, 1);
    assert.equal(system.cannonBalls.length, 1);
    assert.equal(cannon.activated, false);

    system.update(undefined, outsideViewport);
    assert.equal(cannon.cooldownTicksRemaining, 0);
    assert.equal(cannon.activated, false);
    system.update(undefined, cameraViewport);
    assert.equal(cannon.activated, true);
    assert.equal(cannon.warning, true);
    assert.equal(system.cannonBalls.length, 1);
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

    system.update();
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
      assert.equal(
        ball.y + ball.bounds.height / 2,
        cannon.muzzleCenter[1]
      );

      const launchX = ball.x;
      system.update();
      assert.equal(ball.x, launchX + direction * CANNON_BALL_SPEED);
    }
  });

  void it('breaks into debris on terrain without damaging the player', () => {
    let playerHits = 0;
    const motionValues = [
      0, 0.5, 0.5, 0.5,
      0.34, 0.5, 0, 1,
      0.67, 1, 1, 0,
      0.34, 0.25, 0.25, 0.75,
      0.67, 0.75, 0.75, 0.25,
    ];
    let randomCalls = 0;
    const random = () => {
      if (randomCalls++ === 0) {
        return 0.99;
      }
      return motionValues[(randomCalls - 2) % motionValues.length] ?? 0;
    };
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
      makeTilemap({
        '2;3': cannonTile(2, 3),
        '5;3': { type: 'grass', variant: 0, loc: [5, 3] },
      }),
      () => {
        playerHits += 1;
      },
      random
    );

    for (
      let tick = 0;
      tick < CANNON_WARNING_TICKS + CANNON_LAUNCH_DELAY_TICKS + 30 &&
      system.cannonDebris.length === 0;
      tick += 1
    ) {
      system.update();
    }

    assert.equal(playerHits, 0);
    assert.equal(system.cannonBalls.length, 0);
    assert.equal(system.cannonDebris.length, 9);
    const secondDebris = system.cannonDebris[1];
    assert.ok(secondDebris);
    assert.equal(secondDebris.velocityX.toFixed(2), '-0.91');
    assert.equal(secondDebris.velocityY.toFixed(2), '-3.25');
    const wallX = 5 * 32;
    assert.ok(
      system.cannonDebris.every(
        (fragment) => fragment.bounds.x + fragment.bounds.width <= wallX
      )
    );
    assert.ok(
      system.cannonDebris.some(
        (fragment) => fragment.bounds.x + fragment.bounds.width === wallX
      )
    );
    assert.deepEqual(
      new Set(
        system.cannonDebris.map((fragment) => fragment.animationFrameTicks)
      ),
      new Set([2, 3, 4])
    );
    system.render(scene);
    const debrisImages = images.filter((image) =>
      image.texture.key.startsWith('cannon/ball/destroyed/')
    );
    assert.equal(debrisImages.length, 9);
    assert.deepEqual(
      new Set(debrisImages.map((image) => image.texture.key)),
      new Set([
        'cannon/ball/destroyed/0',
        'cannon/ball/destroyed/1',
        'cannon/ball/destroyed/2',
      ])
    );
  });

  void it('bursts from the struck wall face in either cannon direction', () => {
    for (const [cannonX, variant, direction] of [
      [2, 0, 1],
      [8, 1, -1],
    ] as const) {
      const wallX = 5 * 32;
      const wallImpacts: [number, number][] = [];
      const system = new CannonSystem(
        makeTilemap({
          [`${cannonX};3`]: cannonTile(cannonX, 3, variant),
          '5;3': { type: 'grass', variant: 0, loc: [5, 3] },
        }),
        () => undefined,
        () => 0,
        (position) => {
          wallImpacts.push([position[0], position[1]]);
        }
      );

      for (
        let tick = 0;
        tick < CANNON_WARNING_TICKS + CANNON_LAUNCH_DELAY_TICKS + 30 &&
        system.cannonDebris.length === 0;
        tick += 1
      ) {
        system.update();
      }

      assert.equal(system.cannonDebris.length, 6);
      const wallRight = wallX + 32;
      assert.equal(wallImpacts.length, 1);
      assert.equal(
        wallImpacts[0]?.[0],
        direction > 0 ? wallX : wallRight
      );
      assert.ok(wallImpacts[0]?.[1] >= 3 * 32);
      assert.ok(wallImpacts[0]?.[1] < 4 * 32);
      if (direction > 0) {
        assert.ok(
          system.cannonDebris.every(
            (fragment) => fragment.bounds.x + fragment.bounds.width <= wallX
          )
        );
        assert.ok(
          system.cannonDebris.some(
            (fragment) => fragment.bounds.x + fragment.bounds.width === wallX
          )
        );
      } else {
        assert.ok(
          system.cannonDebris.every(
            (fragment) => fragment.bounds.x >= wallRight
          )
        );
        assert.ok(
          system.cannonDebris.some(
            (fragment) => fragment.bounds.x === wallRight
          )
        );
      }

      const startingMotion = system.cannonDebris.map((fragment) => ({
        x: fragment.x,
        y: fragment.y,
        velocityX: fragment.velocityX,
        velocityY: fragment.velocityY,
      }));
      system.update();
      assert.ok(
        new Set(system.cannonDebris.map((fragment) => fragment.x)).size > 1
      );
      system.cannonDebris.forEach((fragment, index) => {
        const start = startingMotion[index];
        assert.ok(start);
        assert.equal(fragment.x, start.x + start.velocityX);
        assert.ok(fragment.y < start.y);
        assert.ok(fragment.velocityY > start.velocityY);
      });

      if (direction > 0) {
        assert.ok(
          system.cannonDebris.every(
            (fragment) => fragment.bounds.x + fragment.bounds.width < wallX
          )
        );
      } else {
        assert.ok(
          system.cannonDebris.every(
            (fragment) => fragment.bounds.x > wallRight
          )
        );
      }
    }
  });

  void it('lands each debris fragment flush on the floor before it fades', () => {
    const tiles: Record<string, TileData> = {
      '2;3': cannonTile(2, 3),
      '5;3': { type: 'grass', variant: 0, loc: [5, 3] },
    };
    for (let x = -12; x <= 12; x += 1) {
      tiles[`${x};4`] = { type: 'grass', variant: 0, loc: [x, 4] };
    }

    let randomCalls = 0;
    const random = () => {
      if (randomCalls++ === 0) {
        return 0;
      }
      return [0, 0.5, 0.5, 0.5][(randomCalls - 2) % 4] ?? 0;
    };
    const system = new CannonSystem(makeTilemap(tiles), () => undefined, random);

    for (
      let tick = 0;
      tick < CANNON_WARNING_TICKS + CANNON_LAUNCH_DELAY_TICKS + 20 &&
      system.cannonDebris.length === 0;
      tick += 1
    ) {
      system.update();
    }

    assert.equal(system.cannonBalls.length, 0);
    assert.equal(system.cannonDebris.length, 6);
    const fragments = [...system.cannonDebris];
    const debris = fragments[0];
    assert.ok(debris);
    assert.ok(debris.velocityX < 0);
    assert.ok(debris.velocityY < 0);
    const impactY = debris.y;

    for (let tick = 0; tick < 5; tick += 1) {
      system.update();
    }
    assert.ok(debris.y < impactY);
    assert.ok(debris.velocityY > -2.2);
    assert.equal(debris.animationFrame, 1);
    for (let tick = 0; tick < 3; tick += 1) {
      system.update();
    }
    assert.equal(debris.animationFrame, 2);
    for (let tick = 0; tick < 3; tick += 1) {
      system.update();
    }
    assert.equal(debris.animationFrame, 0);

    let fallTicks = 0;
    while (fragments.some((fragment) => !fragment.grounded) && fallTicks < 60) {
      system.update();
      fallTicks += 1;
    }

    assert.ok(fragments.every((fragment) => fragment.grounded));
    assert.ok(fallTicks < 60);
    assert.deepEqual(
      new Set(fragments.map((fragment) => fragment.groundedAnimationFrame)),
      new Set([0, 1, 2])
    );
    for (const fragment of fragments) {
      assert.equal(fragment.bounds.y + fragment.bounds.height, 4 * 32);
    }

    const lastToLand = fragments.reduce((latest, fragment) =>
      fragment.ageTicks > latest.ageTicks ? fragment : latest
    );
    const groundedFrame = lastToLand.animationFrame;
    for (let tick = 0; tick < 30; tick += 1) {
      system.update();
    }
    assert.equal(lastToLand.animationFrame, groundedFrame);
    assert.equal(lastToLand.alpha, 1);
    system.update();
    assert.ok(lastToLand.alpha < 1);
    for (let tick = 0; tick < 11; tick += 1) {
      system.update();
    }
    assert.equal(system.cannonDebris.includes(lastToLand), false);
  });

  void it('damages only the player on projectile impact', () => {
    const hitDirections: number[] = [];
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
    system.render(scene);
    assert.ok(
      images.some((image) => image.texture.key === 'cannon/ball/explosion/0')
    );
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
        .damageFromAttack(bounds, firstSwing, cannon.x - 20)
        .map((result) => result.health),
      [2]
    );
    assert.deepEqual(
      system.damageFromAttack(bounds, firstSwing, cannon.x - 20),
      []
    );
    assert.equal(cannon.health, 2);

    assert.equal(
      system.damageFromAttack(bounds, new Set(), cannon.x - 20)[0]?.health,
      1
    );
    const finalHit = system.damageFromAttack(
      bounds,
      new Set(),
      cannon.x - 20
    )[0];
    assert.equal(finalHit?.health, 0);
    assert.equal(finalHit?.destroyed, true);
    assert.equal(cannon.animation, 'destroyed');

    for (let tick = 0; tick < 300; tick += 1) {
      system.update();
    }
    assert.equal(system.cannonBalls.length, 0);
  });

  void it('bursts the heavy cannon body and two lighter holders independently', () => {
    const tiles: Record<string, TileData> = {
      '2;3': cannonTile(2, 3),
    };
    for (let x = -10; x <= 10; x += 1) {
      tiles[`${x};4`] = { type: 'grass', variant: 0, loc: [x, 4] };
    }

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
      makeTilemap(tiles),
      () => undefined,
      () => 0.5
    );
    const cannon = system.cannons[0];
    assert.ok(cannon);

    for (let hit = 0; hit < 3; hit += 1) {
      system.damageFromAttack(cannon.bounds, new Set(), cannon.x - 20);
    }

    assert.deepEqual(
      system.cannonWreckParts.map((part) => part.frame),
      [1, 2, 3]
    );
    const body = system.cannonWreckParts[0];
    const firstHolder = system.cannonWreckParts[1];
    const secondHolder = system.cannonWreckParts[2];
    assert.ok(body);
    assert.ok(firstHolder);
    assert.ok(secondHolder);
    assert.equal(body.kind, 'body');
    assert.equal(firstHolder.kind, 'holder');
    assert.equal(secondHolder.kind, 'holder');
    assert.ok(body.mass > firstHolder.mass);
    assert.equal(firstHolder.mass, secondHolder.mass);
    assert.ok(
      Math.hypot(body.velocityX, body.velocityY) <
        Math.hypot(firstHolder.velocityX, firstHolder.velocityY)
    );
    assert.ok(
      Math.hypot(body.velocityX, body.velocityY) <
        Math.hypot(secondHolder.velocityX, secondHolder.velocityY)
    );
    assert.notEqual(firstHolder.x, secondHolder.x);

    system.render(scene);
    assert.ok(images.some((image) => image.texture.key === 'cannon/destroyed/0'));
    assert.deepEqual(
      new Set(
        images
          .filter((image) => image.texture.key.startsWith('cannon/destroyed/'))
          .map((image) => image.texture.key)
      ),
      new Set([
        'cannon/destroyed/0',
        'cannon/destroyed/1',
        'cannon/destroyed/2',
        'cannon/destroyed/3',
      ])
    );

    const holderParts = [firstHolder, secondHolder];
    let sawHolderDescending = false;
    let sawHolderBounce = false;
    for (let tick = 0; tick < 90; tick += 1) {
      system.update();
      if (holderParts.some((part) => part.velocityY > 0)) {
        sawHolderDescending = true;
      } else if (
        sawHolderDescending &&
        holderParts.some((part) => part.velocityY < 0)
      ) {
        sawHolderBounce = true;
      }
      if (system.cannonWreckParts.every((part) => part.grounded)) {
        break;
      }
    }

    assert.equal(sawHolderBounce, true);
    assert.ok(system.cannonWreckParts.every((part) => part.grounded));
    for (const part of system.cannonWreckParts) {
      assert.ok(
        Math.abs(part.bounds.y + part.bounds.height - 4 * 32) < 0.000001
      );
    }

    for (let tick = 0; tick < 60; tick += 1) {
      system.update();
    }
    assert.equal(system.cannonWreckParts.length, 3);
    assert.ok(system.cannonWreckParts.every((part) => part.grounded));

    for (let tick = 0; tick < 300; tick += 1) {
      system.update();
    }
    assert.equal(system.cannonWreckParts.length, 3);

    system.render(scene);
    assert.equal(
      images.find((image) => image.texture.key === 'cannon/destroyed/0')?.visible,
      false
    );
  });

  void it('knocks the cannon away from the attacking side for 30 ticks', () => {
    for (const [attackerX, direction] of [
      [40, 1],
      [120, -1],
    ] as const) {
      const system = new CannonSystem(
        makeTilemap({ '2;3': cannonTile(2, 3) }),
        () => undefined
      );
      const cannon = system.cannons[0];
      assert.ok(cannon);
      const startX = cannon.x;

      system.damageFromAttack(cannon.bounds, new Set(), attackerX);
      assert.ok(
        Math.abs(cannon.knockbackVelocityX - direction * 1.15) < 0.000001
      );
      assert.equal(cannon.knockbackTicksRemaining, 30);

      for (let tick = 0; tick < 30; tick += 1) {
        system.update();
      }

      assert.ok((cannon.x - startX) * direction > 9.7);
      assert.ok((cannon.x - startX) * direction < 9.8);
      assert.equal(cannon.knockbackTicksRemaining, 0);
      assert.equal(cannon.knockbackVelocityX, 0);
    }
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
    system.damageFromAttack(cannon.bounds, new Set(), cannon.x - 20);
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
