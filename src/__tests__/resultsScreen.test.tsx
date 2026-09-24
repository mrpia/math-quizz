import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultsScreen } from '../screens/ResultsScreen';
import type { SessionResult } from '../domain/session';
import type { Question } from '../domain/question';

const q = (a: number, b: number): Question => ({ a, b, op: 'mul', expected: a * b });

const paperResult: SessionResult = {
  startedAt: '2026-06-13T08:00:00Z',
  durationPerQuestionMs: 4000,
  partialCreditFactor: 0.5,
  questionCount: 2,
  selectedTables: [7],
  mode: 'mul',
  answerMode: 'paper',
  answers: [
    { question: q(7, 8), given: null, elapsedMs: 0 },
    { question: q(6, 9), given: null, elapsedMs: 0 },
  ],
};

const screenResult: SessionResult = {
  ...paperResult,
  answerMode: 'screen',
  answers: [
    { question: q(7, 8), given: 56, elapsedMs: 1200 },
    { question: q(6, 9), given: 50, elapsedMs: 2000 },
  ],
};

const trainingResult: SessionResult = {
  ...paperResult,
  answerMode: 'training',
  answers: [
    // Correct but slow (elapsed > target): an untimed mode must NOT penalise this.
    { question: q(7, 8), given: 56, elapsedMs: 9000, selfMarkedCorrect: true },
    { question: q(6, 9), given: 50, elapsedMs: 1300, selfMarkedCorrect: false },
  ],
};

const noop = () => {};

describe('ResultsScreen — paper self-marking', () => {
  test('rows default to correct → score equals max', () => {
    render(<ResultsScreen result={paperResult} onReplay={noop} onHome={noop} onSave={noop} />);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    // The correct answer is shown for self-comparison
    expect(screen.getByText('7 × 8 = 56')).toBeInTheDocument();
  });

  test('un-marking a row lowers the live score', () => {
    render(<ResultsScreen result={paperResult} onReplay={noop} onHome={noop} onSave={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /7 × 8 = 56/ }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  test('Enregistrer fires onSave once with selfMarkedCorrect from the marks, then disappears', () => {
    const onSave = vi.fn();
    render(<ResultsScreen result={paperResult} onReplay={noop} onHome={noop} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: /6 × 9 = 54/ })); // mark second wrong
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as SessionResult;
    expect(saved.answers[0].selfMarkedCorrect).toBe(true);
    expect(saved.answers[1].selfMarkedCorrect).toBe(false);
    expect(saved.answerMode).toBe('paper');

    expect(screen.queryByRole('button', { name: /Enregistrer/ })).toBeNull();
  });
});

describe('ResultsScreen — training summary', () => {
  test('scores from selfMarkedCorrect, shows the correct facts, no Enregistrer', () => {
    render(<ResultsScreen result={trainingResult} onReplay={noop} onHome={noop} />);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByText('7 × 8 = 56')).toBeInTheDocument();
    expect(screen.getByText('6 × 9 = 54')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enregistrer/ })).toBeNull();
    // Untimed: the correct-but-slow answer is not flagged as "trop lent".
    expect(screen.queryByText(/trop lent/)).toBeNull();
  });
});

describe('ResultsScreen — screen mode unchanged', () => {
  test('renders read-only rows with no Enregistrer button', () => {
    render(<ResultsScreen result={screenResult} onReplay={noop} onHome={noop} />);
    expect(screen.getByText('1 / 2')).toBeInTheDocument(); // 56 ok, 50 wrong
    expect(screen.queryByRole('button', { name: /Enregistrer/ })).toBeNull();
  });
});

describe('ResultsScreen — target legend', () => {
  test('shows a half-second target as is, not rounded up (#38)', () => {
    render(
      <ResultsScreen
        result={{ ...screenResult, durationPerQuestionMs: 2500 }}
        onReplay={noop}
        onHome={noop}
      />,
    );
    expect(screen.getByText(/Cible : 2\.5s/)).toBeInTheDocument();
  });
});
