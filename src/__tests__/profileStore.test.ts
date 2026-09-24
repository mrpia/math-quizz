import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  purgeProfile,
  loadSettings,
  saveSettings,
  loadHistory,
  appendSession,
  recordSession,
  loadTrainingHistory,
  recordTrainingSession,
  clearAll,
  exportProfile,
  importProfile,
  HISTORY_LIMIT,
  storageKeys,
  loadPairStats,
} from '../storage/profileStore';
import { DEFAULT_SETTINGS } from '../domain/session';
import type { SessionResult } from '../domain/session';

const mkSession = (offsetMinutes: number): SessionResult => ({
  startedAt: new Date(Date.UTC(2026, 4, 9, 8, offsetMinutes, 0)).toISOString(),
  durationPerQuestionMs: 4000,
  partialCreditFactor: 0.5,
  questionCount: 1,
  selectedTables: [7],
  mode: 'mul',
  answers: [
    {
      question: { a: 7, b: 8, op: 'mul', expected: 56 },
      given: 56,
      elapsedMs: 1000,
    },
  ],
});

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('settings', () => {
  test('loadSettings returns DEFAULT_SETTINGS when storage is empty', () => {
    expect(loadSettings('default')).toEqual(DEFAULT_SETTINGS);
  });

  test('saveSettings then loadSettings returns the saved object', () => {
    const custom = { ...DEFAULT_SETTINGS, durationPerQuestionMs: 6000, questionCount: 10 };
    saveSettings('default', custom);
    expect(loadSettings('default')).toEqual(custom);
  });

  test('loadSettings falls back to defaults when storage is JSON-corrupt', () => {
    localStorage.setItem(storageKeys('default').settings, '{not valid json');
    expect(loadSettings('default')).toEqual(DEFAULT_SETTINGS);
  });

  test('storage key uses mathquizz:profile:default: prefix', () => {
    expect(storageKeys('default').settings).toBe('mathquizz:profile:default:settings');
  });

  test('loadSettings fills missing fields from defaults (forward-compat)', () => {
    // Simulate a settings blob saved before partialCreditFactor existed
    localStorage.setItem(
      storageKeys('default').settings,
      JSON.stringify({
        durationPerQuestionMs: 5000,
        questionCount: 10,
        selectedTables: [7],
        mode: 'mul',
      }),
    );
    const loaded = loadSettings('default');
    expect(loaded.durationPerQuestionMs).toBe(5000);
    expect(loaded.partialCreditFactor).toBe(DEFAULT_SETTINGS.partialCreditFactor);
  });
});

describe('history', () => {
  test('loadHistory returns [] when empty', () => {
    expect(loadHistory('default')).toEqual([]);
  });

  test('appendSession pushes and persists', () => {
    const s = mkSession(1);
    appendSession('default', s);
    expect(loadHistory('default')).toEqual([s]);
  });

  test('history is capped at HISTORY_LIMIT (oldest dropped)', () => {
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      appendSession('default', mkSession(i));
    }
    const hist = loadHistory('default');
    expect(hist).toHaveLength(HISTORY_LIMIT);
    // Oldest (offset 0..4) must have been dropped
    expect(hist[0].startedAt).toBe(mkSession(5).startedAt);
    expect(hist[hist.length - 1].startedAt).toBe(mkSession(HISTORY_LIMIT + 4).startedAt);
  });

  test('loadHistory returns [] when storage is JSON-corrupt', () => {
    localStorage.setItem(storageKeys('default').history, 'garbage');
    expect(loadHistory('default')).toEqual([]);
  });
});

const LEGACY_ERRORS_KEY = 'mathquizz:profile:default:errors';

describe('the abandoned lifetime error counters', () => {
  const legacy = () => ({ '7x8': { attempts: 9, errors: 3, timeouts: 1 } });

  test('recordSession appends to history and writes nothing else', () => {
    recordSession('default', {
      ...mkSession(0),
      answers: [
        {
          question: { a: 7, b: 8, op: 'mul', expected: 56 },
          given: 54,
          elapsedMs: 1500,
        },
      ],
    });
    expect(loadHistory('default')).toHaveLength(1);
    expect(localStorage.getItem(LEGACY_ERRORS_KEY)).toBeNull();
  });

  test('clearAll removes a key left behind by an older version', () => {
    localStorage.setItem(LEGACY_ERRORS_KEY, JSON.stringify(legacy()));
    clearAll('default');
    expect(localStorage.getItem(LEGACY_ERRORS_KEY)).toBeNull();
  });

  test('importProfile drops it too, so nothing stale outlives a restore', () => {
    localStorage.setItem(LEGACY_ERRORS_KEY, JSON.stringify(legacy()));
    importProfile('default', exportProfile('default', '0.11.0'));
    expect(localStorage.getItem(LEGACY_ERRORS_KEY)).toBeNull();
  });
});

