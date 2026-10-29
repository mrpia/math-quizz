# Vision

> Human-owned durable intent for every role. Keep this file at or below 1000 lines. The injected copy is capped at 1000 lines; keep each item high-signal and move supporting history to feature notes. The coordinator may propose changes but does not invent or rewrite this intent unprompted.

## Product principles

- Timed multiplication and division drills for a child who already knows the tables and is automating recall. A test tool, not a teaching tool: a learning mode (no timer, immediate correction) would be a separate project, not an option on this one.
- Nothing leaves the device. No backend, accounts, analytics, telemetry, cookies or third-party assets. Any data collection needs an explicit owner decision on what, where and with what consent, never a quiet addition.
- All state lives in `localStorage`, per browser. A profile is a name and a storage prefix, not an identity: no password, PIN or recovery. That is the design, not a gap.
- Several children can share one device. Reading or writing the wrong profile's data is the worst bug this app can have.
- The backup file is a published contract for third parties (`docs/data-format.md`, JSON Schema under `public/schemas/`). Additive changes keep `formatVersion: 1`; anything that breaks an existing export ships a v2 schema beside v1.
- Statistics serve the child's practice: recency-weighted for ranking and the adaptive draw, raw for anything shown. Decay is per session, never wall-clock.
- Trilingual (FR/DE/EN) everywhere the child reads, including in-app release notes, written for a child: tutoiement in FR, du-form in DE, casual EN.
- Zero runtime dependencies beyond React. Inline SVG and plain CSS over libraries.
- Deliberate choices not up for re-litigation without an owner decision: tables 11, 12 and 15 stay in, input caps at 4 digits, paper tests are never recorded. Reasons in `docs/roadmap.md` (decision record; section numbers are cited elsewhere, never renumber).

## Current direction

- This checkout is a limen trial on branch `limen-trial`. Work lands on `limen-trial` only, never on `main`. Pushing `limen-trial` to `origin` is fine; never push any other branch or tag. No other GitHub writes (issues, PRs, comments, releases), no `pnpm ship` or other deploy, no version bump.
- Open product work lives in GitHub issues: #15 fill-in-the-blank division, #16 end-of-session sounds and animations, #17 voice mode. Trial tasks may draw on them; the issues stay the backlog of record.
