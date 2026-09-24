import { useState } from 'react';
import type { SessionResult, AnswerRecord } from '../domain/session';
import { totalScore } from '../domain/scoring';
import { formatPoints, formatSeconds } from '../domain/format';
import { useI18n } from '../i18n/I18nContext';
import './ResultsScreen.css';

type Props = {
  result: SessionResult;
  onReplay: () => void;
  onHome: () => void;
  /** Paper mode only: persist the self-marked result to history. */
  onSave?: (final: SessionResult) => void;
};

type Kind = 'ok' | 'slow' | 'wrong' | 'timeout';

const renderOperation = (record: AnswerRecord): string => {
  const { question } = record;
  if (question.op === 'mul') {
    return `${question.a} × ${question.b} = ${question.expected}`;
  }
  return `${question.a * question.b} ÷ ${question.a} = ${question.expected}`;
};

const classify = (record: AnswerRecord, targetMs: number): Kind => {
  // Legacy only: no current mode stores a screen answer without a value.
  if (record.given === null) return 'timeout';
  if (record.given !== record.question.expected) return 'wrong';
  return record.elapsedMs <= targetMs ? 'ok' : 'slow';
};

const ICON: Record<Kind, string> = {
  ok: '✅',
  slow: '🟡',
  wrong: '❌',
  timeout: '⏰',
};

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
          const kind = classify(record, result.durationPerQuestionMs);
          const elapsed = (record.elapsedMs / 1000).toFixed(1);
          return (
            <li key={i} className={`results__row results__row--${kind}`}>
              <span className="results__icon" aria-hidden>
                {ICON[kind]}
              </span>
              <span className="results__operation">{renderOperation(record)}</span>
              <span className="results__detail">
                {kind === 'ok' && <>{elapsed}s</>}
                {kind === 'slow' && <>{elapsed}s · {t('results.slow')}</>}
                {kind === 'wrong' && (
                  <>
                    {elapsed}s · {t('results.wrongAnswer', { given: record.given ?? '' })}
                  </>
                )}
                {kind === 'timeout' && <>{t('results.noAnswer')}</>}
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
  const { t } = useI18n();
  return (
    <ul className="results__list">
      {result.answers.map((record, i) => {
        const ok = record.selfMarkedCorrect === true;
        return (
          <li key={i} className={`results__row results__row--${ok ? 'ok' : 'wrong'}`}>
            <span className="results__icon" aria-hidden>
              {ok ? '✅' : '❌'}
            </span>
            <span className="results__operation">{renderOperation(record)}</span>
            {!ok && (
              <span className="results__detail">
                {t('results.wrongAnswer', { given: record.given ?? '' })}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export const ResultsScreen = ({ result, onReplay, onHome, onSave }: Props) => {
  const { t } = useI18n();
  const isPaper = result.answerMode === 'paper';
  const isTraining = result.answerMode === 'training';
  const [marks, setMarks] = useState<boolean[]>(() => result.answers.map(() => true));
  const [saved, setSaved] = useState(false);

  const scoredAnswers: AnswerRecord[] = isPaper
    ? result.answers.map((a, i) => ({ ...a, selfMarkedCorrect: marks[i] }))
    : result.answers;

  const { points, max } = totalScore(scoredAnswers, {
    durationPerQuestionMs: result.durationPerQuestionMs,
    partialCreditFactor: result.partialCreditFactor,
  });

  const handleSave = () => {
    if (saved) return;
    setSaved(true);
    onSave?.({ ...result, answers: scoredAnswers });
  };

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
        {isPaper && !saved && (
          <button type="button" className="results__btn" onClick={handleSave}>
            {`💾 ${t('results.save')}`}
          </button>
        )}
        {isPaper && saved && <p className="results__saved">{`${t('results.saved')} ✓`}</p>}
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
