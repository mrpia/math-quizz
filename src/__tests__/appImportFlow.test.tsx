import { describe, expect, test, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../App';
import { storageKeys, loadHistory } from '../storage/profileStore';
import { REGISTRY_KEY } from '../storage/profileRegistry';
import { DEFAULT_SETTINGS } from '../domain/session';
import type { SessionResult } from '../domain/session';
import { createBackup, serializeBackup } from '../domain/backup';

/**
 * Import through the real App (#18). The Settings screen tests mock
 * `onImport` and `onPreviewMerge`, so only this file sees what `App` does with
 * them: whether a merge leaves the stored settings alone, and whether the
 * dialog's counts come from what is really in storage.
 */

const session = (minute: number, id?: string): SessionResult => ({
  ...(id === undefined ? {} : { id }),
  startedAt: new Date(Date.UTC(2026, 8, 5, 8, minute, 0)).toISOString(),
  durationPerQuestionMs: 4000,
  partialCreditFactor: 0.5,
  questionCount: 1,
  selectedTables: [7],
  mode: 'mul',
  answerMode: 'screen',
  answers: [
    { question: { a: 7, b: 8, op: 'mul', expected: 56 }, given: 56, elapsedMs: 900 },
  ],
});

const storedSettings = (profileId: string) =>
  JSON.parse(localStorage.getItem(storageKeys(profileId).settings) ?? '{}');

/** Léa (active) has done one session; Tom has done none. */
const seed = () => {
  localStorage.setItem(
    REGISTRY_KEY,
    JSON.stringify({
      active: 'default',
      profiles: [
        { id: 'default', name: 'Léa', createdAt: '' },
        { id: 'p2', name: 'Tom', createdAt: '2026-09-05T10:00:00.000Z' },
      ],
    }),
  );
  localStorage.setItem(
    storageKeys('default').settings,
    JSON.stringify({ ...DEFAULT_SETTINGS, questionCount: 5 }),
  );
  localStorage.setItem(
    storageKeys('p2').settings,
    JSON.stringify({ ...DEFAULT_SETTINGS, questionCount: 9 }),
  );
  localStorage.setItem(storageKeys('default').history, JSON.stringify([session(1, 'a')]));
};

/** Written on "the laptop": Léa's session a, a newer one, and other settings. */
const laptopFile = serializeBackup(
  createBackup(
    {
      settings: { ...DEFAULT_SETTINGS, questionCount: 33 },
      history: [session(1, 'a'), session(3, 'b')],
      trainingHistory: [],
    },
    {
      appVersion: '1.2.0',
      exportedAt: '2026-09-05T10:11:12.000Z',
      profile: 'default',
      profileName: 'Léa',
    },
  ),
);

const openImportDialog = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'paramètres' }));
  const file = new File([laptopFile], 'backup.json', { type: 'application/json' });
  fireEvent.change(screen.getByLabelText(/importer un fichier/i), {
    target: { files: [file] },
  });
  await screen.findByText(/importer ce fichier \?/i);
};

const confirm = async (done: RegExp) => {
  fireEvent.click(screen.getByRole('button', { name: /oui, importer/i }));
  await screen.findByText(done);
};

afterEach(() => localStorage.clear());

describe('App — importing a file (#18)', () => {
  test('a merge adds the new sessions, in order, and keeps the stored settings', async () => {
    seed();
    render(<App />);
    await openImportDialog();
    fireEvent.click(screen.getByRole('radio', { name: /^ajouter$/i }));

    // Counted against what Léa really has: a is here, b is new.
    expect(screen.getByText(/nouvelles sessions\s*:\s*1.*déjà là\s*:\s*1/i)).toBeInTheDocument();

    await confirm(/résultats ajoutés/i);

    expect(loadHistory('default').map((s) => s.id)).toEqual(['a', 'b']);
    // App must not adopt the file's settings: its persist effect would then
    // write 33 over Léa's 5, despite the dialog promising they stay.
    expect(storedSettings('default').questionCount).toBe(5);
    expect(screen.getByLabelText(/nombre de questions/i)).toHaveValue(5);
  });

  test('a replace still adopts the file, settings included', async () => {
    // The control for the test above: the same flow on replace must change them.
    seed();
    render(<App />);
    await openImportDialog();

    await confirm(/données importées/i);

    expect(loadHistory('default').map((s) => s.id)).toEqual(['a', 'b']);
    expect(storedSettings('default').questionCount).toBe(33);
  });

  test('a merge into another profile touches neither profile\'s settings', async () => {
    seed();
    render(<App />);
    await openImportDialog();
    fireEvent.click(screen.getByRole('radio', { name: /^ajouter$/i }));
    fireEvent.change(screen.getByLabelText(/importer dans le profil/i), {
      target: { value: 'p2' },
    });

    // Tom has nothing yet, so both sessions are new to him.
    expect(screen.getByText(/nouvelles sessions\s*:\s*2.*déjà là\s*:\s*0/i)).toBeInTheDocument();

    await confirm(/résultats ajoutés/i);

    expect(loadHistory('p2').map((s) => s.id)).toEqual(['a', 'b']);
    expect(loadHistory('default').map((s) => s.id)).toEqual(['a']);
    expect(storedSettings('p2').questionCount).toBe(9);
    expect(storedSettings('default').questionCount).toBe(5);
  });
});
