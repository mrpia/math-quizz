import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithLanguage } from './renderWithLanguage';
import { SettingsScreen } from '../screens/SettingsScreen';
import { DEFAULT_SETTINGS } from '../domain/session';
import { MAX_PROFILES, loadRegistry, saveRegistry } from '../storage/profileRegistry';
import type { ProfileRegistry } from '../storage/profileRegistry';
import { storageKeys, saveSettings, recordSession } from '../storage/profileStore';
import { createBackup } from '../domain/backup';
import type { SessionResult } from '../domain/session';

const ONE: ProfileRegistry = {
  active: 'default',
  profiles: [{ id: 'default', name: '', createdAt: '' }],
};

const TWO: ProfileRegistry = {
  active: 'default',
  profiles: [
    { id: 'default', name: 'Léa', createdAt: '' },
    { id: 'p2', name: 'Tom', createdAt: '2026-09-05T10:00:00.000Z' },
  ],
};

const session: SessionResult = {
  startedAt: '2026-09-05T08:00:00.000Z',
  durationPerQuestionMs: 4000,
  partialCreditFactor: 0.5,
  questionCount: 1,
  selectedTables: [7],
  mode: 'mul',
  answers: [
    { question: { a: 7, b: 8, op: 'mul', expected: 56 }, given: 56, elapsedMs: 900 },
  ],
};

const backupOf = (profile: string, profileName: string) =>
  createBackup(
    { settings: DEFAULT_SETTINGS, history: [], trainingHistory: [] },
    {
      appVersion: '0.12.0',
      exportedAt: '2026-09-05T10:11:12.000Z',
      profile,
      profileName,
    },
  );

/**
 * ProfileManager is controlled, so the test has to hold the registry the way
 * App does — otherwise a create would render nothing new and every assertion
 * below would be vacuous.
 */
const renderManager = (initial: ProfileRegistry) => {
  const onExport = vi.fn((profileId: string, profileName: string) =>
    backupOf(profileId, profileName),
  );
  const seen: ProfileRegistry[] = [];

  const Harness = () => {
    const [registry, setRegistry] = useState(initial);
    return (
      <SettingsScreen
        settings={DEFAULT_SETTINGS}
        registry={registry}
        onRegistryChange={(next) => {
          seen.push(next);
          setRegistry(next);
        }}
        onSave={vi.fn()}
        onClearHistory={vi.fn()}
        onExport={onExport}
        onImport={vi.fn()}
        onPreviewMerge={() => ({ added: 0, known: 0, dropped: 0 })}
        onBack={vi.fn()}
      />
    );
  };

  renderWithLanguage(<Harness />, 'fr');
  return { onExport, seen, latest: () => seen[seen.length - 1] };
};

const create = (name: string) => {
  fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: /ajouter/i }));
};

describe('the profile list', () => {
  it('labels the nameless migrated profile rather than showing a blank row', () => {
    renderManager(ONE);
    expect(screen.getByText('Sans nom')).toBeInTheDocument();
  });

  it('offers no delete while a single profile exists', () => {
    renderManager(ONE);
    expect(screen.queryByRole('button', { name: /^supprimer/i })).toBeNull();
  });
});

describe('creating a profile', () => {
  it('appends it without switching to it', () => {
    const { latest } = renderManager(ONE);
    create('Tom');

    const next = latest();
    expect(next.profiles.map((p) => p.name)).toEqual(['', 'Tom']);
    expect(next.active).toBe('default');
    expect(screen.getByText('Tom')).toBeInTheDocument();
  });

  it('refuses a blank name', () => {
    const { seen } = renderManager(ONE);
    create('   ');
    expect(seen).toHaveLength(0);
    expect(screen.getByRole('alert')).toHaveTextContent(/écris un prénom/i);
  });

  it('refuses a name another profile already uses, whatever the case', () => {
    const { seen } = renderManager(TWO);
    create('tom');
    expect(seen).toHaveLength(0);
    expect(screen.getByRole('alert')).toHaveTextContent(/déjà pris/i);
  });

  it('stops at MAX_PROFILES and says so', () => {
    const full: ProfileRegistry = {
      active: 'default',
      profiles: Array.from({ length: MAX_PROFILES }, (_, i) => ({
        id: i === 0 ? 'default' : `p${i}`,
        name: `Enfant ${i}`,
        createdAt: '',
      })),
    };
    renderManager(full);

    expect(screen.getByLabelText('Prénom')).toBeDisabled();
    expect(screen.getByRole('button', { name: /ajouter/i })).toBeDisabled();
    expect(screen.getByText(`Maximum ${MAX_PROFILES} profils.`)).toBeInTheDocument();
  });
});

describe('renaming', () => {
  it('renames in place and keeps the id, so the stored data stays put', () => {
    const { latest } = renderManager(TWO);

    fireEvent.click(screen.getByRole('button', { name: 'renommer Tom' }));
    fireEvent.change(screen.getByLabelText('renommer Tom'), {
      target: { value: '  Thomas ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Renommer' }));

    expect(latest().profiles[1]).toEqual({
      id: 'p2',
      name: 'Thomas',
      createdAt: '2026-09-05T10:00:00.000Z',
    });
  });

  it('starts the nameless profile from an empty field, not from "Sans nom"', () => {
    renderManager(ONE);
    fireEvent.click(screen.getByRole('button', { name: 'renommer Sans nom' }));
    expect(screen.getByLabelText('renommer Sans nom')).toHaveValue('');
  });

  it('refuses a name another profile already uses', () => {
    const { seen } = renderManager(TWO);
    fireEvent.click(screen.getByRole('button', { name: 'renommer Tom' }));
    fireEvent.change(screen.getByLabelText('renommer Tom'), {
      target: { value: 'Léa' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Renommer' }));

    expect(seen).toHaveLength(0);
    expect(screen.getByRole('alert')).toHaveTextContent(/déjà pris/i);
  });
});

describe('deleting', () => {
  // The export-first button really downloads; jsdom has neither of these.
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('offers the export before the deletion, not after', () => {
    const { onExport } = renderManager(TWO);
    fireEvent.click(screen.getByRole('button', { name: 'supprimer Tom' }));

    expect(screen.getByText(/Supprimer « Tom » et tous ses résultats/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /exporter ses données d’abord/i }));

    expect(onExport).toHaveBeenCalledWith('p2', 'Tom');
  });

  it('erases the storage the profile owned', () => {
    saveSettings('p2', { ...DEFAULT_SETTINGS, questionCount: 33 });
    recordSession('p2', session);
    saveSettings('default', { ...DEFAULT_SETTINGS, questionCount: 11 });

    const { latest } = renderManager(TWO);
    fireEvent.click(screen.getByRole('button', { name: 'supprimer Tom' }));
    fireEvent.click(screen.getByRole('button', { name: 'Oui, supprimer' }));

    expect(latest().profiles.map((p) => p.id)).toEqual(['default']);
    expect(localStorage.getItem(storageKeys('p2').settings)).toBeNull();
    expect(localStorage.getItem(storageKeys('p2').history)).toBeNull();
    // The survivor is untouched.
    expect(localStorage.getItem(storageKeys('default').settings)).toContain('11');
  });

  it('can be backed out of', () => {
    const { seen } = renderManager(TWO);
    fireEvent.click(screen.getByRole('button', { name: 'supprimer Tom' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(seen).toHaveLength(0);
    expect(screen.getByText('Tom')).toBeInTheDocument();
  });
});

describe('what reaches storage', () => {
  it('a saved registry round-trips through loadRegistry', () => {
    saveRegistry(TWO);
    expect(loadRegistry()).toEqual(TWO);
  });
});
