import { expect, test } from '@playwright/test';
import { seedProfiles, sessionOverPair, storedSettings } from './fixtures';

/**
 * Who is playing, across an actual page load.
 *
 * `profileFlow.test.tsx` re-renders; it never reloads, so it cannot see the one
 * failure mode this feature was designed against. `App.tsx` holds
 * `{ registry, settings }` as a single state value precisely so no render can
 * exist in which `registry.active` is the new profile while `settings` still
 * belongs to the old one — because the effect that persists settings would then
 * write one child's preferences into another child's storage key. Nothing
 * checked that invariant after a reload, which is where it would actually bite.
 */

const LEA = 'default';
const TOM = 'p-tom';

test('switching profile survives a reload without touching the other child', async ({
  page,
}) => {
  await seedProfiles(page, [
    {
      id: LEA,
      name: 'Léa',
      settings: { selectedTables: [2, 3], questionCount: 12 },
      history: [sessionOverPair(2, 3)],
    },
    {
      id: TOM,
      name: 'Tom',
      settings: { selectedTables: [7], questionCount: 25 },
      history: [sessionOverPair(7, 9)],
    },
  ]);

  await page.goto('/');

  const switcher = page.getByTestId('profile-switcher');
  const tables = page.getByTestId('table-selector');
  const chip = (n: string) => tables.getByRole('button', { name: n, exact: true });

  await expect(chip('3')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip('7')).toHaveAttribute('aria-pressed', 'false');

  // A profile name is typed by the user and never translated, so filtering on
  // one does not smuggle a dictionary assertion into the lookup the way a UI
  // label would. The test id is still what identifies the switcher itself.
  await switcher.getByRole('radio', { name: 'Tom' }).click();
  await expect(chip('7')).toHaveAttribute('aria-pressed', 'true');

  await page.reload();

  await expect(switcher.getByRole('radio', { name: 'Tom' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(chip('7')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip('3')).toHaveAttribute('aria-pressed', 'false');

  // The invariant: Léa's stored settings are exactly as they were. A render
  // that paired Tom's settings with Léa's id would have overwritten these.
  const lea = await storedSettings(page, LEA);
  expect(lea.selectedTables).toEqual([2, 3]);
  expect(lea.questionCount).toBe(12);

  // And the history that came back after the reload is Tom's, not Léa's.
  await page.getByTestId('open-progress').click();
  await expect(page.getByTestId('trickiest-pairs')).toContainText('7 × 9');
  await expect(page.getByTestId('trickiest-pairs')).not.toContainText('2 × 3');
});
