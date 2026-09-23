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

const renderSettings = (settings: Settings, onSave = vi.fn(), onBack = vi.fn()) =>
  renderWithLanguage(
    <SettingsScreen
      registry={REGISTRY}
      onRegistryChange={() => {}}
      settings={settings}
      onSave={onSave}
      onClearHistory={() => {}}
      onExport={exportStub}
      onImport={() => {}}
      onBack={onBack}
    />,
    'fr',
  );

describe('SettingsScreen adaptive draw', () => {
  it('shows the current strength as checked', () => {
    renderSettings({ ...DEFAULT_SETTINGS, adaptiveDraw: 'strong' });
    expect(screen.getByRole('radio', { name: 'Beaucoup' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: 'Un peu' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('reads an absent setting as moderate', () => {
    const { adaptiveDraw: _omitted, ...legacy } = DEFAULT_SETTINGS;
    renderSettings(legacy);
    expect(screen.getByRole('radio', { name: 'Un peu' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('applies the choice immediately via onSave', () => {
    const onSave = vi.fn();
    const onBack = vi.fn();
    renderSettings(DEFAULT_SETTINGS, onSave, onBack);
    fireEvent.click(screen.getByRole('radio', { name: 'Non' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ adaptiveDraw: 'off' }));
    expect(onBack).not.toHaveBeenCalled();
  });
});
