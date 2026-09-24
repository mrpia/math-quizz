import { MULTIPLIERS } from '../domain/tables';
import type { GridCell } from '../domain/progress';
import { rateBucket } from './rateColor';
import { useI18n } from '../i18n/I18nContext';

type Props = { grid: GridCell[][] };

export const ErrorHeatmap = ({ grid }: Props) => {
  const { t } = useI18n();
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
                {row[0].a}
              </th>
              {row.map((cell) => {
                // Colour is weighted, the number is raw — same split as the
                // "Paires à revoir" list, so the two never disagree.
                const label =
                  cell.errorRate === null
                    ? `${cell.a}×${cell.b} — ${t('heatmap.notPlayed')}`
                    : `${cell.a}×${cell.b} — ${cell.failures} / ${cell.attempts}`;
                return (
                  <td
                    key={`${cell.a}x${cell.b}`}
                    className={`heatmap__cell heat--${rateBucket(cell.errorRate)}`}
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
        <span className="heat--0" /> <span>{t('heatmap.rare')}</span>
        <span className="heat--3" /> <span>{t('heatmap.frequent')}</span>
        <span className="heat--nodata" /> <span>{t('heatmap.noData')}</span>
      </div>
    </div>
  );
};
