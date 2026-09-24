import { useMemo, useRef, useState } from 'react';
import { loadPairStats } from '../storage/profileStore';
import { generateQuestions } from '../domain/question';
import type { Question } from '../domain/question';
import type { AnswerRecord, Settings, SessionResult } from '../domain/session';
import { NumPad } from '../components/NumPad';
import { QuestionCard } from '../components/QuestionCard';
import { CancelButton } from '../components/CancelButton';
import { useNumericKeyboard } from '../hooks/useNumericKeyboard';
import { appendDigit } from '../domain/answerInput';
import { useI18n } from '../i18n/I18nContext';
import './TrainingScreen.css';

type Props = {
  /** Whose history biases the draw. */
  profileId: string;
  settings: Settings;
  onComplete: (result: SessionResult) => void;
  /** Abandon the session and return to the caller (e.g. home). */
  onCancel?: () => void;
};

type Phase = 'answering' | 'feedback';
type Feedback = { correct: boolean; given: number; expected: number };

export const TrainingScreen = ({ profileId, settings, onComplete, onCancel }: Props) => {
  const { t } = useI18n();
  const questions = useMemo<Question[]>(
    () => generateQuestions(settings, loadPairStats(profileId)),
    [settings, profileId],
  );
  const [index, setIndex] = useState(0);
  const [given, setGiven] = useState('');
  const [phase, setPhase] = useState<Phase>('answering');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const startedAtRef = useRef<string>(new Date().toISOString());
  const questionStartRef = useRef<number>(performance.now());
  const answersRef = useRef<AnswerRecord[]>([]);
  const completedRef = useRef(false);

  const current = questions[index];
  const isLast = index === questions.length - 1;

  const submit = () => {
    if (given === '' || phase !== 'answering') return;
    const value = Number(given);
    const correct = value === current.expected;
    answersRef.current = [
      ...answersRef.current,
      {
        question: current,
        given: value,
        elapsedMs: performance.now() - questionStartRef.current,
        selfMarkedCorrect: correct,
      },
    ];
    setFeedback({ correct, given: value, expected: current.expected });
    setPhase('feedback');
  };

  const handleNext = () => {
    if (completedRef.current) return;
    if (isLast) {
      completedRef.current = true;
      onComplete({
        startedAt: startedAtRef.current,
        durationPerQuestionMs: settings.durationPerQuestionMs,
        partialCreditFactor: settings.partialCreditFactor,
        questionCount: settings.questionCount,
        selectedTables: [...settings.selectedTables],
        mode: settings.mode,
        answerMode: 'training',
        answers: answersRef.current,
      });
      return;
    }
    setIndex((i) => i + 1);
    setGiven('');
    setFeedback(null);
    setPhase('answering');
    questionStartRef.current = performance.now();
  };

  const handleDigit = (d: number) => {
    if (phase !== 'answering') return;
    setGiven((prev) => appendDigit(prev, d));
  };
  const handleErase = () => {
    if (phase !== 'answering') return;
    setGiven((prev) => prev.slice(0, -1));
  };
  const handleValidate = () => {
    if (phase === 'answering') submit();
    else handleNext();
  };

  useNumericKeyboard({
    onDigit: handleDigit,
    onErase: handleErase,
    onValidate: handleValidate,
    enabled: !completedRef.current,
  });

  return (
    <div className="training">
      <div className="training__counter">
        {t('session.counter', { n: index + 1, total: questions.length })}
      </div>
      <QuestionCard
        question={current}
        given={phase === 'feedback' && feedback ? String(feedback.expected) : given}
        answerTone={phase === 'feedback' && feedback ? 'correct' : 'neutral'}
      />
      {phase === 'answering' ? (
        <NumPad onDigit={handleDigit} onErase={handleErase} onValidate={handleValidate} />
      ) : (
        feedback && (
          <>
            <div
              className={`training__feedback training__feedback--${feedback.correct ? 'ok' : 'wrong'}`}
            >
              <p className="training__verdict">
                {feedback.correct ? `✅ ${t('training.correct')}` : `❌ ${t('training.wrong')}`}
              </p>
              {!feedback.correct && (
                <p className="training__correction">
                  {t('training.yourAnswer', {
                    given: feedback.given,
                    expected: feedback.expected,
                  })}
                </p>
              )}
            </div>
            <button type="button" className="training__next-btn" onClick={handleNext}>
              {isLast ? t('training.finish') : `${t('training.next')} →`}
            </button>
          </>
        )
      )}
      {onCancel && <CancelButton onCancel={onCancel} />}
    </div>
  );
};
