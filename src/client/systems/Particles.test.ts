/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Particles } from './Particles.ts';

void describe('Particles', () => {
  void it('respects per-type spawn cooldowns', () => {
    let currentTime = 0;
    const particles = new Particles(() => currentTime);

    particles.addParticle('enemy/run_dust', [100, 100], false);
    particles.addParticle('enemy/run_dust', [100, 100], false);
    assert.equal(particles.particles.length, 1);
    assert.equal(particles.sfxFlags['enemy/run_dust'], true);

    currentTime = 599;
    particles.addParticle('enemy/run_dust', [100, 100], false);
    assert.equal(particles.particles.length, 1);

    currentTime = 600;
    particles.addParticle('enemy/run_dust', [100, 100], false);
    assert.equal(particles.particles.length, 2);
  });

  void it('updates position and animation and removes finished particles', () => {
    const particles = new Particles(() => 0);
    particles.addParticle('player/run_dust', [10, 20], true, [1.5, -2]);
    const [firstParticle] = particles.particles;

    assert.ok(firstParticle);
    particles.addParticle('player/run_dust', [30, 40], false);
    const secondParticle = particles.particles[1];
    assert.ok(secondParticle);
    assert.notEqual(firstParticle.animation, secondParticle.animation);

    particles.update();

    assert.deepEqual(firstParticle.pos, [11.5, 18]);
    assert.equal(firstParticle.animation.frame, 1);
    assert.equal(particles.sfxFlags['player/run_dust'], false);

    while (particles.particles.length > 0) {
      particles.update();
    }
    assert.equal(particles.particles.length, 0);
  });

  void it('renders particles in world coordinates with the right frame and flip', () => {
    const scene = new MockParticleScene();
    const particles = new Particles(() => 0);
    particles.addParticle('jump_dust', [12, 24], true);

    particles.render(scene);

    const image = scene.images[0];
    assert.ok(image);
    assert.deepEqual([image.x, image.y], [12, 24]);
    assert.equal(image.flipX, true);
    assert.equal(image.texture, 'particle/jump_dust/0');

    for (let frame = 0; frame < 6; frame++) {
      particles.update();
    }
    particles.render(scene);
    assert.equal(image.texture, 'particle/jump_dust/1');
  });

  void it('interpolates new player step particles but leaves old and enemy particles in place', () => {
    const scene = new MockParticleScene();
    const particles = new Particles(() => 0);
    particles.addParticle('player/run_dust', [100, 100], false);
    particles.addParticle('enemy/run_dust', [200, 200], false);

    particles.render(scene, [-2, 1]);

    assert.deepEqual(
      scene.images.map(({ x, y }) => [x, y]),
      [
        [98, 101],
        [200, 200],
      ]
    );

    particles.update();
    particles.render(scene, [-2, 1]);
    assert.deepEqual(
      scene.images.map(({ x, y }) => [x, y]),
      [
        [100, 100],
        [200, 200],
      ]
    );
  });
});

class MockParticleImage {
  x = 0;
  y = 0;
  texture: string;
  flipX = false;

  constructor(texture: string) {
    this.texture = texture;
  }

  setOrigin(_x: number, _y: number) {}

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  setTexture(texture: string) {
    this.texture = texture;
  }

  setFlipX(flip: boolean) {
    this.flipX = flip;
  }

  destroy() {}
}

class MockParticleScene {
  images: MockParticleImage[] = [];
  add = {
    image: (_x: number, _y: number, texture: string) => {
      const image = new MockParticleImage(texture);
      this.images.push(image);
      return image;
    },
  };
}
