import { useEffect, useMemo, useRef, useState } from 'react';
import { loadPairStats } from '../storage/profileStore';
import { generateQuestions } from '../domain/question';
import type { Question } from '../domain/question';
import type { AnswerRecord, Settings, SessionResult } from '../domain/session';
import { QuestionCard } from '../components/QuestionCard';
import { CancelButton } from '../components/CancelButton';
import { useI18n } from '../i18n/I18nContext';
import './PaperSessionScreen.css';

type Props = {
  /** Whose history biases the draw. */
  profileId: string;
  settings: Settings;
  onComplete: (result: SessionResult) => void;
  /** Abandon the session and return to the caller (e.g. home). */
  onCancel?: () => void;
};

type Phase = { kind: 'leadin' } | { kind: 'question'; index: number };

const LeadIn = ({ onDone }: { onDone: () => void }) => {
  const { t } = useI18n();
  const [n, setN] = useState(3);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    // Individual timeouts created up-front so vi.advanceTimersByTime fires them all.
    const t1 = setTimeout(() => setN(2), 1000);
    const t2 = setTimeout(() => setN(1), 2000);
    const t3 = setTimeout(() => { onDoneRef.current(); }, 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div className="paper-session paper-session--leadin">
      <p className="paper-session__ready">{t('session.ready')}</p>
      <p className="paper-session__leadin-number">{n}</p>
    </div>
  );
};

export const PaperSessionScreen = ({ profileId, settings, onComplete, onCancel }: Props) => {
  const { t } = useI18n();
  const questions = useMemo<Question[]>(
    () => generateQuestions(settings, loadPairStats(profileId)),
    [settings, profileId],
  );
  const [phase, setPhase] = useState<Phase>({ kind: 'leadin' });
  const startedAtRef = useRef<string>(new Date().toISOString());
  const completedRef = useRef(false);

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    const answers: AnswerRecord[] = questions.map((question) => ({
      question,
      given: null,
      elapsedMs: 0,
    }));
    onComplete({
      startedAt: startedAtRef.current,
      durationPerQuestionMs: settings.durationPerQuestionMs,
      partialCreditFactor: settings.partialCreditFactor,
      questionCount: settings.questionCount,
      selectedTables: [...settings.selectedTables],
      mode: settings.mode,
      answerMode: 'paper',
      answers,
    });
  };

  const advance = (current: number) => {
    if (completedRef.current) return;
    if (current + 1 >= questions.length) {
      finish();
    } else {
      setPhase({ kind: 'question', index: current + 1 });
    }
  };

  // Auto-advance to the next question after the configured time. Paper mode
  // keeps this pacing but shows no countdown bar — the time still runs, the
  // child just isn't watching it drain (less on-screen pressure).
  useEffect(() => {
    if (phase.kind !== 'question') return;
    const id = setTimeout(() => advance(phase.index), settings.durationPerQuestionMs);
    return () => clearTimeout(id);
    // `advance` is intentionally omitted: it reads only refs/stable values, and
    // we want exactly one timer per question (keyed on phase), not per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, settings.durationPerQuestionMs]);

  if (phase.kind === 'leadin') {
    return <LeadIn onDone={() => setPhase({ kind: 'question', index: 0 })} />;
  }

  const current = questions[phase.index];
  return (
    <div className="paper-session">
      <div className="paper-session__counter">
        {t('session.counter', { n: phase.index + 1, total: questions.length })}
      </div>
      <QuestionCard question={current} given="" />
      {onCancel && <CancelButton onCancel={onCancel} />}
    </div>
  );
};
