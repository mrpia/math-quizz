import { describe, expect, test } from 'vitest';
import { formatElapsed } from '../domain/format';
import { SETTINGS_BOUNDS, TARGET_STEP_MS, snapTargetMs } from '../domain/session';

describe('formatElapsed', () => {
  test('starts at zero with one decimal', () => {
    expect(formatElapsed(0, 4000)).toBe('0.0');
  });

  test('rounds up, so the target is shown only while the answer is still on time (#48)', () => {
    expect(formatElapsed(3950, 4000)).toBe('4.0');
    expect(formatElapsed(4000, 4000)).toBe('4.0');
    // toFixed(1) showed "4.0" here, and scoring called it slow.
    expect(formatElapsed(4001, 4000)).toBe('4.1');
    expect(formatElapsed(4040, 4000)).toBe('4.1');
  });

  test('a half-second target keeps one decimal', () => {
    expect(formatElapsed(2500, 2500)).toBe('2.5');
    expect(formatElapsed(2501, 2500)).toBe('2.6');
  });

  test('a target off the tenth grid switches to hundredths, so the boundary still holds', () => {
    // With tenths, 2.3 would be shown for 2201–2300 ms, while 2250 is on time.
    expect(formatElapsed(2250, 2250)).toBe('2.25');
    expect(formatElapsed(2251, 2250)).toBe('2.26');
    expect(formatElapsed(0, 2250)).toBe('0.00');
  });

  test('display exceeds the target exactly when the answer would be scored slow', () => {
    for (const target of [1000, 2250, 2500, 4000]) {
      for (let ms = target - 150; ms <= target + 150; ms += 0.5) {
        const shownMs = Number(formatElapsed(ms, target)) * 1000;
        expect(shownMs > target).toBe(ms > target);
      }
    }
  });

  test('...for every target the app can store, i.e. every step of the grid', () => {
    // A target off the grid (2255) breaks this: "2.26" for a fast 2251 ms.
    // Settings and the importer snap to the grid, so none is ever stored.
    expect(snapTargetMs(2255)).toBe(2260);
    const { min } = SETTINGS_BOUNDS.durationPerQuestionMs;
    for (let target = min; target <= min + 3000; target += TARGET_STEP_MS) {
      for (let ms = target - 30; ms <= target + 30; ms += 1) {
        const shownMs = Number(formatElapsed(ms, target)) * 1000;
        expect(shownMs > target).toBe(ms > target);
      }
    }
  });
});
