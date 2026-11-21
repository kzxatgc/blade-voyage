/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AIR_ATTACK_TYPES,
  AIR_ATTACK_COOLDOWN_TICKS,
  Attack,
  ATTACK_TYPES,
  GROUND_ATTACK_COOLDOWN_TICKS,
  type AttackPlayerTarget,
  type AttackRenderScene,
} from './Attack.ts';

void describe('Attack', () => {
  void it('triggers ground attack when airTime <= 1', () => {
    const attack = new Attack();
    attack.triggerAttack(0); // airTime = 0
    assert.equal(attack.attackState, true);
    assert.ok(
      (ATTACK_TYPES as readonly string[]).includes(attack.currentAttackType)
    );
  });

  void it('does not trigger when already attacking', () => {
    const attack = new Attack();
    attack.triggerAttack(0);
    const firstType = attack.currentAttackType;
    attack.triggerAttack(0);
    assert.equal(attack.currentAttackType, firstType); // unchanged
  });

  void it('enforces a ground-attack cooldown after the attack animation ends', () => {
    const attack = new Attack();
    assert.equal(attack.isReady, true);
    assert.equal(attack.triggerAttack(0), true);
    assert.equal(attack.isReady, false);
    assert.equal(attack.cooldownProgress, 0);
    attack.attackState = false;
    attack.update();

    const ticksPerSquare = Math.ceil(GROUND_ATTACK_COOLDOWN_TICKS / 5);
    for (let tick = 0; tick < ticksPerSquare; tick += 1) {
      attack.update();
    }
    assert.equal(Math.floor(attack.cooldownProgress * 5), 1);

    for (
      let tick = ticksPerSquare;
      tick < GROUND_ATTACK_COOLDOWN_TICKS - 1;
      tick += 1
    ) {
      attack.update();
    }

    assert.equal(attack.triggerAttack(0), false);
    attack.update();
    assert.equal(attack.isReady, true);
    assert.equal(attack.triggerAttack(0), true);
  });

  void it('triggers air attack when airTime > 1', () => {
    const attack = new Attack();
    attack.triggerAttack(5); // in air
    assert.ok(
      (AIR_ATTACK_TYPES as readonly string[]).includes(attack.currentAttackType)
    );
  });

  void it('shares the aerial cooldown with ground follow-up attempts', () => {
    const attack = new Attack();
    assert.equal(attack.triggerAttack(5), true);
    attack.attackState = false;
    attack.update();

    for (let tick = 0; tick < AIR_ATTACK_COOLDOWN_TICKS - 1; tick += 1) {
      attack.update();
    }

    assert.equal(attack.triggerAttack(0), false);
    attack.update();
    assert.equal(attack.triggerAttack(0), true);
  });

  void it('updates player action and ends attack when animation is done', () => {
    let assignedAction = '';
    const mockPlayer: AttackPlayerTarget = {
      airTime: 0,
      flip: false,
      pos: [100, 200],
      animation: { done: false } as unknown as AttackPlayerTarget['animation'],
      setAction(act: string) {
        assignedAction = act;
      },
    };

    const attack = new Attack(mockPlayer, () => 0); // picks attack_1
    attack.triggerAttack();
    assert.equal(attack.attackState, true);

    attack.setAction();
    assert.equal(assignedAction, 'sword/attack_1');
    assert.equal(attack.attackState, true);

    // When animation completes
    if (mockPlayer.animation) {
      mockPlayer.animation.done = true;
    }
    attack.setAction();
    assert.equal(attack.attackState, false);
  });

  void it('renders effect overlay with directional posAdjustment and cleans up when done', () => {
    type MockImageRecord = {
      x: number;
      y: number;
      texture: string;
      flipX: boolean;
    };
    let createdImage: MockImageRecord | null = null;
    const mockScene: AttackRenderScene = {
      add: {
        image(x: number, y: number, texture: string) {
          createdImage = { x, y, texture, flipX: false };
          return {
            setOrigin() {},
            setPosition(px: number, py: number) {
              if (createdImage) {
                createdImage.x = px;
                createdImage.y = py;
              }
            },
            setTexture(tex: string) {
              if (createdImage) createdImage.texture = tex;
            },
            setFlipX(flip: boolean) {
              if (createdImage) createdImage.flipX = flip;
            },
            destroy() {
              createdImage = null;
            },
          };
        },
      },
    };

    const mockPlayer: AttackPlayerTarget = {
      airTime: 0,
      flip: false,
      pos: [100, 200],
      animation: { done: false } as unknown as AttackPlayerTarget['animation'],
      setAction() {},
    };

    const attack = new Attack(mockPlayer, () => 0); // attack_1: [44, 15, -7, 15]
    attack.triggerAttack();
    attack.render(mockScene);

    assert.ok(createdImage !== null);
    const renderedImage = createdImage as MockImageRecord;
    // facing right: pos + [44, 15] -> [144, 215]
    assert.equal(renderedImage.x, 144);
    assert.equal(renderedImage.y, 215);
    assert.equal(renderedImage.flipX, false);

    // facing left: pos + [-7, 15] -> [93, 215]
    mockPlayer.flip = true;
    attack.render(mockScene);
    assert.equal(renderedImage.x, 93);
    assert.equal(renderedImage.y, 215);
    assert.equal(renderedImage.flipX, true);

    // Fast-forward effect animation to done
    if (attack.effect) {
      attack.effect.done = true;
    }
    attack.update();
    assert.equal(attack.effect, null);

    attack.render(mockScene);
    assert.equal(createdImage, null);
  });
});
