/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Attack, FRENZY_DURATION_TICKS } from './Attack.ts';
import { shouldShowAttackCooldownIndicator } from './AttackCooldownHud.ts';

void describe('Attack cooldown HUD', () => {
  void it('hides during Frenzy and returns after the effect expires', () => {
    const attack = new Attack();
    const indicatorVisible = () =>
      shouldShowAttackCooldownIndicator(true, false, attack.isFrenzyActive);

    assert.equal(indicatorVisible(), true);

    attack.activateFrenzy();
    assert.equal(indicatorVisible(), false);

    for (let tick = 0; tick < FRENZY_DURATION_TICKS - 1; tick += 1) {
      attack.update();
    }
    assert.equal(indicatorVisible(), false);
    assert.equal(attack.triggerAttack(0), true);
    attack.attackState = false;
    attack.update();

    assert.equal(attack.isFrenzyActive, false);
    assert.equal(indicatorVisible(), true);
    assert.equal(attack.isReady, false);
  });

  void it('keeps existing sword and death visibility rules', () => {
    assert.equal(
      shouldShowAttackCooldownIndicator(false, false, false),
      false
    );
    assert.equal(
      shouldShowAttackCooldownIndicator(true, true, false),
      false
    );
  });
});
