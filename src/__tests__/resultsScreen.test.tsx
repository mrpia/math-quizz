import { describe, expect, test } from 'vitest';
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
    render(<ResultsScreen result={paperResult} onReplay={noop} onHome={noop} />);
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    // The correct answer is shown for self-comparison
    expect(screen.getByText('7 × 8 = 56')).toBeInTheDocument();
  });

  test('un-marking a row lowers the live score', () => {
    render(<ResultsScreen result={paperResult} onReplay={noop} onHome={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /7 × 8 = 56/ }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  test('has no Enregistrer button: a paper test is never saved (#44)', () => {
    render(<ResultsScreen result={paperResult} onReplay={noop} onHome={noop} />);
    expect(screen.queryByRole('button', { name: /Enregistrer/ })).toBeNull();
    expect(screen.getByText(/pas enregistré/)).toBeInTheDocument();
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

describe('ResultsScreen — elapsed time is rounded up like the timer (#48)', () => {
  test('an answer scored slow never reads as the target or less', () => {
    // 4030 ms against a 4 s target: toFixed(1) said "4.0s · trop lent", the
    // same contradiction #48 removed from the running timer.
    const justOver: SessionResult = {
      ...screenResult,
      questionCount: 2,
      answers: [
        { question: q(7, 8), given: 56, elapsedMs: 4030 },
        { question: q(6, 9), given: 54, elapsedMs: 4000 },
      ],
    };
    render(<ResultsScreen result={justOver} onReplay={noop} onHome={noop} />);
    expect(screen.getByTestId('results-row-slow')).toHaveTextContent('4.1s · trop lent');
    expect(screen.getByTestId('results-row-ok')).toHaveTextContent('4.0s');
    expect(screen.queryByText(/^4\.0s · trop lent/)).toBeNull();
  });

  test('a target off the tenth grid shows hundredths, as the timer does', () => {
    const fine: SessionResult = {
      ...screenResult,
      durationPerQuestionMs: 2250,
      questionCount: 1,
      answers: [{ question: q(7, 8), given: 56, elapsedMs: 2251 }],
    };
    render(<ResultsScreen result={fine} onReplay={noop} onHome={noop} />);
    expect(screen.getByTestId('results-row-slow')).toHaveTextContent('2.26s · trop lent');
  });
});

describe('ResultsScreen — partial credit precision (#39)', () => {
  test('a 0.25 credit is shown as 0.25 in the score and the legend, not 0.3', () => {
    const quarter: SessionResult = {
      ...screenResult,
      durationPerQuestionMs: 1000,
      partialCreditFactor: 0.25,
      questionCount: 1,
      answers: [{ question: q(7, 8), given: 56, elapsedMs: 2000 }],
    };
    render(<ResultsScreen result={quarter} onReplay={noop} onHome={noop} />);
    expect(screen.getByTestId('results-score')).toHaveTextContent('0.25 / 1');
    expect(screen.getByText(/0\.25 pt/)).toBeInTheDocument();
  });
});
