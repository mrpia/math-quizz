import { describe, expect, test } from 'vitest';
import {
  generateQuestions,
  formatOperation,
  adaptiveAlpha,
  ADAPTIVE_ALPHA,
  UNPRACTISED_RATE,
} from '../domain/question';
import { MULTIPLIERS } from '../domain/tables';
import type { Settings } from '../domain/session';
import type { PairCounterMap, PairCounters } from '../domain/stats';

const baseSettings = (overrides: Partial<Settings> = {}): Settings => ({
  durationPerQuestionMs: 4000,
  questionCount: 22,
  selectedTables: [7],
  mode: 'mul',
  partialCreditFactor: 0.5,
  language: 'fr',
  ...overrides,
});

describe('generateQuestions', () => {
  test('returns exactly questionCount questions', () => {
    const questions = generateQuestions(baseSettings({ questionCount: 22 }));
    expect(questions).toHaveLength(22);
  });

  test('all questions have a in selectedTables and b in MULTIPLIERS', () => {
    const settings = baseSettings({
      selectedTables: [7, 8],
      questionCount: 50,
    });
    const questions = generateQuestions(settings);
    for (const q of questions) {
      expect(settings.selectedTables).toContain(q.a);
      expect(MULTIPLIERS).toContain(q.b as (typeof MULTIPLIERS)[number]);
    }
  });

  test('mode "mul": every question is a multiplication with expected = a*b', () => {
    const questions = generateQuestions(
      baseSettings({ mode: 'mul', selectedTables: [7, 8], questionCount: 30 }),
    );
    for (const q of questions) {
      expect(q.op).toBe('mul');
      expect(q.expected).toBe(q.a * q.b);
    }
  });

  test('mode "div": every question is a division with expected = b', () => {
    const questions = generateQuestions(
      baseSettings({ mode: 'div', selectedTables: [7, 8], questionCount: 30 }),
    );
    for (const q of questions) {
      expect(q.op).toBe('div');
      expect(q.expected).toBe(q.b);
    }
  });

  test('mode "mix": both operators appear on a large sample', () => {
    const questions = generateQuestions(
      baseSettings({ mode: 'mix', selectedTables: [7, 8], questionCount: 200 }),
    );
    const ops = new Set(questions.map((q) => q.op));
    expect(ops.has('mul')).toBe(true);
    expect(ops.has('div')).toBe(true);
  });

  test('pool smaller than questionCount: returns questionCount questions with repetitions', () => {
    // 1 selected table * 11 multipliers = 11 distinct couples
    const questions = generateQuestions(
      baseSettings({ selectedTables: [7], questionCount: 30 }),
    );
    expect(questions).toHaveLength(30);
    // At least one duplicated (a,b,op) signature must exist
    const sigs = questions.map((q) => `${q.a}-${q.b}-${q.op}`);
    expect(new Set(sigs).size).toBeLessThan(sigs.length);
  });

  test('throws when selectedTables is empty', () => {
    expect(() =>
      generateQuestions(baseSettings({ selectedTables: [] })),
    ).toThrow();
  });

  test('throws when questionCount <= 0', () => {
    expect(() =>
      generateQuestions(baseSettings({ questionCount: 0 })),
    ).toThrow();
  });
});

const counters = (overrides: Partial<PairCounters> = {}): PairCounters => ({
  attempts: 10,
  errors: 0,
  timeouts: 0,
  weightedAttempts: 5,
  weightedFailures: 0,
  ...overrides,
});

const key = (a: number, b: number) => (a < b ? `${a}x${b}` : `${b}x${a}`);

/** Every a×b pair of one table practised and mastered. */
const mastered = (a: number): PairCounterMap => {
  const stats: PairCounterMap = {};
  for (const b of MULTIPLIERS) stats[key(a, b)] = counters();
  return stats;
};

/** Every 7×b pair practised and mastered, except 7×8 which always fails. */
const shakyOn7x8 = (): PairCounterMap => ({
  ...mastered(7),
  '7x8': counters({ errors: 10, weightedFailures: 5 }),
});

/** Every 7×b pair mastered, except 7×8 which was never practised. */
const unseen7x8 = (): PairCounterMap => {
  const stats = mastered(7);
  delete stats['7x8'];
  return stats;
};

const is7x8 = (q: { a: number; b: number }) =>
  (q.a === 7 && q.b === 8) || (q.a === 8 && q.b === 7);

/** Share of `runs` single-question draws that land on 7×8. */
const shareOf7x8 = (settings: Settings, stats?: PairCounterMap, runs = 4000) => {
  let hits = 0;
  for (let i = 0; i < runs; i++) {
    if (is7x8(generateQuestions({ ...settings, questionCount: 1 }, stats)[0])) hits++;
  }
  return hits / runs;
};

