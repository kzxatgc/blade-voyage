import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getActionPromptUnitScale } from './ActionPromptLayout.ts';

void describe('ActionPromptHUD scaling', () => {
  void it('uses the same CSS scaling for the first prompt layout', () => {
    assert.equal(
      getActionPromptUnitScale(1280, 680, 1280, 680),
      1
    );
  });

  void it('keeps prompt size stable in narrow Fit-scaled viewports', () => {
    assert.equal(
      getActionPromptUnitScale(1280, 680, 640, 340),
      2
    );
  });

  void it('measures CSS scale independently from camera zoom', () => {
    assert.equal(getActionPromptUnitScale(1280, 680, 640, 340), 2);
    assert.equal(getActionPromptUnitScale(1280, 680, 1280, 680), 1);
  });

  void it('falls back safely for invalid measurements', () => {
    assert.equal(getActionPromptUnitScale(0, 680, 1280, 680), 1);
    assert.equal(getActionPromptUnitScale(1280, 680, 0, 680), 1);
  });
});
