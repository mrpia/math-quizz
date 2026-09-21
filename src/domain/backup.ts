/**
 * The export / import file format.
 *
 * Math Quizz keeps everything in `localStorage`; this envelope is the only way
 * that data ever leaves (or re-enters) the browser. It is a published contract:
 * `public/schemas/math-quizz-backup-v1.schema.json` documents it field by field
 * for anyone who wants to process their own export, and
 * `src/__tests__/backup.test.ts` ties the schema to the constants below so the
 * two cannot drift.
 *
 * Two deliberate validation policies:
 * - **structure is rejected, not repaired** — a malformed session or a junk
 *   error key fails the whole file. Silently dropping records would hand the
 *   child a partial history that looks complete, and a bad pair key would reach
 *   `trickiestPairs`, whose `key.split('x').map(Number)` then renders
 *   "NaN × NaN";
 * - **settings are sanitised, not rejected** — every setting has a safe default
 *   and `loadSettings` is already merge-tolerant, so an out-of-range number is
 *   clamped and an unknown enum value falls back. Notably `selectedTables` can
 *   never end up empty: `generateQuestions` throws on an empty selection.
 */
import { DEFAULT_SETTINGS, SETTINGS_BOUNDS } from './session';
import type { AnswerMode, AnswerRecord, SessionResult, Settings } from './session';
import type { Mode, Operator, Question } from './question';
import { SITE_URL } from '../config/site';
import { MULTIPLICANDS } from './tables';
import { LANGUAGES } from '../i18n';
import type { Language } from '../i18n/types';

/** Marker that identifies the file as ours. */
export const BACKUP_FORMAT = 'math-quizz-backup';

/** Version of the envelope, not of the app. Bumped only on a breaking change. */
export const BACKUP_FORMAT_VERSION = 1;

/**
 * Where the published JSON Schema lives. Also written into every export.
 *
 * Built on `SITE_URL` so a fork retargets it by editing src/config/site.ts.
 * The `-v1` stays a literal on purpose: bumping `BACKUP_FORMAT_VERSION` means
 * shipping a new schema file next to the old one, which is a deliberate act,
 * not a string that should follow the constant automatically.
 */
export const BACKUP_SCHEMA_URL =
  `${SITE_URL}/schemas/math-quizz-backup-v1.schema.json`;

/**
 * Lifetime per-pair counters, as written by versions up to 0.10.0.
 * Deprecated: the app derives every statistic from the histories, weighting
 * recent sessions more heavily, which a timestamp-less running total cannot
 * express. Still validated on import (a v1 file may carry it) and then
 * dropped; never written.
 */
export type LegacyErrorStat = {
  attempts: number;
  errors: number;
  timeouts: number;
};

export type LegacyErrorStats = Record<string, LegacyErrorStat>;

/** One profile's payload — one field per localStorage key the app owns. */
export type BackupData = {
  settings: Settings;
  history: SessionResult[];
  trainingHistory: SessionResult[];
  /** @deprecated accepted for v1 files, ignored on import, never exported. */
  errors?: LegacyErrorStats;
};

export type Backup = {
  $schema: string;
  format: typeof BACKUP_FORMAT;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  /** ISO timestamp, or '' when the file did not carry one. */
  exportedAt: string;
  /** package.json version of the app that wrote the file, or ''. */
  appVersion: string;
  /** Id of the profile the data came from. Informational — see the schema. */
  profile: string;
  /**
   * Display name of that profile, or '' when it had none. Informational: it
   * lets the import confirmation say which child a file belongs to, and it
   * names the exported file. Never used to pick the destination profile.
   */
  profileName: string;
  data: BackupData;
};

export type BackupMeta = {
  appVersion: string;
  exportedAt: string;
  profile: string;
  profileName: string;
};

/** Why a file could not be imported. Each maps to its own message in the UI. */
export type BackupProblem =
  | 'unreadable'
  | 'not-a-backup'
  | 'unsupported-version'
  | 'corrupt';

export type BackupParseResult =
  | { ok: true; backup: Backup }
  | { ok: false; problem: BackupProblem };

