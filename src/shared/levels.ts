import { LEVEL_MAP_INDICES } from './generatedLevelMaps.ts';

export type LevelDefinition = {
  number: number;
  mapFile: string;
};

export { MAX_LEVEL_COUNT } from './generatedLevelMaps.ts';

export const ENDING_LEVEL: LevelDefinition = {
  number: -1,
  mapFile: 'maps/-1.json',
};

export const LEVELS_PER_PAGE = 8;
export const PLAYABLE_LEVELS: readonly LevelDefinition[] = LEVEL_MAP_INDICES.map(
  (mapIndex) => ({
    number: mapIndex + 1,
    mapFile: `maps/${mapIndex}.json`,
  })
);
export const getLevelDefinition = (
  levelNumber: number
): LevelDefinition | undefined =>
  levelNumber === ENDING_LEVEL.number
    ? ENDING_LEVEL
    : PLAYABLE_LEVELS.find((level) => level.number === levelNumber);
export const getNextLevel = (levelNumber: number): LevelDefinition => {
  const currentIndex = PLAYABLE_LEVELS.findIndex(
    (level) => level.number === levelNumber
  );
  if (currentIndex < 0) {
    throw new Error(`Level ${levelNumber} is not playable.`);
  }
  return PLAYABLE_LEVELS[currentIndex + 1] ?? ENDING_LEVEL;
};
export const LEVEL_COUNT = PLAYABLE_LEVELS.length;
export const LEVEL_PAGE_COUNT = Math.ceil(LEVEL_COUNT / LEVELS_PER_PAGE);

export const getLevelMapCacheKey = (levelNumber: number): string =>
  `level-map-${levelNumber}`;

export const getLevelNumbersForPage = (pageIndex: number): number[] => {
  if (
    !Number.isInteger(pageIndex) ||
    pageIndex < 0 ||
    pageIndex >= LEVEL_PAGE_COUNT
  ) {
    return [];
  }

  const firstIndex = pageIndex * LEVELS_PER_PAGE;
  return PLAYABLE_LEVELS.slice(
    firstIndex,
    firstIndex + LEVELS_PER_PAGE
  ).map((level) => level.number);
};
