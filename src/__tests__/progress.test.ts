import { describe, expect, test } from 'vitest';
import {
  isCorrect,
  sessionScores,
  trickiestPairs,
  errorGrid,
  completeTables,
  REVIEW_MIN_RATE,
  CONFIDENT_MIN_ATTEMPTS,
} from '../domain/progress';
import { aggregatePairs, canonicalKey, weightedErrorRate } from '../domain/stats';
import { rateBucket, cellBucket } from '../components/rateColor';
import { MULTIPLICANDS, MULTIPLIERS } from '../domain/tables';
import type { SessionResult, AnswerRecord } from '../domain/session';
import type { Question } from '../domain/question';

const mkQ = (a: number, b: number, op: 'mul' | 'div' = 'mul'): Question => ({
  a,
  b,
  op,
  expected: op === 'mul' ? a * b : b,
});

const rec = (
  question: Question,
  given: number | null,
  elapsedMs: number,
  selfMarkedCorrect?: boolean,
): AnswerRecord => ({
  question,
  given,
  elapsedMs,
  ...(selfMarkedCorrect !== undefined ? { selfMarkedCorrect } : {}),
});

const mkSession = (
  answers: AnswerRecord[],
  over: Partial<SessionResult> = {},
): SessionResult => ({
  startedAt: '2026-01-01T00:00:00.000Z',
  durationPerQuestionMs: 4000,
  partialCreditFactor: 0.5,
  questionCount: answers.length,
  selectedTables: [7],
  mode: 'mul',
  answers,
  ...over,
});

describe('isCorrect', () => {
  test('slow-but-correct still counts as correct', () => {
    expect(isCorrect(rec(mkQ(7, 8), 56, 9999))).toBe(true);
  });
  test('wrong answer is not correct', () => {
    expect(isCorrect(rec(mkQ(7, 8), 50, 1000))).toBe(false);
  });
  test('timeout (given null) is not correct', () => {
    expect(isCorrect(rec(mkQ(7, 8), null, 4000))).toBe(false);
  });
  test('paper self-marked overrides given value', () => {
    expect(isCorrect(rec(mkQ(7, 8), null, 0, true))).toBe(true);
    expect(isCorrect(rec(mkQ(7, 8), 56, 0, false))).toBe(false);
  });
});

