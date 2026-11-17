import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MOBILE_VIEWPORT_MAX_WIDTH,
  shouldShowTouchControls,
} from './TouchControlsVisibility.ts';

void describe('touch control viewport visibility', () => {
  void it('shows controls in narrow mobile preview regardless of the host pointer', () => {
    assert.equal(shouldShowTouchControls(390, false, false, false), true);
  });

  void it('shows controls up to the mobile breakpoint and hides them above it', () => {
    assert.equal(
      shouldShowTouchControls(MOBILE_VIEWPORT_MAX_WIDTH, false, false, false),
      true
    );
    assert.equal(
      shouldShowTouchControls(
        MOBILE_VIEWPORT_MAX_WIDTH + 1,
        false,
        false,
        false
      ),
      false
    );
  });

  void it('shows controls on wider touch-primary devices', () => {
    assert.equal(shouldShowTouchControls(1024, true, false, false), true);
  });

  void it('responds when the viewport changes between mobile and desktop sizes', () => {
    const visibility = [390, 1024, 430].map((width) =>
      shouldShowTouchControls(width, false, false, false)
    );
    assert.deepEqual(visibility, [true, false, true]);
  });

  void it('keeps controls hidden for an unavailable viewport unless debug override is enabled', () => {
    assert.equal(shouldShowTouchControls(0, false, false, false), false);
    assert.equal(shouldShowTouchControls(1024, false, true, true), true);
    assert.equal(shouldShowTouchControls(1024, false, false, true), false);
  });

  void it('lets On and Off override automatic and debug visibility', () => {
    assert.equal(
      shouldShowTouchControls(1024, false, false, false, 'on'),
      true
    );
    assert.equal(shouldShowTouchControls(390, true, true, true, 'off'), false);
  });
});
