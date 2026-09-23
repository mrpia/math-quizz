import type { Page } from '@playwright/test';
import type { SessionResult, Settings } from '../src/domain/session';

/**
 * Deterministic starting state for a spec, written straight into localStorage
 * before the page loads.
 *
 * This is the job `addInitScript` keeps in an E2E suite that selects by test
 * id: fixture setup, never element selection. A spec that needs a two-second
 * timer, four questions and the German dictionary says so here instead of
 * clicking its way through Settings first.
 */

export type ProfileSeed = {
  /** Also the storage prefix segment. `default` is the pre-profiles profile. */
  id: string;
  name: string;
  /** Merged over `DEFAULT_SETTINGS` by `loadSettings`, so partial is enough. */
  settings: Partial<Settings>;
  history?: SessionResult[];
};

export const REGISTRY_KEY = 'mathquizz:profiles';

export const settingsKey = (id: string) => `mathquizz:profile:${id}:settings`;
export const historyKey = (id: string) => `mathquizz:profile:${id}:history`;

/**
 * Seeds the registry and one storage bucket per profile. `active` defaults to
 * the first seed.
 *
 * The guard matters more than it looks: `addInitScript` runs before *every*
 * document in the page, reloads included. Seeding unconditionally would rewrite
 * storage on each reload and quietly make every "does this survive a reload?"
 * assertion vacuous — the specs would pass against an app that persists
 * nothing. So the script only ever fills storage that is still empty.
 */
export const seedProfiles = async (
  page: Page,
  seeds: ProfileSeed[],
  active: string = seeds[0].id,
): Promise<void> => {
  await page.addInitScript(
    ({ seeds, active, registryKey }) => {
      if (localStorage.getItem(registryKey) !== null) return;
      localStorage.setItem(
        registryKey,
        JSON.stringify({
          active,
          profiles: seeds.map((seed) => ({
            id: seed.id,
            name: seed.name,
            createdAt: '2026-01-01T00:00:00.000Z',
          })),
        }),
      );
      for (const seed of seeds) {
        const at = `mathquizz:profile:${seed.id}:`;
        localStorage.setItem(`${at}settings`, JSON.stringify(seed.settings));
        if (seed.history) {
          localStorage.setItem(`${at}history`, JSON.stringify(seed.history));
        }
      }
    },
    { seeds, active, registryKey: REGISTRY_KEY },
  );
};

/** Reads a profile's stored settings back — for invariants the UI cannot show. */
export const storedSettings = (page: Page, id: string): Promise<Settings> =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
    settingsKey(id),
  );

/**
 * A recorded session over one multiplication pair, `wrong` of its attempts
 * answered incorrectly.
 *
 * `trickiestPairs` only surfaces a pair with at least three raw attempts and a
 * non-zero weighted failure rate, so a fixture meant to be *visible* on the
 * progress screen has to clear that bar — hence the default of four attempts.
 */
export const sessionOverPair = (
  a: number,
  b: number,
  { attempts = 4, wrong = 1 } = {},
): SessionResult => ({
  startedAt: '2026-01-02T10:00:00.000Z',
  durationPerQuestionMs: 4000,
  partialCreditFactor: 0.5,
  questionCount: attempts,
  selectedTables: [a],
  mode: 'mul',
  answerMode: 'screen',
  answers: Array.from({ length: attempts }, (_, i) => ({
    question: { a, b, op: 'mul' as const, expected: a * b },
    given: i < wrong ? a * b + 1 : a * b,
    elapsedMs: 2000,
  })),
});
