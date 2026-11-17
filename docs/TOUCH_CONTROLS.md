# Virtual Touch Controls

## Visibility

Controls show when the game canvas is at most 768 CSS pixels wide, or the primary input is touch-like (`pointer: coarse` and `hover: none`). They also show when both `DEBUG_CONFIG.enabled` and `showTouchControlsOnDesktop` are enabled in `src/shared/debug.ts`; the desktop override defaults to off.

The breakpoint is a heuristic: Reddit exposes no app-facing Mobile/Desktop flag or exact simulator widths. Narrow desktop windows may show controls, and touch-primary desktops may be classified as touch-first. Verify Mobile and Desktop in Reddit's UI Simulator.

On a fresh visit, the game detects visibility from the device and viewport. Until you choose a setting, detection responds to canvas resize and input-mode changes. Hiding the controls clears held movement. The controls stay fixed during camera zoom and target at least 48 CSS pixels.

Open the gear to access three icon-only toggles. The speaker switches game audio, the lightbulb switches the dropped-sword pickup hint, and the controller switches the touch overlay. Each setting is saved in this browser; the pickup hint is enabled by default, and the Controls setting overrides device detection on later visits. Settings interactions play a short click sound, and each button bounces when tapped.

In the main game, touch controls scale down slightly while held and spring back on release. Movement controls stay pressed for as long as the pointer is held. When the pickup hint is enabled and the player can collect a dropped sword, a pulsing `PICK UP` prompt appears above it; press the attack control, Space/L, or click to collect it.

## Layout and actions

- Bottom-left: Left and Right move.
- Right side: B attacks or picks up above Jump.
- Left side: A throws above Down; Down drops through platforms.
- Keyboard: Space/L attacks or picks up; Q/K throws.

## Test

```powershell
node --experimental-strip-types --no-warnings=ExperimentalWarning --test src/client/systems/TouchControlsVisibility.test.ts
```
