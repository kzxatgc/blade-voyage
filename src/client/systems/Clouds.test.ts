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

  void it('keeps cloud on-screen position and display size invariant under camera zoom', () => {
    const scene1 = new MockCloudScene();
    const scene2 = new MockCloudScene();
    const scene3 = new MockCloudScene();
    const cloud1 = new Cloud({ key: 'background/cloud/0', width: 100, height: 20 }, [100, 50], 0, 0.5, 2);
    const cloud2 = new Cloud({ key: 'background/cloud/0', width: 100, height: 20 }, [100, 50], 0, 0.5, 2);
    const cloud3 = new Cloud({ key: 'background/cloud/0', width: 100, height: 20 }, [100, 50], 0, 0.5, 2);

    cloud1.render(scene1, [0, 0], 1, 1);
    cloud2.render(scene2, [0, 0], 1, 2);
    cloud3.render(scene3, [0, 0], 1, 3);

    const img1 = scene1.images[0]!;
    const img2 = scene2.images[0]!;
    const img3 = scene3.images[0]!;

    const cx = scene1.scale.width / 2;
    const cy = scene1.scale.height / 2;

    const screenX1 = (img1.x - cx) * 1 + cx;
    const screenX2 = (img2.x - cx) * 2 + cx;
    const screenX3 = (img3.x - cx) * 3 + cx;
    assert.ok(Math.abs(screenX1 - screenX2) < 0.001);
    assert.ok(Math.abs(screenX1 - screenX3) < 0.001);

    const screenY1 = (img1.y - cy) * 1 + cy;
    const screenY2 = (img2.y - cy) * 2 + cy;
    const screenY3 = (img3.y - cy) * 3 + cy;
    assert.ok(Math.abs(screenY1 - screenY2) < 0.001);
    assert.ok(Math.abs(screenY1 - screenY3) < 0.001);

    const screenW1 = img1.displaySize[0] * 1;
    const screenW2 = img2.displaySize[0] * 2;
    const screenW3 = img3.displaySize[0] * 3;
    assert.ok(Math.abs(screenW1 - screenW2) <= 1);
    assert.ok(Math.abs(screenW1 - screenW3) <= 1);
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
