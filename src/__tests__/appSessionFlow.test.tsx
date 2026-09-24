import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../App';
import { storageKeys, loadHistory, loadTrainingHistory } from '../storage/profileStore';

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  localStorage.setItem(
    storageKeys('default').settings,
    JSON.stringify({
      durationPerQuestionMs: 4000,
      questionCount: 2,
      selectedTables: [7],
      mode: 'mul',
      partialCreditFactor: 0.5,
      answerMode: 'screen',
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('App — screen flow', () => {
  test('a completed screen session is stored with answerMode: screen', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Lancer/ }));
    for (let i = 0; i < 2; i++) {
      fireEvent.keyDown(window, { key: '1' });
      fireEvent.keyDown(window, { key: 'Enter' });
    }

    expect(screen.getByTestId('results-score')).toBeInTheDocument();
    expect(loadTrainingHistory('default')).toHaveLength(0);
    const history = loadHistory('default');
    expect(history).toHaveLength(1);
    expect(history[0].answerMode).toBe('screen');
  });
});
