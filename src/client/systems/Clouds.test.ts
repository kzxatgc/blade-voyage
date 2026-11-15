/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BigCloud, Cloud, Clouds } from './Clouds.ts';

void describe('Clouds', () => {
  void it('updates and renders small clouds with parallax and zoom compensation', () => {
    const scene = new MockCloudScene();
    const cloud = new Cloud(
      { key: 'background/cloud/0', width: 100, height: 20 },
      [100, 50],
      2,
      0.5,
      3
    );

    cloud.update();
    cloud.render(scene, [20, 10], 2);

    const image = scene.images[0];
    assert.ok(image);
    assert.equal(image.x, -99.75);
    assert.equal(image.y, 59.875);
    assert.deepEqual(image.displaySize, [150, 30]);
    assert.equal(image.scrollFactor, 0);
  });

  void it('renders small clouds with smooth continuous vertical parallax without wrapping', () => {
    const scene = new MockCloudScene();
    const cloud = new Cloud(
      { key: 'background/cloud/0', width: 100, height: 20 },
      [100, 245],
      0,
      0.6,
      1
    );

    // Standing on ground (offset y = 50)
    cloud.render(scene, [0, 50], 1);
    const yBefore = scene.images[0]?.y;
    assert.ok(yBefore !== undefined);

    // High jump (offset y = -300)
    cloud.render(scene, [0, -300], 1);
    const yAfter = scene.images[0]?.y;
    assert.ok(yAfter !== undefined);

    // Smooth 10.5px parallax shift without wrapping or snapping
    assert.ok(Math.abs((yAfter - yBefore) - 10.5) < 0.001);
  });

  void it('tiles the big cloud across the surface and pins it to sea level', () => {
    const scene = new MockCloudScene();
    const cloud = new BigCloud(
      { key: 'background/big_cloud', width: 100, height: 20 },
      0.8
    );
    cloud.update();
    cloud.render(scene, [10, 20], 2);

    assert.equal(scene.images.length, 3);
    assert.deepEqual(
      scene.images.map(({ x }) => x),
      [-640, 0, 640]
    );
    assert.ok(
      scene.images.every(
        ({ y, displaySize }) =>
          y === 340 * BigCloud.SEA_LEVEL_FRAC - 128 &&
          displaySize[0] === 640 &&
          displaySize[1] === 128
      )
    );
  });

  void it('creates ten small clouds with speeds tied to the primary big cloud', () => {
    const clouds = new Clouds(
      [{ key: 'background/cloud/0', width: 74, height: 24 }],
      10,
      [{ key: 'background/big_cloud', width: 448, height: 101 }],
      () => 0.5
    );
    const previousPositions = clouds.clouds.map(({ pos }) => pos[0]);

    assert.equal(clouds.clouds.length, 10);
    assert.equal(clouds.bigClouds.length, 1);
    const baseSpeed = clouds.bigClouds[0]?.speed;
    assert.ok(baseSpeed !== undefined);
    assert.ok(
      clouds.clouds.every(
        ({ speed, depth }) =>
          Math.abs(speed - baseSpeed * (0.3 + depth * 0.8)) < 1e-12
      )
    );

    clouds.update();
    assert.ok(
      clouds.clouds.every(
        ({ pos }, index) => pos[0] > previousPositions[index]!
      )
    );
  });

  void it('rejects invalid zoom and missing cloud textures', () => {
    const cloud = new Cloud(
      { key: 'background/cloud/0', width: 74, height: 24 },
      [0, 0],
      1,
      0.5
    );

    assert.throws(() => cloud.render(new MockCloudScene(), [0, 0], 0), RangeError);
    assert.throws(() => new Clouds([], 1), /At least one small cloud image/);
  });
});

class MockCloudImage {
  x = 0;
  y = 0;
  displaySize: [number, number] = [0, 0];
  scrollFactor = 1;
  visible = true;

  setOrigin(_x: number, _y: number) {}

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setDisplaySize(width: number, height: number) {
    this.displaySize = [width, height];
  }

  setScrollFactor(factor: number) {
    this.scrollFactor = factor;
  }

  setVisible(visible: boolean) {
    this.visible = visible;
  }
}

class MockCloudScene {
  scale = { width: 640, height: 340 };
  images: MockCloudImage[] = [];
  add = {
    image: (_x: number, _y: number, _texture: string) => {
      const image = new MockCloudImage();
      this.images.push(image);
      return image;
    },
  };
}
