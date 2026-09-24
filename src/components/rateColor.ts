import { REVIEW_MIN_RATE } from '../domain/progress';

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
