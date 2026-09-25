import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithLanguage } from './renderWithLanguage';
import { SettingsScreen } from '../screens/SettingsScreen';
import { DEFAULT_SETTINGS } from '../domain/session';
import type { Settings } from '../domain/session';
import { createBackup } from '../domain/backup';
import type { ProfileRegistry } from '../storage/profileRegistry';

const REGISTRY: ProfileRegistry = {
  active: 'default',
  profiles: [{ id: 'default', name: '', createdAt: '' }],
};

const exportStub = () =>
  createBackup(
    { settings: DEFAULT_SETTINGS, history: [], trainingHistory: [] },
    {
      appVersion: '0.0.0',
      exportedAt: '2026-01-01T00:00:00.000Z',
      profile: 'default',
      profileName: '',
    },
  );

const SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  durationPerQuestionMs: 4000,
  questionCount: 22,
  partialCreditFactor: 0.5,
};

const renderSettings = () => {
  const onSave = vi.fn();
  renderWithLanguage(
    <SettingsScreen
      registry={REGISTRY}
      onRegistryChange={() => {}}
      settings={SETTINGS}
      onSave={onSave}
      onClearHistory={() => {}}
      onExport={exportStub}
      onImport={() => {}}
      onPreviewMerge={() => ({ added: 0, known: 0, dropped: 0 })}
      onBack={() => {}}
    />,
    'fr',
  );
  const save = (): Settings => {
    fireEvent.click(screen.getByTestId('settings-save'));
    return onSave.mock.calls.at(-1)![0];
  };
  return { save };
};

const field = (label: RegExp) =>
  screen.getByRole('spinbutton', { name: label }) as HTMLInputElement;

const targetTime = () => field(/^Temps cible/);
const questionCount = () => field(/^Nombre de questions/);
const partialCredit = () => field(/^Crédit pour/);

// #49: an emptied field used to be read as Number('') = 0, then clamped to
// the minimum and saved without a word.
describe('SettingsScreen numeric fields', () => {
  it.each([
    ['target time', targetTime],
    ['question count', questionCount],
    ['partial credit', partialCredit],
  ])('an emptied %s field keeps the previous value on save', (_name, input) => {
    const { save } = renderSettings();
    fireEvent.change(input(), { target: { value: '' } });
    const saved = save();
    expect(saved.durationPerQuestionMs).toBe(4000);
    expect(saved.questionCount).toBe(22);
    expect(saved.partialCreditFactor).toBe(0.5);
  });

  it('shows an emptied field as empty, not as 0', () => {
    renderSettings();
    fireEvent.change(targetTime(), { target: { value: '' } });
    expect(targetTime().value).toBe('');
  });

  it('still saves a typed value', () => {
    const { save } = renderSettings();
    fireEvent.change(targetTime(), { target: { value: '6.5' } });
    fireEvent.change(questionCount(), { target: { value: '30' } });
    fireEvent.change(partialCredit(), { target: { value: '0.25' } });
    expect(save()).toMatchObject({
      durationPerQuestionMs: 6500,
      questionCount: 30,
      partialCreditFactor: 0.25,
    });
  });

  it('snaps the target to the 10 ms grid the timer can show', () => {
    // 2.255 s would be scored against a number no label shows: "cible 2.25s"
    // while 2.251 s still counted as fast. Same result as an imported 2255.
    const { save } = renderSettings();
    fireEvent.change(targetTime(), { target: { value: '2.255' } });
    expect(save().durationPerQuestionMs).toBe(2260);
    fireEvent.change(targetTime(), { target: { value: '2.254' } });
    expect(save().durationPerQuestionMs).toBe(2250);
    fireEvent.change(targetTime(), { target: { value: '2.25' } });
    expect(save().durationPerQuestionMs).toBe(2250);
  });

  it('still clamps an out-of-range number', () => {
    const { save } = renderSettings();
    fireEvent.change(targetTime(), { target: { value: '400' } });
    fireEvent.change(questionCount(), { target: { value: '0' } });
    fireEvent.change(partialCredit(), { target: { value: '3' } });
    expect(save()).toMatchObject({
      durationPerQuestionMs: 60000,
      questionCount: 1,
      partialCreditFactor: 1,
    });
  });
});
