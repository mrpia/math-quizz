import { useState } from 'react';
import type { SessionResult, AnswerRecord } from '../domain/session';
import { outcomeOf, totalScore } from '../domain/scoring';
import type { Outcome } from '../domain/scoring';
import { formatElapsed, formatPoints, formatSeconds } from '../domain/format';
import { useI18n } from '../i18n/I18nContext';
import './ResultsScreen.css';

type Props = {
  result: SessionResult;
  onReplay: () => void;
  onHome: () => void;
};

const renderPrompt = ({ question }: AnswerRecord): string =>
  question.op === 'mul'
    ? `${question.a} × ${question.b}`
    : `${question.a * question.b} ÷ ${question.a}`;

const renderOperation = (record: AnswerRecord): string =>
  `${renderPrompt(record)} = ${record.question.expected}`;

// A ❌ beside the bold right equation read as "this equation is wrong". The
// child's answer goes where the answer goes, crossed out, the right one after
// it. Strikethrough is rarely announced, so screen readers get a sentence.
const Correction = ({ record }: { record: AnswerRecord }) => {
  const { t } = useI18n();
  const prompt = renderPrompt(record);
  const { expected } = record.question;
  return (
    <span className="results__operation">
      <span aria-hidden>
        {prompt} = <del className="results__given">{record.given}</del>{' '}
        <ins className="results__expected">{expected}</ins>
      </span>
      <span className="results__sr">
        {t('results.wrongAnswerSpoken', { operation: prompt, given: record.given ?? '', expected })}
      </span>
    </span>
  );
};

const ICON: Record<Outcome, string> = {
  correct: '✅',
  slow: '🟡',
  wrong: '❌',
  timeout: '⏰',
};

// The CSS modifier and the test id predate `Outcome` and say "ok" for correct.
const rowKind = (outcome: Outcome): string => (outcome === 'correct' ? 'ok' : outcome);

const ScreenResults = ({ result }: { result: SessionResult }) => {
  const { t } = useI18n();
  const targetSeconds = formatSeconds(result.durationPerQuestionMs);
  return (
    <>
      <p className="results__legend">
        {t('results.legend', { seconds: targetSeconds, points: formatPoints(result.partialCreditFactor) })}
      </p>
      <ul className="results__list">
        {result.answers.map((record, i) => {
          const outcome = outcomeOf(record, result.durationPerQuestionMs);
          const kind = rowKind(outcome);
          // Rounded up like the running timer (#48): an answer scored slow must
          // never read as the target or less next to "trop lent".
          const elapsed = formatElapsed(record.elapsedMs, result.durationPerQuestionMs);
          return (
            <li
              key={i}
              className={`results__row results__row--${kind}`}
              data-testid={`results-row-${kind}`}
            >
              <span className="results__icon" aria-hidden>
                {ICON[outcome]}
              </span>
              {outcome === 'wrong' ? (
                <Correction record={record} />
              ) : (
                <span className="results__operation">{renderOperation(record)}</span>
              )}
              <span className="results__detail">
                {outcome === 'correct' && <>{elapsed}s</>}
                {outcome === 'slow' && <>{elapsed}s · {t('results.slow')}</>}
                {outcome === 'wrong' && <>{elapsed}s</>}
                {outcome === 'timeout' && <>{t('results.noAnswer')}</>}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
};

const PaperResults = ({
  result,
  marks,
  onToggle,
}: {
  result: SessionResult;
  marks: boolean[];
  onToggle: (i: number) => void;
}) => {
  const { t } = useI18n();
  return (
    <>
      <p className="results__legend">
        {t('results.paperLegend')}
      </p>
      <p className="results__legend">{t('results.paperNotSaved')}</p>
      <ul className="results__list">
        {result.answers.map((record, i) => (
          <li
            key={i}
            className={`results__row results__row--${marks[i] ? 'ok' : 'wrong'}`}
          >
            <button
              type="button"
              className="results__mark"
              aria-pressed={marks[i]}
              aria-label={`${renderOperation(record)} ${marks[i] ? t('results.markCorrect') : t('results.markWrong')}`}
              onClick={() => onToggle(i)}
            >
              {marks[i] ? '✅' : '❌'}
            </button>
            <span className="results__operation">{renderOperation(record)}</span>
          </li>
        ))}
      </ul>
    </>
  );
};

const TrainingResults = ({ result }: { result: SessionResult }) => {
  return (
    <ul className="results__list">
      {result.answers.map((record, i) => {
        const ok = record.selfMarkedCorrect === true;
        return (
          <li key={i} className={`results__row results__row--${ok ? 'ok' : 'wrong'}`}>
            <span className="results__icon" aria-hidden>
              {ok ? '✅' : '❌'}
            </span>
            {ok ? (
              <span className="results__operation">{renderOperation(record)}</span>
            ) : (
              <Correction record={record} />
            )}
          </li>
        );
      })}
    </ul>
  );
};

export const ResultsScreen = ({ result, onReplay, onHome }: Props) => {
  const { t } = useI18n();
  const isPaper = result.answerMode === 'paper';
  const isTraining = result.answerMode === 'training';
  // Paper marks only drive the live score: nothing is saved (#44), so the
  // all-correct default can no longer inflate the statistics.
  const [marks, setMarks] = useState<boolean[]>(() => result.answers.map(() => true));

  const scoredAnswers: AnswerRecord[] = isPaper
    ? result.answers.map((a, i) => ({ ...a, selfMarkedCorrect: marks[i] }))
    : result.answers;

  const { points, max } = totalScore(scoredAnswers, {
    durationPerQuestionMs: result.durationPerQuestionMs,
    partialCreditFactor: result.partialCreditFactor,
  });

  return (
    <div className="results">
      <header className="results__header">
        <h2>{t('results.title')}</h2>
        <div className="results__score" data-testid="results-score">
          {formatPoints(points)} / {max}
        </div>
      </header>

      {isPaper ? (
        <PaperResults
          result={result}
          marks={marks}
          onToggle={(i) =>
            setMarks((m) => m.map((v, j) => (j === i ? !v : v)))
          }
        />
      ) : isTraining ? (
        <TrainingResults result={result} />
      ) : (
        <ScreenResults result={result} />
      )}

      <div className="results__actions">
        <button type="button" className="results__btn" onClick={onReplay}>
          {`🔁 ${t('results.replay')}`}
        </button>
        <button
          type="button"
          className="results__btn results__btn--secondary"
          onClick={onHome}
        >
          {`🏠 ${t('common.backToHome')}`}
        </button>
      </div>
    </div>
  );
};
