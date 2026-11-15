/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Enemy, PARTICLE_POS_ADJUSTMENT, ATTACK_EFFECT_POS_ADJUSTMENT, DIALOGUE_POS_ADJUSTMENT } from './Enemy.ts';

void describe('Enemy entity', () => {
  void it('initializes pink_star with default properties and adjustments', () => {
    const enemy = new Enemy('pink_star', [100, 100], [26, 23]);

    assert.equal(enemy.enemyType, 'pink_star');
    assert.equal(enemy.type, 'enemy/pink_star');
    assert.deepEqual(enemy.pos, [100, 100]);
    assert.deepEqual(enemy.size, [26, 23]);
    assert.equal(enemy.walking, 0);
    assert.equal(enemy.anticipationState, false);
    assert.equal(enemy.attackTimer, 0);
    assert.equal(enemy.health, 100);
    assert.equal(enemy.dead, false);
    assert.equal(enemy.action, 'idle');
    assert.equal(enemy.animationKey, 'enemy/pink_star/idle');
    assert.equal(enemy.animation?.img(), 'enemy/pink_star/idle/0');

    assert.deepEqual(enemy.particlePosAdjustment, PARTICLE_POS_ADJUSTMENT['pink_star']);
    assert.deepEqual(enemy.attackEffectPosAdjustment, ATTACK_EFFECT_POS_ADJUSTMENT['pink_star']);
    assert.deepEqual(enemy.dialoguePosAdjustment, DIALOGUE_POS_ADJUSTMENT['pink_star']);
  });

  void it('initializes crabby with size 32x26', () => {
    const enemy = new Enemy('crabby', [200, 200], [32, 26]);

    assert.equal(enemy.enemyType, 'crabby');
    assert.equal(enemy.type, 'enemy/crabby');
    assert.deepEqual(enemy.size, [32, 26]);
    assert.equal(enemy.animationKey, 'enemy/crabby/idle');
    assert.equal(enemy.animation?.img(), 'enemy/crabby/idle/0');
  });

  void it('initializes fierce_tooth with size 24x20', () => {
    const enemy = new Enemy('fierce_tooth', [300, 300], [24, 20]);

    assert.equal(enemy.enemyType, 'fierce_tooth');
    assert.equal(enemy.type, 'enemy/fierce_tooth');
    assert.deepEqual(enemy.size, [24, 20]);
    assert.equal(enemy.animationKey, 'enemy/fierce_tooth/idle');
    assert.equal(enemy.animation?.img(), 'enemy/fierce_tooth/idle/0');
  });

  void it('generates dialogue animations and ignores duplicate generation calls', () => {
    const enemy = new Enemy('pink_star', [100, 100], [26, 23]);

    assert.equal(enemy.dialogueAnimation, null);
    enemy.generateDialogue('exclamation');
    const dialogue = enemy.dialogueAnimation as unknown as { img(): string } | null;
    assert.ok(dialogue !== null);
    assert.equal(enemy.dialogueType, 'exclamation');
    assert.equal(dialogue?.img(), 'dialogue/exclamation/0');

    // Generating while dialogue is active does not overwrite
    enemy.generateDialogue('dead');
    assert.equal(enemy.dialogueType, 'exclamation');
  });

  void it('renders enemy and flips horizontally based on facing direction', () => {
    const enemy = new Enemy('pink_star', [100, 100], [26, 23]);
    let flipped = false;
    let renderedPos: [number, number] = [0, 0];

    const mockScene = {
      add: {
        image(x: number, y: number) {
          renderedPos = [x, y];
          return {
            setOrigin() {},
            setPosition(nx: number, ny: number) {
              renderedPos = [nx, ny];
            },
            setTexture() {},
            setFlipX(f: boolean) {
              flipped = f;
            },
            destroy() {},
          };
        },
      },
    };

    // When facing right (flip = false), enemy sprite is flipped (not flip = true)
    enemy.flip = false;
    enemy.render(mockScene);
    assert.equal(flipped, true);
    assert.deepEqual(renderedPos, [100, 100]);

    // When facing left (flip = true), enemy sprite is not flipped (not flip = false)
    enemy.flip = true;
    enemy.render(mockScene);
    assert.equal(flipped, false);

    // Destroy cleans up image
    enemy.destroy();
  });
});
