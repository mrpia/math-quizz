/**
 * A duration in ms as the seconds shown to the child: "4", "2.5", "2.25".
 *
 * Trailing zeros are dropped, but nothing is rounded to the whole second — the
 * label must name the target that scoring actually applies (#38). Two decimals
 * cover every value Settings can store: the input's 0.5 step is only a hint, so
 * a typed 2.25 or an imported 2250 ms is possible.
 */
export const formatSeconds = (ms: number): string =>
  Number((ms / 1000).toFixed(2)).toString();

/**
 * A score or a partial-credit factor as shown to the child: "7", "0.5", "1.25".
 *
 * Same rule as `formatSeconds`: two decimals, trailing zeros dropped. One
 * decimal misreported a 0.25 credit as 0.3 (#39) — the Settings input's 0.1
 * step is only a hint, and imports clamp without rounding. `toFixed(2)` also
 * absorbs the float noise of summing credits (0.1 + 0.2).
 */
export const formatPoints = (n: number): string => Number(n.toFixed(2)).toString();
