import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const levelsUrl = new URL('./levels.ts', import.meta.url).href;
const mapsDirectory = fileURLToPath(
  new URL('../../public/assets/maps/', import.meta.url)
);

void describe('Level picker pages', () => {
  void it('derives playable levels and pages from numbered map files', async () => {
    const {
      LEVEL_COUNT,
      LEVEL_PAGE_COUNT,
      LEVELS_PER_PAGE,
      MAX_LEVEL_COUNT,
      PLAYABLE_LEVELS,
      getLevelNumbersForPage,
    } = await import(levelsUrl);
    const expectedLevels = readdirSync(mapsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^\d+\.json$/.test(entry.name))
      .map((entry) => {
        const mapIndex = Number.parseInt(
          entry.name.slice(0, -'.json'.length),
          10
        );
        return {
          number: mapIndex + 1,
          mapFile: `maps/${entry.name}`,
        };
      })
      .sort((left, right) => left.number - right.number);
    const pages = Array.from({ length: LEVEL_PAGE_COUNT }, (_, pageIndex) =>
      getLevelNumbersForPage(pageIndex)
    );
    const levelNumbers = expectedLevels.map((level) => level.number);

    assert.deepEqual(PLAYABLE_LEVELS, expectedLevels);
    assert.equal(LEVEL_COUNT, expectedLevels.length);
    assert.equal(LEVEL_PAGE_COUNT, Math.ceil(LEVEL_COUNT / LEVELS_PER_PAGE));
    assert(pages.every((page) => page.length <= LEVELS_PER_PAGE));
    assert.equal(new Set(levelNumbers).size, LEVEL_COUNT);
    assert.deepEqual(pages.flat(), levelNumbers);
    assert(LEVEL_COUNT <= MAX_LEVEL_COUNT);
    assert.deepEqual(getLevelNumbersForPage(LEVEL_PAGE_COUNT), []);
  });
});
