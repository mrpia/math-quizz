import { describe, expect, test } from 'vitest';
import { appendDigit, MAX_ANSWER_DIGITS } from '../domain/answerInput';

describe('appendDigit', () => {
  test('appends to what is already typed', () => {
    expect(appendDigit('4', 9)).toBe('49');
  });

  test('a leading zero is replaced, not kept: 0 then 4 then 9 reads 49', () => {
    expect(appendDigit(appendDigit(appendDigit('', 0), 4), 9)).toBe('49');
  });

  test('zero on its own is still an answer, and 0 then 0 stays 0', () => {
    expect(appendDigit('', 0)).toBe('0');
    expect(appendDigit('0', 0)).toBe('0');
  });

  test('zeros after the first digit are kept', () => {
    expect(appendDigit('10', 0)).toBe('100');
  });

  test('stops at the digit cap', () => {
    const full = '1'.repeat(MAX_ANSWER_DIGITS);
    expect(appendDigit(full, 2)).toBe(full);
  });
});
