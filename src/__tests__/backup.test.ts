import { describe, it, expect } from 'vitest';
import schemaRaw from '../../public/schemas/math-quizz-backup-v1.schema.json?raw';
import { SITE_URL } from '../config/site';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_SCHEMA_URL,
  backupFileName,
  createBackup,
  parseBackup,
  serializeBackup,
  summarizeBackup,
  validateBackup,
} from '../domain/backup';
import type { Backup, BackupData } from '../domain/backup';
import { DEFAULT_SETTINGS } from '../domain/session';
import type { SessionResult } from '../domain/session';
import { expectedAnswer, generateQuestions } from '../domain/question';
import type { Question } from '../domain/question';
import { MULTIPLICANDS, MULTIPLIERS } from '../domain/tables';

const session = (minute: number): SessionResult => ({
  startedAt: new Date(Date.UTC(2026, 4, 9, 8, minute, 0)).toISOString(),
  durationPerQuestionMs: 4000,
  partialCreditFactor: 0.5,
  questionCount: 1,
  selectedTables: [7],
  mode: 'mul',
  answerMode: 'screen',
  answers: [
    {
      question: { a: 7, b: 8, op: 'mul', expected: 56 },
      given: 56,
      elapsedMs: 1200,
    },
  ],
});

const data: BackupData = {
  settings: { ...DEFAULT_SETTINGS, questionCount: 11 },
  history: [session(1)],
  trainingHistory: [{ ...session(2), answerMode: 'training' }],
  errors: { '7x8': { attempts: 3, errors: 1, timeouts: 0 } },
};

const meta = {
  appVersion: '0.10.0',
  exportedAt: '2026-09-05T10:11:12.000Z',
  profile: 'default',
  profileName: '',
};

const ok = (result: ReturnType<typeof validateBackup>): Backup => {
  if (!result.ok) throw new Error(`expected ok, got problem "${result.problem}"`);
  return result.backup;
};

describe('createBackup', () => {
  it('wraps the data in a self-describing envelope', () => {
    const backup = createBackup(data, meta);
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(backup.$schema).toBe(BACKUP_SCHEMA_URL);
    expect(backup.exportedAt).toBe(meta.exportedAt);
    expect(backup.appVersion).toBe('0.10.0');
    expect(backup.profile).toBe('default');
    expect(backup.data).toEqual(data);
  });
});

describe('serializeBackup / parseBackup', () => {
  it('round-trips without losing anything', () => {
    const backup = createBackup(data, meta);
    expect(ok(parseBackup(serializeBackup(backup)))).toEqual(backup);
  });

  it('is pretty-printed so a human can read the file', () => {
    expect(serializeBackup(createBackup(data, meta))).toContain('\n  "format"');
  });

  it('reports "unreadable" for text that is not JSON', () => {
    expect(parseBackup('{ not json')).toEqual({ ok: false, problem: 'unreadable' });
  });
});

describe('validateBackup — envelope', () => {
  it.each([null, 42, 'text', [], {}])('rejects %p as not-a-backup', (value) => {
    expect(validateBackup(value)).toEqual({ ok: false, problem: 'not-a-backup' });
  });

  it('rejects a JSON file from another app', () => {
    expect(validateBackup({ format: 'something-else', formatVersion: 1, data: {} })).toEqual({
      ok: false,
      problem: 'not-a-backup',
    });
  });

  it.each([2, 0, '1', null])('rejects formatVersion %p as unsupported', (formatVersion) => {
    expect(validateBackup({ format: BACKUP_FORMAT, formatVersion, data: {} })).toEqual({
      ok: false,
      problem: 'unsupported-version',
    });
  });

  it('accepts a minimal third-party file: format + version + empty data', () => {
    const backup = ok(validateBackup({ format: BACKUP_FORMAT, formatVersion: 1, data: {} }));
    expect(backup.data.history).toEqual([]);
    expect(backup.data.trainingHistory).toEqual([]);
    expect(backup.data.settings).toEqual(DEFAULT_SETTINGS);
    expect(backup.exportedAt).toBe('');
    expect(backup.appVersion).toBe('');
  });

  it('rejects a file with no data object', () => {
    expect(validateBackup({ format: BACKUP_FORMAT, formatVersion: 1 })).toEqual({
      ok: false,
      problem: 'corrupt',
    });
  });

  it('keeps unknown envelope fields out of the imported result', () => {
    const backup = ok(
      validateBackup({ format: BACKUP_FORMAT, formatVersion: 1, data: {}, futureField: 'x' }),
    );
    expect(backup).not.toHaveProperty('futureField');
  });
});

