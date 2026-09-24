/**
 * Merging an imported history into the one already on the device (#18).
 *
 * Every statistic is derived from the histories (there has been no separate
 * accumulator since 0.11.0), so merging the histories merges the statistics
 * too. Two things make it more than a concatenation:
 * - recency weights come from a session's *position*, so the result is sorted
 *   by `startedAt` before anything reads it;
 * - it is trimmed to the same cap as every other write, so a merge keeps the
 *   newest sessions overall and can push out older ones from either side. The
 *   counts returned here let the import dialog say so before anything is written.
 */
import type { SessionResult } from './session';
import { chronological } from './stats';

/** What the import dialog offers. Replace is a restore; merge keeps both sides. */
export type ImportMode = 'replace' | 'merge';

/**
 * What identifies a session across devices. The id when there is one; sessions
 * recorded before ids existed fall back to `startedAt` plus answer count, which
 * is unique only by luck but is all an old file carries.
 */
export const sessionKey = (session: SessionResult): string =>
  session.id ?? `${session.startedAt}#${session.answers.length}`;

export type MergeCounts = {
  /** Sessions from the file that were not here yet. */
  added: number;
  /** Sessions from the file this history already holds. */
  known: number;
  /** Sessions, from either side, that the cap leaves out of the result. */
  dropped: number;
};

export type HistoryMerge = MergeCounts & { merged: SessionResult[] };

/**
 * `local` wins on a shared key: the two copies should be identical, and
 * keeping the one already stored means a merge never rewrites what is here.
 * Duplicates *within* one side are left alone, since each side is a real
 * history, and ids are compared across the two sides only.
 */
export const mergeHistories = (
  local: SessionResult[],
  incoming: SessionResult[],
  limit: number,
): HistoryMerge => {
  const here = new Set(local.map(sessionKey));
  const fresh = incoming.filter((session) => !here.has(sessionKey(session)));
  const merged = chronological(local, fresh).slice(-limit);
  return {
    merged,
    added: fresh.length,
    known: incoming.length - fresh.length,
    dropped: local.length + fresh.length - merged.length,
  };
};

/** Tests and training are merged separately; the dialog shows one total. */
export const sumMerges = (...merges: MergeCounts[]): MergeCounts =>
  merges.reduce(
    (sum, { added, known, dropped }) => ({
      added: sum.added + added,
      known: sum.known + known,
      dropped: sum.dropped + dropped,
    }),
    { added: 0, known: 0, dropped: 0 },
  );
