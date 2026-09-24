import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { Timer } from '../components/Timer';
import { LanguageProvider } from '../i18n/I18nContext';
import { renderWithLanguage } from './renderWithLanguage';

describe('Timer', () => {
  test('shows a half-second target as is, not rounded up (#38)', () => {
    renderWithLanguage(<Timer targetMs={2500} startedAt={performance.now()} />);
    expect(screen.getByText(/cible 2\.5s/)).toBeInTheDocument();
  });

  test('shows a whole-second target without a decimal', () => {
    renderWithLanguage(<Timer targetMs={4000} startedAt={performance.now()} />);
    expect(screen.getByText(/cible 4s/)).toBeInTheDocument();
  });
});

describe('Timer clock (#48)', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const advance = (ms: number) =>
    act(() => {
      vi.advanceTimersByTime(ms);
    });

  const value = () => screen.getByTestId('session-timer').textContent;
  const isOver = () => screen.getByRole('status').classList.contains('timer--over');

  test('counts from the start it is given, not from its own mount', () => {
    // The scoring clock started 40 ms before the timer committed.
    const startedAt = performance.now() - 40;
    renderWithLanguage(<Timer targetMs={4000} startedAt={startedAt} />);
    advance(3952); // performance.now() - startedAt = 3992
    expect(value()).toBe('4.0s');
    expect(isOver()).toBe(false);
    advance(16); // 4008: scored slow, so it must not read 4.0s
    expect(value()).toBe('4.1s');
    expect(isOver()).toBe(true);
  });

  test('restarts at zero when the next question gets a new start', () => {
    const { rerender } = renderWithLanguage(
      <Timer targetMs={4000} startedAt={performance.now()} />,
    );
    advance(3200);
    expect(value()).toBe('3.2s');
    rerender(
      <LanguageProvider lang="fr">
        <Timer targetMs={4000} startedAt={performance.now()} />
      </LanguageProvider>,
    );
    expect(value()).toBe('0.0s');
    advance(800);
    expect(value()).toBe('0.8s');
  });
});