const fail = (problem: BackupProblem): BackupParseResult => ({ ok: false, problem });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const OPERATORS: readonly string[] = ['mul', 'div'] satisfies Operator[];
const MODES: readonly string[] = ['mul', 'div', 'mix'] satisfies Mode[];
const ANSWER_MODES: readonly string[] = [
  'screen',
  'paper',
  'training',
  'list',
] satisfies AnswerMode[];
const TABLES: readonly number[] = MULTIPLICANDS;
const LANGUAGE_CODES: readonly string[] = LANGUAGES.map((entry) => entry.code);

/** '<low>x<high>', the canonical pair key produced by `stats.canonicalKey`. */
const PAIR_KEY = /^\d+x\d+$/;

const isQuestion = (value: unknown): value is Question =>
  isRecord(value) &&
  isNumber(value.a) &&
  isNumber(value.b) &&
  isNumber(value.expected) &&
  isString(value.op) &&
  OPERATORS.includes(value.op);

const isAnswerRecord = (value: unknown): value is AnswerRecord =>
  isRecord(value) &&
  isQuestion(value.question) &&
  (value.given === null || isNumber(value.given)) &&
  isNumber(value.elapsedMs) &&
  (value.selfMarkedCorrect === undefined ||
    typeof value.selfMarkedCorrect === 'boolean');

const isSessionResult = (value: unknown): value is SessionResult =>
  isRecord(value) &&
  isString(value.startedAt) &&
  isNumber(value.durationPerQuestionMs) &&
  isNumber(value.partialCreditFactor) &&
  isNumber(value.questionCount) &&
  Array.isArray(value.selectedTables) &&
  value.selectedTables.every(isNumber) &&
  isString(value.mode) &&
  MODES.includes(value.mode) &&
  (value.answerMode === undefined ||
    (isString(value.answerMode) && ANSWER_MODES.includes(value.answerMode))) &&
  Array.isArray(value.answers) &&
  value.answers.every(isAnswerRecord);

const isErrorStat = (value: unknown): value is LegacyErrorStat =>
  isRecord(value) &&
  isNumber(value.attempts) &&
  value.attempts >= 0 &&
  isNumber(value.errors) &&
  value.errors >= 0 &&
  isNumber(value.timeouts) &&
  value.timeouts >= 0;

/** `null` means "present but malformed" — the caller turns that into 'corrupt'. */
const readSessions = (value: unknown): SessionResult[] | null => {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  return value.every(isSessionResult) ? (value as SessionResult[]) : null;
};

/** Tri-state: `undefined` = absent (fine), `null` = present but malformed. */
const readLegacyErrors = (
  value: unknown,
): LegacyErrorStats | undefined | null => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return null;
  for (const [key, stat] of Object.entries(value)) {
    if (!PAIR_KEY.test(key) || !isErrorStat(stat)) return null;
  }
  return value as LegacyErrorStats;
};

const clamp = (value: number, { min, max }: { min: number; max: number }) =>
  Math.max(min, Math.min(max, value));

const readNumber = (
  value: unknown,
  bounds: { min: number; max: number },
  fallback: number,
): number => (isNumber(value) ? clamp(value, bounds) : fallback);

const readEnum = <T extends string>(
  value: unknown,
  allowed: readonly string[],
  fallback: T,
): T => (isString(value) && allowed.includes(value) ? (value as T) : fallback);

const readTables = (value: unknown): number[] => {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.selectedTables;
  const kept = value.filter(
    (entry): entry is number => isNumber(entry) && TABLES.includes(entry),
  );
  // An empty selection would make generateQuestions throw — never allow it.
  return kept.length > 0 ? kept : DEFAULT_SETTINGS.selectedTables;
};

