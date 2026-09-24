import { useEffect, useRef, useState } from 'react';
import { formatSeconds } from '../domain/format';
import { useI18n } from '../i18n/I18nContext';
import './Timer.css';

type Props = {
  targetMs: number;
  resetKey: string | number;
};

export const Timer = ({ targetMs, resetKey }: Props) => {
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number>(performance.now());

  useEffect(() => {
    startRef.current = performance.now();
    setElapsedMs(0);
    let raf = 0;
    const tick = () => {
      setElapsedMs(performance.now() - startRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [resetKey]);

  const { t } = useI18n();
  const overTarget = elapsedMs > targetMs;
  const seconds = (elapsedMs / 1000).toFixed(1);

  return (
    <div
      className={`timer${overTarget ? ' timer--over' : ''}`}
      role="status"
      aria-label={overTarget ? t('timer.over') : t('timer.running')}
    >
      <span className="timer__value" data-testid="session-timer">
        {seconds}s
      </span>
      <span className="timer__target"> {t('timer.target', { target: formatSeconds(targetMs) })}</span>
    </div>
  );
};
