import { REVIEW_MIN_RATE } from '../domain/progress';
import type { GridCell } from '../domain/progress';

/**
 * Maps an error rate (0..1) — or null for "never practised" — to the CSS
 * bucket suffix used by the shared `.heat--{bucket}` classes. Bucket 0 ends at
 * `REVIEW_MIN_RATE`, where "Paires à revoir" starts listing a pair.
 */
export const rateBucket = (rate: number | null): string => {
  if (rate === null) return 'nodata';
  if (rate < REVIEW_MIN_RATE) return '0';
  if (rate < 0.18) return '1';
  if (rate < 0.3) return '2';
  return '3';
};

/**
 * A heat-map cell's bucket. A pair played fewer than `CONFIDENT_MIN_ATTEMPTS`
 * times is `unsure` whatever its rate: one lucky answer is not green, one slip
 * not red — the same pairs the review list leaves out.
 */
export const cellBucket = (cell: Pick<GridCell, 'errorRate' | 'confident'>): string => {
  if (cell.errorRate === null) return 'nodata';
  if (!cell.confident) return 'unsure';
  return rateBucket(cell.errorRate);
};
