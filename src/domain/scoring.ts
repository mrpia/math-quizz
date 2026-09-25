import type { AnswerRecord, Settings } from './session';

type ScoringSettings = Pick<Settings, 'durationPerQuestionMs' | 'partialCreditFactor'>;

/** What happened to one answer, as the score, the statistics and the results screen all see it. */
export type Outcome = 'correct' | 'slow' | 'wrong' | 'timeout';

/**
 * The one place an answer is judged. `pointsFor` scores it, `aggregatePairs`
 * counts it and the results screen draws it from this verdict, so the three
 * cannot disagree on where "slow" starts (#48 had the timer and the results
 * list disagree by exactly that).
 *
 * - A self-marked record (paper, training) is the child's or the app's verdict
 *   as stored: right or wrong, never slow — those modes are untimed.
 * - `given: null` is legacy only: no current mode stores a screen answer
 *   without a value, but old histories carry them and they still count.
 * - Otherwise right answers are `correct` up to and including the target and
 *   `slow` past it.
 */
export const outcomeOf = (record: AnswerRecord, targetMs: number): Outcome => {
  if (record.selfMarkedCorrect !== undefined) {
    return record.selfMarkedCorrect ? 'correct' : 'wrong';
  }
  if (record.given === null) return 'timeout';
  if (record.given !== record.question.expected) return 'wrong';
  return record.elapsedMs <= targetMs ? 'correct' : 'slow';
};

export const pointsFor = (record: AnswerRecord, settings: ScoringSettings): number => {
  switch (outcomeOf(record, settings.durationPerQuestionMs)) {
    case 'correct':
      return 1;
    case 'slow':
      return settings.partialCreditFactor;
    default:
      return 0;
  }
};

export const totalScore = (
  answers: AnswerRecord[],
  settings: ScoringSettings,
): { points: number; max: number } => ({
  points: answers.reduce((sum, a) => sum + pointsFor(a, settings), 0),
  max: answers.length,
});