describe('clearAll', () => {
  test('clears history and errors but preserves settings', () => {
    saveSettings('default', { ...DEFAULT_SETTINGS, questionCount: 11 });
    appendSession('default', mkSession(1));
    clearAll('default');
    expect(loadHistory('default')).toEqual([]);
    expect(loadSettings('default').questionCount).toBe(11);
  });
});

describe('training history', () => {
  test('loadTrainingHistory returns [] when empty', () => {
    expect(loadTrainingHistory('default')).toEqual([]);
  });

  test('recordTrainingSession appends to training history, not the test history', () => {
    const s: SessionResult = { ...mkSession(0), answerMode: 'training' };
    recordTrainingSession('default', s);
    expect(loadTrainingHistory('default')).toEqual([s]);
    expect(loadHistory('default')).toEqual([]);
  });

  test('training history is capped at HISTORY_LIMIT', () => {
    for (let i = 0; i < HISTORY_LIMIT + 3; i++) {
      recordTrainingSession('default', { ...mkSession(i), answerMode: 'training' });
    }
    expect(loadTrainingHistory('default')).toHaveLength(HISTORY_LIMIT);
  });

  test('clearAll also wipes training history', () => {
    recordTrainingSession('default', { ...mkSession(1), answerMode: 'training' });
    clearAll('default');
    expect(loadTrainingHistory('default')).toEqual([]);
  });

  test('training history key uses the profile prefix', () => {
    expect(storageKeys('default').trainingHistory).toBe(
      'mathquizz:profile:default:training-history',
    );
  });
});

it('defaults language to fr when absent from stored settings', () => {
  localStorage.setItem(storageKeys('default').settings, JSON.stringify({ questionCount: 10 }));
  expect(loadSettings('default').language).toBe('fr');
});

describe('loadPairStats', () => {
  const missed = (offsetMinutes: number): SessionResult => {
    const session = mkSession(offsetMinutes);
    return { ...session, answers: [{ ...session.answers[0], given: 55 }] };
  };

  test('is empty for a profile with no history', () => {
    expect(loadPairStats('default')).toEqual({});
  });

  test('counts tests and training together', () => {
    recordSession('default', mkSession(0));
    recordTrainingSession('default', missed(1));
    const stats = loadPairStats('default')['7x8'];
    expect(stats.attempts).toBe(2);
    expect(stats.errors).toBe(1);
  });

  test('decays across both histories in the order they were played', () => {
    // The training miss came first, so it weighs less than the test success.
    recordTrainingSession('default', missed(0));
    recordSession('default', mkSession(1));
    const { weightedAttempts, weightedFailures } = loadPairStats('default')['7x8'];
    expect(weightedFailures).toBeLessThan(weightedAttempts / 2);
  });

  test('ignores paper sessions already in storage (#44)', () => {
    // Self-marked against a visible answer key: saved by versions before #44.
    const paper: SessionResult = {
      ...mkSession(1),
      answerMode: 'paper',
      answers: [{ ...mkSession(1).answers[0], given: null, selfMarkedCorrect: true }],
    };
    recordSession('default', missed(0));
    recordSession('default', paper);
    const stats = loadPairStats('default')['7x8'];
    expect(stats.attempts).toBe(1);
    // Not aged by the paper session either: the miss is still the latest entry.
    expect(stats.weightedFailures).toBe(stats.weightedAttempts);
  });

  test('reads only the profile it is given', () => {
    recordSession('other', missed(0));
    expect(loadPairStats('default')).toEqual({});
  });
});

