import { useMemo, useState } from 'react';
import { loadPairStats } from '../storage/profileStore';
import { generateQuestions, formatOperation } from '../domain/question';
import type { Question } from '../domain/question';
import type { Settings } from '../domain/session';
import { useI18n } from '../i18n/I18nContext';
import './ExerciseListScreen.css';

type Props = {
  /** Whose history biases the draw. */
  profileId: string;
  settings: Settings;
  /** Return to the caller (home). The list never completes a session. */
  onCancel: () => void;
};

export const ExerciseListScreen = ({ profileId, settings, onCancel }: Props) => {
  const { t } = useI18n();
  const [seed, setSeed] = useState(0);
  const questions = useMemo<Question[]>(
    () => generateQuestions(settings, loadPairStats(profileId)),
    [settings, profileId, seed],
  );
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const allRevealed = questions.length > 0 && revealed.size === questions.length;

  const toggleAll = () =>
    setRevealed(allRevealed ? new Set() : new Set(questions.map((_, i) => i)));

  const toggleOne = (i: number) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const reshuffle = () => {
    setRevealed(new Set());
    setSeed((s) => s + 1);
  };

  return (
    <div className="exercise-list">
      <header className="exercise-list__header">
        <h2>{t('list.title')}</h2>
        <button
          type="button"
          className="exercise-list__back-btn"
          onClick={onCancel}
          aria-label={t('common.backToHomeAria')}
        >
          🏠
        </button>
      </header>

      <div className="exercise-list__controls">
        <button
          type="button"
          className="exercise-list__control"
          onClick={toggleAll}
        >
          {allRevealed ? t('list.hideAll') : t('list.revealAll')}
        </button>
        <button
          type="button"
          className="exercise-list__control exercise-list__control--ghost"
          onClick={reshuffle}
        >
          {t('list.shuffle')}
        </button>
      </div>

      <ul className="exercise-list__rows">
        {questions.map((q, i) => {
          const isRevealed = revealed.has(i);
          return (
            <li key={i} className="exercise-list__item">
              <button
                type="button"
                className="exercise-list__row"
                onClick={() => toggleOne(i)}
                aria-label={isRevealed ? t('list.hideRowAria') : t('list.revealRowAria')}
              >
                <span className="exercise-list__operation">
                  {formatOperation(q)} =
                </span>
                <span
                  className={`exercise-list__answer${
                    isRevealed ? '' : ' exercise-list__answer--hidden'
                  }`}
                >
                  {isRevealed ? q.expected : '?'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
