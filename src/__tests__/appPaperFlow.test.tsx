import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { App } from '../App';
import { storageKeys, loadHistory, loadTrainingHistory } from '../storage/profileStore';

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
  });
  vi.spyOn(Math, 'random').mockReturnValue(0);
  localStorage.setItem(
    storageKeys('default').settings,
    JSON.stringify({
      durationPerQuestionMs: 4000,
      questionCount: 2,
      selectedTables: [7],
      mode: 'mul',
      partialCreditFactor: 0.5,
      answerMode: 'paper',
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('App — pen-and-paper flow', () => {
  test('a paper test is never recorded, whatever the child marks (#44)', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Lancer/ }));
    advance(3000); // lead-in
    advance(4000); // question 1
    advance(4000); // question 2 → results

    expect(screen.getByText('Bilan')).toBeInTheDocument();
    // The marks still drive the live score for the child's own review.
    fireEvent.click(screen.getAllByRole('button', { pressed: true })[0]);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /accueil/i }));
    expect(loadHistory('default')).toHaveLength(0);
    expect(loadTrainingHistory('default')).toHaveLength(0);
  });
});
