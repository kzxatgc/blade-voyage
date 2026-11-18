export type LevelDefinition = {
  number: number;
  mapFile: string;
};

export const LEVEL_COUNT = 9;
export const LEVELS_PER_PAGE = 8;
export const LEVEL_PAGE_COUNT = Math.ceil(LEVEL_COUNT / LEVELS_PER_PAGE);
export const PLAYABLE_LEVELS: readonly LevelDefinition[] = [
  { number: 1, mapFile: 'maps/0.json' },
];

export const getLevelMapCacheKey = (levelNumber: number): string =>
  `level-map-${levelNumber}`;

export const getLevelNumbersForPage = (pageIndex: number): number[] => {
  const firstLevel = pageIndex * LEVELS_PER_PAGE + 1;
  const pageLength = Math.min(LEVELS_PER_PAGE, LEVEL_COUNT - firstLevel + 1);
  return Array.from(
    { length: pageLength },
    (_, index) => firstLevel + index
  );
};
