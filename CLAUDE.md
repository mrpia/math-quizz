# math-quizz

A small, fully client-side React + TypeScript app: timed multiplication and
division drills for a child who already knows the tables. Trilingual UI
(FR/DE/EN) via `src/i18n/`. State (settings, session history) lives in
`localStorage` — no backend, no account.

## Commands

- `pnpm dev` — local dev server (Vite)
- `pnpm test` — run the vitest suite once (`pnpm test:watch` to watch)
- `pnpm test:e2e` — Playwright (Chromium) against a fresh production build
- `pnpm build` — typecheck (`tsc --noEmit`) then production build

## Releasing — keep three things in sync

The app version, the technical changelog, and the in-app "Nouveautés" notes
each have a single source of truth. On **every** version bump, change all
three together in the same commit:

1. **`package.json` `version`** — the one source of truth for the version
   number. It is injected into the bundle at build time (`vite.config.ts` →
   `__APP_VERSION__`) and shown on the À propos screen. Never hard-code a
   version in UI source.

2. **`CHANGELOG.md`** — contributor-facing, **English**, in
   [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format
   (`## [x.y.z] - YYYY-MM-DD` with `### Added` / `### Changed` / `### Fixed`).
   Technical detail is welcome here.

3. **`src/domain/releaseNotes.ts`** — user-facing, child-friendly, shown in-app
   on the À propos screen. Prepend a new
   `{ version, date, changes: { fr, de, en } }` entry at the top (newest first).
   `changes` is `Record<Language, string[]>`: write the note in **all three
   languages** (tutoiement FR / du-form DE / casual EN), each referencing the
   same UI labels the child sees. Keep notes short and about what the *user*
   gains, not implementation detail.

The drift guard (`src/__tests__/releaseNotes.test.ts`) ties all three to the
version in `package.json`:
- `releaseNotes[0].version` must equal `package.json` version (step 1 ↔ 3).
- `CHANGELOG.md` must contain a `## [<version>]` section for it (step 1 ↔ 2).
- every entry must carry non-empty `fr`, `de` **and** `en` notes — a missing
  translation fails `pnpm test`.

So forgetting the changelog entry, or any of the three language notes, on a bump
makes `pnpm test` fail. The `CHANGELOG.md` check is intentionally loose — it
only verifies the section header exists, not its contents.

## Profiles: the id is always an argument

Several people can share a device (siblings, a tablet). `storage/profileRegistry.ts`
owns one key, `mathquizz:profiles`, holding `{ active, profiles: [{ id, name,
createdAt }] }` **outside** every profile prefix. `storage/profileStore.ts` owns
everything *inside* a prefix, and every function there takes the profile id as
its first argument.

Do not give that argument a default. The store knowing nothing about who is
active is what stops a screen reading the wrong profile by forgetting to pass an
id — without a default it fails to compile instead. It also keeps the dependency
one-way (registry → store, for `purgeProfile` on delete), so there is no cycle.

Two invariants worth not breaking:

- **`App` holds `{ registry, settings }` as one state value.** Two `useState`s
  allow a render where `registry.active` is the new profile and `settings` is
  still the old one; the effect that persists settings then writes one child's
  preferences into another child's key. One object makes that unrepresentable.
- **`SettingsScreen` is keyed by the active profile id.** Its three numeric
  inputs seed from props on first render only, so deleting the active profile
  must remount the screen rather than leave stale numbers behind.

The profile that predates this feature keeps the id `default`, which is the id
its keys already use — migration moves nothing. Its `name` is `''` on purpose:
the app never asked for one, so the UI supplies a label (`profiles.unnamed`) and
renaming starts from an empty field.

A profile is a name and a storage prefix, **not an identity** — no password, no
PIN, no recovery. That is the design, not a gap.

## The backup format is a published contract

Settings → Tes données exports/imports the whole profile as one JSON file. Three
things describe that file and must move together:

- `src/domain/backup.ts` — the envelope constants and `validateBackup`;
- `public/schemas/math-quizz-backup-v1.schema.json` — the JSON Schema, deployed
  with the app and linked from the Settings screen, so third parties can process
  their own export;
- `docs/data-format.md` — the same contract in prose.

`src/__tests__/backup.test.ts` pins the schema's `$id`, `format`, `formatVersion`
and `required` list to the code, and requires a non-empty `description` on every
documented field — so a new field with no documentation fails `pnpm test`.

Additive changes keep `formatVersion: 1`. Anything that would make an existing
export unreadable bumps it and ships a `-v2` schema next to v1; the old URL keeps
resolving. Narrowing to what the app has always written (rejecting values no
released version produced, as #45 did for question operands) also keeps v1, but
say in the changelog that it narrows the schema for third-party writers.

**A backup is one profile, and the registry is not in it.** `profile` (an id)
and `profileName` are informational; the import destination is always the
profile the user picks in the dialog. So importing can never create, rename or
remove a profile, and a file from another device cannot rearrange this device's
people.

Two validation policies, deliberately different — don't "simplify" them into
one: **structure is rejected** (a malformed session or a non-canonical error key
fails the whole file, because a partial history that looks complete is worse than
a refusal), **settings are sanitised** (every setting has a safe default, and
`selectedTables` must never end up empty — `generateQuestions` throws on empty).

## Statistics are recency-weighted

Per-pair figures come from `domain/stats.ts` → `aggregatePairs(history)`, which
returns raw and weighted counters together. Keep the two uses apart:

- **raw** (`attempts` / `errors` / `timeouts` / `slow`) — confidence thresholds
  and any number shown to the child;
- **weighted** (`weightedAttempts` / `weightedFailures`, via
  `weightedErrorRate`) — ranking, colour and the adaptive draw.

A failure is the credit an answer did not earn, `1 - pointsFor(record,
session)`, under that session's own target and factor: a miss or a timeout
counts 1, a correct answer past the target counts `1 - partialCreditFactor`
(#47). Hesitation is what the drill works on, so a pair the results screen
flags 🟡 must not show as mastered on the progress screen. Paper and training
records carry a verdict, never partial credit, so slowness never counts there.
The `slow` count is display-only: without it a pair listed for slowness alone
would read "0 / 5".

Collapsing them would either flag pairs the child has already fixed or judge a
pair on one recent lucky answer. Decay is per *session*, never wall-clock: it
stays deterministic and does not blank the progress screen after a holiday.

**Paper tests are never recorded** (#44), the same way list mode never is. The
child marks the sheet against the answers shown on screen, so the app cannot
check a ✅, and because decay counts sessions, even an honest paper session would
age the real ones. Don't bring back a Save button or a "reviewed" flag. Older
versions did save paper sessions; `trackedSessions` (`stats.ts`) drops them at
read time in `loadPairStats` and on the progress screen, and leaves storage and
exports alone. A new reader of `history` should go through it too.

`HISTORY_LIMIT` is not arbitrary any more — it is sized to the half-life, and
`stats.test.ts` asserts `HISTORY_LIMIT >= 5 * RECENCY_HALF_LIFE_SESSIONS`. Raise
one and you must raise the other.

There is **no stored statistics accumulator**. Versions up to 0.10.0 kept one
that nothing read; don't reintroduce it, and don't "optimise" the render by
caching derived stats into localStorage — a running total cannot be decayed.

## Deploy

Static bundle on **Firebase Hosting** (GCP project `modern-ally-102412`), live at
`math-quizz.mrpia.ch`. Deploy with `pnpm ship` (builds, then `firebase deploy
--only hosting`). See `README.md` and
`docs/superpowers/specs/2026-06-13-firebase-hosting-design.md`.

## Two suites, and the line between them

**If a test can be written in Vitest, it stays in Vitest.** `pnpm test` is the
fast suite — source modules under jsdom, `src/__tests__/`. `pnpm test:e2e` runs
Chromium against `dist/` behind `vite preview`, and exists only for what jsdom
cannot reach: the service worker and Cache Storage, a real page reload, the
download and file-picker flows, and an unfaked clock. Five specs in `e2e/`;
adding a sixth means first showing the thing is out of jsdom's reach.

Two mechanics worth knowing before touching either:

- `test.include` in `vite.config.ts` is pinned to `src/`. Vitest's default glob
  matches from the repo root and would otherwise sweep `e2e/*.spec.ts` into
  `pnpm test`, where they cannot run.
- The PWA specs must run against the build: `registerServiceWorker()` returns
  early unless `import.meta.env.PROD`, so they do nothing against `pnpm dev`.

E2E does **not** cover `firebase.json`'s `Cache-Control` headers — `vite
preview` does not reproduce them, and that is where the stale-deploy bug lived.
Deploy-time check, not a test.

## Conventions

- TDD: write the failing test first (see existing `src/__tests__/`), then the
  minimal code to pass. Tests use vitest globals + Testing Library.
- New screens follow the `App.tsx` screen-state-machine pattern and mirror an
  existing screen (e.g. `ProgressScreen` / `InfoScreen`): a header with a 🏠
  back button, then `*__panel` sections. Component CSS sits beside the `.tsx`.
- UI copy lives in `src/i18n/{fr,de,en}.ts`; every user-facing string is keyed
  and translated into all three languages. `i18n.test.ts` enforces that the
  three dictionaries share exactly the same keys.
- E2E specs select by `data-testid` (Playwright's `getByTestId()` default, so
  nothing configures it), never by visible text or `aria-label`. That follows
  from the rule above: the language is a per-profile setting, so a name-based
  locator would assert one dictionary as a side effect of finding a button.
  `getByRole()` without a name filter is fine — roles are language-independent.
  Add ids as specs need them, never preemptively, and name them after the thing
  (`numpad-validate`, `profile-switcher`), not the screen.
