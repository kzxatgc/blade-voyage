import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const levelsUrl = new URL('./levels.ts', import.meta.url).href;

void describe('Level picker pages', () => {
  void it('shows eight levels on page one and level nine on page two', async () => {
    const {
      LEVEL_COUNT,
      LEVEL_PAGE_COUNT,
      LEVELS_PER_PAGE,
      getLevelNumbersForPage,
    } = await import(levelsUrl);
    const pages = Array.from({ length: LEVEL_PAGE_COUNT }, (_, pageIndex) =>
      getLevelNumbersForPage(pageIndex)
    );
    const levelNumbers = pages.flat();

    assert.equal(pages[0].length, LEVELS_PER_PAGE);
    assert.deepEqual(pages[0], [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(pages.at(-1), [9]);
    assert.equal(new Set(levelNumbers).size, LEVEL_COUNT);
  });
});
