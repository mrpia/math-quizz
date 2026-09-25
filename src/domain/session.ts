import type { Question, Mode } from './question';
import type { Language } from '../i18n/types';

export type AnswerMode = 'screen' | 'paper' | 'training' | 'list';

/** How hard the question draw leans toward pairs the child gets wrong. */
export type AdaptiveDraw = 'off' | 'moderate' | 'strong';

export type AnswerRecord = {
  question: Question;
  /**
   * The typed answer. `null` in paper records (the app never sees the sheet)
   * and in legacy screen records from when a question could time out; no
   * current mode produces a timeout.
   */
  given: number | null;
  elapsedMs: number;
  /**
   * The verdict, when it does not come from comparing `given` with `expected`.
   * Paper: the child's own mark on the results screen. Training: the app's
   * check, stored at answer time next to a numeric `given`. Absent on screen
   * records.
   */
  selfMarkedCorrect?: boolean;
};

export type SessionResult = {
  /**
   * Opaque and random, stamped when the session is recorded (#18), so a merge
   * can tell two devices' sessions apart even when they share a `startedAt`.
   * Absent on sessions recorded before 1.2.0, and never backfilled: a random
   * id given to the same old session on two devices would make the copies
   * look different. Those match on `startedAt` plus answer count instead.
   */
  id?: string;
  startedAt: string;
  durationPerQuestionMs: number;
  partialCreditFactor: number;
  questionCount: number;
  selectedTables: number[];
  mode: Mode;
  answers: AnswerRecord[];
  /**
   * Missing on legacy history entries (screen sessions up to 1.1.0 never set
   * it); treat absent as 'screen'. Never 'list' —
   * the list mode is a view and does not record a session.
   */
  answerMode?: AnswerMode;
};

export type Settings = {
  /** Target answer time. Faster than this earns full credit. */
  durationPerQuestionMs: number;
  questionCount: number;
  selectedTables: number[];
  mode: Mode;
  /** Credit awarded for a correct answer slower than the target. */
  partialCreditFactor: number;
  /** How answers are collected. Absent reads as 'screen'. */
  answerMode?: AnswerMode;
  /** UI language. Absent reads as 'fr'. */
  language: Language;
  /** Bias of the draw toward shaky pairs. Absent reads as 'moderate'. */
  adaptiveDraw?: AdaptiveDraw;
};

/**
 * Accepted range for each numeric setting. Shared by the Settings form and the
 * backup importer, so a hand-edited file cannot smuggle in a value the UI would
 * refuse.
 */
export const SETTINGS_BOUNDS = {
  durationPerQuestionMs: { min: 1000, max: 60000 },
  questionCount: { min: 1, max: 200 },
  partialCreditFactor: { min: 0, max: 1 },
} as const;

/**
 * The finest step a target time is stored at. The timer and every target
 * label show at most hundredths of a second, so a target between two of them
 * (a typed 2.255 s, an imported 2255 ms) would be scored against a number the
 * child cannot see: "cible 2.25s" while 2.251 s still counts as fast. Both
 * ways in — the Settings form and `sanitizeSettings` — snap to this grid.
 *
 * Whole milliseconds first, then the grid, on both paths: a typed "2.255"
 * arrives as 2254.9999999999995 and an imported 2254.9 as itself, and both
 * must land where an integer 2255 does, on 2260.
 */
export const TARGET_STEP_MS = 10;

export const snapTargetMs = (ms: number): number =>
  Math.round(Math.round(ms) / TARGET_STEP_MS) * TARGET_STEP_MS;

export const DEFAULT_SETTINGS: Settings = {
  durationPerQuestionMs: 4000,
  questionCount: 22,
  selectedTables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 24, 25],
  mode: 'mix',
  partialCreditFactor: 0.5,
  answerMode: 'screen',
  language: 'fr',
  adaptiveDraw: 'moderate',
};

/**
 * 128 random bits, hex. Built on `getRandomValues` rather than
 * `crypto.randomUUID`, which only exists in a secure context and would be
 * missing when the dev server is opened from a tablet over the LAN.
 */
export const newSessionId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