describe('validateBackup — sessions', () => {
  const withHistory = (history: unknown) =>
    validateBackup({ format: BACKUP_FORMAT, formatVersion: 1, data: { history } });

  it('accepts a well-formed session', () => {
    expect(ok(withHistory([session(1)])).data.history).toEqual([session(1)]);
  });

  it('keeps a session id (#18), so a merge can match on it', () => {
    const withId = { ...session(1), id: '0123abcd' };
    expect(ok(withHistory([withId])).data.history[0].id).toBe('0123abcd');
  });

  it('accepts a session with no id — every file before 1.2.0', () => {
    expect(ok(withHistory([session(1)])).data.history[0]).not.toHaveProperty('id');
  });

  it('accepts a legacy session with no answerMode', () => {
    const { answerMode: _drop, ...legacy } = session(1);
    expect(ok(withHistory([legacy])).data.history[0].answerMode).toBeUndefined();
  });

  it('accepts a paper session with selfMarkedCorrect', () => {
    const paper = {
      ...session(1),
      answerMode: 'paper',
      answers: [{ ...session(1).answers[0], given: null, selfMarkedCorrect: true }],
    };
    expect(ok(withHistory([paper])).data.history[0].answers[0].selfMarkedCorrect).toBe(true);
  });

  it.each([
    ['history is not an array', 'not-an-array'],
    ['a session is not an object', [null]],
    ['startedAt is missing', [{ ...session(1), startedAt: undefined }]],
    ['the id is not a string', [{ ...session(1), id: 42 }]],
    ['the id is empty', [{ ...session(1), id: '' }]],
    ['answers is not an array', [{ ...session(1), answers: {} }]],
    ['an answer has no question', [{ ...session(1), answers: [{ given: 1, elapsedMs: 1 }] }]],
    [
      'a question has a non-numeric operand',
      [
        {
          ...session(1),
          answers: [
            { question: { a: 'seven', b: 8, op: 'mul', expected: 56 }, given: 56, elapsedMs: 1 },
          ],
        },
      ],
    ],
    [
      'an answer has an unknown operator',
      [
        {
          ...session(1),
          answers: [
            { question: { a: 7, b: 8, op: 'pow', expected: 56 }, given: 56, elapsedMs: 1 },
          ],
        },
      ],
    ],
    ['given is neither a number nor null', [{ ...session(1), answers: [{ ...session(1).answers[0], given: '56' }] }]],
  ])('rejects the file when %s', (_label, history) => {
    expect(withHistory(history)).toEqual({ ok: false, problem: 'corrupt' });
  });
});

