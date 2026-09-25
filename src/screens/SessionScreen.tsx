import { useEffect, useMemo, useRef, useState } from 'react';
import { loadPairStats } from '../storage/profileStore';
import { generateQuestions } from '../domain/question';
import type { Question } from '../domain/question';
import type { AnswerRecord, Settings, SessionResult } from '../domain/session';
import { NumPad } from '../components/NumPad';
import { Timer } from '../components/Timer';
import { QuestionCard } from '../components/QuestionCard';
import { CancelButton } from '../components/CancelButton';
import { useNumericKeyboard } from '../hooks/useNumericKeyboard';
import { appendDigit } from '../domain/answerInput';
import { useI18n } from '../i18n/I18nContext';
import './SessionScreen.css';

type Props = {
  /** Whose history biases the draw. */
  profileId: string;
  settings: Settings;
  onComplete: (result: SessionResult) => void;
  /** Abandon the session and return to the caller (e.g. home). */
  onCancel?: () => void;
};

export const SessionScreen = ({ profileId, settings, onComplete, onCancel }: Props) => {
  const { t } = useI18n();
  const questions = useMemo<Question[]>(
    () => generateQuestions(settings, loadPairStats(profileId)),
    [settings, profileId],
  );
  const [index, setIndex] = useState(0);
  const [given, setGiven] = useState<string>('');
  const startedAtRef = useRef<string>(new Date().toISOString());
  // State, not a ref: the Timer renders from it, and `submit` scores against
  // it, so it changes together with `index` in one render (#48).
  const [questionStartedAt, setQuestionStartedAt] = useState(() => performance.now());
  const answersRef = useRef<AnswerRecord[]>([]);
  const completedRef = useRef<boolean>(false);

  const finishIfDone = (recordsSoFar: AnswerRecord[]) => {
    if (recordsSoFar.length < questions.length || completedRef.current) return;
    completedRef.current = true;
    onComplete({
      startedAt: startedAtRef.current,
      durationPerQuestionMs: settings.durationPerQuestionMs,
      partialCreditFactor: settings.partialCreditFactor,
      questionCount: settings.questionCount,
      selectedTables: [...settings.selectedTables],
      mode: settings.mode,
      answers: recordsSoFar,
      answerMode: 'screen',
    });
  };

  const submit = (value: number) => {
    if (completedRef.current) return;
    const record: AnswerRecord = {
      question: questions[index],
      given: value,
      elapsedMs: performance.now() - questionStartedAt,
    };
    const next = [...answersRef.current, record];
    answersRef.current = next;
    setGiven('');
    if (next.length >= questions.length) {
      finishIfDone(next);
      return;
    }
    setQuestionStartedAt(performance.now());
    setIndex(next.length);
  };

  const handleDigit = (d: number) => {
    setGiven((prev) => appendDigit(prev, d));
  };

  const handleErase = () => setGiven((prev) => prev.slice(0, -1));

  const handleValidate = () => {
    if (given === '') return;
    submit(Number(given));
  };

  useNumericKeyboard({
    onDigit: handleDigit,
    onErase: handleErase,
    onValidate: handleValidate,
    enabled: !completedRef.current,
  });

  // Reset given on question change (covers programmatic submit paths)
  useEffect(() => {
    setGiven('');
  }, [index]);

  const current = questions[index];
  return (
    <div className="session">
      <div className="session__top">
        <div className="session__counter">
          {t('session.counter', { n: index + 1, total: questions.length })}
        </div>
        <Timer targetMs={settings.durationPerQuestionMs} startedAt={questionStartedAt} />
      </div>
      <QuestionCard question={current} given={given} />
      <NumPad
        onDigit={handleDigit}
        onErase={handleErase}
        onValidate={handleValidate}
      />
      {onCancel && <CancelButton onCancel={onCancel} />}
    </div>
  );
};
