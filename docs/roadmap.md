# Roadmap — decision record

> **The backlog moved to [GitHub issues](https://github.com/mrpia/math-quizz/issues).**
> Open work is tracked there and nowhere else. This file is kept as the record of
> *why* each shipped feature ended up the way it did, plus the design choices
> that were made deliberately and are not up for re-litigation.

Numbering is stable on purpose: the design notes under `docs/superpowers/specs/`
cite sections of this file by number (`docs/roadmap.md §1`, `§2`, `§3`), and
`CHANGELOG.md` refers to "roadmap item N". Renumbering would break both.

**Status legend**: ✅ done (written up below) · 📋 planned (one line, linking to
the issue that holds the detail).

## 1. PWA / service worker (offline + installable)

**Status**: ✅ Done — shipped in v0.3.0. Hand-rolled service worker
(`public/sw.js`): network-first for the HTML shell, cache-first for
content-hashed assets; web manifest + committed PNG icon set
(incl. maskable + iOS `apple-touch-icon`). No `vite-plugin-pwa`/Workbox —
kept the zero-dependency rule. Routing logic is unit-tested via
`src/sw/cacheStrategy.ts`.

**Why**: V1 already works without a network once the page is loaded
(everything is static + `localStorage`), but you have to reach the page a
first time, and the app doesn't install like a real app on a tablet or
phone.

**What's needed**:

- add a manifest (`public/manifest.webmanifest`) with icons and
  `display: standalone`;
- add a service worker — simple option: the
  [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/) plugin, which
  handles automatic generation in `injectManifest` or `generateSW` mode;
- cache strategy: `precache` the shell + assets, `cacheFirst` for the
  SVGs/icons — no network required, so nothing else to handle.

**When**: as soon as the child wants to use the app on a tablet without
opening a tab each time. Low cost (< 1h), big UX gain.

---

## 2. Adaptive weighting of draws

**Status**: ✅ Done — merged after v1.0.0 ([#14](https://github.com/mrpia/math-quizz/issues/14)),
ships in the next release. `generateQuestions(settings, stats?)` weights each
pair by `1 + α × weightedErrorRate`, with α set in Settings (off / moderate /
strong = 0 / 2 / 5, default moderate). The issue holds the original motivation.

**Decisions**:

- **Tests and training feed one statistic.** `loadPairStats` merges both
  histories by `startedAt` before `aggregatePairs`, so the decay runs over the
  order sessions were actually played. A pair missed in a test is exactly what
  training should bring back; feeding tests alone would give a child who only
  trains no adaptation at all. The progress screen still shows the two apart.
- **The stored setting names a level, not α.** `adaptiveDraw: 'off' |
  'moderate' | 'strong'` keeps the curve retunable in one constant
  (`ADAPTIVE_ALPHA`) without migrating anyone's saved settings or backups.
  Additive to backup format v1, so `formatVersion` stays 1.
- **Recency-weighted, never raw.** A test pins it: a pair with ten old
  failures and no recent ones draws like any other.
- **Unpractised pairs get a small boost.** A pair with no history is drawn
  as if its error rate were `UNPRACTISED_RATE` (0.25): above a mastered pair,
  below one missed half the time — so a newly selected table gets its turn
  without crowding out real trouble spots. A brand-new profile still draws
  uniformly, since every pair is equally unknown. Bayesian shrinkage
  (`(failures + U·k) / (attempts + k)`) was considered, since it would also
  treat evidence from long ago as weak; it was rejected because it is a soft
  minimum-attempts gate, which the next point rules out.
- **Efraimidis–Spirakis sampling, then a shuffle.** No pair repeats while the
  pool covers `questionCount`; the shuffle stops the heaviest pairs from
  clustering at the start. Repeats beyond the pool are drawn weighted too.
- **No confidence gate.** One recent miss can raise a pair's weight to 1 + α.
  For the draw that is the point — it re-asks, and one right answer halves the
  rate. The progress screen keeps its `minAttempts` threshold, because
  *showing* a pair as tricky is a judgement, and drawing it again is not.

---

## 3. "My results" page (progress chart)

**Status**: ✅ Done — shipped in v0.2.0. Built as `ProgressScreen` with two
score curves (correct/total + partial-credit), a "trickiest pairs" list, and
a 14×11 error heat-map; reachable from a 📈 button on the home screen. Pure
derivations live in `src/domain/progress.ts`; rendering is inline SVG.

**Why**: motivation. The child sees their score improve session after
session, and spots the most fragile tables.

**What's needed**:

- new `ProgressScreen.tsx` screen reachable from the home screen;
- read `history` (already in localStorage, capped at 50);
- two visualizations:
  1. `correct/total` score over the last N sessions (simple line);
  2. heat-map of errors per canonical pair (`stats.aggregateErrors` at the
     time — `stats.aggregatePairs` since v0.11.0).
- library: no need for Chart.js or Recharts for this — an inline SVG does
  the job nicely and stays true to the "zero superfluous dependency"
  philosophy.

**Prerequisite**: none, the data is already collected by `recordSession`.

---

## 4. Multiple named local profiles

**Status**: ✅ Done — shipped in v0.12.0. `storage/profileRegistry.ts` owns
`mathquizz:profiles` (`{ active, profiles: [{ id, name, createdAt }] }`) outside
every profile prefix; every function in `storage/profileStore.ts` now takes the
profile id as its first argument, with **no default** — a screen cannot read the
wrong profile by forgetting to pass one, it fails to compile. A switcher sits on
the home screen (hidden while a single profile exists), create / rename / delete
in Settings. Design notes:
`docs/superpowers/specs/2026-09-05-multiple-profiles-design.md`.

**Why**: siblings share one tablet. The app stores exactly one profile per
browser, so a brother's timeouts land in his sister's heat-map and the score
curve mixes two children into one line. Named profiles separate them without
giving up the rule that nothing leaves the device.

**Explicitly still stateless and credential-free**: a profile is a name and a
storage prefix, not an identity. No password, no PIN, no recovery, no account —
whoever holds the device can switch to any profile. That is the point: the data
is a child's practice history on a family tablet, not something to protect from
the family. If a profile ever needs protecting, that is a different feature and
a different conversation.

**What's needed**:

- storage keys are already prefixed `mathquizz:profile:default:`, and
  `storage/profileStore.ts` routes every key through the exported `PROFILE_ID`
  constant — turning that constant into an argument is the whole storage change;
- a registry outside the per-profile prefix, e.g. `mathquizz:profiles` holding
  `{ active: string, profiles: { id, name, createdAt }[] }`. Ids stay stable and
  opaque; the name is what the child sees and can rename;
- a profile switcher on the home screen, with create / rename / delete in
  Settings. Deleting a profile must offer an export first (item 9);
- migration on first open after the update: register the existing `default:`
  data as a profile, keeping the id `default` so nothing has to move;
- export / import (item 9) follows. The backup envelope already carries a
  `profile` field, but the importer ignores it and always writes the default
  profile. With several profiles, importing should ask *which* profile to write
  into, and the suggested filename should carry the profile name.

**How it shipped, where it differs from the above**:

- migration works as planned: the existing data is registered under the id
  `default`, so nothing moves. Its `name` is empty — the app never asked for
  one — and the UI renders "Sans nom" until it is renamed;
- the envelope gained `profileName` alongside `profile` (additive, so
  `formatVersion` stays 1). Both are informational: the import destination is
  always the profile the user picks in the dialog, never the one named in the
  file. **The registry is not part of a backup**, so importing can never create,
  rename or remove a profile;
- **the active profile is not shown on *every* screen.** The risk below is
  *starting a session as the wrong person*, and that decision is made on the
  home screen — which is exactly where the switcher lives, permanently. A badge
  on the session screen would arrive after the choice is irreversible, on the one
  screen deliberately kept free of everything but the question. So the profile
  is shown where it changes a decision or interprets data: home, "Mes résultats",
  and Settings;
- creating a profile does **not** switch to it. Creation happens in Settings,
  where the form above edits the current profile's numbers; switching there
  would silently re-target the next "Enregistrer".

**Minor risk**: if a parent and a child use the app alternately without properly
selecting the profile, the stats become wrong. Mitigated by the always-visible
switcher on the home screen (see above), not eliminated — nothing short of a
login could eliminate it, and a login is explicitly out of scope.

---

## 5. Fill-in-the-blank division (`a × ? = a×b`)

**Status**: 📋 Planned — tracked as [#15](https://github.com/mrpia/math-quizz/issues/15).

The full write-up (motivation, what is needed, guardrails and the invariants not
to break) moved to that issue, so there is one place to read and one place to
update.

---

## 6. Sounds and animations at the end of a session

**Status**: 📋 Planned — tracked as [#16](https://github.com/mrpia/math-quizz/issues/16).

The full write-up (motivation, what is needed, guardrails and the invariants not
to break) moved to that issue, so there is one place to read and one place to
update.

---

## 7. Language choice: FR, DE, EN

**Status**: ✅ Done — shipped in v0.5.0 (selector in Settings), extended in
v0.7.0 (the same `LanguageToggle` on the home screen, so the language changes
without opening Settings) and v0.9.0 (release notes localized too). Hand-rolled
i18n as planned, no `react-i18next`: `src/i18n/{fr,de,en}.ts` plus `translate()`
with `{placeholder}` interpolation. `LanguageProvider` sets
`document.documentElement.lang`, and `i18n.test.ts` enforces that the three
dictionaries share exactly the same keys — a missing translation fails
`pnpm test`.

**Why**: potentially multilingual home or classroom, future use outside
France.

**What's needed**:

- new field `Settings.language: 'fr' | 'de' | 'en'` (default `fr`, like the
  current UI);
- i18n layer: for ~30 strings a homemade solution is enough — a
  `src/i18n/{fr,de,en}.ts` dictionary plus a `t(key)` function.
  `react-i18next` is useful beyond ~100 strings or when you want plurals or
  complex interpolation;
- inventory the strings: `HomeScreen`, `SessionScreen`, `ResultsScreen`,
  `SettingsScreen`, `ModeToggle`, `TableSelector`, + the `aria-label`
  labels of the `NumPad`;
- language selector in Settings (flag or 2-letter code);
- update `<html lang>` on the fly so the TTS and accessibility tools pick
  the right locale.

**Prerequisite**: none.

**Tests to add**: for each language, render `HomeScreen` and
`ResultsScreen` and verify the presence of a characteristic keyword
("Lancer" / "Start" / "Starten").

**Note**: mathematical labels (`×`, `÷`, digits) stay unchanged —
universal.

---

## 8. Voice mode (audio reading of the question)

**Status**: 📋 Planned — tracked as [#17](https://github.com/mrpia/math-quizz/issues/17).

The full write-up (motivation, what is needed, guardrails and the invariants not
to break) moved to that issue, so there is one place to read and one place to
update.

---

## 9. Export / import of the local data

**Status**: ✅ Done — shipped in v0.10.0. **Settings → Tes données** writes the
whole profile to one JSON file and reads it back. The envelope is a published
contract: `public/schemas/math-quizz-backup-v1.schema.json` is live at
<https://math-quizz.mrpia.ch/schemas/math-quizz-backup-v1.schema.json> and linked
from the Settings screen, `docs/data-format.md` documents it in prose, and
`src/__tests__/backup.test.ts` pins the schema to the constants in
`src/domain/backup.ts` so the two cannot drift. (Firebase serves static files
ahead of the `**` → `/index.html` SPA rewrite, so that path really returns the
schema and not the app shell — worth re-checking if the rewrite rules change.)

**Why**: `localStorage` is the only copy. Clearing browser data, switching
device or reinstalling the PWA loses months of practice history, and nothing
short of an account could bring it back. An export file is the whole backup
story for an app that deliberately has no backend.

**Design notes worth keeping**:

- the export carries the two histories and nothing else. A lifetime error
  accumulator used to travel with them until v0.11.0 (item 11) removed it;
  `data.errors` survives in the schema marked deprecated, so files already in
  the wild keep validating;
- structure is rejected, settings are sanitised. See `domain/backup.ts` for why
  the two halves are treated differently;
- import is a restore, not a merge (item 10);
- since v0.12.0 (item 4) a restore has a *destination*: the import dialog asks
  which profile to overwrite, defaulting to the one in use. The file names its
  source profile but never picks the target.

---

## 10. Merge on import

**Status**: 📋 Planned — tracked as [#18](https://github.com/mrpia/math-quizz/issues/18).

The full write-up (motivation, what is needed, guardrails and the invariants not
to break) moved to that issue, so there is one place to read and one place to
update.

---

## 11. Recency-weighted statistics

**Status**: ✅ Done — shipped in v0.11.0. `domain/stats.ts` →
`aggregatePairs(history)` folds a history into raw and weighted counters in one
pass; an attempt `n` sessions back counts `0.5 ^ (n / RECENCY_HALF_LIFE_SESSIONS)`
with a half-life of 10.

**Why**: found while building item 9. The app maintained a lifetime per-pair
accumulator that **no screen ever read** — `ProgressScreen` recomputed from the
capped `history` throughout. Two divergent statistics, no stated source of
truth, one of them dead.

The interesting part was that the dead one was arguably the *wrong* one to
revive: lifetime counters never forget, so a pair the child mastered months ago
keeps its old failures forever and crowds out what is actually shaky. Weighting
by recency resolves both problems at once and makes the accumulator redundant —
a running total with no timestamps cannot be decayed.

**Decisions worth not re-litigating**:

- decay is per **session**, not wall-clock. Elapsed-time decay is pedagogically
  truer, but after a school holiday every weight collapses and the heat-map goes
  grey — statistically correct, reads as broken. Session decay is also
  deterministic and testable without mocking a clock;
- **confidence from raw counts, ranking from weighted rate.** The `minAttempts`
  filter and the "3 / 5" on each row stay raw; only ordering and colour are
  weighted. Collapsing the two would drop a pair practised three times long ago
  below the confidence threshold entirely;
- `HISTORY_LIMIT` is now sized to the half-life rather than to storage. 50
  sessions is 97 KB, ~2% of a 5 MB quota — it was never a real storage guard.
  At half-life 10 the newest 50 carry >96% of all weight; a test asserts
  `HISTORY_LIMIT >= 5 * RECENCY_HALF_LIFE_SESSIONS`.

**Follow-up**: item 2 (adaptive weighting of draws) built the draw side on
this statistic.

---

## Residual reservations (to reconsider if the context changes)

These points are neither bugs nor missing features — they are **deliberate
design choices** made at the time of V1. They're listed here so we can
explicitly reopen them if the context evolves.

### Pure test mode, no learning

The app assumes the child already knows their tables. If another child in
the discovery phase has to use the tool, a **learning mode** will be needed
(no timer, with immediate correction) — that's a separate project, not an
option to add to the test mode.

### Tables 11, 12, 15 outside the official curriculum

The client's choice. If the educational objective changes, modifying the
`MULTIPLICANDS` constant in `src/domain/tables.ts` is enough; no other file
depends on the exact list.

### No telemetry, no analytics

Deliberate. No data leaves the device. If we ever want to track usage (for
example to iterate on perceived difficulty), it will require an **explicit**
decision on what to collect, where, and with what consent — not a quiet
addition.

### Input limited to 4 digits

`SessionScreen.handleDigit` caps at 4 digits. The largest possible result
with `MULTIPLICANDS × MULTIPLIERS` is `15 × 15 = 225` (3 digits). If we
extend the tables beyond 31 (`32 × 32 = 1024`), this limit will need to be
widened.
