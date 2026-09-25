import { expect, test } from '@playwright/test';
import { seedProfiles, sessionOverPair } from './fixtures';

/**
 * Layout of the progress screen at phone width.
 *
 * Vitest runs with `css: false` and jsdom lays nothing out, so a count that
 * wraps onto two lines is invisible there: the text is all present, just not
 * where the child sees it. Only a real browser at a real width can say whether
 * "0 / 3 · 3 🐢" stays on one line next to its bar.
 */

// A small phone in portrait: the narrowest layout the app is used at.
test.use({ viewport: { width: 390, height: 844 } });

test('a pair count with a slow-answer suffix stays on one line', async ({ page }) => {
  await seedProfiles(page, [
    {
      id: 'default',
      name: 'Léa',
      settings: { language: 'fr' },
      // Three right-but-slow answers: listed for slowness alone, so the row
      // carries the longest count the list can show.
      history: [sessionOverPair(9, 4, { attempts: 3, wrong: 0, slow: 3 })],
    },
  ]);

  await page.goto('/');
  await page.getByTestId('open-progress').click();

  const count = page.getByTestId('trickiest-pairs').locator('.pairs__num').first();
  await expect(count).toHaveText(/🐢/);

  // A range over the text gets one rect per line fragment; fragments on one
  // line share a top edge. Two distinct tops means the count wrapped.
  const lines = await count.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return new Set(Array.from(range.getClientRects(), (r) => Math.round(r.top))).size;
  });
  expect(lines).toBe(1);
});
