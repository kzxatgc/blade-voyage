/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  Spark,
  Sparks,
  createDiamondPoints,
  createHeartPoints,
  rgbToHex,
  type SparksRenderSurface,
} from './Sparks.ts';

void describe('Spark', () => {
  void it('moves in angle direction and decays speed', () => {
    const spark = new Spark([100, 100], 0, 2); // angle 0 = right
    const killed = spark.update();
    assert.equal(killed, false);
    assert.ok(spark.pos[0] > 100); // moved right
    assert.equal(spark.pos[1], 100);
    assert.ok(spark.speed < 2); // decayed
  });

  void it('returns true when speed reaches 0', () => {
    const spark = new Spark([0, 0], 0, 0.05);
    const killed = spark.update();
    assert.equal(killed, true);
    assert.equal(spark.speed, 0);
  });

  void it('creates 4 diamond polygon points with correct offset', () => {
    const points = createDiamondPoints([50, 50], 0, 2, [3, 0.5], [10, 10]);
    assert.equal(points.length, 4);
    // Tip 0: angle 0 (right): pos[0] + cos(0)*speed*3 - offset[0] = 50 + 1*2*3 - 10 = 46
    assert.equal(points[0]?.[0], 46);
    assert.equal(points[0]?.[1], 40);
  });

  void it('creates heart points parametrically', () => {
    const points = createHeartPoints([100, 100], 6, 1, [0, 0]);
    assert.ok(points.length > 50);
  });

  void it('renders to surface using fillPoints', () => {
    const spark = new Spark([50, 50], 0, 1);
    let capturedColor = 0;
    let capturedPointsCount = 0;

    const mockSurface: SparksRenderSurface = {
      fillStyle(color: number) {
        capturedColor = color;
      },
      fillPoints(points) {
        capturedPointsCount = points.length;
      },
    };

    spark.render([255, 0, 0], mockSurface, 'diamond', [0, 0]);
    assert.equal(capturedColor, 0xff0000);
    assert.equal(capturedPointsCount, 4);

    spark.render(0x00ff00, mockSurface, 'heart', [0, 0], 6);
    assert.equal(capturedColor, 0x00ff00);
    assert.ok(capturedPointsCount > 50);
  });
});

void describe('Sparks', () => {
  void it('creates correct number of sparks for burst', () => {
    const sparks = new Sparks([100, 100], false, 3, 10, [255, 255, 255], 'burst', 'diamond');
    assert.equal(sparks.sparks.length, 10);
    for (const spark of sparks.sparks) {
      assert.ok(spark.speed <= 3);
    }
  });

  void it('supports "up" direction mode', () => {
    const sparks = new Sparks([100, 100], false, 2, 5, [255, 215, 0], 'up', 'diamond');
    assert.equal(sparks.sparks.length, 5);
    for (const spark of sparks.sparks) {
      // Up direction angles are in range [-0.85*PI, -0.15*PI] (all negative y)
      assert.ok(spark.angle < 0);
    }
  });

  void it('supports specific angle and flips direction', () => {
    const sparksNormal = new Sparks([100, 100], false, 2, 1, [255, 255, 255], 0, 'diamond', [3, 0.5], () => 0.5);
    const sparksFlipped = new Sparks([100, 100], true, 2, 1, [255, 255, 255], 0, 'diamond', [3, 0.5], () => 0.5);

    const normalAngle = sparksNormal.sparks[0]?.angle ?? 0;
    const flippedAngle = sparksFlipped.sparks[0]?.angle ?? 0;
    assert.ok(Math.abs(flippedAngle - normalAngle - Math.PI) < 0.0001);
  });

  void it('updates and filters out expired sparks, returning true when empty', () => {
    const sparks = new Sparks([100, 100], false, 0.05, 3, [255, 255, 255], 'burst');
    assert.equal(sparks.sparks.length, 3);

    // Initial speed <= 0.05, decays to 0 on 1st update
    const empty = sparks.update();
    assert.equal(empty, true);
    assert.equal(sparks.sparks.length, 0);
  });

  void it('renders all managed sparks', () => {
    const sparks = new Sparks([100, 100], false, 2, 4, [255, 255, 255], 'burst');
    let renderCalls = 0;
    const mockSurface: SparksRenderSurface = {
      fillStyle() {},
      fillPoints() {
        renderCalls++;
      },
    };

    sparks.render(mockSurface);
    assert.equal(renderCalls, 4);
  });
});

void describe('rgbToHex utility', () => {
  void it('converts rgb array to hex number', () => {
    assert.equal(rgbToHex([255, 255, 255]), 0xffffff);
    assert.equal(rgbToHex([0, 0, 0]), 0x000000);
    assert.equal(rgbToHex([140, 140, 160]), (140 << 16) | (140 << 8) | 160);
    assert.equal(rgbToHex(0x123456), 0x123456);
  });
});