describe('sessionScores', () => {
  test('correctRatio counts slow-correct; creditRatio applies partial credit', () => {
    const s = mkSession([
      rec(mkQ(2, 3), 6, 1000), // fast correct -> 1 pt
      rec(mkQ(2, 4), 8, 5000), // slow correct -> 0.5 pt
      rec(mkQ(2, 5), 9, 1000), // wrong -> 0 pt
    ]);
    const [p] = sessionScores([s]);
    expect(p.total).toBe(3);
    expect(p.correctRatio).toBeCloseTo(2 / 3);
    expect(p.creditRatio).toBeCloseTo(1.5 / 3);
    expect(p.startedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  test('uses each session own partialCreditFactor', () => {
    const s = mkSession([rec(mkQ(2, 4), 8, 5000)], {
      partialCreditFactor: 0.25,
    });
    const [p] = sessionScores([s]);
    expect(p.correctRatio).toBe(1);
    expect(p.creditRatio).toBeCloseTo(0.25);
  });

  test('preserves order and guards empty answers', () => {
    const a = mkSession([rec(mkQ(2, 3), 6, 1000)], { startedAt: 'A' });
    const b = mkSession([], { startedAt: 'B' });
    const pts = sessionScores([a, b]);
    expect(pts.map((p) => p.startedAt)).toEqual(['A', 'B']);
    expect(pts[1]).toMatchObject({ total: 0, correctRatio: 0, creditRatio: 0 });
  });
});

describe('trickiestPairs', () => {
  const history = [
    mkSession([
      // 7x8: 5 attempts, 3 misses (merges 7x8 and 8x7) -> rate 0.6
      rec(mkQ(7, 8), 56, 1000),
      rec(mkQ(7, 8), 50, 1000),
      rec(mkQ(7, 8), 51, 1000),
      rec(mkQ(8, 7), 56, 1000),
      rec(mkQ(8, 7), 50, 1000),
      // 2x3: 4 attempts, 1 miss -> rate 0.25
      rec(mkQ(2, 3), 6, 1000),
      rec(mkQ(2, 3), 6, 1000),
      rec(mkQ(2, 3), 6, 1000),
      rec(mkQ(2, 3), 5, 1000),
      // 6x9: 2 attempts, 2 misses -> rate 1.0 but below default threshold
      rec(mkQ(6, 9), 50, 1000),
      rec(mkQ(6, 9), 51, 1000),
    ]),
  ];

  test('ranks by error rate, excludes pairs below minAttempts (default 3)', () => {
    const top = trickiestPairs(history);
    expect(top).toHaveLength(2);
    expect(top[0]).toMatchObject({ a: 7, b: 8, attempts: 5, errors: 3 });
    expect(top[0].errorRate).toBeCloseTo(0.6);
    expect(top[1]).toMatchObject({ a: 2, b: 3, attempts: 4 });
    expect(top[1].errorRate).toBeCloseTo(0.25);
  });

  test('minAttempts and limit are configurable', () => {
    const top = trickiestPairs(history, { minAttempts: 1, limit: 1 });
    expect(top).toHaveLength(1);
    expect(top[0]).toMatchObject({ a: 6, b: 9 });
    expect(top[0].errorRate).toBeCloseTo(1);
  });

  test('timeouts count toward the error rate', () => {
    const h = [
      mkSession([
        rec(mkQ(3, 4), 12, 1000),
        rec(mkQ(3, 4), 12, 1000),
        rec(mkQ(3, 4), null, 4000), // timeout
      ]),
    ];
    const [p] = trickiestPairs(h, { minAttempts: 3 });
    expect(p).toMatchObject({ a: 3, b: 4, attempts: 3, timeouts: 1 });
    expect(p.errorRate).toBeCloseTo(1 / 3);
  });

  test('excludes mastered pairs (no misses) even past the attempts threshold', () => {
    const h = [
      mkSession([
        rec(mkQ(5, 5), 25, 1000),
        rec(mkQ(5, 5), 25, 1000),
        rec(mkQ(5, 5), 25, 1000),
      ]),
    ];
    expect(trickiestPairs(h)).toHaveLength(0);
  });
});

describe('trickiestPairs — recency', () => {
  const wrong = (a: number, b: number) => mkSession([rec(mkQ(a, b), 0, 1000)]);
  const right = (a: number, b: number) => mkSession([rec(mkQ(a, b), a * b, 1000)]);
  const idle = () => mkSession([]);

  test('a pair the child has since fixed ranks below one failing now', () => {
    // Identical raw records: 3 misses and 3 hits each, opposite order in time.
    const history = [
      wrong(2, 3), wrong(2, 3), wrong(2, 3),
      right(7, 8), right(7, 8), right(7, 8),
      ...Array.from({ length: 20 }, idle),
      right(2, 3), right(2, 3), right(2, 3),
      wrong(7, 8), wrong(7, 8), wrong(7, 8),
    ];
    const top = trickiestPairs(history);

    // Raw counts are identical, so unweighted ranking could not separate these.
    expect(top.map((p) => `${p.a}x${p.b}`)).toEqual(['7x8', '2x3']);
    expect(top[0]).toMatchObject({ attempts: 6, errors: 3 });
    expect(top[1]).toMatchObject({ attempts: 6, errors: 3 });
    expect(top[0].errorRate).toBeGreaterThan(top[1].errorRate * 4);
  });

  test('the displayed counts stay raw even though the ranking is weighted', () => {
    const history = [wrong(3, 4), ...Array.from({ length: 10 }, idle), right(3, 4), right(3, 4)];
    const [pair] = trickiestPairs(history, { minAttempts: 3 });
    // 1 miss out of 3 raw, but the miss is 12 sessions old: discounted, yet
    // still recent enough to clear the review cut-off.
    expect(pair).toMatchObject({ attempts: 3, errors: 1 });
    expect(pair.errorRate).toBeLessThan(1 / 3);
    expect(pair.errorRate).toBeGreaterThanOrEqual(REVIEW_MIN_RATE);
  });

  test('an all-correct pair is still excluded, however recent', () => {
    expect(trickiestPairs([right(5, 5), right(5, 5), right(5, 5)])).toHaveLength(0);
  });
});

describe('trickiestPairs — review cut-off', () => {
  const wrong = (a: number, b: number) => mkSession([rec(mkQ(a, b), 0, 1000)]);
  const right = (a: number, b: number) => mkSession([rec(mkQ(a, b), a * b, 1000)]);
  const idle = () => mkSession([]);
  const rateOf = (history: SessionResult[], a: number, b: number) =>
    weightedErrorRate(aggregatePairs(history)[canonicalKey(a, b)]) ?? 0;

  test('one old miss followed by twenty hits drops the pair from the list (#43)', () => {
    const history = [
      wrong(2, 5),
      ...Array.from({ length: 19 }, idle),
      ...Array.from({ length: 20 }, () => right(2, 5)),
    ];
    // The weighted rate never reaches zero, which is what kept the pair listed.
    expect(rateOf(history, 2, 5)).toBeGreaterThan(0);
    expect(rateOf(history, 2, 5)).toBeLessThan(REVIEW_MIN_RATE);
    expect(trickiestPairs(history)).toEqual([]);
  });

  test('a pair that is still shaky stays listed next to one that has recovered', () => {
    const history = [
      wrong(2, 5),
      ...Array.from({ length: 20 }, () => right(2, 5)),
      mkSession([
        rec(mkQ(7, 8), 50, 1000),
        rec(mkQ(7, 8), 51, 1000),
        rec(mkQ(7, 8), 52, 1000),
        rec(mkQ(7, 8), 56, 1000),
        rec(mkQ(7, 8), 56, 1000),
        rec(mkQ(7, 8), 56, 1000),
      ]),
    ];
    expect(trickiestPairs(history).map((p) => `${p.a}x${p.b}`)).toEqual(['7x8']);
  });

  test('the cut-off applies to the weighted rate, on both sides of it', () => {
    // Same raw record for both pairs: 1 miss, then 3 hits. Only the gap
    // between the miss and the hits differs, so raw counts cannot decide.
    const recent = [wrong(3, 4), right(3, 4), right(3, 4), right(3, 4)];
    const stale = [
      wrong(3, 4),
      ...Array.from({ length: 30 }, idle),
      right(3, 4), right(3, 4), right(3, 4),
    ];
    expect(rateOf(recent, 3, 4)).toBeGreaterThanOrEqual(REVIEW_MIN_RATE);
    expect(rateOf(stale, 3, 4)).toBeLessThan(REVIEW_MIN_RATE);

    expect(trickiestPairs(recent)).toHaveLength(1);
    expect(trickiestPairs(stale)).toHaveLength(0);
  });

  test('the list and the heat-map colour share the cut-off', () => {
    expect(rateBucket(REVIEW_MIN_RATE)).not.toBe('0');
    expect(rateBucket(REVIEW_MIN_RATE - 1e-9)).toBe('0');
  });
});

describe('trickiestPairs — slowness (#47)', () => {
  test('a pair answered right but always slowly is listed, with its slow count', () => {
    // 7x8: right every time, always past the 4 s target -> weighted rate 0.5.
    const history = [
      mkSession([
        rec(mkQ(7, 8), 56, 9000),
        rec(mkQ(7, 8), 56, 9000),
        rec(mkQ(8, 7), 56, 9000),
        rec(mkQ(5, 5), 25, 1000),
        rec(mkQ(5, 5), 25, 1000),
        rec(mkQ(5, 5), 25, 1000),
      ]),
    ];
    const top = trickiestPairs(history);
    expect(top).toHaveLength(1);
    expect(top[0]).toMatchObject({ a: 7, b: 8, attempts: 3, errors: 0, timeouts: 0, slow: 3 });
    expect(top[0].errorRate).toBeCloseTo(0.5);
  });

  test('a miss still ranks above the same number of slow answers', () => {
    const history = [
      mkSession([
        rec(mkQ(7, 8), 56, 9000),
        rec(mkQ(7, 8), 56, 1000),
        rec(mkQ(7, 8), 56, 1000),
        rec(mkQ(6, 9), 50, 1000),
        rec(mkQ(6, 9), 54, 1000),
        rec(mkQ(6, 9), 54, 1000),
      ]),
    ];
    expect(trickiestPairs(history).map((p) => `${p.a}x${p.b}`)).toEqual(['6x9', '7x8']);
  });
});

describe('errorGrid', () => {
  const history = [
    mkSession([
      rec(mkQ(7, 8), 50, 1000),
      rec(mkQ(7, 8), 51, 1000),
      rec(mkQ(8, 7), 56, 1000),
    ]),
  ];

  test('has MULTIPLICANDS rows x MULTIPLIERS cols', () => {
    const grid = errorGrid(history);
    expect(grid).toHaveLength(MULTIPLICANDS.length);
    expect(grid[0]).toHaveLength(MULTIPLIERS.length);
  });

  test('computes rate and is symmetric via canonical key', () => {
    const grid = errorGrid(history);
    const r7 = MULTIPLICANDS.indexOf(7);
    const c8 = MULTIPLIERS.indexOf(8);
    const r8 = MULTIPLICANDS.indexOf(8);
    const c7 = MULTIPLIERS.indexOf(7);
    expect(grid[r7][c8].errorRate).toBeCloseTo(2 / 3);
    expect(grid[r8][c7].errorRate).toBeCloseTo(2 / 3);
  });

  test('carries the raw failure count next to the weighted rate', () => {
    const grid = errorGrid(history);
    const cell = grid[MULTIPLICANDS.indexOf(7)][MULTIPLIERS.indexOf(8)];
    expect(cell.attempts).toBe(3);
    expect(cell.failures).toBe(2);
  });

  test('carries the raw slow count, and slowness colours the cell', () => {
    const grid = errorGrid([mkSession([rec(mkQ(7, 8), 56, 9000), rec(mkQ(7, 8), 56, 1000)])]);
    const cell = grid[MULTIPLICANDS.indexOf(7)][MULTIPLIERS.indexOf(8)];
    expect(cell).toMatchObject({ attempts: 2, failures: 0, slow: 1 });
    expect(cell.errorRate).toBeCloseTo(0.25);
  });

  test('never-practised cell has null errorRate', () => {
    const grid = errorGrid(history);
    const r15 = MULTIPLICANDS.indexOf(15);
    const c11 = MULTIPLIERS.indexOf(11);
    expect(grid[r15][c11].errorRate).toBeNull();
    expect(grid[r15][c11].attempts).toBe(0);
    expect(grid[r15][c11].failures).toBe(0);
    expect(grid[r15][c11].slow).toBe(0);
  });
});

describe('errorGrid — confidence', () => {
  const cellOf = (grid: ReturnType<typeof errorGrid>, a: number, b: number) =>
    grid[MULTIPLICANDS.indexOf(a as never)][MULTIPLIERS.indexOf(b as never)];

  test('shares its attempt threshold with the review list', () => {
    const answers = Array.from({ length: CONFIDENT_MIN_ATTEMPTS }, () => rec(mkQ(7, 8), 50, 1000));
    const history = [mkSession(answers)];
    expect(trickiestPairs(history).map((p) => `${p.a}x${p.b}`)).toEqual(['7x8']);
    expect(cellOf(errorGrid(history), 7, 8).confident).toBe(true);

    const fewer = [mkSession(answers.slice(1))];
    expect(trickiestPairs(fewer)).toEqual([]);
    expect(cellOf(errorGrid(fewer), 7, 8).confident).toBe(false);
  });

  test('one lucky answer is not confident, and is not painted green', () => {
    const cell = cellOf(errorGrid([mkSession([rec(mkQ(7, 8), 56, 1000)])]), 7, 8);
    expect(cell).toMatchObject({ attempts: 1, errorRate: 0, confident: false });
    expect(cellBucket(cell)).toBe('unsure');
  });

  test('an unconfident miss is unsure too, as it is absent from the review list', () => {
    const cell = cellOf(errorGrid([mkSession([rec(mkQ(7, 8), 50, 1000)])]), 7, 8);
    expect(cellBucket(cell)).toBe('unsure');
  });

  test('a confident cell takes its rate colour, a never-played one stays nodata', () => {
    const grid = errorGrid([
      mkSession([rec(mkQ(7, 8), 56, 1000), rec(mkQ(7, 8), 56, 1000), rec(mkQ(8, 7), 56, 1000)]),
    ]);
    expect(cellBucket(cellOf(grid, 7, 8))).toBe(rateBucket(0));
    expect(cellBucket(cellOf(grid, 15, 11))).toBe('nodata');
  });
});

describe('completeTables', () => {
  /** Every pair of table `a`, answered correctly and fast `times` times. */
  const tableAnswers = (a: number, times = CONFIDENT_MIN_ATTEMPTS): AnswerRecord[] =>
    MULTIPLIERS.flatMap((b) =>
      Array.from({ length: times }, () => rec(mkQ(a, b), a * b, 1000)),
    );

  test('lists a table whose every pair is confidently mastered', () => {
    expect(completeTables(errorGrid([mkSession(tableAnswers(7))]))).toEqual([7]);
  });

  test('one pair short of the attempt threshold keeps the star away', () => {
    const answers = tableAnswers(7).slice(1); // 7×2 answered one time fewer
    expect(completeTables(errorGrid([mkSession(answers)]))).toEqual([]);
  });

  test('one pair still to review keeps the star away', () => {
    const answers = [...tableAnswers(7), rec(mkQ(7, 8), 50, 1000)];
    expect(completeTables(errorGrid([mkSession(answers)]))).toEqual([]);
  });

  test('slowness counts: an always-slow pair keeps the star away (#47)', () => {
    const answers = tableAnswers(7).map((r) =>
      r.question.b === 8 ? { ...r, elapsedMs: 9000 } : r,
    );
    expect(completeTables(errorGrid([mkSession(answers)]))).toEqual([]);
  });

  test('pairs shared with another table count for both', () => {
    // Every 2..12 table crossed with 7 is covered once table 7 is: 7×8 is also 8×7.
    const grid = errorGrid([mkSession(tableAnswers(7))]);
    expect(cellBucket(grid[MULTIPLICANDS.indexOf(8)][MULTIPLIERS.indexOf(7)])).toBe('0');
    expect(completeTables(grid)).not.toContain(8);
  });

  test('a new miss removes the star; time passing without one does not', () => {
    const mastered = mkSession(tableAnswers(7));
    const unrelated = Array.from({ length: 30 }, (_, i) =>
      mkSession([rec(mkQ(3, 4), 12, 1000)], {
        startedAt: `2026-02-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
      }),
    );
    expect(completeTables(errorGrid([mastered, ...unrelated]))).toEqual([7]);
    const slip = mkSession([rec(mkQ(7, 8), 50, 1000)], { startedAt: '2026-03-01T00:00:00.000Z' });
    expect(completeTables(errorGrid([mastered, ...unrelated, slip]))).toEqual([]);
  });
});
