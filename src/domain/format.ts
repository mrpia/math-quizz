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

/**
 * Elapsed time on the running timer, in seconds: "0.0", "3.7", "2.26".
 *
 * Rounded **up**, so the shown number passes the target exactly when scoring
 * (`elapsedMs <= durationPerQuestionMs`) turns slow. `toFixed(1)` showed "4.0"
 * for 4.04 s, an answer scored slow (#48). The step is a tenth when the target
 * sits on that grid (every 0.5-step value does) and a hundredth otherwise, so
 * a 2.25 s target does not read "2.3" while the answer still counts as fast.
 * Relies on targets being stored on the `TARGET_STEP_MS` grid: off it, a
 * hundredth could still round past a target the answer had not passed.
 */
export const formatElapsed = (ms: number, targetMs: number): string => {
  const stepMs = targetMs % 100 === 0 ? 100 : 10;
  const shownMs = Math.ceil(ms / stepMs) * stepMs;
  return (shownMs / 1000).toFixed(stepMs === 100 ? 1 : 2);
};

/**
 * A pair's raw record as the list and the heat-map tooltip show it: "2 / 5",
 * or "0 / 5 · 3 🐢" when some correct answers were slow. Without the slow
 * count, a pair listed for review on slowness alone would read "0 / 5" (#47).
 */
export const formatPairCount = (failures: number, attempts: number, slow: number): string =>
  slow > 0 ? `${failures} / ${attempts} · ${slow} 🐢` : `${failures} / ${attempts}`;
