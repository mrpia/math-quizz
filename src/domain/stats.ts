/**
 * Per-pair practice statistics, weighted so that recent work counts for more.
 *
 * Every attempt is filed under a canonical key, so 7×8, 8×7 and 56÷7 all feed
 * one counter — the child knows a *pair*, not a direction.
 *
 * Each counter carries two views of the same data:
 * - **raw** (`attempts` / `errors` / `timeouts` / `slow`) — honest lifetime-of-history
 *   counts. Used for confidence ("have we seen this pair enough to judge?")
 *   and for anything shown as a number.
 * - **weighted** (`weightedAttempts` / `weightedFailures`) — the same events
 *   with older sessions discounted. Used for ranking and colour, so a pair the
 *   child has since mastered stops being flagged instead of carrying its old
 *   failures forever.
 *
 * A failure is the credit the answer did not earn, `1 - pointsFor(...)`, under
 * the session's own target and partial-credit factor: a miss or a timeout is a
 * whole failure, a correct answer past the target is `1 - partialCreditFactor`
 * of one (#47). So the statistics apply the rule the score applies — a pair the
 * results screen flags 🟡 does not show as mastered here.
 *
 * Decay is measured in *sessions*, not wall-clock time: it stays deterministic,
 * is testable without mocking a clock, and never blanks the progress screen
 * after a school holiday the way elapsed-time decay would.
 */
import type { SessionResult } from './session';
import { outcomeOf, pointsFor } from './scoring';

/**
 * Sessions after which an attempt carries half the weight of one from the
 * newest session. Bounded from above by the stored history: past roughly five
 * half-lives the cap would truncate weight the statistic still wants, so
 * `HISTORY_LIMIT >= 5 * RECENCY_HALF_LIFE_SESSIONS` — asserted in
 * `src/__tests__/stats.test.ts`. At 10, the newest 50 sessions carry >96% of
 * all weight, so the cap costs nothing.
 */
export const RECENCY_HALF_LIFE_SESSIONS = 10;

/** Weight of a session `sessionsAgo` entries behind the newest (0 = newest). */
export const recencyWeight = (sessionsAgo: number): number =>
  Math.pow(0.5, sessionsAgo / RECENCY_HALF_LIFE_SESSIONS);

export type PairCounters = {
  attempts: number;
  errors: number;
  timeouts: number;
  /** Correct, but past the session's target — what the results screen marks 🟡. */
  slow: number;
  weightedAttempts: number;
  weightedFailures: number;
};

export type PairCounterMap = Record<string, PairCounters>;

export const canonicalKey = (a: number, b: number): string => {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return `${lo}x${hi}`;
};

const EMPTY: PairCounters = {
  attempts: 0,
  errors: 0,
  timeouts: 0,
  slow: 0,
  weightedAttempts: 0,
  weightedFailures: 0,
};

/**
 * Folds a history (oldest first, as stored) into per-pair counters.
 * One pass: raw and weighted totals are accumulated together.
 */
export const aggregatePairs = (history: SessionResult[]): PairCounterMap => {
  const stats: PairCounterMap = {};
  history.forEach((session, index) => {
    const weight = recencyWeight(history.length - 1 - index);
    for (const record of session.answers) {
      const key = canonicalKey(record.question.a, record.question.b);
      const prev = stats[key] ?? EMPTY;
      // The verdict and the credit come from the same rule (`scoring.ts`),
      // so a 🟡 on the results screen is a `slow` here and nowhere a `correct`.
      const outcome = outcomeOf(record, session.durationPerQuestionMs);
      const failure = 1 - pointsFor(record, session);
      stats[key] = {
        attempts: prev.attempts + 1,
        errors: prev.errors + (outcome === 'wrong' ? 1 : 0),
        timeouts: prev.timeouts + (outcome === 'timeout' ? 1 : 0),
        slow: prev.slow + (outcome === 'slow' ? 1 : 0),
        weightedAttempts: prev.weightedAttempts + weight,
        weightedFailures: prev.weightedFailures + failure * weight,
      };
    }
  });
  return stats;
};

/**
 * Share of recent credit the pair lost, 0..1 — misses count whole, slow answers
 * in part. `null` when the pair has never been practised.
 */
export const weightedErrorRate = (counters: PairCounters): number | null =>
  counters.weightedAttempts === 0
    ? null
    : counters.weightedFailures / counters.weightedAttempts;

/**
 * Several histories folded into one, oldest first, so `aggregatePairs` can
 * decay them as a single sequence. Sessions are ordered by `startedAt` (ISO
 * strings, so they sort as text); ties keep their stored order.
 */
export const chronological = (...histories: SessionResult[][]): SessionResult[] =>
  histories
    .flat()
    .sort((x, y) => (x.startedAt < y.startedAt ? -1 : x.startedAt > y.startedAt ? 1 : 0));

/**
 * The sessions statistics are built from. Paper tests are left out (#44): the
 * app never sees the sheet, and the child marks it against an answer key shown
 * on screen, so a paper ✅ is a claim, not a measurement. Current versions no
 * longer save them; this drops the ones older versions did, without deleting
 * anything from storage or from an export.
 */
export const trackedSessions = (history: SessionResult[]): SessionResult[] =>
  history.filter((session) => session.answerMode !== 'paper');