const sanitizeSettings = (value: unknown): Settings => {
  const raw = isRecord(value) ? value : {};
  return {
    durationPerQuestionMs: readNumber(
      raw.durationPerQuestionMs,
      SETTINGS_BOUNDS.durationPerQuestionMs,
      DEFAULT_SETTINGS.durationPerQuestionMs,
    ),
    questionCount: Math.round(
      readNumber(
        raw.questionCount,
        SETTINGS_BOUNDS.questionCount,
        DEFAULT_SETTINGS.questionCount,
      ),
    ),
    selectedTables: readTables(raw.selectedTables),
    mode: readEnum<Mode>(raw.mode, MODES, DEFAULT_SETTINGS.mode),
    partialCreditFactor: readNumber(
      raw.partialCreditFactor,
      SETTINGS_BOUNDS.partialCreditFactor,
      DEFAULT_SETTINGS.partialCreditFactor,
    ),
    answerMode: readEnum<AnswerMode>(
      raw.answerMode,
      ANSWER_MODES,
      DEFAULT_SETTINGS.answerMode ?? 'screen',
    ),
    language: readEnum<Language>(
      raw.language,
      LANGUAGE_CODES,
      DEFAULT_SETTINGS.language,
    ),
  };
};

export const createBackup = (data: BackupData, meta: BackupMeta): Backup => ({
  $schema: BACKUP_SCHEMA_URL,
  format: BACKUP_FORMAT,
  formatVersion: BACKUP_FORMAT_VERSION,
  exportedAt: meta.exportedAt,
  appVersion: meta.appVersion,
  profile: meta.profile,
  profileName: meta.profileName,
  data,
});

/** Pretty-printed: the file is meant to be readable, and diffable, by hand. */
export const serializeBackup = (backup: Backup): string =>
  `${JSON.stringify(backup, null, 2)}\n`;

export const validateBackup = (value: unknown): BackupParseResult => {
  if (!isRecord(value)) return fail('not-a-backup');
  if (value.format !== BACKUP_FORMAT) return fail('not-a-backup');
  if (value.formatVersion !== BACKUP_FORMAT_VERSION) return fail('unsupported-version');
  if (!isRecord(value.data)) return fail('corrupt');

  const { data } = value;
  const history = readSessions(data.history);
  const trainingHistory = readSessions(data.trainingHistory);
  const errors = readLegacyErrors(data.errors);
  if (history === null || trainingHistory === null || errors === null) {
    return fail('corrupt');
  }

  // Rebuilt field by field: unknown envelope fields never reach storage.
  return {
    ok: true,
    backup: {
      $schema: isString(value.$schema) ? value.$schema : BACKUP_SCHEMA_URL,
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: isString(value.exportedAt) ? value.exportedAt : '',
      appVersion: isString(value.appVersion) ? value.appVersion : '',
      profile: isString(value.profile) ? value.profile : '',
      profileName: isString(value.profileName) ? value.profileName : '',
      data: {
        settings: sanitizeSettings(data.settings),
        history,
        trainingHistory,
        ...(errors === undefined ? {} : { errors }),
      },
    },
  };
};

export const parseBackup = (text: string): BackupParseResult => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return fail('unreadable');
  }
  return validateBackup(value);
};

/** Counts shown in the import confirmation, before anything is overwritten. */
export const summarizeBackup = (backup: Backup) => {
  const pairs = new Set<string>();
  for (const session of [...backup.data.history, ...backup.data.trainingHistory]) {
    for (const { question } of session.answers) {
      const lo = Math.min(question.a, question.b);
      const hi = Math.max(question.a, question.b);
      pairs.add(`${lo}x${hi}`);
    }
  }
  return {
    sessions: backup.data.history.length,
    trainingSessions: backup.data.trainingHistory.length,
    pairs: pairs.size,
  };
};

/**
 * ASCII, lowercase, hyphenated — a filename that survives every filesystem and
 * every mail client. Accents are folded ("Léa" → "lea"); a name that folds
 * away to nothing (a non-Latin script, say) simply drops out of the filename
 * rather than producing a file called "math-quizz-backup--2026-09-05.json".
 */
const slugify = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/, '');

export const backupFileName = (exportedAt: string, profileName = ''): string => {
  const day = exportedAt.slice(0, 10);
  const who = slugify(profileName);
  const parts = ['math-quizz-backup'];
  if (who !== '') parts.push(who);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) parts.push(day);
  return `${parts.join('-')}.json`;
};