describe('generateQuestions — adaptive draw', () => {
  // 11 pairs in the 7 table: a uniform draw hits 7×8 about 9% of the time.
  const UNIFORM = 1 / MULTIPLIERS.length;

  test('draws a shaky pair more often than a uniform draw would', () => {
    // strong (α=5): 7×8 weighs 6, the ten others 1 → about 6/16 = 37.5%.
    const share = shareOf7x8(baseSettings({ adaptiveDraw: 'strong' }), shakyOn7x8());
    expect(share).toBeGreaterThan(0.28);
  });

  test('a stronger setting biases harder', () => {
    const stats = shakyOn7x8();
    const moderate = shareOf7x8(baseSettings({ adaptiveDraw: 'moderate' }), stats);
    const strong = shareOf7x8(baseSettings({ adaptiveDraw: 'strong' }), stats);
    expect(moderate).toBeGreaterThan(UNIFORM * 1.8);
    expect(strong).toBeGreaterThan(moderate);
  });

  test('"off" ignores the statistics', () => {
    const share = shareOf7x8(baseSettings({ adaptiveDraw: 'off' }), shakyOn7x8());
    expect(share).toBeLessThan(UNIFORM * 1.5);
  });

  test('no statistics: the draw stays uniform', () => {
    const share = shareOf7x8(baseSettings({ adaptiveDraw: 'strong' }));
    expect(share).toBeLessThan(UNIFORM * 1.5);
  });

  test('weights by the recency-weighted rate, never the raw error count', () => {
    // Lots of old failures, none recent: the child has fixed this pair.
    const stats = shakyOn7x8();
    stats['7x8'] = counters({ errors: 10, weightedFailures: 0 });
    const share = shareOf7x8(baseSettings({ adaptiveDraw: 'strong' }), stats);
    expect(share).toBeLessThan(UNIFORM * 1.5);
  });

  test('looks pairs up by canonical key, so 8×7 inherits 7×8', () => {
    const share = shareOf7x8(
      baseSettings({ selectedTables: [8], adaptiveDraw: 'strong' }),
      { ...mastered(8), '7x8': counters({ weightedFailures: 5 }) },
    );
    expect(share).toBeGreaterThan(0.28);
  });

  test('a pair never practised comes up more often than a mastered one', () => {
    // strong: 7×8 weighs 1 + 5 × 0.25 = 2.25 against ten 1s → about 18%.
    const share = shareOf7x8(baseSettings({ adaptiveDraw: 'strong' }), unseen7x8());
    expect(share).toBeGreaterThan(UNIFORM * 1.5);
  });

  test('...but less often than a pair the child keeps missing', () => {
    const stats = {
      ...unseen7x8(),
      '7x9': counters({ errors: 10, weightedFailures: 5 }),
    };
    const settings = baseSettings({ adaptiveDraw: 'strong', questionCount: 1 });
    let unseen = 0;
    let missed = 0;
    for (let i = 0; i < 4000; i++) {
      const [q] = generateQuestions(settings, stats);
      if (q.b === 8) unseen++;
      if (q.b === 9) missed++;
    }
    // Expected about 520 against 1390.
    expect(missed).toBeGreaterThan(unseen * 1.8);
  });

  test('"off" gives a pair never practised no boost either', () => {
    const share = shareOf7x8(baseSettings({ adaptiveDraw: 'off' }), unseen7x8());
    expect(share).toBeLessThan(UNIFORM * 1.5);
  });

  test('never repeats a pair while the pool is large enough', () => {
    for (let i = 0; i < 50; i++) {
      const questions = generateQuestions(
        baseSettings({ questionCount: MULTIPLIERS.length, adaptiveDraw: 'strong' }),
        shakyOn7x8(),
      );
      expect(new Set(questions.map((q) => q.b)).size).toBe(MULTIPLIERS.length);
    }
  });

  test('does not front-load the shaky pairs', () => {
    // Whole pool drawn: 7×8 must land anywhere, not mostly in first place.
    const runs = 3000;
    let first = 0;
    for (let i = 0; i < runs; i++) {
      const [q] = generateQuestions(
        baseSettings({ questionCount: MULTIPLIERS.length, adaptiveDraw: 'strong' }),
        shakyOn7x8(),
      );
      if (is7x8(q)) first++;
    }
    expect(first / runs).toBeLessThan(UNIFORM * 1.5);
  });

  test('repetitions beyond the pool are weighted too', () => {
    const questions = generateQuestions(
      baseSettings({ questionCount: 200, adaptiveDraw: 'strong' }),
      shakyOn7x8(),
    );
    expect(questions).toHaveLength(200);
    // 11 guaranteed once, 189 extras at ~37.5% → about 72; uniform gives ~18.
    expect(questions.filter(is7x8).length).toBeGreaterThan(40);
  });
});

describe('UNPRACTISED_RATE', () => {
  test('sits between a mastered pair and one missed half the time', () => {
    expect(UNPRACTISED_RATE).toBeGreaterThan(0);
    expect(UNPRACTISED_RATE).toBeLessThan(0.5);
  });
});

describe('adaptiveAlpha', () => {
  test('maps each setting to its strength', () => {
    expect(ADAPTIVE_ALPHA).toEqual({ off: 0, moderate: 2, strong: 5 });
    expect(adaptiveAlpha(baseSettings({ adaptiveDraw: 'strong' }))).toBe(5);
  });

  test('an absent setting reads as moderate', () => {
    expect(adaptiveAlpha(baseSettings())).toBe(ADAPTIVE_ALPHA.moderate);
  });
});

describe('formatOperation', () => {
  test('renders multiplication as "a × b"', () => {
    expect(formatOperation({ a: 7, b: 8, op: 'mul', expected: 56 })).toBe('7 × 8');
  });

  test('renders division as "(a*b) ÷ a"', () => {
    expect(formatOperation({ a: 7, b: 8, op: 'div', expected: 8 })).toBe('56 ÷ 7');
  });
});
