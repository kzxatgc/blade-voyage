export const LEVEL_BOX_DESIGN_SIZE = 120;

const LEVEL_BOX_SCALE = 0.85;
const LEVEL_BOX_BASE_SIZE = LEVEL_BOX_DESIGN_SIZE * LEVEL_BOX_SCALE;
const LEVEL_BOX_SOURCE_SIZE = 14;
const LEVEL_BOX_FACE_TOP = 3;
const LEVEL_BOX_FACE_BOTTOM = 9;

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
