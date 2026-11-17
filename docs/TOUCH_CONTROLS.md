# Virtual Touch Controls

## Visibility

Controls show when the game canvas is at most 768 CSS pixels wide, or the primary input is touch-like (`pointer: coarse` and `hover: none`). They also show when both `DEBUG_CONFIG.enabled` and `showTouchControlsOnDesktop` are enabled in `src/shared/debug.ts`; the desktop override defaults to off.

The breakpoint is a heuristic: Reddit exposes no app-facing Mobile/Desktop flag or exact simulator widths. Narrow desktop windows may show controls, and touch-primary desktops may be classified as touch-first. Verify Mobile and Desktop in Reddit's UI Simulator.

Visibility responds to canvas resize and input-mode changes. Hiding the controls clears held movement. The controls stay fixed during camera zoom and target at least 48 CSS pixels.

## Layout and actions

- Bottom-left: Left and Right move.
- Right side: B attacks or picks up above Jump.
- Left side: A throws above Down; Down drops through platforms.
- Keyboard: Space/L attacks or picks up; Q/K throws.

## Test

```powershell
node --experimental-strip-types --no-warnings=ExperimentalWarning --test src/client/systems/TouchControlsVisibility.test.ts
```
