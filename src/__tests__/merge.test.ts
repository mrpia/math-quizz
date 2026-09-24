import { describe, expect, it } from 'vitest';
import { mergeHistories, sessionKey, sumMerges } from '../domain/merge';
import { newSessionId } from '../domain/session';
import type { SessionResult } from '../domain/session';

const at = (minute: number) =>
  new Date(Date.UTC(2026, 8, 20, 8, minute, 0)).toISOString();

const mk = (minute: number, over: Partial<SessionResult> = {}): SessionResult => ({
  startedAt: at(minute),
  durationPerQuestionMs: 4000,
  partialCreditFactor: 0.5,
  questionCount: 1,
  selectedTables: [7],
  mode: 'mul',
  answers: [
    { question: { a: 7, b: 8, op: 'mul', expected: 56 }, given: 56, elapsedMs: 1000 },
  ],
  ...over,
});

describe('newSessionId', () => {
  it('is a non-empty string that does not repeat', () => {
    const ids = new Set(Array.from({ length: 200 }, newSessionId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('sessionKey', () => {
  it('is the id when the session carries one', () => {
    expect(sessionKey(mk(1, { id: 'abc' }))).toBe('abc');
  });

  it('falls back to startedAt plus answer count for sessions older than ids', () => {
    expect(sessionKey(mk(1))).toBe(`${at(1)}#1`);
  });
});

describe('mergeHistories', () => {
  it('keeps everything from both sides when nothing is shared', () => {
    const result = mergeHistories([mk(1, { id: 'a' })], [mk(2, { id: 'b' })], 50);
    expect(result.merged.map((s) => s.id)).toEqual(['a', 'b']);
    expect(result).toMatchObject({ added: 1, known: 0, dropped: 0 });
  });

  it('skips a session already here, matched on id', () => {
    const local = [mk(1, { id: 'a' }), mk(2, { id: 'b' })];
    const incoming = [mk(2, { id: 'b' }), mk(3, { id: 'c' })];
    const result = mergeHistories(local, incoming, 50);
    expect(result.merged.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(result).toMatchObject({ added: 1, known: 1, dropped: 0 });
  });

  it('two sessions stamped the same second on two devices are both kept', () => {
    // The reason ids exist: startedAt alone is unique only by luck.
    const result = mergeHistories([mk(1, { id: 'tablet' })], [mk(1, { id: 'laptop' })], 50);
    expect(result.merged).toHaveLength(2);
    expect(result.added).toBe(1);
  });

  it('matches id-less sessions on startedAt and answer count', () => {
    const shorter = mk(1, { answers: [] });
    const result = mergeHistories([mk(1)], [mk(1), shorter], 50);
    expect(result).toMatchObject({ added: 1, known: 1 });
    expect(result.merged).toHaveLength(2);
  });

  it('sorts the result by startedAt, so recency weights mean something', () => {
    // Weights come from position: concatenating in import order would decay
    // the tablet's newest session as if it were the oldest.
    const local = [mk(1, { id: 'a' }), mk(5, { id: 'c' })];
    const incoming = [mk(3, { id: 'b' }), mk(7, { id: 'd' })];
    expect(mergeHistories(local, incoming, 50).merged.map((s) => s.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('keeps the newest overall and counts what the cap pushes out', () => {
    const local = [mk(1, { id: 'a' }), mk(4, { id: 'd' })];
    const incoming = [mk(2, { id: 'b' }), mk(3, { id: 'c' })];
    const result = mergeHistories(local, incoming, 3);
    expect(result.merged.map((s) => s.id)).toEqual(['b', 'c', 'd']);
    // One dropped, and it was a local one: the dialog counts both sides.
    expect(result).toMatchObject({ added: 2, known: 0, dropped: 1 });
  });

  it('is idempotent: merging a file twice changes nothing the second time', () => {
    const incoming = [mk(2, { id: 'b' })];
    const once = mergeHistories([mk(1, { id: 'a' })], incoming, 50).merged;
    const twice = mergeHistories(once, incoming, 50);
    expect(twice.merged).toEqual(once);
    expect(twice).toMatchObject({ added: 0, known: 1, dropped: 0 });
  });

  it('keeps the local copy of a session both sides hold', () => {
    const local = [mk(1, { id: 'a', questionCount: 1 })];
    const incoming = [mk(1, { id: 'a', questionCount: 99 })];
    expect(mergeHistories(local, incoming, 50).merged[0].questionCount).toBe(1);
  });
});

describe('sumMerges', () => {
  it('adds the counts of the test and training merges', () => {
    const tests = mergeHistories([], [mk(1, { id: 'a' })], 50);
    const training = mergeHistories([mk(2, { id: 'b' })], [mk(2, { id: 'b' })], 50);
    expect(sumMerges(tests, training)).toEqual({ added: 1, known: 1, dropped: 0 });
  });
});
