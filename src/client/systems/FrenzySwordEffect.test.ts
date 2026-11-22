/// <reference types="node" />

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FRENZY_SWORD_EFFECT_ACTIVE_FRAME_TICKS,
  FRENZY_SWORD_EFFECT_DEACTIVATION_DURATION_TICKS,
  FRENZY_SWORD_EFFECT_DISPLAY_SIZE,
  FRENZY_SWORD_EFFECT_FRAME_SIZE,
  FRENZY_SWORD_EFFECT_FRAME_COUNT,
  FRENZY_SWORD_EFFECT_ACTIVATION_FRAME_TICKS,
  getFrenzySwordEffectDeactivationFrame,
  getFrenzySwordEffectFrame,
  getFrenzySwordEffectTransform,
} from './FrenzySwordEffect.ts';
import { RENDER_DEPTH } from '../../shared/constants.ts';

void describe('Frenzy sword effect', () => {
  void it('plays row 1 as activation, then loops row 6', () => {
    assert.equal(getFrenzySwordEffectFrame(0), 0);
    assert.equal(
      getFrenzySwordEffectFrame(FRENZY_SWORD_EFFECT_ACTIVATION_FRAME_TICKS),
      1
    );
    assert.equal(
      getFrenzySwordEffectFrame(
        FRENZY_SWORD_EFFECT_ACTIVATION_FRAME_TICKS * 7
      ),
      7
    );
    assert.equal(
      getFrenzySwordEffectFrame(
        FRENZY_SWORD_EFFECT_ACTIVATION_FRAME_TICKS * 8
      ),
      40
    );
    assert.equal(
      getFrenzySwordEffectFrame(
        FRENZY_SWORD_EFFECT_ACTIVATION_FRAME_TICKS * 8 +
          FRENZY_SWORD_EFFECT_ACTIVE_FRAME_TICKS * FRENZY_SWORD_EFFECT_FRAME_COUNT
      ),
      40
    );
  });

  void it('plays row 1 backward to deactivate', () => {
    assert.equal(getFrenzySwordEffectDeactivationFrame(0), 7);
    assert.equal(
      getFrenzySwordEffectDeactivationFrame(
        FRENZY_SWORD_EFFECT_ACTIVATION_FRAME_TICKS
      ),
      6
    );
    assert.equal(
      getFrenzySwordEffectDeactivationFrame(
        FRENZY_SWORD_EFFECT_ACTIVATION_FRAME_TICKS * 7
      ),
      0
    );
    assert.equal(
      getFrenzySwordEffectDeactivationFrame(
        FRENZY_SWORD_EFFECT_DEACTIVATION_DURATION_TICKS
      ),
      undefined
    );
  });

  void it('keeps the original effect size and trims only excess length', () => {
    const cropWidthForLength = (length: number) =>
      Math.min(
        FRENZY_SWORD_EFFECT_FRAME_SIZE,
        (length * FRENZY_SWORD_EFFECT_FRAME_SIZE) /
          FRENZY_SWORD_EFFECT_DISPLAY_SIZE
      );
    const idle = getFrenzySwordEffectTransform(
      'player/sword/idle/0',
      false
    );
    assert.ok(idle);
    assert.equal(idle.offsetX, 50.47);
    assert.equal(idle.offsetY, 24.74);
    assert.ok(Math.abs(idle.rotation - (1.7 * Math.PI) / 180) < 1e-9);
    assert.equal(idle.displaySize, FRENZY_SWORD_EFFECT_DISPLAY_SIZE);
    assert.equal(idle.cropWidth, cropWidthForLength(14));
    assert.equal(
      idle.cropX,
      (FRENZY_SWORD_EFFECT_FRAME_SIZE - idle.cropWidth) / 2
    );

    const jump = getFrenzySwordEffectTransform(
      'player/sword/jump/0',
      false
    );
    assert.ok(jump);
    assert.equal(jump.offsetX, 42.76);
    assert.equal(jump.offsetY, 12);
    assert.ok(Math.abs(jump.rotation + (88.7 * Math.PI) / 180) < 1e-9);
    assert.equal(jump.displaySize, FRENZY_SWORD_EFFECT_DISPLAY_SIZE);
    assert.equal(jump.cropWidth, cropWidthForLength(10));
    assert.equal(
      jump.cropX,
      (FRENZY_SWORD_EFFECT_FRAME_SIZE - jump.cropWidth) / 2
    );

    const shortAttack = getFrenzySwordEffectTransform(
      'player/sword/attack_1/0',
      false
    );
    assert.ok(shortAttack);
    assert.equal(shortAttack.displaySize, FRENZY_SWORD_EFFECT_DISPLAY_SIZE);
    assert.equal(shortAttack.cropWidth, cropWidthForLength(7.1));

    const longAttack = getFrenzySwordEffectTransform(
      'player/sword/attack_1/1',
      false
    );
    assert.ok(longAttack);
    assert.equal(longAttack.displaySize, FRENZY_SWORD_EFFECT_DISPLAY_SIZE);
    assert.equal(longAttack.cropWidth, cropWidthForLength(19.4));
  });

  void it('mirrors the sword pose for the opposite facing direction', () => {
    const pose = getFrenzySwordEffectTransform(
      'player/sword/attack_1/1',
      true
    );
    assert.ok(pose);
    assert.ok(Math.abs(pose.offsetX - 9.92) < 1e-9);
    assert.equal(pose.offsetY, 25.62);
    assert.ok(Math.abs(pose.rotation - (25 * Math.PI) / 180) < 1e-9);
  });

  void it('omits the effect when the sword is not visible in the sprite', () => {
    assert.equal(
      getFrenzySwordEffectTransform('player/sword/hit/0', false),
      null
    );
    assert.equal(
      getFrenzySwordEffectTransform('player/throw_sword/1', false),
      null
    );
  });

  void it('renders the weapon effect in front of the player but behind the shield', () => {
    assert.ok(RENDER_DEPTH.ENTITIES < RENDER_DEPTH.WEAPON_EFFECTS);
    assert.ok(RENDER_DEPTH.WEAPON_EFFECTS < RENDER_DEPTH.EFFECTS);
  });

  void it('provides transforms for every held-sword animation frame', () => {
    const animationFrames: Readonly<Record<string, number>> = {
      'player/sword/idle': 5,
      'player/sword/run': 6,
      'player/sword/jump': 3,
      'player/sword/fall': 1,
      'player/sword/land': 2,
      'player/sword/attack_1': 3,
      'player/sword/attack_2': 3,
      'player/sword/attack_3': 3,
      'player/sword/air_attack_1': 3,
      'player/sword/air_attack_2': 3,
      'player/sword/hit': 4,
      'player/sword/dead_hit': 4,
      'player/sword/dead': 4,
      'player/throw_sword': 3,
    };

    for (const [animation, frameCount] of Object.entries(animationFrames)) {
      for (let frame = 0; frame < frameCount; frame += 1) {
        assert.ok(
          getFrenzySwordEffectTransform(`${animation}/${frame}`, false) !==
            undefined,
          `Missing effect transform for ${animation}/${frame}`
        );
      }
    }
  });

  void it('rejects invalid animation time', () => {
    assert.throws(() => getFrenzySwordEffectFrame(0.5), RangeError);
    assert.throws(() => getFrenzySwordEffectDeactivationFrame(-1), RangeError);
  });
});
