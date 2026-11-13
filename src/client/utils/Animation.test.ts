/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const animationUrl = new URL('./Animation.ts', import.meta.url).href;

const getAnimation = async () => (await import(animationUrl)).Animation;

void describe('Animation', () => {
  void it('loops through frame keys at the configured duration', async () => {
    const Animation = await getAnimation();
    const animation = new Animation('test', 4, 6);

    assert.equal(animation.img(), 'test/0');
    for (let i = 0; i < 6; i++) animation.update();
    assert.equal(animation.img(), 'test/1');
    for (let i = 0; i < 18; i++) animation.update();
    assert.equal(animation.img(), 'test/0');
    assert.equal(animation.done, false);
  });

  void it('stops at the final frame when not looping', async () => {
    const Animation = await getAnimation();
    const animation = new Animation('test', 3, 6, false);

    for (let i = 0; i < 30; i++) animation.update();

    assert.equal(animation.frame, 17);
    assert.equal(animation.img(), 'test/2');
    assert.equal(animation.done, true);
    animation.update();
    assert.equal(animation.frame, 17);
  });

  void it('sets indexChanged only when the image index changes', async () => {
    const Animation = await getAnimation();
    const animation = new Animation('test', 2, 6);

    for (let i = 0; i < 5; i++) animation.update();
    assert.equal(animation.indexChanged, false);
    animation.update();
    assert.equal(animation.indexChanged, true);
    animation.update();
    assert.equal(animation.indexChanged, false);
  });

  void it('copy creates a fresh animation with the same configuration', async () => {
    const Animation = await getAnimation();
    const animation = new Animation('test', 2, 6, false);

    for (let i = 0; i < 10; i++) animation.update();
    const copy = animation.copy();

    assert.equal(copy.frame, 0);
    assert.equal(copy.img(), 'test/0');
    assert.equal(copy.imgDur, 6);
    assert.equal(copy.loop, false);
    assert.equal(animation.frame, 10);
  });

  void it('rejects invalid frame counts and durations', async () => {
    const Animation = await getAnimation();

    assert.throws(() => new Animation('test', 0, 6), RangeError);
    assert.throws(() => new Animation('test', 2, 0), RangeError);
  });
});
