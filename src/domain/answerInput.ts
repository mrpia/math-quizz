/** Longest answer the numpad accepts. Every table answer fits well inside it. */
export const MAX_ANSWER_DIGITS = 4;

/**
 * The typed answer after one more digit, as shown on screen and later read with
 * `Number()`.
 *
 * A lone leading zero is replaced rather than kept, as on a calculator: "0",
 * "4", "9" reads "49", not "049". `Number("049")` is 49 either way, so this is
 * about what the child sees, and about not spending one of the four digits on
 * a zero. "0" by itself stays a valid answer.
 */
export const appendDigit = (prev: string, d: number): string => {
  if (prev === '0') return String(d);
  if (prev.length >= MAX_ANSWER_DIGITS) return prev;
  return prev + String(d);
};
