import { describe, expect, test } from 'vitest';
import {
  generateQuestions,
  formatOperation,
  adaptiveAlpha,
  ADAPTIVE_ALPHA,
  UNPRACTISED_RATE,
  UNPRACTISED_PRIOR_ATTEMPTS,
  drawRate,
} from '../domain/question';
import { MULTIPLICANDS, MULTIPLIERS } from '../domain/tables';
import type { Settings } from '../domain/session';
import type { PairCounterMap, PairCounters } from '../domain/stats';

const key = (a: number, b: number) => (a < b ? `${a}x${b}` : `${b}x${a}`);

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

  test.each(['mul', 'div', 'mix'] as const)(
    'mode "%s": asking for the whole pool over several tables yields every fact exactly once',
    (mode) => {
      // 2, 7 and 12 are both tables and multipliers, so 2×7, 2×12 and 7×12
      // are one fact each, not two: 44 ordered entries, 41 facts.
      const selectedTables = [2, 7, 12, 25];
      const facts = new Set(
        selectedTables.flatMap((a) => MULTIPLIERS.map((b) => key(a, b))),
      );
      expect(facts.size).toBe(41);
      const questions = generateQuestions(
        baseSettings({ selectedTables, mode, questionCount: facts.size }),
      );
      const drawn = questions.map((q) => key(q.a, q.b)).sort();
      expect(drawn).toEqual([...facts].sort());
    },
  );

  test('a fact whose mirror is also selected comes up in both orientations', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      for (const q of generateQuestions(
        baseSettings({ selectedTables: [3, 4], questionCount: 21 }),
      )) {
        seen.add(`${q.a}×${q.b}`);
      }
    }
    expect(seen).toContain('3×4');
    expect(seen).toContain('4×3');
  });

  test('a commutative fact is drawn as often as a square', () => {
    // Tables 3 and 4: 21 facts. Before #41, 3×4 sat in the pool twice
    // (2/22) against 3×3 once (1/22).
    const settings = baseSettings({ selectedTables: [3, 4], questionCount: 1 });
    let commutative = 0;
    let square = 0;
    for (let i = 0; i < 6000; i++) {
      const [q] = generateQuestions(settings);
      if (key(q.a, q.b) === '3x4') commutative++;
      if (key(q.a, q.b) === '3x3') square++;
    }
    // Both expected about 286; the old pool gives about 545 against 273.
    expect(commutative / square).toBeLessThan(1.4);
  });

  test('all 14 tables make a pool of 99 facts, so a session only repeats past 99', () => {
    // Tables 2..12 against multipliers 2..12: 11 squares + 55 unordered pairs
    // = 66 facts. Tables 15, 24 and 25 are never multipliers, so each of their
    // 11 facts stands alone: 33 more. Before #41 the pool held 154 entries.
    const all = baseSettings({ selectedTables: [...MULTIPLICANDS], adaptiveDraw: 'off' });
    const keysOf = (qs: { a: number; b: number }[]) => new Set(qs.map((q) => key(q.a, q.b)));

    // Sampled without replacement while the pool covers the count: no repeat.
    expect(keysOf(generateQuestions({ ...all, questionCount: 99 })).size).toBe(99);
    // One past the pool: every fact once, then exactly one repeat.
    const hundred = generateQuestions({ ...all, questionCount: 100 });
    expect(hundred).toHaveLength(100);
    expect(keysOf(hundred).size).toBe(99);
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
  slow: 0,
  weightedAttempts: 5,
  weightedFailures: 0,
  ...overrides,
});

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
    // strong (α=5), with the prior: 7×8 rates 5.5/7 and weighs 4.93, the ten
    // mastered pairs rate 0.5/7 and weigh 1.36 → about 4.93/18.5 = 26.6%.
    const share = shareOf7x8(baseSettings({ adaptiveDraw: 'strong' }), shakyOn7x8());
    expect(share).toBeGreaterThan(0.22);
  });

  test('a stronger setting biases harder', () => {
    const stats = shakyOn7x8();
    const moderate = shareOf7x8(baseSettings({ adaptiveDraw: 'moderate' }), stats);
    const strong = shareOf7x8(baseSettings({ adaptiveDraw: 'strong' }), stats);
    // moderate (α=2): 2.57 against ten 1.14 → about 18%.
    expect(moderate).toBeGreaterThan(UNIFORM * 1.6);
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
    expect(share).toBeGreaterThan(0.22);
  });

  test('a pair never practised comes up more often than a mastered one', () => {
    // strong: 7×8 weighs 1 + 5 × 0.25 = 2.25 against ten 1.36 → about 14%.
    const share = shareOf7x8(baseSettings({ adaptiveDraw: 'strong' }), unseen7x8());
    expect(share).toBeGreaterThan(UNIFORM * 1.3);
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
    // 2.25 against 4.93: expected about 460 against 1020.
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
      baseSettings({ questionCount: 400, adaptiveDraw: 'strong' }),
      shakyOn7x8(),
    );
    expect(questions).toHaveLength(400);
    // 11 guaranteed once, 389 extras at ~26.6% → about 104; uniform gives ~36.
    expect(questions.filter(is7x8).length).toBeGreaterThan(70);
  });
});

describe('UNPRACTISED_RATE', () => {
  test('sits between a mastered pair and one missed half the time', () => {
    expect(UNPRACTISED_RATE).toBeGreaterThan(0);
    expect(UNPRACTISED_RATE).toBeLessThan(0.5);
  });
});

describe('drawRate — confidence builds gradually (#50)', () => {
  const seen = (weightedAttempts: number, weightedFailures: number) =>
    counters({ weightedAttempts, weightedFailures });

  test('a pair never practised gets UNPRACTISED_RATE', () => {
    expect(drawRate(undefined)).toBe(UNPRACTISED_RATE);
    expect(drawRate(seen(0, 0))).toBe(UNPRACTISED_RATE);
  });

  test('one correct answer leaves a pair above a mastered one', () => {
    const once = drawRate(seen(1, 0));
    expect(once).toBeLessThan(UNPRACTISED_RATE);
    expect(once).toBeGreaterThan(drawRate(seen(5, 0)));
    expect(once).toBeCloseTo((UNPRACTISED_RATE * UNPRACTISED_PRIOR_ATTEMPTS) / 3);
  });

  test('one wrong answer boosts a pair, but not to the ceiling', () => {
    const once = drawRate(seen(1, 1));
    expect(once).toBeGreaterThan(UNPRACTISED_RATE);
    expect(once).toBeLessThan(drawRate(seen(5, 5)));
  });

  test('with enough evidence the rate approaches the observed one', () => {
    expect(drawRate(seen(20, 0))).toBeLessThan(0.03);
    expect(drawRate(seen(20, 20))).toBeGreaterThan(0.9);
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
