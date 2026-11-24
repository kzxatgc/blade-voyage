export const LEVEL_BOX_DESIGN_SIZE = 120;

const LEVEL_BOX_SCALE = 0.85;
const LEVEL_BOX_BASE_SIZE = LEVEL_BOX_DESIGN_SIZE * LEVEL_BOX_SCALE;
const LEVEL_BOX_SOURCE_SIZE = 14;
const LEVEL_BOX_FACE_TOP = 3;
const LEVEL_BOX_FACE_BOTTOM = 9;
const LEVEL_NAV_ARROW_SOURCE_SIZE = 32;
const LEVEL_NAV_ARROW_VISIBLE_LEFT = 3;
const LEVEL_NAV_ARROW_VISIBLE_RIGHT = 28;
const LEVEL_NAV_ARROW_VISIBLE_TOP = 3;
const LEVEL_NAV_ARROW_VISIBLE_BOTTOM = 28;
const LEVEL_NAV_ARROW_VERTICAL_NUDGE = 1;

export const getLevelBoxDisplaySize = (
  canvasUnitScale: number,
  minTouchTargetCss: number
): number =>
  Math.max(LEVEL_BOX_BASE_SIZE, minTouchTargetCss * canvasUnitScale);

export const getLevelBoxFaceCenterOffsetY = (displaySize: number): number => {
  const faceCenter = (LEVEL_BOX_FACE_TOP + LEVEL_BOX_FACE_BOTTOM) / 2;
  const boxCenter = LEVEL_BOX_SOURCE_SIZE / 2;

  return (faceCenter - boxCenter) * (displaySize / LEVEL_BOX_SOURCE_SIZE);
};

export const getLevelNavArrowOffset = (
  buttonDisplaySize: number,
  glyphDisplayWidth: number,
  glyphDisplayHeight: number
): { x: number; y: number } => {
  const buttonFaceOffsetY = getLevelBoxFaceCenterOffsetY(buttonDisplaySize);
  const glyphCenterX =
    (LEVEL_NAV_ARROW_VISIBLE_LEFT + LEVEL_NAV_ARROW_VISIBLE_RIGHT + 1) / 2;
  const glyphCenterY =
    (LEVEL_NAV_ARROW_VISIBLE_TOP + LEVEL_NAV_ARROW_VISIBLE_BOTTOM + 1) / 2;
  const glyphTextureCenter = LEVEL_NAV_ARROW_SOURCE_SIZE / 2;

  return {
    x:
      (glyphTextureCenter - glyphCenterX) *
      (glyphDisplayWidth / LEVEL_NAV_ARROW_SOURCE_SIZE),
    y:
      buttonFaceOffsetY +
      (glyphTextureCenter - glyphCenterY) *
        (glyphDisplayHeight / LEVEL_NAV_ARROW_SOURCE_SIZE) -
      LEVEL_NAV_ARROW_VERTICAL_NUDGE,
  };
};
