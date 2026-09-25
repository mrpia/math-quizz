import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithLanguage } from './renderWithLanguage';
import { SettingsScreen } from '../screens/SettingsScreen';
import { DEFAULT_SETTINGS } from '../domain/session';
import type { SessionResult } from '../domain/session';
import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_URL,
  createBackup,
  serializeBackup,
} from '../domain/backup';
import type { Backup } from '../domain/backup';
import type { ProfileRegistry } from '../storage/profileRegistry';

// One nameless profile: no import-target picker, and the exported filename
// carries no name — which is what the download assertion below expects.
const REGISTRY: ProfileRegistry = {
  active: 'default',
  profiles: [{ id: 'default', name: '', createdAt: '' }],
};

const session: SessionResult = {
  startedAt: '2026-05-09T08:01:00.000Z',
  durationPerQuestionMs: 4000,
  partialCreditFactor: 0.5,
  questionCount: 1,
  selectedTables: [7],
  mode: 'mul',
  answerMode: 'screen',
  answers: [
    { question: { a: 7, b: 8, op: 'mul', expected: 56 }, given: 56, elapsedMs: 1200 },
  ],
};

const backup: Backup = createBackup(
  {
    settings: { ...DEFAULT_SETTINGS, questionCount: 11 },
    history: [session],
    trainingHistory: [{ ...session, answerMode: 'training' }],
    errors: { '7x8': { attempts: 3, errors: 1, timeouts: 0 } },
  },
  {
    appVersion: '0.10.0',
    exportedAt: '2026-09-05T10:11:12.000Z',
    profile: 'default',
    profileName: '',
  },
);

const renderScreen = (over: Partial<Parameters<typeof SettingsScreen>[0]> = {}) => {
  const props = {
    settings: DEFAULT_SETTINGS,
    registry: REGISTRY,
    onRegistryChange: vi.fn(),
    onSave: vi.fn(),
    onClearHistory: vi.fn(),
    onExport: vi.fn(() => backup),
    onImport: vi.fn(),
    onPreviewMerge: vi.fn(() => ({ added: 0, known: 0, dropped: 0 })),
    onBack: vi.fn(),
    ...over,
  };
  renderWithLanguage(<SettingsScreen {...props} />, 'fr');
  return props;
};

/** jsdom 25 has no Blob.text(), so read the downloaded blob the long way. */
const blobText = (blob: Blob): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });

const uploadJson = (text: string) => {
  const input = screen.getByLabelText(/importer un fichier/i);
  const file = new File([text], 'backup.json', { type: 'application/json' });
  fireEvent.change(input, { target: { files: [file] } });
};

describe('SettingsScreen — export', () => {
  let objectUrls: Blob[];
  let downloads: string[];

  beforeEach(() => {
    objectUrls = [];
    downloads = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      objectUrls.push(blob);
      return 'blob:mock';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('downloads a dated .json file built from the profile', async () => {
    const props = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /exporter mes données/i }));

    expect(props.onExport).toHaveBeenCalledOnce();
    expect(downloads).toEqual(['math-quizz-backup-2026-09-05.json']);

    const written = JSON.parse(await blobText(objectUrls[0]));
    expect(written.format).toBe(BACKUP_FORMAT);
    expect(written.data.history).toHaveLength(1);
    await screen.findByText(/fichier exporté/i);
  });

  it('links to the published JSON Schema so others can read the file', () => {
    renderScreen();
    expect(screen.getByRole('link', { name: /schéma json/i })).toHaveAttribute(
      'href',
      BACKUP_SCHEMA_URL,
    );
  });
});

