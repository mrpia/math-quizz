import { describe, expect, test } from 'vitest';
import { outcomeOf, pointsFor, totalScore } from '../domain/scoring';
import type { AnswerRecord, Settings } from '../domain/session';
import type { Question } from '../domain/question';

const settings: Pick<Settings, 'durationPerQuestionMs' | 'partialCreditFactor'> = {
  durationPerQuestionMs: 4000,
  partialCreditFactor: 0.5,
};

const mkQ = (a: number, b: number, op: 'mul' | 'div' = 'mul'): Question => ({
  a,
  b,
  op,
  expected: op === 'mul' ? a * b : b,
});

const rec = (
  q: Question,
  given: number | null,
  elapsedMs: number,
): AnswerRecord => ({ question: q, given, elapsedMs });

describe('pointsFor', () => {
  test('correct under target → 1 point', () => {
    expect(pointsFor(rec(mkQ(7, 8), 56, 1500), settings)).toBe(1);
  });

  test('correct exactly at target → 1 point (≤ is fast)', () => {
    expect(pointsFor(rec(mkQ(7, 8), 56, 4000), settings)).toBe(1);
  });

  test('correct over target → partialCreditFactor', () => {
    expect(pointsFor(rec(mkQ(7, 8), 56, 4500), settings)).toBe(0.5);
  });

  test('wrong → 0 regardless of time', () => {
    expect(pointsFor(rec(mkQ(7, 8), 49, 1000), settings)).toBe(0);
    expect(pointsFor(rec(mkQ(7, 8), 49, 8000), settings)).toBe(0);
  });

  test('null answer (legacy timeout records) → 0', () => {
    expect(pointsFor(rec(mkQ(7, 8), null, 4000), settings)).toBe(0);
  });

  test('partialCreditFactor is configurable', () => {
    expect(
      pointsFor(rec(mkQ(7, 8), 56, 6000), {
        durationPerQuestionMs: 4000,
        partialCreditFactor: 0.25,
      }),
    ).toBe(0.25);
  });
});

describe('totalScore', () => {
  test('aggregates points and reports max', () => {
    const answers: AnswerRecord[] = [
      rec(mkQ(7, 8), 56, 1000), // 1
      rec(mkQ(7, 8), 56, 5000), // 0.5
      rec(mkQ(7, 8), 49, 2000), // 0
      rec(mkQ(7, 8), 56, 4000), // 1 (exactly target)
    ];
    expect(totalScore(answers, settings)).toEqual({ points: 2.5, max: 4 });
  });

  test('empty answers → zero of zero', () => {
    expect(totalScore([], settings)).toEqual({ points: 0, max: 0 });
  });
});

describe('pointsFor — self-marked (pen-and-paper)', () => {
  const paper = (correct: boolean): AnswerRecord => ({
    question: mkQ(7, 8),
    given: null,
    elapsedMs: 0,
    selfMarkedCorrect: correct,
  });

  test('self-marked correct → 1 point (ignores given/elapsed)', () => {
    expect(pointsFor(paper(true), settings)).toBe(1);
  });

  test('self-marked wrong → 0 points', () => {
    expect(pointsFor(paper(false), settings)).toBe(0);
  });

  test('self-marked correct beats a slow time → 1 (proves elapsed is ignored)', () => {
    // given matches expected but is slow; without the guard this would be partial credit (0.5)
    const record: AnswerRecord = {
      question: mkQ(7, 8),
      given: 56,
      elapsedMs: 999_999,
      selfMarkedCorrect: true,
    };
    expect(pointsFor(record, settings)).toBe(1);
  });

  test('self-marked wrong beats a matching answer → 0 (proves given is ignored)', () => {
    // given matches expected and is fast; without the guard this would score 1
    const record: AnswerRecord = {
      question: mkQ(7, 8),
      given: 56,
      elapsedMs: 0,
      selfMarkedCorrect: false,
    };
    expect(pointsFor(record, settings)).toBe(0);
  });
});

describe('outcomeOf — the one verdict scoring, statistics and the results screen share', () => {
  test('right up to and including the target is correct, past it is slow', () => {
    expect(outcomeOf(rec(mkQ(7, 8), 56, 1500), 4000)).toBe('correct');
    expect(outcomeOf(rec(mkQ(7, 8), 56, 4000), 4000)).toBe('correct');
    expect(outcomeOf(rec(mkQ(7, 8), 56, 4001), 4000)).toBe('slow');
  });

  test('a wrong answer is wrong however fast, a missing one is a timeout', () => {
    expect(outcomeOf(rec(mkQ(7, 8), 49, 100), 4000)).toBe('wrong');
    expect(outcomeOf(rec(mkQ(7, 8), 49, 9000), 4000)).toBe('wrong');
    expect(outcomeOf(rec(mkQ(7, 8), null, 4000), 4000)).toBe('timeout');
  });

  test('a self-marked record (paper, training) is never slow: those modes are untimed', () => {
    const slowButMarked: AnswerRecord = {
      question: mkQ(7, 8),
      given: 56,
      elapsedMs: 999_999,
      selfMarkedCorrect: true,
    };
    expect(outcomeOf(slowButMarked, 4000)).toBe('correct');
    expect(outcomeOf({ ...slowButMarked, selfMarkedCorrect: false }, 4000)).toBe('wrong');
  });

  test('pointsFor follows the verdict: 1, the partial factor, 0, 0', () => {
    const at = { durationPerQuestionMs: 4000, partialCreditFactor: 0.25 };
    expect(pointsFor(rec(mkQ(7, 8), 56, 4000), at)).toBe(1);
    expect(pointsFor(rec(mkQ(7, 8), 56, 4001), at)).toBe(0.25);
    expect(pointsFor(rec(mkQ(7, 8), 49, 1), at)).toBe(0);
    expect(pointsFor(rec(mkQ(7, 8), null, 1), at)).toBe(0);
  });
});
