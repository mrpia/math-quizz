import { MULTIPLICANDS, MULTIPLIERS } from './tables';
import { aggregatePairs, canonicalKey, weightedErrorRate } from './stats';
import { totalScore } from './scoring';
import type { SessionResult, AnswerRecord } from './session';

export type SessionScorePoint = {
  startedAt: string;
  total: number;
  correctRatio: number;
  creditRatio: number;
};

export type PairStat = {
  a: number;
  b: number;
  /** Raw counts over the stored history — what the row displays as "2 / 5". */
  attempts: number;
  errors: number;
  timeouts: number;
  /** Recency-weighted failure share — what the row is ranked and coloured by. */
  errorRate: number;
};

export type GridCell = {
  a: number;
  b: number;
  /** Raw attempts; 0 means the pair has never come up. */
  attempts: number;
  /** Raw errors + timeouts — the number the tooltip shows, as in the list. */
  failures: number;
  /** Recency-weighted failure share, or null when never practised. */
  errorRate: number | null;
};

export type TrickiestOpts = { minAttempts?: number; limit?: number };

/**
 * Lowest weighted failure rate that still counts as "needs review". Recency
 * weights decay but never reach zero, so without a floor one miss, however
 * old, would keep a pair listed forever (#43). The heat-map uses the same
 * number as the edge of its "rare" colour, so a pair on the list is never
 * painted as fine.
 */
export const REVIEW_MIN_RATE = 0.08;

export const isCorrect = (record: AnswerRecord): boolean => {
  if (record.selfMarkedCorrect !== undefined) return record.selfMarkedCorrect;
  return record.given !== null && record.given === record.question.expected;
};

export const sessionScores = (
  history: SessionResult[],
): SessionScorePoint[] =>
  history.map((session) => {
    const total = session.answers.length;
    const correct = session.answers.filter(isCorrect).length;
    const { points, max } = totalScore(session.answers, {
      durationPerQuestionMs: session.durationPerQuestionMs,
      partialCreditFactor: session.partialCreditFactor,
    });
    return {
      startedAt: session.startedAt,
      total,
      correctRatio: total === 0 ? 0 : correct / total,
      creditRatio: max === 0 ? 0 : points / max,
    };
  });

/**
 * The pairs worth practising next. Confidence comes from the raw attempt count
 * (has this pair come up enough to judge?), ranking and the `REVIEW_MIN_RATE`
 * cut-off from the recency-weighted rate (is it still shaky, or was that
 * months ago?).
 */
export const trickiestPairs = (
  history: SessionResult[],
  opts: TrickiestOpts = {},
): PairStat[] => {
  const { minAttempts = 3, limit = 8 } = opts;
  return Object.entries(aggregatePairs(history))
    .map(([key, counters]) => {
      const [a, b] = key.split('x').map(Number);
      return {
        a,
        b,
        attempts: counters.attempts,
        errors: counters.errors,
        timeouts: counters.timeouts,
        errorRate: weightedErrorRate(counters) ?? 0,
      };
    })
    .filter((row) => row.attempts >= minAttempts && row.errorRate >= REVIEW_MIN_RATE)
    .sort(
      (x, y) =>
        y.errorRate - x.errorRate ||
        y.attempts - x.attempts ||
        x.a - y.a ||
        x.b - y.b,
    )
    .slice(0, limit);
};

export const errorGrid = (history: SessionResult[]): GridCell[][] => {
  const stats = aggregatePairs(history);
  return MULTIPLICANDS.map((a) =>
    MULTIPLIERS.map((b) => {
      const counters = stats[canonicalKey(a, b)];
      if (!counters || counters.attempts === 0) {
        return { a, b, attempts: 0, failures: 0, errorRate: null };
      }
      return {
        a,
        b,
        attempts: counters.attempts,
        failures: counters.errors + counters.timeouts,
        errorRate: weightedErrorRate(counters),
      };
    }),
  );
};
