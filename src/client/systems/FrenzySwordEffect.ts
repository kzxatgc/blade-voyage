export const FRENZY_SWORD_EFFECT_SPRITE_KEY = 'frenzy-sword-effect';
export const FRENZY_SWORD_EFFECT_FRAME_SIZE = 32;
export const FRENZY_SWORD_EFFECT_DISPLAY_SIZE = 48;
export const FRENZY_SWORD_EFFECT_LENGTH_PADDING = 0;

export const FRENZY_SWORD_EFFECT_ACTIVATION_FIRST_FRAME = 0;
export const FRENZY_SWORD_EFFECT_ACTIVE_FIRST_FRAME = 40;
export const FRENZY_SWORD_EFFECT_FRAME_COUNT = 8;
export const FRENZY_SWORD_EFFECT_ACTIVATION_FRAME_TICKS = 2;
export const FRENZY_SWORD_EFFECT_ACTIVE_FRAME_TICKS = 4;
export const FRENZY_SWORD_EFFECT_DEACTIVATION_DURATION_TICKS =
  FRENZY_SWORD_EFFECT_FRAME_COUNT *
  FRENZY_SWORD_EFFECT_ACTIVATION_FRAME_TICKS;

const PLAYER_SPRITE_WIDTH = 64;

type SwordPose = {
  x: number;
  y: number;
  angleDegrees: number;
  length: number;
};

export type FrenzySwordEffectTransform = {
  offsetX: number;
  offsetY: number;
  rotation: number;
  displaySize: number;
  cropX: number;
  cropWidth: number;
};

const createPose = (
  x: number,
  y: number,
  angleDegrees = 0,
  length = 14
): SwordPose => ({ x, y, angleDegrees, length });

const SWORD_POSES_BY_TEXTURE: Readonly<
  Record<string, readonly (SwordPose | null)[]>
> = {
  'player/sword/idle': [
    createPose(50.47, 24.74, 1.7),
    createPose(50.47, 24.74, 1.7),
    createPose(50.47, 25.74, 1.7),
    createPose(50.47, 26.74, 1.7),
    createPose(50.47, 25.74, 1.7),
  ],
  'player/sword/run': [
    createPose(48.47, 21.74, 1.7),
    createPose(48.47, 23.74, 1.7),
    createPose(50.47, 25.74, 1.7),
    createPose(51.47, 19.74, 1.7),
    createPose(51.47, 21.74, 1.7),
    createPose(50.47, 24.74, 1.7),
  ],
  'player/sword/jump': [
    createPose(42.76, 12, -88.7, 10),
    createPose(40.71, 8.05, -88.1, 12),
    createPose(41.74, 8.53, -88.3),
  ],
  'player/sword/fall': [createPose(49.47, 20.74, 1.7)],
  'player/sword/land': [
    createPose(50.47, 27.74, 1.7),
    createPose(49.47, 25.74, 1.7),
  ],
  'player/sword/attack_1': [
    createPose(46, 25.31, -2.2, 7.1),
    createPose(54.08, 25.62, -25, 19.4),
    createPose(52.47, 23.74, 1.7),
  ],
  'player/sword/attack_2': [
    createPose(41.74, 8.53, -88.3),
    createPose(54.73, 27.07, 87.4, 25.2),
    createPose(50.47, 25.74, 1.7),
  ],
  'player/sword/attack_3': [
    createPose(24.53, 24.74, -1.7),
    createPose(53.28, 14.49, -68, 28.1),
    createPose(50.47, 18.74, 1.7),
  ],
  'player/sword/air_attack_1': [
    createPose(30.11, 31.96, 20.7, 32.6),
    createPose(24.29, 23, 0, 10),
    createPose(24.53, 23.74, -1.7),
  ],
  'player/sword/air_attack_2': [
    createPose(44.21, 32.14, -31.7, 33.6),
    createPose(49.71, 20, 0, 10),
    createPose(49.47, 20.74, 1.7),
  ],
  'player/sword/hit': [
    null,
    createPose(48.04, 23.25, 0.5, 10),
    createPose(50.47, 22.74, 1.7),
    createPose(49.47, 22.74, 1.7),
  ],
  'player/sword/dead_hit': [null, null, null, null],
  'player/sword/dead': [null, null, null, null],
  'player/throw_sword': [
    createPose(41.74, 7.53, -88.3),
    null,
    null,
  ],
};

