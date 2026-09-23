import { describe, expect, test } from 'vitest';
import {
  canonicalKey,
  aggregatePairs,
  recencyWeight,
  weightedErrorRate,
  RECENCY_HALF_LIFE_SESSIONS,
  chronological,
} from '../domain/stats';
import { HISTORY_LIMIT } from '../storage/profileStore';
import type { SessionResult } from '../domain/session';
import type { Question } from '../domain/question';

const mkSession = (answers: SessionResult['answers']): SessionResult => ({
  startedAt: new Date('2026-05-09T08:00:00Z').toISOString(),
  durationPerQuestionMs: 4000,
  partialCreditFactor: 0.5,
  questionCount: answers.length,
  selectedTables: [7, 8],
  mode: 'mul',
  answers,
});

const mkQ = (a: number, b: number, op: 'mul' | 'div' = 'mul'): Question => ({
  a,
  b,
  op,
  expected: op === 'mul' ? a * b : b,
});

/** History is stored oldest-first: later entries are more recent. */
const empties = (count: number): SessionResult[] =>
  Array.from({ length: count }, () => mkSession([]));

describe('canonicalKey', () => {
  test('same key for (a,b) and (b,a)', () => {
    expect(canonicalKey(7, 8)).toBe(canonicalKey(8, 7));
  });

  test('format is "${min}x${max}"', () => {
    expect(canonicalKey(8, 7)).toBe('7x8');
    expect(canonicalKey(11, 3)).toBe('3x11');
  });

  test('reflexive case', () => {
    expect(canonicalKey(6, 6)).toBe('6x6');
  });
});

describe('recencyWeight', () => {
  test('the newest session carries full weight', () => {
    expect(recencyWeight(0)).toBe(1);
  });

  test('one half-life back is worth half a session', () => {
    expect(recencyWeight(RECENCY_HALF_LIFE_SESSIONS)).toBeCloseTo(0.5);
    expect(recencyWeight(RECENCY_HALF_LIFE_SESSIONS * 2)).toBeCloseTo(0.25);
  });

  test('decays monotonically and never reaches zero', () => {
    for (let n = 1; n < 60; n++) {
      expect(recencyWeight(n)).toBeLessThan(recencyWeight(n - 1));
      expect(recencyWeight(n)).toBeGreaterThan(0);
    }
  });

  test('the stored history is long enough for the half-life to matter', () => {
    // Below ~5 half-lives the cap would truncate weight the statistic still
    // wants. At 5 half-lives the newest HISTORY_LIMIT sessions carry >96%.
    expect(HISTORY_LIMIT).toBeGreaterThanOrEqual(5 * RECENCY_HALF_LIFE_SESSIONS);
  });
});

describe('aggregatePairs — raw counting', () => {
  test('counts attempts, errors and timeouts per canonical key', () => {
    const stats = aggregatePairs([
      mkSession([
        { question: mkQ(7, 8), given: 56, elapsedMs: 1200 }, // correct
        { question: mkQ(8, 7), given: 54, elapsedMs: 1500 }, // wrong (same key)
        { question: mkQ(9, 6), given: null, elapsedMs: 4000 }, // timeout
        { question: mkQ(7, 8), given: 49, elapsedMs: 1800 }, // wrong
      ]),
    ]);
    expect(stats['7x8']).toMatchObject({ attempts: 3, errors: 2, timeouts: 0 });
    expect(stats['6x9']).toMatchObject({ attempts: 1, errors: 0, timeouts: 1 });
  });

  test('division aggregates under the same key as multiplication', () => {
    const stats = aggregatePairs([
      mkSession([
        { question: mkQ(7, 8, 'mul'), given: 56, elapsedMs: 1000 },
        { question: mkQ(7, 8, 'div'), given: 9, elapsedMs: 1000 }, // wrong, expected 8
      ]),
    ]);
    expect(stats['7x8'].attempts).toBe(2);
    expect(stats['7x8'].errors).toBe(1);
  });

  test('self-marked records count as attempts/errors, never timeouts', () => {
    const stats = aggregatePairs([
      mkSession([
        { question: mkQ(7, 8), given: null, elapsedMs: 0, selfMarkedCorrect: true },
        { question: mkQ(7, 8), given: null, elapsedMs: 0, selfMarkedCorrect: false },
      ]),
    ]);
    expect(stats['7x8']).toMatchObject({ attempts: 2, errors: 1, timeouts: 0 });
  });

  test('empty history aggregates to nothing', () => {
    expect(aggregatePairs([])).toEqual({});
  });
});

