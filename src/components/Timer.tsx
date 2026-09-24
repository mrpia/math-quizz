import { useEffect, useState } from 'react';
import { formatElapsed, formatSeconds } from '../domain/format';
import { useI18n } from '../i18n/I18nContext';
import './Timer.css';

type Props = {
  targetMs: number;
  /**
   * `performance.now()` at which the question started — the same instant the
   * caller scores against, so the display cannot drift from the verdict (#48).
   */
  startedAt: number;
};

export const Timer = ({ targetMs, startedAt }: Props) => {
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { t } = useI18n();
  // `now` is from the last frame, so it predates a new `startedAt` until the
  // next tick: clamp rather than show the previous question's time.
  const elapsedMs = Math.max(0, now - startedAt);
  const overTarget = elapsedMs > targetMs;

  return (
    <div
      className={`timer${overTarget ? ' timer--over' : ''}`}
      role="status"
      aria-label={overTarget ? t('timer.over') : t('timer.running')}
    >
      <span className="timer__value" data-testid="session-timer">
        {formatElapsed(elapsedMs, targetMs)}s
      </span>
      <span className="timer__target"> {t('timer.target', { target: formatSeconds(targetMs) })}</span>
    </div>
  );
};