describe('validateBackup — questions must be consistent (#45)', () => {
  const withHistory = (history: unknown) =>
    validateBackup({ format: BACKUP_FORMAT, formatVersion: 1, data: { history } });
  const withQuestion = (question: Question) => [
    { ...session(1), answers: [{ question, given: question.expected, elapsedMs: 1 }] },
  ];

  it.each<[string, Question]>([
    ['a product whose expected is not a×b', { a: 7, b: 8, op: 'mul', expected: 999 }],
    ['a division whose expected is not b', { a: 7, b: 8, op: 'div', expected: 56 }],
    ['a pair outside the tables with a wrong answer', { a: 13, b: 13, op: 'mul', expected: 170 }],
    ['a fractional operand', { a: 7.5, b: 8, op: 'mul', expected: 60 }],
    ['a zero operand', { a: 0, b: 8, op: 'mul', expected: 0 }],
    ['a negative operand', { a: 7, b: -8, op: 'mul', expected: -56 }],
  ])('rejects %s', (_label, question) => {
    expect(withHistory(withQuestion(question))).toEqual({ ok: false, problem: 'corrupt' });
  });

  // The tables have changed once (2026-06-13: multiplier 15 and 1 went, 24
  // and 25 came) and a session played the day before survives in real
  // storage. An export the app wrote must import again, so membership in
  // today's tables is not a condition — only that the question is a real
  // one, with positive whole operands and the right answer.
  it.each<[string, Question]>([
    ['2 × 15 asked as a division (a pre-deploy session)', { a: 2, b: 15, op: 'div', expected: 15 }],
    ['15 × 15, a square no table offers any more', { a: 15, b: 15, op: 'mul', expected: 225 }],
    ['3 × 1 as a division, from when 1 was a multiplier', { a: 3, b: 1, op: 'div', expected: 1 }],
    ['13 × 8, a pair the app never offered', { a: 13, b: 8, op: 'mul', expected: 104 }],
  ])('accepts %s when the arithmetic holds', (_label, question) => {
    expect(ok(withHistory(withQuestion(question))).data.history[0].answers).toHaveLength(1);
  });

  it('imports the 2026-06-12 session shape: tables 2–12 and 15, mix, multipliers 1 and 15', () => {
    const questions: Question[] = [
      { a: 2, b: 15, op: 'div', expected: 15 },
      { a: 12, b: 15, op: 'mul', expected: 180 },
      { a: 15, b: 15, op: 'mul', expected: 225 },
      { a: 3, b: 1, op: 'div', expected: 1 },
      { a: 4, b: 15, op: 'mul', expected: 60 },
      { a: 15, b: 1, op: 'div', expected: 1 },
      { a: 7, b: 8, op: 'mul', expected: 56 },
    ];
    const history = [
      {
        ...session(1),
        selectedTables: [2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 15],
        mode: 'mix' as const,
        answers: questions.map((question) => ({ question, given: question.expected, elapsedMs: 1 })),
      },
    ];
    expect(ok(withHistory(history)).data.history[0].answers).toHaveLength(questions.length);
  });

  it('rejects the whole file for one bad record among valid ones', () => {
    const tainted = {
      ...session(2),
      answers: [
        session(2).answers[0],
        { question: { a: 7, b: 8, op: 'mul', expected: 999 }, given: 999, elapsedMs: 1 },
      ],
    };
    expect(withHistory([session(1), tainted, session(3)])).toEqual({
      ok: false,
      problem: 'corrupt',
    });
  });

  it('accepts every pair the tables allow, in both directions', () => {
    const questions = MULTIPLICANDS.flatMap((a) =>
      MULTIPLIERS.flatMap((b) =>
        (['mul', 'div'] as const).map((op) => ({ a, b, op, expected: expectedAnswer(a, b, op) })),
      ),
    );
    const history = [{ ...session(1), answers: questions.map((question) => ({
      question,
      given: question.expected,
      elapsedMs: 1,
    })) }];
    expect(ok(withHistory(history)).data.history[0].answers).toHaveLength(questions.length);
  });

  // The guard against locking a child out of their own backup: whatever the
  // generator can draw, an export of it must import again.
  it.each(['mul', 'div', 'mix'] as const)(
    'round-trips a %s history drawn over every table',
    (mode) => {
      const draws = [
        ...MULTIPLICANDS.map((table) => [table]),
        [...MULTIPLICANDS], // all at once, so reversible pairs get swapped too
      ];
      const history = draws.map((selectedTables, i): SessionResult => {
        const settings = { ...DEFAULT_SETTINGS, selectedTables, mode, questionCount: 150 };
        return {
          ...session(i),
          selectedTables,
          mode,
          questionCount: settings.questionCount,
          answers: generateQuestions(settings).map((question) => ({
            question,
            given: question.expected,
            elapsedMs: 1,
          })),
        };
      });
      const exported = serializeBackup(createBackup({ ...data, history }, meta));
      expect(ok(parseBackup(exported)).data.history).toEqual(history);
    },
  );

  it('still accepts paper and training records — the rule is about question, not given', () => {
    const paper = {
      ...session(1),
      answerMode: 'paper',
      answers: [{ ...session(1).answers[0], given: null, selfMarkedCorrect: false }],
    };
    const training = {
      ...session(2),
      answerMode: 'training',
      answers: [{ ...session(2).answers[0], given: 54, selfMarkedCorrect: false }],
    };
    expect(ok(withHistory([paper, training])).data.history).toHaveLength(2);
  });
});

describe('validateBackup — the deprecated errors section', () => {
  it('still accepts a v1 file that carries it, so old backups keep working', () => {
    const backup = ok(
      validateBackup({
        format: BACKUP_FORMAT,
        formatVersion: 1,
        data: { errors: { '7x8': { attempts: 3, errors: 1, timeouts: 0 } } },
      }),
    );
    expect(backup.data.errors).toEqual({ '7x8': { attempts: 3, errors: 1, timeouts: 0 } });
  });

  it('leaves it absent when the file omits it', () => {
    const backup = ok(validateBackup({ format: BACKUP_FORMAT, formatVersion: 1, data: {} }));
    expect(backup.data).not.toHaveProperty('errors');
  });
});

