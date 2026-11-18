import { LEVEL_MAP_INDICES } from './generatedLevelMaps.ts';

export type LevelDefinition = {
  number: number;
  mapFile: string;
};

export { MAX_LEVEL_COUNT } from './generatedLevelMaps.ts';

export const LEVELS_PER_PAGE = 8;
export const PLAYABLE_LEVELS: readonly LevelDefinition[] = LEVEL_MAP_INDICES.map(
  (mapIndex) => ({
    number: mapIndex + 1,
    mapFile: `maps/${mapIndex}.json`,
  })
);
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
