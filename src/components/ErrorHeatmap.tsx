import { MULTIPLIERS } from '../domain/tables';
import { completeTables } from '../domain/progress';
import type { GridCell } from '../domain/progress';
import { cellBucket } from './rateColor';
import { useI18n } from '../i18n/I18nContext';
import { formatPairCount } from '../domain/format';

type Props = { grid: GridCell[][] };

export const ErrorHeatmap = ({ grid }: Props) => {
  const { t } = useI18n();
  const complete = new Set(completeTables(grid));
  return (
    <div className="heatmap">
      <table className="heatmap__table">
        <thead>
          <tr>
            <th className="heatmap__corner" aria-hidden />
            {MULTIPLIERS.map((b) => (
              <th key={b} className="heatmap__colhead" scope="col">
                {b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map((row) => (
            <tr key={row[0].a}>
              <th className="heatmap__rowhead" scope="row">
                {complete.has(row[0].a) && (
                  <span
                    className="heatmap__star"
                    role="img"
                    aria-label={t('heatmap.tableComplete', { n: row[0].a })}
                  >
                    ⭐
                  </span>
                )}
                {row[0].a}
              </th>
              {row.map((cell) => {
                // Colour is weighted, the number is raw, and under
                // CONFIDENT_MIN_ATTEMPTS there is no colour at all — the same
                // rules as the "Paires à revoir" list, so the two never disagree.
                const label =
                  cell.errorRate === null
                    ? `${cell.a}×${cell.b} — ${t('heatmap.notPlayed')}`
                    : `${cell.a}×${cell.b} — ${formatPairCount(cell.failures, cell.attempts, cell.slow)}`;
                return (
                  <td
                    key={`${cell.a}x${cell.b}`}
                    className={`heatmap__cell heat--${cellBucket(cell)}`}
                    title={label}
                    aria-label={label}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="heatmap__legend">
        <span className="heatmap__legend-item">
          <span className="heat--0" /> {t('heatmap.mastered')}
        </span>
        <span className="heatmap__legend-item">
          <span className="heatmap__legend-scale" aria-hidden="true">
            <span className="heat--1" />
            <span className="heat--2" />
            <span className="heat--3" />
          </span>{' '}
          {t('heatmap.review')}
        </span>
        <span className="heatmap__legend-item">
          <span className="heat--unsure" /> {t('heatmap.unsure')}
        </span>
        <span className="heatmap__legend-item">
          <span className="heat--nodata" /> {t('heatmap.noData')}
        </span>
      </div>
    </div>
  );
};
