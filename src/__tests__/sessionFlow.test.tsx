import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { SessionScreen } from '../screens/SessionScreen';
import type { Settings, SessionResult } from '../domain/session';

const settings: Settings = {
  durationPerQuestionMs: 4000,
  questionCount: 3,
  selectedTables: [7],
  mode: 'mul',
  partialCreditFactor: 0.5,
  language: 'fr',
};

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
  });
  // Deterministic question generation (mode=mul, expected = a*b)
  vi.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('SessionScreen flow', () => {
  test('keyboard input + Enter → records correct answer', () => {
    let result: SessionResult | null = null;
    render(<SessionScreen profileId="default" settings={settings} onComplete={(r) => (result = r)} />);

    fireEvent.keyDown(window, { key: '5' });
    fireEvent.keyDown(window, { key: '6' });
    fireEvent.keyDown(window, { key: 'Enter' });

    fireEvent.keyDown(window, { key: '0' });
    fireEvent.keyDown(window, { key: 'Enter' });

    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(result).not.toBeNull();
    expect(result!.answers).toHaveLength(3);
    expect(result!.answers[0].given).toBe(56);
    expect(result!.answers[1].given).toBe(0);
    expect(result!.answers[2].given).toBe(1);
  });

  test('time past target does NOT auto-advance — child can take all the time they need', () => {
    let result: SessionResult | null = null;
    render(<SessionScreen profileId="default" settings={settings} onComplete={(r) => (result = r)} />);

    // Wait well past the target — nothing should happen on its own
    advance(15_000);
    expect(result).toBeNull();
    expect(screen.getByText('Question 1 / 3')).toBeInTheDocument();

    // Now answer slowly: the elapsed time is captured but the answer still counts
    fireEvent.keyDown(window, { key: '5' });
    fireEvent.keyDown(window, { key: '6' });
    fireEvent.keyDown(window, { key: 'Enter' });

    // Finish the remaining two quickly
    advance(500);
    fireEvent.keyDown(window, { key: '0' });
    fireEvent.keyDown(window, { key: 'Enter' });
    advance(300);
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(result).not.toBeNull();
    expect(result!.answers).toHaveLength(3);
    expect(result!.answers[0].given).toBe(56);
    expect(result!.answers[0].elapsedMs).toBeGreaterThan(settings.durationPerQuestionMs);
  });

  test('records partialCreditFactor on the SessionResult for self-contained scoring', () => {
    let result: SessionResult | null = null;
    render(<SessionScreen profileId="default" settings={settings} onComplete={(r) => (result = r)} />);

    for (let i = 0; i < 3; i++) {
      fireEvent.keyDown(window, { key: '0' });
      fireEvent.keyDown(window, { key: 'Enter' });
    }

    expect(result!.partialCreditFactor).toBe(0.5);
    expect(result!.durationPerQuestionMs).toBe(4000);
  });

  test('NumPad clicks erase + validate work', () => {
    let result: SessionResult | null = null;
    render(<SessionScreen profileId="default" settings={settings} onComplete={(r) => (result = r)} />);

    fireEvent.click(screen.getByRole('button', { name: 'chiffre 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'chiffre 9' })); // 59
    fireEvent.click(screen.getByRole('button', { name: 'effacer' }));   // 5
    fireEvent.click(screen.getByRole('button', { name: 'chiffre 6' })); // 56
    fireEvent.click(screen.getByRole('button', { name: 'valider' }));

    fireEvent.keyDown(window, { key: '0' });
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(result!.answers[0].given).toBe(56);
  });

  test('cancel button hands control back to the caller', () => {
    const onCancel = vi.fn();
    render(<SessionScreen profileId="default" settings={settings} onComplete={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Arrêter' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test('empty answer + Enter is ignored (no advance)', () => {
    let result: SessionResult | null = null;
    render(<SessionScreen profileId="default" settings={settings} onComplete={(r) => (result = r)} />);

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByText('Question 1 / 3')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: '2' });
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: '3' });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(result!.answers).toHaveLength(3);
  });
});