describe('validateBackup — error stats', () => {
  const withErrors = (errors: unknown) =>
    validateBackup({ format: BACKUP_FORMAT, formatVersion: 1, data: { errors } });

  it('accepts canonical pair keys', () => {
    expect(ok(withErrors({ '7x8': { attempts: 3, errors: 1, timeouts: 0 } })).data.errors).toEqual({
      '7x8': { attempts: 3, errors: 1, timeouts: 0 },
    });
  });

  it.each([
    ['the key is not a canonical pair', { foo: { attempts: 1, errors: 0, timeouts: 0 } }],
    ['a counter is missing', { '7x8': { attempts: 1, errors: 0 } }],
    ['a counter is not a number', { '7x8': { attempts: '1', errors: 0, timeouts: 0 } }],
    ['a counter is negative', { '7x8': { attempts: -1, errors: 0, timeouts: 0 } }],
    ['errors is an array', []],
  ])('rejects the file when %s', (_label, errors) => {
    expect(withErrors(errors)).toEqual({ ok: false, problem: 'corrupt' });
  });
});

describe('validateBackup — settings are sanitized, not rejected', () => {
  const withSettings = (settings: unknown) =>
    ok(validateBackup({ format: BACKUP_FORMAT, formatVersion: 1, data: { settings } })).data
      .settings;

  it('falls back to the default for an unknown language', () => {
    expect(withSettings({ language: 'klingon' }).language).toBe(DEFAULT_SETTINGS.language);
  });

  it('falls back to the default for an unknown mode or answerMode', () => {
    const s = withSettings({ mode: 'sqrt', answerMode: 'telepathy' });
    expect(s.mode).toBe(DEFAULT_SETTINGS.mode);
    expect(s.answerMode).toBe(DEFAULT_SETTINGS.answerMode);
  });

  it('falls back to the default for an unknown adaptiveDraw', () => {
    expect(withSettings({ adaptiveDraw: 'maximum' }).adaptiveDraw).toBe(
      DEFAULT_SETTINGS.adaptiveDraw,
    );
    expect(withSettings({ adaptiveDraw: 'strong' }).adaptiveDraw).toBe('strong');
  });

  it('never lets selectedTables end up empty (generateQuestions throws on empty)', () => {
    expect(withSettings({ selectedTables: [] }).selectedTables).toEqual(
      DEFAULT_SETTINGS.selectedTables,
    );
    expect(withSettings({ selectedTables: [7, 999, 'x'] }).selectedTables).toEqual([7]);
  });

  it('clamps out-of-range numbers instead of trusting them', () => {
    const s = withSettings({
      questionCount: 100000,
      durationPerQuestionMs: -5,
      partialCreditFactor: 7,
    });
    expect(s.questionCount).toBe(200);
    expect(s.durationPerQuestionMs).toBe(1000);
    expect(s.partialCreditFactor).toBe(1);
  });

  it('snaps the target time to the 10 ms grid the timer can show', () => {
    // The timer and the labels show hundredths at most, so a target between
    // two hundredths would be applied but never shown. Same as the form.
    expect(withSettings({ durationPerQuestionMs: 2255 }).durationPerQuestionMs).toBe(2260);
    expect(withSettings({ durationPerQuestionMs: 2254.4 }).durationPerQuestionMs).toBe(2250);
    // Whole ms first, so 2254.9 lands where the form's "2.2549" does.
    expect(withSettings({ durationPerQuestionMs: 2254.9 }).durationPerQuestionMs).toBe(2260);
    expect(withSettings({ durationPerQuestionMs: 2.255 * 1000 }).durationPerQuestionMs).toBe(2260);
    expect(withSettings({ durationPerQuestionMs: 2250 }).durationPerQuestionMs).toBe(2250);
    expect(withSettings({ durationPerQuestionMs: 6500 }).durationPerQuestionMs).toBe(6500);
  });

  it('keeps a settings blob that is not an object from breaking the import', () => {
    expect(withSettings('nope')).toEqual(DEFAULT_SETTINGS);
  });
});

describe('backupFileName', () => {
  it('is dated from the export timestamp', () => {
    expect(backupFileName('2026-09-05T10:11:12.000Z')).toBe('math-quizz-backup-2026-09-05.json');
  });

  it('falls back to an undated name when the timestamp is absent', () => {
    expect(backupFileName('')).toBe('math-quizz-backup.json');
  });
});

describe('summarizeBackup', () => {
  it('counts what the confirm dialog shows before overwriting', () => {
    expect(summarizeBackup(createBackup(data, meta))).toEqual({
      sessions: 1,
      trainingSessions: 1,
      pairs: 1,
    });
  });
});

