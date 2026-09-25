# Math Quizz

[![CI](https://github.com/mrpia/math-quizz/actions/workflows/ci.yml/badge.svg)](https://github.com/mrpia/math-quizz/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Timed mental-math drills (multiplication and division) for a child who already
knows the tables and wants to automate recall. Single-page app, trilingual UI
(FR/DE/EN), runs entirely in the browser, stores progress in `localStorage`.

## Privacy

**Nothing leaves the device.** This is an app for children, so the short
version matters more than the long one:

- **No backend, no accounts, no sign-in.** There is no server to send anything
  to — the production build is a folder of static files.
- **No analytics, no telemetry, no tracking, no cookies.** The bundle's only
  runtime dependencies are `react` and `react-dom`, and it loads no font, script
  or asset from a third-party host. The service worker re-fetches the app shell
  from this site's own origin to pick up new versions — that is the only network
  traffic the app generates, and it carries nothing about the user.
- **All state is `localStorage`, per browser and per device.** Settings, session
  history and the profile names a child types in stay in that one browser. They
  do not sync, and they are not readable by anyone but whoever holds the device.
- **A profile is a name and a storage prefix, not an identity** — no password,
  no PIN, no recovery. That is the design, not a gap: the data is a child's
  practice history on a family tablet, not something to protect from the family.
- **The only way data moves** is the user pressing **Settings → Tes données →
  Exporter**, which writes a JSON file wherever the browser's download dialog
  says. Nothing is uploaded.

The two outbound links in the app — the author credit and a "Buy me a coffee"
link, both on the À propos screen — are ordinary `<a href>`s that do nothing
until tapped. Adding any collection would be an explicit decision about what,
where and with what consent; see "No telemetry, no analytics" under
[Residual reservations](docs/roadmap.md#residual-reservations-to-reconsider-if-the-context-changes).

## Prerequisites

- Node.js **22** (22.22.2 or later) or **24** (24.15.0 or later), the two LTS
  lines CI tests on every push. `pnpm install` refuses any other version,
  including Node 26: `engines` in `package.json` sets the range and `.npmrc`
  turns pnpm's default warning into an error. The floors are jsdom's, not ours.
- pnpm **10+** (install with `npm install -g pnpm` or
  [`corepack enable`](https://pnpm.io/installation#using-corepack))

This project uses pnpm; `pnpm-lock.yaml` is the source of truth. Don't mix
with `npm install` (it would create a stray `package-lock.json` and a
divergent `node_modules`).

## Install

```bash
pnpm install
```

You may see a one-time warning `Ignored build scripts: esbuild` — it's
benign. The native esbuild binary still ships via optional dependencies
and the build works regardless.

## Develop

```bash
pnpm dev
```

Opens a Vite dev server (default `http://localhost:5173`) with hot module
reload. Open the URL in any modern browser. Both the on-screen number pad and
the physical keyboard (digits, `Backspace`, `Enter`) drive answers.

The dev server does not register a service worker, so development assets are
not cached for offline use. Test offline/PWA behaviour with `pnpm build` then
`pnpm preview`, which serves a production build with the worker enabled on a
different port (`4173`). Service worker scope is per origin, so the worker that
`pnpm preview` installs can never take over the dev server on `5173`.

If an older service worker is already controlling your localhost page, remove
that site's worker in DevTools → Application → Service Workers → **Unregister**,
then hard-reload. The production-only guard does not remove existing registrations.

## Test

```bash
pnpm test           # one-off Vitest run — the fast one, run this constantly
pnpm test:watch     # same, in watch mode
pnpm test:e2e       # Playwright, against a fresh production build
```

Two suites, and the split between them is a rule rather than a taste: **if a
test can be written in Vitest, it stays in Vitest.**

`pnpm test` is 30-odd files in `src/__tests__/`, source modules under `jsdom`.
It covers the domain logic, every component and several whole flows, and it
finishes in seconds.

`pnpm test:e2e` (specs in [`e2e/`](e2e/)) runs Chromium against `dist/` served
by `vite preview`, and earns its keep only where `jsdom` cannot follow:

| Spec | What only a browser can show |
|---|---|
| `offline.spec.ts` | the service worker installs, caches the shell and serves it with the network gone; a launch while online still prefers the network |
| `backup.spec.ts` | a real download, saved to disk, fed back through the real file picker — as a restore, and as a merge that matches on the ids the file carries |
| `profiles.spec.ts` | the active profile and its history survive an actual page reload |
| `bundle.spec.ts` | the built site serves the manifest, the icons, relative asset paths and the version `package.json` declares |
| `session.spec.ts` | the on-screen pad and a physical keyboard on a tablet-sized viewport, timed by a real clock |
| `progress.spec.ts` | the pair count stays on one line at phone width — layout, which Vitest never computes |

`playwright.config.ts` builds and starts the preview server itself, so
`pnpm test:e2e` needs nothing running first — the first run also needs
`pnpm exec playwright install chromium`. It type-checks the E2E tree
(`tsconfig.e2e.json`) before launching a browser; `pnpm build` deliberately does
not, so the typecheck that gates a release stays a typecheck of what ships.

What E2E does **not** cover: Firebase Hosting's `Cache-Control` headers.
`vite preview` does not reproduce `firebase.json`, and a service worker's
`fetch()` goes through the browser's ordinary HTTP cache — which is where the
one-hour-stale-deploy bug actually lived. That stays a deploy-time check.

### Selecting elements in E2E specs: `data-testid`

Every visible string and nearly every `aria-label` in this app is translated,
and the language is a per-profile setting. So `getByRole('button', { name:
'Lancer' })` would assert the French dictionary as a side effect of looking a
button up, and break on a copy change in a language the spec was never about.
E2E specs therefore select by test id — which `page.getByTestId()` reads from
`data-testid` by default, so nothing is configured for it.

- `getByTestId()` for identity; `getByRole()` **without** a name filter where
  the role alone is unambiguous. Roles are language-independent; accessible
  names are not. Filtering by a *profile* name is fine — the child typed it, no
  dictionary contains it.
- Add ids as specs need them, never preemptively.
- Name them after the thing, not the screen — `numpad-validate`,
  `profile-switcher`, `backup-export` — so a spec does not break when a
  component moves.
- They ship in the bundle. A handful of attributes does not justify a
  strip-at-build step.

None of this leaves the accessible names untested: `i18n.test.ts` enforces that
the three dictionaries share exactly the same keys, and `languageSwitch.test.tsx`
renders the screens once per language and asserts the characteristic word. One
render each, no browser — the right layer for it.

## Build

```bash
pnpm build
```

Produces a static bundle in `dist/`. The output is fully self-contained —
no backend, no environment variables, no runtime configuration.

## Preview the production build

```bash
pnpm preview
```

Or with any static server, e.g.:

```bash
pnpm dlx serve dist
```

Either approach mirrors what GitHub Pages / Netlify / Vercel will serve.

## Deploy

The app is a static bundle hosted on **Firebase Hosting** (project
`modern-ally-102412`), served at **https://math-quizz.mrpia.ch** with a free
Google-managed TLS certificate. There is no server — Firebase Hosting serves the
`dist/` files directly from Google's edge CDN.

Build and publish to Firebase Hosting in one command (needs `firebase-tools`
installed):

```bash
pnpm ship   # = pnpm build && firebase deploy --only hosting
```

`firebase.json` reproduces the old nginx behaviour: a `**` → `/index.html`
rewrite for the SPA fallback, a 1-year immutable cache on the content-hashed
`/assets/`, and `no-cache` on `sw.js` and `manifest.webmanifest`. Gzip/brotli
compression is automatic. `.firebaserc` pins the default project.

> Custom domain DNS lives at the `mrpia.ch` registrar: the `math-quizz` host
> points at Firebase Hosting via the record shown in the Firebase console →
> Hosting. The Google-managed certificate renews automatically.

### Deploying a fork

Four files carry the identity of *this* deployment. Change them and nothing
else points back here:

| File | What to change |
|---|---|
| [`src/config/site.ts`](src/config/site.ts) | `SITE_URL`, `AUTHOR_URL`, `SUPPORT_URL` — the credit line, the support link, and the origin the backup schema URL is built on |
| `.firebaserc` | your own Firebase project id (or delete it and host the `dist/` folder anywhere — Netlify, Vercel, GitHub Pages, any static server) |
| `public/schemas/math-quizz-backup-v1.schema.json` | its `$id`, to match your new `SITE_URL` |
| `.github/FUNDING.yml` | the sponsor account GitHub shows on the repo, which should match `SUPPORT_URL` |

Two of the four are enforced by `pnpm test`: `siteConfig.test.ts` fails if any
file under `src/` hard-codes one of those hosts again, and `backup.test.ts`
fails if the published schema's `$id` drifts from `BACKUP_SCHEMA_URL`. The other
two are not — `.firebaserc` is read by the Firebase CLI and `FUNDING.yml` by
GitHub, so nothing in the suite will remind you.

## Project layout

```
src/
├── App.tsx                 screen state machine
├── main.tsx                React bootstrap
├── domain/                 pure logic (questions, stats, types)
├── storage/                localStorage I/O
├── components/             UI primitives (NumPad, Timer, ...)
├── screens/                Home / Session / Results / Settings
├── hooks/                  useNumericKeyboard
├── styles/                 global CSS + design tokens
└── __tests__/              Vitest suite

e2e/                        Playwright specs, run against the built bundle
```

## Icons

The favicon and PWA icons derive from `public/icon.svg` (rounded, for the
`"any"` purpose) and `public/icon-maskable.svg` (full-bleed, for the
`maskable` purpose and the iOS `apple-touch-icon`). The committed PNGs are
regenerated with:

```bash
npx -y sharp-cli --density 576 -i public/icon.svg          -o public/icon-192.png          resize 192 192
npx -y sharp-cli --density 576 -i public/icon.svg          -o public/icon-512.png          resize 512 512
npx -y sharp-cli --density 576 -i public/icon-maskable.svg -o public/icon-maskable-512.png resize 512 512
npx -y sharp-cli --density 576 -i public/icon-maskable.svg -o public/apple-touch-icon.png  resize 180 180
```

## Stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + TypeScript
- [Vitest](https://vitest.dev/) with `jsdom`, and `@testing-library/react`, for
  the unit and component suite
- [Playwright](https://playwright.dev/) (Chromium only) for the handful of
  things that need a real browser
- No CSS framework — plain CSS with custom properties (light + dark mode)

## Storage layout

One key lists the people on this device; everything else is namespaced per
profile under `mathquizz:profile:<id>:`.

| Key | Type |
|---|---|
| `mathquizz:profiles` | `{ active, profiles: [{ id, name, createdAt }] }` — who exists, who is playing |
| `…:settings` | `Settings` (timer duration, question count, selected tables, mode, answer mode, language) |
| `…:history` | `SessionResult[]` capped at 50 |
| `…:training-history` | `SessionResult[]` from training mode, capped at 50 |

The profile that predates the feature keeps the id `default`, which is the id
its keys already used, so the migration moves nothing. A profile is a name and a
storage prefix, **not an identity**: no password, no PIN, no recovery — whoever
holds the device can switch to any profile on it.

Every per-pair statistic — "Paires à revoir", the table heat-map — is recomputed
from the histories on render; there is no separate statistics store. Sessions
are weighted by recency, an attempt `n` sessions back counting `0.5 ^ (n / 10)`
(`RECENCY_HALF_LIFE_SESSIONS` in `src/domain/stats.ts`). The 50-session cap is
sized to that half-life: past ~5 half-lives the remaining weight is negligible,
and a test asserts `HISTORY_LIMIT >= 5 * RECENCY_HALF_LIFE_SESSIONS`.

> Versions up to 0.10.0 also kept `…:errors`, a lifetime accumulator no screen
> ever read. It is no longer written; see `docs/data-format.md`.

Use the in-app **Settings → Effacer l'historique** button to reset the
histories; the user-facing `Settings` object is preserved.

## Export / import

**Settings → Tes données** writes one profile to one JSON file and reads it back
— the only backup an app with no backend can offer, and the way to move a
history between devices. The import dialog asks *which* profile the file lands
in and whether it **replaces** that profile (a restore: settings and both
histories become the file's) or is **added** to it (a merge: sessions the
profile already holds are skipped, the rest are sorted in, the destination's
settings stay). The registry is not part of the file, so importing never
creates, renames or removes a profile.

The file format is a published contract, not an internal detail:

- [`docs/data-format.md`](docs/data-format.md) documents it in prose, with `jq`
  recipes for processing your own export;
- [`public/schemas/math-quizz-backup-v1.schema.json`](public/schemas/math-quizz-backup-v1.schema.json)
  is the JSON Schema (2020-12), deployed alongside the app at
  `/schemas/math-quizz-backup-v1.schema.json` and linked from the Settings
  screen;
- `src/__tests__/backup.test.ts` pins the schema's `$id`, `format` and
  `formatVersion` to the constants in `src/domain/backup.ts`, so the published
  contract cannot drift from the code.

## Contributing

1. Branch off `main`: `git switch -c feat/<short-name>`.
2. Work test-first. Anything in `src/domain/` or a new component ships with a
   Vitest case; run `pnpm test` and `pnpm build` (the build also type-checks)
   before pushing. CI runs both on every pull request
   ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) — including
   Dependabot's, which is the point: a dependency bump that breaks the build
   should fail before it reaches `main`, not after. A separate CI job runs
   `pnpm test:e2e`, so a browser failure and a unit failure stay separate news.
   Touching the service worker, the backup file format or anything that has to
   survive a reload means running it locally too.
3. Keep the zero-runtime-dependency rule — no chart or UI libraries. An
   inline SVG or a few lines of CSS almost always do the job.
4. Follow the existing shape: pure logic in `src/domain/`, presentational
   components in `src/components/`, screens orchestrate. Every user-facing
   string is keyed in `src/i18n/{fr,de,en}.ts` — all three, or `pnpm test`
   fails.
5. Keep commits small and focused, then open a pull request against `main`.

## What's next

Open work is tracked in
[GitHub issues](https://github.com/mrpia/math-quizz/issues). Planned features
carry the [`enhancement`](https://github.com/mrpia/math-quizz/labels/enhancement)
label; the approachable ones are marked
[`good first issue`](https://github.com/mrpia/math-quizz/labels/good%20first%20issue).

[`docs/roadmap.md`](docs/roadmap.md) is no longer the backlog. It is kept as the
decision record: why each shipped feature ended up the way it did, and the
choices made deliberately — no learning mode, tables beyond the curriculum, no
telemetry, the 4-digit input cap — that are not up for re-litigation.

## License

[MIT](LICENSE) © 2026 Pierre-Arnaud Galiana.

Contributions are accepted under the same licence. The name "Math Quizz", the
author credit and the support link are not part of the grant in any meaningful
sense — they are just strings in [`src/config/site.ts`](src/config/site.ts), and
a fork is expected to change them.
