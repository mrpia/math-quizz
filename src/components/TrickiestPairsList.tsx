import type { PairStat } from '../domain/progress';
import { rateBucket } from './rateColor';
import { useI18n } from '../i18n/I18nContext';
import { formatPairCount } from '../domain/format';

type Props = { pairs: PairStat[] };

export const TrickiestPairsList = ({ pairs }: Props) => {
  const { t } = useI18n();
  if (pairs.length === 0) {
    return (
      <p className="pairs__empty">
        {t('pairs.empty')}
      </p>
    );
  }
  const maxRate = Math.max(...pairs.map((p) => p.errorRate)) || 1;
  return (
    <ul className="pairs" data-testid="trickiest-pairs">
      {pairs.map((p) => (
        <li className="pairs__row" key={`${p.a}x${p.b}`}>
          <span className="pairs__pair">
            {p.a} × {p.b}
          </span>
          <span className="pairs__barwrap">
            <span
              className={`pairs__bar heat--${rateBucket(p.errorRate)}`}
              data-testid="pair-bar"
              style={{ width: `${Math.round((p.errorRate / maxRate) * 100)}%` }}
            />
          </span>
          <span className="pairs__num" data-testid="pair-count">
            {formatPairCount(p.failures, p.attempts, p.slow)}
          </span>
        </li>
      ))}
    </ul>
  );
};