describe('published JSON Schema (drift guard)', () => {
  const schema = JSON.parse(schemaRaw);

  it('is served at the URL the app advertises', () => {
    expect(schema.$id).toBe(BACKUP_SCHEMA_URL);
  });

  it('pins the same format marker and version as the code', () => {
    expect(schema.properties.format.const).toBe(BACKUP_FORMAT);
    expect(schema.properties.formatVersion.const).toBe(BACKUP_FORMAT_VERSION);
  });

  it('requires exactly what validateBackup requires', () => {
    expect(schema.required).toEqual(['format', 'formatVersion', 'data']);
  });

  it('marks the errors section deprecated rather than deleting it', () => {
    // v1 files in the wild still carry it; removing it from the schema would
    // make them fail validation against the URL they name.
    expect(schema.properties.data.properties.errors.deprecated).toBe(true);
  });

  it('allows exactly the operands validateBackup allows: positive integers, any table', () => {
    const { a, b } = schema.$defs.question.properties;
    for (const operand of [a, b]) {
      expect(operand).toMatchObject({ type: 'integer', minimum: 1 });
      expect(operand).not.toHaveProperty('enum');
    }
  });

  it('declares the session id as an optional, documented string (#18)', () => {
    const { sessionResult } = schema.$defs;
    expect(sessionResult.properties.id).toMatchObject({ type: 'string', minLength: 1 });
    expect(sessionResult.properties.id.description ?? '').not.toBe('');
    // Additive: older files carry no id and must keep validating.
    expect(sessionResult.required).not.toContain('id');
    expect(schema.properties.formatVersion.const).toBe(1);
  });

  it('documents every top-level and data field', () => {
    for (const prop of Object.values(schema.properties) as { description?: string }[]) {
      expect(prop.description ?? '').not.toBe('');
    }
    for (const prop of Object.values(schema.properties.data.properties) as {
      description?: string;
    }[]) {
      expect(prop.description ?? '').not.toBe('');
    }
  });
});

describe('profileName on the envelope', () => {
  it('survives a round-trip', () => {
    const named = createBackup(data, { ...meta, profile: 'p2', profileName: 'Léa' });
    const back = ok(parseBackup(serializeBackup(named)));
    expect(back.profile).toBe('p2');
    expect(back.profileName).toBe('Léa');
  });

  it('reads as empty when the file predates the field, or carries junk', () => {
    const before = { ...createBackup(data, meta) } as Record<string, unknown>;
    delete before.profileName;
    expect(ok(validateBackup(before)).profileName).toBe('');
    expect(ok(validateBackup({ ...before, profileName: 42 })).profileName).toBe('');
  });
});

describe('backupFileName with a profile name', () => {
  it('folds the name into the file so two children\'s exports are told apart', () => {
    expect(backupFileName('2026-09-05T10:11:12.000Z', 'Léa')).toBe(
      'math-quizz-backup-lea-2026-09-05.json',
    );
  });

  it('is unchanged for a profile that never got a name', () => {
    expect(backupFileName('2026-09-05T10:11:12.000Z', '')).toBe(
      'math-quizz-backup-2026-09-05.json',
    );
  });

  it('keeps the filename usable whatever the name contains', () => {
    expect(backupFileName('2026-09-05T10:11:12.000Z', 'Jean-Luc / Marie')).toBe(
      'math-quizz-backup-jean-luc-marie-2026-09-05.json',
    );
    // A name that folds away to nothing drops out rather than doubling a hyphen.
    expect(backupFileName('2026-09-05T10:11:12.000Z', '小明')).toBe(
      'math-quizz-backup-2026-09-05.json',
    );
    expect(backupFileName('', 'Léa')).toBe('math-quizz-backup-lea.json');
  });
});

describe('the schema documents the profile fields', () => {
  const schema = JSON.parse(schemaRaw) as {
    properties: Record<string, { description?: string; type?: string }>;
  };

  it('declares profileName next to profile, both as strings', () => {
    expect(schema.properties.profile.type).toBe('string');
    expect(schema.properties.profileName.type).toBe('string');
  });

  it('no longer claims the profile is always "default"', () => {
    expect(schema.properties.profile.description).not.toMatch(/always 'default'/i);
  });

  it('stays at formatVersion 1 — profileName is additive', () => {
    expect(BACKUP_FORMAT_VERSION).toBe(1);
    expect(BACKUP_SCHEMA_URL).toContain('-v1.schema.json');
  });

  it('is served from the deployment this build belongs to', () => {
    // The schema URL travels inside every export, so it must follow the site
    // a fork retargets in src/config/site.ts — not a literal frozen here.
    expect(BACKUP_SCHEMA_URL.startsWith(`${SITE_URL}/`)).toBe(true);
  });
});