function assertValidElapsedTicks(elapsedTicks: number): void {
  if (!Number.isInteger(elapsedTicks) || elapsedTicks < 0) {
    throw new RangeError('Frenzy sword effect elapsed ticks are invalid.');
  }
}

export function getFrenzySwordEffectTransform(
  textureKey: string,
  facingLeft: boolean
): FrenzySwordEffectTransform | null | undefined {
  const frameSeparator = textureKey.lastIndexOf('/');
  if (frameSeparator < 0) {
    return undefined;
  }

  const frameIndex = Number(textureKey.slice(frameSeparator + 1));
  if (!Number.isInteger(frameIndex) || frameIndex < 0) {
    return undefined;
  }

  const animationKey = textureKey.slice(0, frameSeparator);
  const pose = SWORD_POSES_BY_TEXTURE[animationKey]?.[frameIndex];
  if (pose === null) {
    return null;
  }
  if (pose === undefined) {
    return undefined;
  }

  const cropLength = Math.max(
    1,
    pose.length + FRENZY_SWORD_EFFECT_LENGTH_PADDING
  );
  const cropWidth = Math.min(
    FRENZY_SWORD_EFFECT_FRAME_SIZE,
    (cropLength * FRENZY_SWORD_EFFECT_FRAME_SIZE) /
      FRENZY_SWORD_EFFECT_DISPLAY_SIZE
  );

  return {
    offsetX: facingLeft ? PLAYER_SPRITE_WIDTH - pose.x : pose.x,
    offsetY: pose.y,
    rotation:
      (facingLeft ? -pose.angleDegrees : pose.angleDegrees) *
      (Math.PI / 180),
    displaySize: FRENZY_SWORD_EFFECT_DISPLAY_SIZE,
    cropX: (FRENZY_SWORD_EFFECT_FRAME_SIZE - cropWidth) / 2,
    cropWidth,
  };
}

export function getFrenzySwordEffectFrame(elapsedTicks: number): number {
  assertValidElapsedTicks(elapsedTicks);

  const activationDuration =
    FRENZY_SWORD_EFFECT_FRAME_COUNT *
    FRENZY_SWORD_EFFECT_ACTIVATION_FRAME_TICKS;
  if (elapsedTicks < activationDuration) {
    return (
      FRENZY_SWORD_EFFECT_ACTIVATION_FIRST_FRAME +
      Math.floor(elapsedTicks / FRENZY_SWORD_EFFECT_ACTIVATION_FRAME_TICKS)
    );
  }

  return (
    FRENZY_SWORD_EFFECT_ACTIVE_FIRST_FRAME +
    Math.floor(
      (elapsedTicks - activationDuration) /
        FRENZY_SWORD_EFFECT_ACTIVE_FRAME_TICKS
    ) %
      FRENZY_SWORD_EFFECT_FRAME_COUNT
  );
}

export function getFrenzySwordEffectDeactivationFrame(
  elapsedTicks: number
): number | undefined {
  assertValidElapsedTicks(elapsedTicks);
  if (elapsedTicks >= FRENZY_SWORD_EFFECT_DEACTIVATION_DURATION_TICKS) {
    return undefined;
  }

  return (
    FRENZY_SWORD_EFFECT_ACTIVATION_FIRST_FRAME +
    FRENZY_SWORD_EFFECT_FRAME_COUNT -
    1 -
    Math.floor(elapsedTicks / FRENZY_SWORD_EFFECT_ACTIVATION_FRAME_TICKS)
  );
}