describe('SettingsScreen — import', () => {
  it('asks for confirmation, showing what the file contains, before overwriting', async () => {
    const props = renderScreen();
    uploadJson(serializeBackup(backup));

    await screen.findByText(/importer ce fichier ?/i);
    expect(
      screen.getByText(/tests\s*:\s*1.*entraînements\s*:\s*1.*paires\s*:\s*1/i),
    ).toBeInTheDocument();
    expect(props.onImport).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /oui, importer/i }));
    expect(props.onImport).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ format: BACKUP_FORMAT }),
      'replace',
    );
    await screen.findByText(/données importées/i);
  });

  it('refreshes the form fields, so a later Save cannot revert the import', async () => {
    const onSave = vi.fn();
    renderScreen({ onSave });

    const imported = createBackup(
      {
        settings: {
          ...DEFAULT_SETTINGS,
          questionCount: 33,
          durationPerQuestionMs: 7000,
          partialCreditFactor: 0.25,
        },
        history: [],
        trainingHistory: [],
        errors: {},
      },
      {
        appVersion: '0.10.0',
        exportedAt: '2026-09-05T10:11:12.000Z',
        profile: 'default',
        profileName: '',
      },
    );
    uploadJson(serializeBackup(imported));
    await screen.findByText(/importer ce fichier ?/i);
    fireEvent.click(screen.getByRole('button', { name: /oui, importer/i }));

    expect(screen.getByLabelText(/nombre de questions/i)).toHaveValue(33);
    expect(screen.getByLabelText(/temps cible par question/i)).toHaveValue(7);

    // And saving now persists the imported values, not the pre-import ones.
    fireEvent.click(screen.getByRole('button', { name: /^enregistrer$/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        questionCount: 33,
        durationPerQuestionMs: 7000,
        partialCreditFactor: 0.25,
      }),
    );
  });

  it('cancelling leaves the profile untouched', async () => {
    const props = renderScreen();
    uploadJson(serializeBackup(backup));

    await screen.findByText(/importer ce fichier ?/i);
    fireEvent.click(screen.getByRole('button', { name: /^annuler$/i }));

    expect(props.onImport).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText(/importer ce fichier ?/i)).not.toBeInTheDocument(),
    );
  });

  it.each([
    ['not JSON at all', 'hello', /pas lisible/i],
    ['a JSON file from another app', '{"foo":1}', /pas un export math quizz/i],
    [
      'a backup from a newer format version',
      JSON.stringify({ format: BACKUP_FORMAT, formatVersion: 2, data: {} }),
      /version plus récente/i,
    ],
    [
      'a structurally broken backup',
      JSON.stringify({ format: BACKUP_FORMAT, formatVersion: 1, data: { history: 'nope' } }),
      /abîmé/i,
    ],
  ])('refuses %s with a specific message', async (_label, text, message) => {
    const props = renderScreen();
    uploadJson(text);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(props.onImport).not.toHaveBeenCalled();
    expect(screen.queryByText(/importer ce fichier ?/i)).not.toBeInTheDocument();
  });

  it('surfaces a storage failure instead of pretending the import worked', async () => {
    const onImport = vi.fn(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    renderScreen({ onImport });
    uploadJson(serializeBackup(backup));

    await screen.findByText(/importer ce fichier ?/i);
    fireEvent.click(screen.getByRole('button', { name: /oui, importer/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/mémoire du navigateur/i);
    expect(screen.queryByText(/données importées/i)).not.toBeInTheDocument();
  });
});

describe('SettingsScreen — choosing where an import lands', () => {
  const TWO: ProfileRegistry = {
    active: 'default',
    profiles: [
      { id: 'default', name: 'Léa', createdAt: '' },
      { id: 'p2', name: 'Tom', createdAt: '' },
    ],
  };

  it('offers no destination picker while there is nowhere else to put it', () => {
    renderScreen();
    uploadJson(serializeBackup(backup));

    return waitFor(() => {
      expect(screen.getByText(/importer ce fichier ?/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/importer dans le profil/i)).toBeNull();
    });
  });

  it('defaults to the profile in use and names it in the warning', async () => {
    renderScreen({ registry: TWO });
    uploadJson(serializeBackup(backup));

    await waitFor(() =>
      expect(screen.getByLabelText(/importer dans le profil/i)).toHaveValue('default'),
    );
    expect(
      screen.getByText(/Les réglages et les résultats de « Léa » seront remplacés/),
    ).toBeInTheDocument();
  });

  it('a new file starts again on the profile in use, whatever the last pick was', async () => {
    // The dialog is keyed per picked file, so the destination cannot carry
    // over from one file to the next. Pinned here; the mode has its own test.
    renderScreen({ registry: TWO });
    uploadJson(serializeBackup(backup));
    const select = await screen.findByLabelText(/importer dans le profil/i);
    fireEvent.change(select, { target: { value: 'p2' } });
    expect(select).toHaveValue('p2');

    uploadJson(serializeBackup(backup));
    await waitFor(() =>
      expect(screen.getByLabelText(/importer dans le profil/i)).toHaveValue('default'),
    );
    expect(
      screen.getByText(/Les réglages et les résultats de « Léa » seront remplacés/),
    ).toBeInTheDocument();
  });

  it('says whose file this is when it carries a name', async () => {
    const fromTom = createBackup(backup.data, {
      appVersion: '0.12.0',
      exportedAt: '2026-09-05T10:11:12.000Z',
      profile: 'whatever-id-that-device-used',
      profileName: 'Tom',
    });
    renderScreen({ registry: TWO });
    uploadJson(serializeBackup(fromTom));

    await waitFor(() =>
      expect(screen.getByText(/Ce fichier vient du profil « Tom »/)).toBeInTheDocument(),
    );
  });

  it('imports into the profile picked, not the one named inside the file', async () => {
    const fromElsewhere = createBackup(backup.data, {
      appVersion: '0.12.0',
      exportedAt: '2026-09-05T10:11:12.000Z',
      profile: 'default',
      profileName: 'Léa',
    });
    const props = renderScreen({ registry: TWO });
    uploadJson(serializeBackup(fromElsewhere));

    const select = await screen.findByLabelText(/importer dans le profil/i);
    fireEvent.change(select, { target: { value: 'p2' } });
    expect(
      screen.getByText(/Les réglages et les résultats de « Tom » seront remplacés/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /oui, importer/i }));

    expect(props.onImport).toHaveBeenCalledWith(
      'p2',
      expect.objectContaining({ format: BACKUP_FORMAT }),
      'replace',
    );
  });

  it('leaves the open form alone when the file lands in another profile', async () => {
    // The imported file carries questionCount 11; the active profile is on 22.
    renderScreen({ registry: TWO, settings: DEFAULT_SETTINGS });
    uploadJson(serializeBackup(backup));

    const select = await screen.findByLabelText(/importer dans le profil/i);
    fireEvent.change(select, { target: { value: 'p2' } });
    fireEvent.click(screen.getByRole('button', { name: /oui, importer/i }));

    expect(screen.getByLabelText(/nombre de questions/i)).toHaveValue(
      DEFAULT_SETTINGS.questionCount,
    );
  });

  it('re-seeds the form when the file lands in the profile being edited', async () => {
    renderScreen({ registry: TWO, settings: DEFAULT_SETTINGS });
    uploadJson(serializeBackup(backup));

    await screen.findByLabelText(/importer dans le profil/i);
    fireEvent.click(screen.getByRole('button', { name: /oui, importer/i }));

    expect(screen.getByLabelText(/nombre de questions/i)).toHaveValue(11);
  });
});

