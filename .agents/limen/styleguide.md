# Styleguide

> Project-owned coding practice for every coordinator, worker, and reviewer turn. Keep this file at or below 1000 lines. The injected copy is capped at 1000 lines. Edit this file to change how agents write and organize code here. It is not product scope and not speech.

## Shape

- Pure logic in `src/domain/`, `localStorage` I/O in `src/storage/`, presentational components in `src/components/`, screens orchestrate in `src/screens/`. `App.tsx` is the screen state machine.
- A new screen mirrors an existing one (`ProgressScreen`, `InfoScreen`): a header with a 🏠 back button, then `*__panel` sections. Component CSS sits beside its `.tsx`.
- `CLAUDE.md` holds the invariants and their reasons. Read its section before touching profiles (`src/storage/`), the backup format (`src/domain/backup.ts`, `merge.ts`), statistics (`src/domain/stats.ts`) or anything release-related.

## Prefer

- Test first: a failing Vitest case in `src/__tests__/`, then the smallest code that passes. Finish with `pnpm test` and `pnpm build` (the build type-checks).
- Vitest for anything jsdom can reach. Playwright in `e2e/` only for the service worker, real reloads, download and file-picker flows, an unfaked clock, or layout.
- Every user-facing string keyed in all three of `src/i18n/{fr,de,en}.ts`. `i18n.test.ts` fails otherwise.
- E2E locators by `data-testid` named after the thing (`numpad-validate`), added only when a spec needs one. `getByRole()` without a name filter is fine.
- Small, focused commits with scoped conventional prefixes: `fix(progress):`, `test(e2e):`, `chore(release):`, `build(deps-dev):`.

## Avoid

- A default for the profile id in `profileStore` functions, or for `mode` in `importProfile`. The missing default is what makes a forgotten argument fail to compile.
- Splitting `App`'s `{ registry, settings }` state into two `useState`s.
- Using weighted statistics for numbers shown to the child, or raw ones for the draw. Reading `history` without going through `trackedSessions`.
- Caching derived statistics in `localStorage`, or bringing back a stored accumulator. A running total cannot be decayed.
- Backfilling session ids on load or import.
- Merging the two backup validation policies: structure is rejected, settings are sanitised.
- Runtime dependencies, chart libraries or UI kits.
- E2E locators by visible text or `aria-label`. The language is per profile, so text locators assert one dictionary.
