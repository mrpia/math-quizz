import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LanguageProvider } from '../i18n/I18nContext';
import { HomeScreen } from '../screens/HomeScreen';
import { DEFAULT_SETTINGS } from '../domain/session';
import type { ProfileEntry } from '../storage/profileRegistry';

const noop = () => {};

// A single profile, so the switcher stays hidden and these tests keep
// exercising the home screen alone.
const PROFILES: ProfileEntry[] = [{ id: 'default', name: '', createdAt: '' }];
const profileProps = {
  profiles: PROFILES,
  activeProfileId: 'default',
  onSwitchProfile: noop,
};

describe('HomeScreen — Saisie toggle', () => {
  test('selecting "Sur papier" emits settings with answerMode=paper', () => {
    const onChange = vi.fn();
    render(
      <HomeScreen
        {...profileProps}
        settings={DEFAULT_SETTINGS}
        onChange={onChange}
        onStart={noop}
        onOpenSettings={noop}
        onOpenProgress={noop}
        onOpenInfo={noop}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: '✏️ Test papier' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ answerMode: 'paper' }),
    );
  });
});

describe('HomeScreen — training mode', () => {
  test('shows the training summary and start label when answerMode is training', () => {
    render(
      <HomeScreen
        {...profileProps}
        settings={{ ...DEFAULT_SETTINGS, answerMode: 'training' }}
        onChange={noop}
        onStart={noop}
        onOpenSettings={noop}
        onOpenProgress={noop}
        onOpenInfo={noop}
      />,
    );

    expect(
      screen.getByText(/correction après chaque réponse/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /S'entraîner/ }),
    ).toBeInTheDocument();
  });
});

describe('HomeScreen — list mode', () => {
  test('shows the list summary and start label when answerMode is list', () => {
    render(
      <HomeScreen
        {...profileProps}
        settings={{ ...DEFAULT_SETTINGS, answerMode: 'list' }}
        onChange={noop}
        onStart={noop}
        onOpenSettings={noop}
        onOpenProgress={noop}
        onOpenInfo={noop}
      />,
    );

    expect(screen.getByText(/opérations à réviser/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Voir la liste/ }),
    ).toBeInTheDocument();
  });
});

describe('HomeScreen — table selection hint', () => {
  test('shows a hint to pick a table when none are selected', () => {
    render(
      <HomeScreen
        {...profileProps}
        settings={{ ...DEFAULT_SETTINGS, selectedTables: [] }}
        onChange={noop}
        onStart={noop}
        onOpenSettings={noop}
        onOpenProgress={noop}
        onOpenInfo={noop}
      />,
    );

    expect(screen.getByText(/au moins une table/i)).toBeInTheDocument();
  });

  test('hides the hint once at least one table is selected', () => {
    render(
      <HomeScreen
        {...profileProps}
        settings={{ ...DEFAULT_SETTINGS, selectedTables: [2] }}
        onChange={noop}
        onStart={noop}
        onOpenSettings={noop}
        onOpenProgress={noop}
        onOpenInfo={noop}
      />,
    );

    expect(screen.queryByText(/au moins une table/i)).not.toBeInTheDocument();
  });
});

describe('HomeScreen — progress entry', () => {
  test('clicking the results button calls onOpenProgress', () => {
    const onOpenProgress = vi.fn();
    render(
      <HomeScreen
        {...profileProps}
        settings={DEFAULT_SETTINGS}
        onChange={noop}
        onStart={noop}
        onOpenSettings={noop}
        onOpenProgress={onOpenProgress}
        onOpenInfo={noop}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'mes résultats' }));
    expect(onOpenProgress).toHaveBeenCalledOnce();
  });
});

describe('HomeScreen — info entry', () => {
  test('clicking the info button calls onOpenInfo', () => {
    const onOpenInfo = vi.fn();
    render(
      <HomeScreen
        {...profileProps}
        settings={DEFAULT_SETTINGS}
        onChange={noop}
        onStart={noop}
        onOpenSettings={noop}
        onOpenProgress={noop}
        onOpenInfo={onOpenInfo}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'à propos' }));
    expect(onOpenInfo).toHaveBeenCalledOnce();
  });
});

describe('HomeScreen — language selector', () => {
  test('switching language emits settings with the new language', () => {
    const onChange = vi.fn();
    render(
      <HomeScreen
        {...profileProps}
        settings={DEFAULT_SETTINGS}
        onChange={onChange}
        onStart={noop}
        onOpenSettings={noop}
        onOpenProgress={noop}
        onOpenInfo={noop}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Deutsch' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'de' }),
    );
  });
});

describe('HomeScreen — summary pluralisation', () => {
  const renderWith = (answerMode: 'screen' | 'training' | 'list', lang: 'fr' | 'de' | 'en') =>
    render(
      <LanguageProvider lang={lang}>
        <HomeScreen
          {...profileProps}
          settings={{ ...DEFAULT_SETTINGS, questionCount: 1, answerMode, language: lang }}
          onChange={noop}
          onStart={noop}
          onOpenSettings={noop}
          onOpenProgress={noop}
          onOpenInfo={noop}
        />
      </LanguageProvider>,
    );

  test.each([
    ['screen', 'fr', /^1 question ·/],
    ['training', 'fr', /^1 question ·/],
    ['list', 'fr', /^1 opération à réviser$/],
    ['screen', 'de', /^1 Frage ·/],
    ['training', 'de', /^1 Frage ·/],
    ['list', 'de', /^1 Aufgabe zum Üben$/],
    ['screen', 'en', /^1 question ·/],
    ['training', 'en', /^1 question ·/],
    ['list', 'en', /^1 operation to review$/],
  ] as const)('one question in %s mode reads in the singular (%s)', (mode, lang, expected) => {
    renderWith(mode, lang);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  test('more than one keeps the plural', () => {
    renderWith('screen', 'en');
    cleanup();
    render(
      <HomeScreen
        {...profileProps}
        settings={{ ...DEFAULT_SETTINGS, questionCount: 2 }}
        onChange={noop}
        onStart={noop}
        onOpenSettings={noop}
        onOpenProgress={noop}
        onOpenInfo={noop}
      />,
    );
    expect(screen.getByText(/^2 questions ·/)).toBeInTheDocument();
  });
});
