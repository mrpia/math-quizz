import { expect, test } from '@playwright/test';
import { historyKey, seedProfiles, sessionOverPair } from './fixtures';

/**
 * Export → import, once, through the real browser plumbing.
 *
 * `settingsBackup.test.tsx` covers the same screen but stops at the edges:
 * jsdom's download is an `<a>` nobody follows, and its file picker is a `File`
 * the test constructed. Here the browser writes an actual file to disk and the
 * same bytes come back in through `setInputFiles` — which is the only way to
 * find out whether what `downloadTextFile` produces is something
 * `readTextFile` + `parseBackup` can still read.
 */

const PROFILE = 'default';

test('a downloaded backup can be picked back up and restored', async ({ page }) => {
  await seedProfiles(page, [
    {
      id: PROFILE,
      name: 'Léa',
      settings: {
        questionCount: 17,
        durationPerQuestionMs: 6500,
        selectedTables: [7, 8],
        language: 'fr',
      },
      history: [sessionOverPair(7, 8)],
    },
  ]);

  await page.goto('/');
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('settings-question-count')).toHaveValue('17');

  const downloading = page.waitForEvent('download');
  await page.getByTestId('backup-export').click();
  const download = await downloading;

  expect(download.suggestedFilename()).toMatch(/^math-quizz-backup-.*\.json$/);
  const file = test.info().outputPath('backup.json');
  await download.saveAs(file);

  // Move the profile away from what the file holds, on both sides of the
  // envelope: a setting the form shows, and the history it does not.
  await page.getByTestId('settings-question-count').fill('9');
  await page.getByTestId('settings-save').click();
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('settings-question-count')).toHaveValue('9');

  await page.getByTestId('clear-history').click();
  await page.getByTestId('clear-confirm').click();
  expect(
    await page.evaluate((key) => localStorage.getItem(key), historyKey(PROFILE)),
  ).toBeNull();

  await page.getByTestId('backup-import').setInputFiles(file);
  await page.getByTestId('import-confirm').click();

  // The settings came back, and the form is showing them rather than the
  // pre-import numbers it was seeded with on its first render.
  await expect(page.getByTestId('settings-question-count')).toHaveValue('17');
  await expect(page.getByTestId('settings-target-time')).toHaveValue('6.5');

  // Saving from the restored form writes those values back, not stale ones.
  await page.getByTestId('settings-save').click();
  await page.getByTestId('open-progress').click();
  await expect(page.getByTestId('trickiest-pairs')).toContainText('7 × 8');
});
