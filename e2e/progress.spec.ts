import { expect, test } from '@playwright/test';
import { seedProfiles, sessionOverPair } from './fixtures';

/**
 * Layout of the progress screen at phone width.
 *
 * Vitest runs with `css: false` and jsdom lays nothing out, so a count that
 * wraps onto two lines, or a bar drawn against a narrower track than its
 * neighbour's, is invisible there: the text and the percentages are all
 * present, just not where the child sees them. Only a real browser at a real
 * width can check either.
 */

// A small phone in portrait: the narrowest layout the app is used at.
test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await seedProfiles(page, [
    {
      id: 'default',
      name: 'Léa',
      settings: { language: 'fr' },
      history: [
        // Two of four wrong: weighted rate 0.5, shown as "2 / 4".
        sessionOverPair(7, 8, { attempts: 4, wrong: 2 }),
        // Three right but slow: also 0.5, shown as "0 / 3 · 3 🐢", the
        // longest count the list can show.
        sessionOverPair(9, 4, { attempts: 3, wrong: 0, slow: 3 }),
        // One of four wrong: rate 0.25, and the widest label, "12 × 12".
        sessionOverPair(12, 12, { attempts: 4, wrong: 1 }),
      ],
    },
  ]);
  await page.goto('/');
  await page.getByTestId('open-progress').click();
});

// A range over the text gets one rect per line fragment; fragments on one
// line share a top edge. Two distinct tops means the text wrapped.
const lineCount = (el: Element) => {
  const range = document.createRange();
  range.selectNodeContents(el);
  return new Set(Array.from(range.getClientRects(), (r) => Math.round(r.top))).size;
};

test('a pair count with a slow-answer suffix stays on one line', async ({ page }) => {
  const count = page.getByTestId('pair-count').filter({ hasText: '🐢' });
  await expect(count).toHaveCount(1);
  expect(await count.evaluate(lineCount)).toBe(1);
});

test('a two-digit pair label stays on one line', async ({ page }) => {
  const label = page.getByTestId('pair-label').filter({ hasText: '12 × 12' });
  await expect(label).toHaveCount(1);
  expect(await label.evaluate(lineCount)).toBe(1);
});

test('two pairs with the same rate get bars of the same length', async ({ page }) => {
  // A bar is a percentage of its track. If a long count or label narrowed
  // its own row's track, the same rate would draw a shorter bar next to it.
  const bars = page.getByTestId('pair-bar');
  await expect(bars).toHaveCount(3);
  const drawn = await bars.evaluateAll((els) =>
    els.map((el) => ({ pct: (el as HTMLElement).style.width, px: el.getBoundingClientRect().width })),
  );
  const full = drawn.filter((bar) => bar.pct === '100%');
  expect(full).toHaveLength(2);
  expect(Math.abs(full[0].px - full[1].px)).toBeLessThan(1);
});