describe('SettingsScreen — replace or merge (#18)', () => {
  const pickMerge = async () => {
    fireEvent.click(await screen.findByRole('radio', { name: /^ajouter$/i }));
  };

  it('starts on replace, the restore it has always been', async () => {
    renderScreen();
    uploadJson(serializeBackup(backup));
    expect(await screen.findByRole('radio', { name: /^remplacer$/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: /^ajouter$/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('says what a merge adds and what is already here, measured on the target', async () => {
    const onPreviewMerge = vi.fn(() => ({ added: 4, known: 2, dropped: 0 }));
    renderScreen({ onPreviewMerge });
    uploadJson(serializeBackup(backup));
    await pickMerge();

    expect(screen.getByText(/nouvelles sessions\s*:\s*4.*déjà là\s*:\s*2/i)).toBeInTheDocument();
    expect(onPreviewMerge).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ format: BACKUP_FORMAT }),
    );
    expect(screen.getByText(/s'ajoutent à ceux de/i)).toBeInTheDocument();
    expect(screen.queryByText(/seront remplacés/i)).not.toBeInTheDocument();
  });

  it('warns when the cap will push sessions out, instead of implying all were kept', async () => {
    renderScreen({ onPreviewMerge: vi.fn(() => ({ added: 5, known: 0, dropped: 3 })) });
    uploadJson(serializeBackup(backup));
    await pickMerge();

    expect(screen.getByText(/au plus 50 tests.*plus anciennes\s*:\s*3/i)).toBeInTheDocument();
  });

  it('stays quiet about the cap when nothing is dropped', async () => {
    renderScreen({ onPreviewMerge: vi.fn(() => ({ added: 1, known: 0, dropped: 0 })) });
    uploadJson(serializeBackup(backup));
    await pickMerge();

    expect(screen.queryByText(/au plus 50 tests/i)).not.toBeInTheDocument();
  });

  it('passes the chosen mode on, and reports the merge as such', async () => {
    const props = renderScreen();
    uploadJson(serializeBackup(backup));
    await pickMerge();
    fireEvent.click(screen.getByRole('button', { name: /oui, importer/i }));

    expect(props.onImport).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ format: BACKUP_FORMAT }),
      'merge',
    );
    await screen.findByText(/résultats ajoutés/i);
  });

  it('leaves the form alone after a merge: the settings were not imported', async () => {
    // The file carries questionCount 11; a merge keeps the profile's 22.
    renderScreen({ settings: DEFAULT_SETTINGS });
    uploadJson(serializeBackup(backup));
    await pickMerge();
    fireEvent.click(screen.getByRole('button', { name: /oui, importer/i }));

    expect(screen.getByLabelText(/nombre de questions/i)).toHaveValue(
      DEFAULT_SETTINGS.questionCount,
    );
  });

  it('recounts when the destination changes', async () => {
    const onPreviewMerge = vi.fn((profileId: string) =>
      profileId === 'p2'
        ? { added: 7, known: 0, dropped: 0 }
        : { added: 1, known: 0, dropped: 0 },
    );
    renderScreen({
      onPreviewMerge,
      registry: {
        active: 'default',
        profiles: [
          { id: 'default', name: 'Léa', createdAt: '' },
          { id: 'p2', name: 'Tom', createdAt: '' },
        ],
      },
    });
    uploadJson(serializeBackup(backup));
    await pickMerge();
    fireEvent.change(screen.getByLabelText(/importer dans le profil/i), {
      target: { value: 'p2' },
    });

    expect(screen.getByText(/nouvelles sessions\s*:\s*7/i)).toBeInTheDocument();
    expect(screen.getByText(/ceux de « Tom »/)).toBeInTheDocument();
  });

  it('a new file starts on replace again', async () => {
    renderScreen();
    uploadJson(serializeBackup(backup));
    await pickMerge();
    uploadJson(serializeBackup(backup));

    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /^remplacer$/i })).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    );
  });
});

describe('SettingsScreen — export names the profile', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it('asks for the active profile, by id and by name', () => {
    const named: ProfileRegistry = {
      active: 'p2',
      profiles: [
        { id: 'default', name: 'Léa', createdAt: '' },
        { id: 'p2', name: 'Tom', createdAt: '' },
      ],
    };
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });

    const props = renderScreen({
      registry: named,
      onExport: vi.fn((profileId: string, profileName: string) =>
        createBackup(backup.data, {
          appVersion: '0.12.0',
          exportedAt: '2026-09-05T10:11:12.000Z',
          profile: profileId,
          profileName,
        }),
      ),
    });
    fireEvent.click(screen.getByRole('button', { name: /exporter mes données/i }));

    expect(props.onExport).toHaveBeenCalledWith('p2', 'Tom');
    expect(downloads).toEqual(['math-quizz-backup-tom-2026-09-05.json']);
  });
});
