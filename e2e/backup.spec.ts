import { expect, test } from '@playwright/test';
import { historyKey, seedProfiles, sessionOverPair } from './fixtures';

/**
 * Export → import, through the real browser plumbing: once as a restore, once
 * as a merge.
 *
 * `settingsBackup.test.tsx` covers the same screen but stops at the edges:
 * jsdom's download is an `<a>` nobody follows, and its file picker is a `File`
 * the test constructed. Here the browser writes an actual file to disk and the
 * same bytes come back in through `setInputFiles` — which is the only way to
 * find out whether what `downloadTextFile` produces is something
 * `readTextFile` + `parseBackup` can still read, and whether a session id
 * survives that trip well enough for a merge to match on it (#18).
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

test('a downloaded backup can be merged back in, matching on the ids it carries', async ({
  page,
}) => {
  // One session with an id, one from before ids existed.
  const stamped = {
    ...sessionOverPair(7, 8),
    startedAt: '2026-01-03T10:00:00.000Z',
    id: 'a'.repeat(32),
  };
  const legacy = sessionOverPair(6, 9);
  await seedProfiles(page, [
    { id: PROFILE, name: 'Léa', settings: { language: 'fr' }, history: [stamped, legacy] },
  ]);

  await page.goto('/');
  await page.getByTestId('open-settings').click();
  const downloading = page.waitForEvent('download');
  await page.getByTestId('backup-export').click();
  const file = test.info().outputPath('backup-merge.json');
  await (await downloading).saveAs(file);

  // Meanwhile this device only has a third session the file knows nothing of.
  const local = {
    ...sessionOverPair(8, 8),
    startedAt: '2026-01-04T10:00:00.000Z',
    id: 'b'.repeat(32),
  };
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [historyKey(PROFILE), JSON.stringify([local])],
  );
  await page.reload();
  await page.getByTestId('open-settings').click();

  const storedIds = () =>
    page.evaluate(
      (key) =>
        (JSON.parse(localStorage.getItem(key) ?? '[]') as { id?: string }[]).map(
          (session) => session.id ?? null,
        ),
      historyKey(PROFILE),
    );

  // First merge: both sessions from the file are new here.
  await page.getByTestId('backup-import').setInputFiles(file);
  await page.getByTestId('import-mode-merge').click();
  // Exactly the two numbers, in this order: 2 new, 0 already here.
  await expect(page.getByTestId('import-merge-summary')).toHaveText(/^\D*2\D+0\D*$/);
  await page.getByTestId('import-confirm').click();
  // Sorted by startedAt; the ids came through the file untouched, and the
  // legacy session is still without one.
  expect(await storedIds()).toEqual([null, 'a'.repeat(32), 'b'.repeat(32)]);

  // Same file again: nothing new, matched on the id and on startedAt.
  await page.getByTestId('backup-import').setInputFiles(file);
  await page.getByTestId('import-mode-merge').click();
  await expect(page.getByTestId('import-merge-summary')).toHaveText(/^\D*0\D+2\D*$/);
  await page.getByTestId('import-confirm').click();
  expect(await storedIds()).toEqual([null, 'a'.repeat(32), 'b'.repeat(32)]);
});
