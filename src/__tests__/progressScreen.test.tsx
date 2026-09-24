import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ProgressScreen } from '../screens/ProgressScreen';
import { storageKeys } from '../storage/profileStore';
import type { SessionResult } from '../domain/session';

const session = (over: Partial<SessionResult> = {}): SessionResult => ({
  startedAt: '2026-01-01T00:00:00.000Z',
  durationPerQuestionMs: 4000,
  partialCreditFactor: 0.5,
  questionCount: 3,
  selectedTables: [7],
  mode: 'mul',
  answers: [
    { question: { a: 7, b: 8, op: 'mul', expected: 56 }, given: 50, elapsedMs: 1000 },
    { question: { a: 7, b: 8, op: 'mul', expected: 56 }, given: 51, elapsedMs: 1000 },
    { question: { a: 7, b: 8, op: 'mul', expected: 56 }, given: 56, elapsedMs: 1000 },
  ],
  ...over,
});

// The only profile on the device: nameless, and so not announced on screen.
const profileProps = { profileId: 'default', profileName: '', showProfile: false };

beforeEach(() => {
  localStorage.clear();
});

describe('ProgressScreen', () => {
  test('shows empty state when there is no history', () => {
    render(<ProgressScreen {...profileProps} onBack={() => {}} />);
    expect(screen.getByText(/Joue quelques sessions/i)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  test('renders heading, chart and trickiest pair from history', () => {
    localStorage.setItem(storageKeys('default').history, JSON.stringify([session()]));
    render(<ProgressScreen {...profileProps} onBack={() => {}} />);
    expect(
      screen.getByRole('heading', { name: 'Mes résultats' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Score sur les dernières sessions/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('7 × 8')).toBeInTheDocument();
  });

  test('heat-map tooltip shows the same raw count as the list, not the weighted %', () => {
    // Two sessions, so the weighted rate (older failures discounted) differs
    // from the raw 2 / 6 and a percentage would give the game away.
    const fixed = session({
      startedAt: '2026-01-02T00:00:00.000Z',
      answers: [
        { question: { a: 7, b: 8, op: 'mul', expected: 56 }, given: 56, elapsedMs: 1000 },
        { question: { a: 7, b: 8, op: 'mul', expected: 56 }, given: 56, elapsedMs: 1000 },
        { question: { a: 7, b: 8, op: 'mul', expected: 56 }, given: 56, elapsedMs: 1000 },
      ],
    });
    localStorage.setItem(storageKeys('default').history, JSON.stringify([session(), fixed]));
    render(<ProgressScreen {...profileProps} onBack={() => {}} />);
    const cell = screen.getByLabelText(/^7×8 — /);
    expect(cell).toHaveAttribute('aria-label', '7×8 — 2 / 6');
    expect(cell).toHaveAttribute('title', '7×8 — 2 / 6');
  });

  test('a pair whose only miss is old is not listed for review, and stays heat--0', () => {
    const hit = { question: { a: 7, b: 8, op: 'mul' as const, expected: 56 }, given: 56, elapsedMs: 1000 };
    const miss = { ...hit, given: 50 };
    const history = [
      session({ answers: [miss] }),
      ...Array.from({ length: 20 }, (_, i) =>
        session({ startedAt: `2026-01-${String(i + 2).padStart(2, '0')}T00:00:00.000Z`, answers: [hit] }),
      ),
    ];
    localStorage.setItem(storageKeys('default').history, JSON.stringify(history));
    render(<ProgressScreen {...profileProps} onBack={() => {}} />);
    expect(screen.queryByText('7 × 8')).not.toBeInTheDocument();
    expect(screen.getByText(/Aucune paire à revoir/)).toBeInTheDocument();
    expect(screen.getByLabelText('7×8 — 1 / 21')).toHaveClass('heat--0');
  });

  test('a pair that is only ever slow is listed, and list and tooltip show the slow count (#47)', () => {
    const slow = { question: { a: 7, b: 8, op: 'mul' as const, expected: 56 }, given: 56, elapsedMs: 9000 };
    const fast = { ...slow, elapsedMs: 1000 };
    localStorage.setItem(
      storageKeys('default').history,
      JSON.stringify([session({ answers: [slow, slow, slow, fast, fast] })]),
    );
    render(<ProgressScreen {...profileProps} onBack={() => {}} />);
    expect(screen.getByText('7 × 8')).toBeInTheDocument();
    expect(screen.getByText('0 / 5 · 3 🐢')).toBeInTheDocument();
    const cell = screen.getByLabelText(/^7×8 — /);
    expect(cell).toHaveAttribute('aria-label', '7×8 — 0 / 5 · 3 🐢');
    expect(cell).not.toHaveClass('heat--0');
  });

  test('a pair with no slow answers shows no slow count', () => {
    localStorage.setItem(storageKeys('default').history, JSON.stringify([session()]));
    render(<ProgressScreen {...profileProps} onBack={() => {}} />);
    // Scoped to the list: the caption below it explains 🐢 either way.
    const list = screen.getByTestId('trickiest-pairs');
    expect(within(list).getByText('2 / 3')).toBeInTheDocument();
    expect(within(list).queryByText(/🐢/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('7×8 — 2 / 3')).toBeInTheDocument();
  });

  test('back button calls onBack', () => {
    const onBack = vi.fn();
    render(<ProgressScreen {...profileProps} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /retour/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('ProgressScreen — training view', () => {
  test('switching to Entraînement reads training history and hides the score chart', () => {
    localStorage.setItem(storageKeys('default').history, JSON.stringify([session()]));
    localStorage.setItem(
      storageKeys('default').trainingHistory,
      JSON.stringify([
        session({
          answerMode: 'training',
          answers: [
            { question: { a: 6, b: 9, op: 'mul', expected: 54 }, given: 50, elapsedMs: 0, selfMarkedCorrect: false },
            { question: { a: 6, b: 9, op: 'mul', expected: 54 }, given: 49, elapsedMs: 0, selfMarkedCorrect: false },
            { question: { a: 6, b: 9, op: 'mul', expected: 54 }, given: 54, elapsedMs: 0, selfMarkedCorrect: true },
          ],
        }),
      ]),
    );
    render(<ProgressScreen {...profileProps} onBack={() => {}} />);

    // Test view (default) shows the score chart
    expect(
      screen.getByRole('img', { name: /Score sur les dernières sessions/i }),
    ).toBeInTheDocument();

    // Switch to training
    fireEvent.click(screen.getByRole('radio', { name: 'Entraînement' }));

    // Chart is gone; the training-only weak pair (6 × 9) is shown
    expect(
      screen.queryByRole('img', { name: /Score sur les dernières sessions/i }),
    ).toBeNull();
    expect(screen.getByText('6 × 9')).toBeInTheDocument();
  });

  test('training view shows its own empty state when there is no training history', () => {
    localStorage.setItem(storageKeys('default').history, JSON.stringify([session()]));
    render(<ProgressScreen {...profileProps} onBack={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Entraînement' }));
    expect(screen.getByText(/Entraîne-toi pour voir/i)).toBeInTheDocument();
  });
});