describe('export / import', () => {
  it('exportProfile captures settings, both histories and the error stats', () => {
    saveSettings('default', { ...DEFAULT_SETTINGS, questionCount: 11 });
    recordSession('default', mkSession(1));
    recordTrainingSession('default', { ...mkSession(2), answerMode: 'training' });

    const backup = exportProfile('default', '0.10.0', '', new Date('2026-09-05T10:11:12.000Z'));

    expect(backup.appVersion).toBe('0.10.0');
    expect(backup.exportedAt).toBe('2026-09-05T10:11:12.000Z');
    expect(backup.profile).toBe('default');
    expect(backup.data.settings.questionCount).toBe(11);
    expect(backup.data.history).toHaveLength(1);
    expect(backup.data.trainingHistory).toHaveLength(1);
  });

  it('exportProfile never emits the deprecated errors section', () => {
    localStorage.setItem(
      LEGACY_ERRORS_KEY,
      JSON.stringify({ '7x8': { attempts: 9, errors: 3, timeouts: 1 } }),
    );
    recordSession('default', mkSession(1));
    expect(exportProfile('default', '0.11.0').data).not.toHaveProperty('errors');
  });

  it('exportProfile on a fresh profile yields defaults and empty collections', () => {
    const backup = exportProfile('default', '0.10.0');
    expect(backup.data.settings).toEqual(DEFAULT_SETTINGS);
    expect(backup.data.history).toEqual([]);
    expect(backup.data.trainingHistory).toEqual([]);
  });

  it('importProfile replaces every section, it does not merge', () => {
    saveSettings('default', { ...DEFAULT_SETTINGS, questionCount: 11 });
    recordSession('default', mkSession(1));
    recordTrainingSession('default', { ...mkSession(2), answerMode: 'training' });

    const incoming = exportProfile('default', '0.10.0');
    incoming.data.settings = { ...DEFAULT_SETTINGS, questionCount: 33 };
    incoming.data.history = [mkSession(9)];
    incoming.data.trainingHistory = [];

    importProfile('default', incoming);

    expect(loadSettings('default').questionCount).toBe(33);
    expect(loadHistory('default')).toEqual([mkSession(9)]);
    expect(loadTrainingHistory('default')).toEqual([]);
  });

  it('round-trips: export, wipe, import, and the profile is back', () => {
    saveSettings('default', { ...DEFAULT_SETTINGS, questionCount: 11 });
    recordSession('default', mkSession(1));
    const backup = exportProfile('default', '0.10.0');

    clearAll('default');
    saveSettings('default', DEFAULT_SETTINGS);
    importProfile('default', backup);

    expect(loadSettings('default').questionCount).toBe(11);
    expect(loadHistory('default')).toEqual([mkSession(1)]);
  });

  it('trims an oversized incoming history to HISTORY_LIMIT, keeping the newest', () => {
    const backup = exportProfile('default', '0.10.0');
    backup.data.history = Array.from({ length: HISTORY_LIMIT + 5 }, (_, i) => mkSession(i));
    backup.data.trainingHistory = Array.from({ length: HISTORY_LIMIT + 5 }, (_, i) => mkSession(i));

    importProfile('default', backup);

    const history = loadHistory('default');
    expect(history).toHaveLength(HISTORY_LIMIT);
    expect(history[0].startedAt).toBe(mkSession(5).startedAt);
    expect(loadTrainingHistory('default')).toHaveLength(HISTORY_LIMIT);
  });
});

describe('two profiles', () => {
  it('keep their settings and their histories entirely apart', () => {
    saveSettings('default', { ...DEFAULT_SETTINGS, questionCount: 11 });
    saveSettings('p2', { ...DEFAULT_SETTINGS, questionCount: 33 });
    recordSession('default', mkSession(1));
    recordTrainingSession('p2', { ...mkSession(2), answerMode: 'training' });

    expect(loadSettings('default').questionCount).toBe(11);
    expect(loadSettings('p2').questionCount).toBe(33);
    expect(loadHistory('default')).toHaveLength(1);
    expect(loadHistory('p2')).toHaveLength(0);
    expect(loadTrainingHistory('default')).toHaveLength(0);
    expect(loadTrainingHistory('p2')).toHaveLength(1);
  });

  it('use distinct storage keys, so nothing can collide', () => {
    expect(storageKeys('p2').history).toBe('mathquizz:profile:p2:history');
    expect(storageKeys('p2').history).not.toBe(storageKeys('default').history);
  });

  it('clearing one leaves the other alone', () => {
    recordSession('default', mkSession(1));
    recordSession('p2', mkSession(2));
    clearAll('p2');
    expect(loadHistory('default')).toHaveLength(1);
    expect(loadHistory('p2')).toHaveLength(0);
  });
});

describe('purgeProfile', () => {
  it('removes the settings too — clearAll deliberately keeps them', () => {
    saveSettings('p2', { ...DEFAULT_SETTINGS, questionCount: 33 });
    recordSession('p2', mkSession(1));

    clearAll('p2');
    expect(localStorage.getItem(storageKeys('p2').settings)).not.toBeNull();

    purgeProfile('p2');
    expect(localStorage.getItem(storageKeys('p2').settings)).toBeNull();
    expect(localStorage.getItem(storageKeys('p2').history)).toBeNull();
    expect(localStorage.getItem(storageKeys('p2').trainingHistory)).toBeNull();
  });

  it('touches no other profile', () => {
    saveSettings('default', { ...DEFAULT_SETTINGS, questionCount: 11 });
    recordSession('default', mkSession(1));
    purgeProfile('p2');
    expect(loadSettings('default').questionCount).toBe(11);
    expect(loadHistory('default')).toHaveLength(1);
  });
});

describe('exportProfile / importProfile across profiles', () => {
  it('carries the profile id and name in the envelope', () => {
    const backup = exportProfile('p2', '0.12.0', 'Tom');
    expect(backup.profile).toBe('p2');
    expect(backup.profileName).toBe('Tom');
  });

  it('writes into the destination it is given, never the one named in the file', () => {
    saveSettings('p2', { ...DEFAULT_SETTINGS, questionCount: 33 });
    recordSession('p2', mkSession(1));
    const fromTom = exportProfile('p2', '0.12.0', 'Tom');

    importProfile('default', fromTom);

    expect(loadSettings('default').questionCount).toBe(33);
    expect(loadHistory('default')).toHaveLength(1);
  });
});
