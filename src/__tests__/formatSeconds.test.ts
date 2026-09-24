import { describe, expect, test } from 'vitest';
import { formatSeconds } from '../domain/format';

describe('formatSeconds', () => {
  test('whole seconds carry no decimal', () => {
    expect(formatSeconds(4000)).toBe('4');
    expect(formatSeconds(10000)).toBe('10');
  });

  test('half seconds are kept, not rounded up (#38)', () => {
    expect(formatSeconds(1500)).toBe('1.5');
    expect(formatSeconds(2500)).toBe('2.5');
    expect(formatSeconds(4500)).toBe('4.5');
  });

  test('an off-step target (typed or imported) is not rounded to the tenth', () => {
    expect(formatSeconds(2250)).toBe('2.25');
    expect(formatSeconds(2750)).toBe('2.75');
  });
});
