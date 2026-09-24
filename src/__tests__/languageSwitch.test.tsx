import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithLanguage } from './renderWithLanguage';
import { HomeScreen } from '../screens/HomeScreen';
import { DEFAULT_SETTINGS } from '../domain/session';
import { InfoScreen } from '../screens/InfoScreen';
import { releaseNotes } from '../domain/releaseNotes';
import { ErrorHeatmap } from '../components/ErrorHeatmap';
import type { ProfileEntry } from '../storage/profileRegistry';

// One nameless profile: the switcher renders nothing, so only the language
// of the home screen itself is under test here.
const PROFILES: ProfileEntry[] = [{ id: 'default', name: '', createdAt: '' }];

const homeProps = {
  settings: DEFAULT_SETTINGS,
  profiles: PROFILES,
  activeProfileId: 'default',
  onSwitchProfile: () => {},
  onChange: () => {},
  onStart: () => {},
  onOpenSettings: () => {},
  onOpenProgress: () => {},
  onOpenInfo: () => {},
};

describe('HomeScreen language', () => {
  it.each([
    ['fr', /Lancer/],
    ['de', /Starten/],
    ['en', /Start/],
  ] as const)('renders the start button in %s', (lang, label) => {
    renderWithLanguage(<HomeScreen {...homeProps} />, lang);
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });
});

describe('ErrorHeatmap language', () => {
  it('renders the legend in German', () => {
    renderWithLanguage(<ErrorHeatmap grid={[]} />, 'de');
    expect(screen.getByText('kannst du')).toBeInTheDocument();
    expect(screen.getByText('üben')).toBeInTheDocument();
    expect(screen.getByText('noch unsicher')).toBeInTheDocument();
    expect(screen.getByText('nicht gespielt')).toBeInTheDocument();
  });
});

describe('InfoScreen language', () => {
  it('renders release notes in the selected language, with no French-only disclaimer', () => {
    renderWithLanguage(<InfoScreen version="9.9.9" onBack={() => {}} />, 'en');
    const latest = releaseNotes[0];
    expect(screen.getByText(latest.changes.en[0])).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(screen.queryByText('These notes are in French.')).not.toBeInTheDocument();
  });
});
