import { describe, expect, test } from 'vitest';
import { formatPoints } from '../domain/format';

describe('formatPoints', () => {
  test('whole points carry no decimal', () => {
    expect(formatPoints(0)).toBe('0');
    expect(formatPoints(7)).toBe('7');
  });

  test('tenths are shown as tenths', () => {
    expect(formatPoints(0.5)).toBe('0.5');
    expect(formatPoints(3.5)).toBe('3.5');
  });

  test('a quarter credit is not rounded to the tenth (#39)', () => {
    expect(formatPoints(0.25)).toBe('0.25');
    expect(formatPoints(0.75)).toBe('0.75');
    expect(formatPoints(1.25)).toBe('1.25');
  });

  test('floating-point noise from summing credits is hidden', () => {
    expect(formatPoints(0.1 + 0.2)).toBe('0.3');
    expect(formatPoints(0.1 * 3)).toBe('0.3');
  });
});