describe('aggregatePairs — recency weighting', () => {
  test('a single session weighs exactly its raw counts', () => {
    const stats = aggregatePairs([
      mkSession([
        { question: mkQ(7, 8), given: 56, elapsedMs: 1000 },
        { question: mkQ(7, 8), given: 50, elapsedMs: 1000 },
      ]),
    ]);
    expect(stats['7x8'].weightedAttempts).toBeCloseTo(2);
    expect(stats['7x8'].weightedFailures).toBeCloseTo(1);
    expect(weightedErrorRate(stats['7x8'])).toBeCloseTo(0.5);
  });

  test('a miss one half-life ago weighs half a miss today', () => {
    const miss = mkSession([{ question: mkQ(7, 8), given: 50, elapsedMs: 1000 }]);
    // Oldest first: the miss sits RECENCY_HALF_LIFE_SESSIONS entries back.
    const stats = aggregatePairs([miss, ...empties(RECENCY_HALF_LIFE_SESSIONS)]);
    expect(stats['7x8'].weightedFailures).toBeCloseTo(0.5);
    expect(stats['7x8'].weightedAttempts).toBeCloseTo(0.5);
    expect(stats['7x8'].attempts).toBe(1); // the raw count is untouched
  });

  test('a pair failed long ago but right lately scores below one failed lately', () => {
    const wrong = (a: number, b: number) =>
      mkSession([{ question: mkQ(a, b), given: 0, elapsedMs: 1000 }]);
    const right = (a: number, b: number) =>
      mkSession([{ question: mkQ(a, b), given: a * b, elapsedMs: 1000 }]);

    // 2x3 failed early then fixed; 7x8 was fine early and is failing now.
    const history = [
      wrong(2, 3), wrong(2, 3), wrong(2, 3),
      right(7, 8), right(7, 8), right(7, 8),
      ...empties(20),
      right(2, 3), right(2, 3), right(2, 3),
      wrong(7, 8), wrong(7, 8), wrong(7, 8),
    ];
    const stats = aggregatePairs(history);

    // Raw rates are identical — 3 misses out of 6 for both.
    expect(stats['2x3'].errors / stats['2x3'].attempts).toBeCloseTo(0.5);
    expect(stats['7x8'].errors / stats['7x8'].attempts).toBeCloseTo(0.5);

    // Weighted rates separate them: 0.858 vs 0.142, a 6x spread.
    const shakyNow = weightedErrorRate(stats['7x8'])!;
    const fixedLongAgo = weightedErrorRate(stats['2x3'])!;
    expect(shakyNow).toBeCloseTo(0.858, 2);
    expect(fixedLongAgo).toBeCloseTo(0.142, 2);
    expect(shakyNow).toBeGreaterThan(fixedLongAgo * 4);
  });

  test('weightedErrorRate is null for a pair with no attempts', () => {
    expect(
      weightedErrorRate({
        attempts: 0,
        errors: 0,
        timeouts: 0,
        weightedAttempts: 0,
        weightedFailures: 0,
      }),
    ).toBeNull();
  });

  test('timeouts count as failures, like wrong answers', () => {
    const stats = aggregatePairs([
      mkSession([
        { question: mkQ(3, 4), given: 12, elapsedMs: 1000 },
        { question: mkQ(3, 4), given: null, elapsedMs: 4000 },
      ]),
    ]);
    expect(stats['3x4'].weightedFailures).toBeCloseTo(1);
    expect(weightedErrorRate(stats['3x4'])).toBeCloseTo(0.5);
  });
});

describe('chronological', () => {
  const at = (iso: string, tag: number): SessionResult => ({
    ...mkSession([]),
    startedAt: iso,
    questionCount: tag,
  });

  test('interleaves several histories by startedAt, oldest first', () => {
    const tests = [at('2026-05-01T08:00:00Z', 1), at('2026-05-03T08:00:00Z', 3)];
    const training = [at('2026-05-02T08:00:00Z', 2), at('2026-05-04T08:00:00Z', 4)];
    expect(chronological(tests, training).map((s) => s.questionCount)).toEqual([
      1, 2, 3, 4,
    ]);
  });

  test('keeps the stored order for sessions that started at the same instant', () => {
    const same = '2026-05-01T08:00:00Z';
    expect(
      chronological([at(same, 1), at(same, 2)], [at(same, 3)]).map((s) => s.questionCount),
    ).toEqual([1, 2, 3]);
  });
});
