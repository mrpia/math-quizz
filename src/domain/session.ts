import type { Question, Mode } from './question';
import type { Language } from '../i18n/types';

export type AnswerMode = 'screen' | 'paper' | 'training' | 'list';

/** How hard the question draw leans toward pairs the child gets wrong. */
export type AdaptiveDraw = 'off' | 'moderate' | 'strong';

export type AnswerRecord = {
  question: Question;
  given: number | null;
  elapsedMs: number;
  /** Set only for pen-and-paper records (self-marked on the results screen). */
  selfMarkedCorrect?: boolean;
};

export type SessionResult = {
  startedAt: string;
  durationPerQuestionMs: number;
  partialCreditFactor: number;
  questionCount: number;
  selectedTables: number[];
  mode: Mode;
  answers: AnswerRecord[];
  /**
   * Missing on legacy history entries; treat absent as 'screen'. Never 'list' —
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
