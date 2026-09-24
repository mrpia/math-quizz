# Export / import file format

Math Quizz stores everything in the browser's `localStorage`. **Settings → Tes
données** writes that data to a single JSON file and reads it back. That file is
the only way the data ever leaves the device, so its shape is a published
contract rather than an internal detail.

- Machine-readable schema: [`public/schemas/math-quizz-backup-v1.schema.json`](../public/schemas/math-quizz-backup-v1.schema.json),
  served at <https://math-quizz.mrpia.ch/schemas/math-quizz-backup-v1.schema.json>
  and linked from the Settings screen.
- Code: [`src/domain/backup.ts`](../src/domain/backup.ts) (envelope, validation),
  [`src/storage/profileStore.ts`](../src/storage/profileStore.ts) (read/write).

## Envelope

```json
{
  "$schema": "https://math-quizz.mrpia.ch/schemas/math-quizz-backup-v1.schema.json",
  "format": "math-quizz-backup",
  "formatVersion": 1,
  "exportedAt": "2026-09-05T10:11:12.000Z",
  "appVersion": "0.12.0",
  "profile": "default",
  "profileName": "Léa",
  "data": {
    "settings": { "…": "…" },
    "history": [],
    "trainingHistory": [],
    "errors": {}
  }
}
```

`formatVersion` versions **this envelope**, not the app; it moves only on a
breaking change. `appVersion` is informational — compatibility is never decided
from it.

`profile` is the **id** of the profile the data came from — the segment in its
localStorage prefix. The profile that predates multiple profiles keeps the id
`default`; ones created since carry an opaque id. `profileName` is what the
child sees (`""` for the never-named original). Both are informational: the app
shows the name in the import confirmation and folds it into the suggested
filename, but the **destination** of an import is always the profile the user
picks in the dialog, never the one named in the file. An id minted on another
device may mean someone else here, or nobody.

Only `format`, `formatVersion` and `data` are required. A third party generating
a file may omit everything else, and the importer fills in a default. Inside
`data`, every section is optional too: an absent `history` imports as `[]`.

## What each section holds

| `data.*` | localStorage key | Contents |
|---|---|---|
| `settings` | `…:settings` | Timer target, question count, selected tables, mode, answer mode, language, adaptive-draw strength |
| `history` | `…:history` | Completed timed tests, oldest first, capped at 50 |
| `trainingHistory` | `…:training-history` | Completed training sessions, same shape, same cap |
| `errors` | — | **Deprecated.** Lifetime per-pair counters written by versions up to 0.10.0. Accepted on import, never exported |

The live sections live under the prefix `mathquizz:profile:<id>:`.

## One file is one profile

Since 0.12.0 a device can hold several named profiles — siblings sharing a
tablet. **A backup covers exactly one of them.** The list of who exists lives at
`mathquizz:profiles`, outside every profile prefix, and is deliberately *not*
part of the file:

- importing never creates, renames or deletes a profile. It overwrites one
  destination, chosen in the import dialog (default: the profile in use);
- so a file from another device can never rearrange this device's profiles, and
  a hand-edited file cannot conjure one into being;
- to move a sibling's data onto a new device you create the profile first, then
  import into it. Two steps, but no step where the app guesses who someone is.

A profile is a name and a storage prefix, not an identity: no password, no PIN,
no recovery. Whoever holds the device can read or export any profile on it. That
is the design, not an oversight — the data is a child's practice history on a
family tablet.

**Everything the app knows is derived from the two histories.** There is no
separate statistics store: per-pair figures — the heat-map, "Paires à revoir" —
are recomputed from `history` (or `trainingHistory`) on every render.

**About `errors`.** Versions up to 0.10.0 also kept a lifetime per-pair
accumulator at `…:errors`, and exported it. No screen ever read it, and since
0.11.0 statistics are recency-weighted, which a running total carrying no
timestamps cannot express — so it is no longer written. The field stays in the
schema, marked `"deprecated": true`: files in the wild still carry it, and they
must keep validating against the URL they name. On import it is shape-checked
and then dropped.

If you are computing your own figures from an export, note that the app weights
recent sessions more heavily: an attempt `n` sessions back counts
`0.5 ^ (n / 10)`. History is stored oldest-first, so the last entry is the most
recent one.

## Two conventions worth knowing

**Questions are stored as a pair, never as rendered text.** A question is
`{ a, b, op, expected }`. For `op: "mul"` the child sees `a × b` and `expected`
is `a×b`. For `op: "div"` the child sees `(a×b) ÷ a` and `expected` is `b`. The
same stored pair backs both directions.

**Error keys are canonical.** `errors` is keyed `"<low>x<high>"` with the
operands sorted ascending, so 7×8, 8×7 and 56÷7 all accumulate under `"7x8"`.

**`selfMarkedCorrect`, when present, is the verdict.** It overrides the
`given`/`expected` comparison for both scoring and statistics. Two modes write
it:

- **paper**: the app never sees the written answer, so `given` is `null` and
  the flag is what the child ticked on the results screen;
- **training**: `given` is the number typed, and the flag is the app's own check,
  stored at answer time.

Screen records leave it out and are judged on `given === expected`.

**A `null` `given` outside paper mode is legacy data.** Older versions cut a
screen question off when time ran out and stored `given: null`. No current mode
does that: a screen question waits for an answer however long it takes. Exports
may still carry such records from old histories, and the app still counts them
as timeouts.

## How the importer treats a file

Import is a **restore, not a merge**: each section replaces the one in the
browser. Nothing is written until the confirmation dialog is accepted.

Structure and settings are handled by deliberately different rules:

- **Structure is rejected, never repaired.** A malformed session, an
  unknown operator or an error key that is not a canonical pair fails the whole
  file. Dropping the bad records silently would hand the child a partial history
  that looks complete, and a junk pair key renders as "NaN × NaN" on the
  progress screen.
- **Settings are sanitised, never rejected.** Every setting has a safe default,
  so an out-of-range number is clamped to the range the Settings form accepts
  and an unknown enum value falls back to the default. `selectedTables` can
  never end up empty — question generation throws on an empty selection.

Unknown fields in the envelope are dropped on import. A `history` longer than 50
imports fine but is trimmed to the newest 50, the same cap the app applies to
its own writes.

The four rejection reasons map to their own message on screen:

| Reason | Meaning |
|---|---|
| `unreadable` | Not valid JSON |
| `not-a-backup` | Valid JSON, but `format` is not `math-quizz-backup` |
| `unsupported-version` | Right marker, `formatVersion` other than 1 |
| `corrupt` | Right envelope, malformed payload |

## Processing an export yourself

The file is plain JSON, pretty-printed with two-space indentation, so ordinary
tooling works. A few examples:

```bash
# Score of every recorded test, as a ratio.
# selfMarkedCorrect wins when present (paper and training records carry it).
jq '.data.history[] | {
      at: .startedAt,
      correct: ([.answers[] | select(
                   if has("selfMarkedCorrect")
                   then .selfMarkedCorrect
                   else .given == .question.expected end)] | length),
      total: (.answers | length)
    }' math-quizz-backup-2026-09-05.json

# The ten shakiest pairs by error rate
jq -r '.data.errors | to_entries
       | map(select(.value.attempts >= 3))
       | sort_by((.value.errors + .value.timeouts) / .value.attempts) | reverse
       | .[:10][] | "\(.key)\t\((.value.errors + .value.timeouts) / .value.attempts)"' \
   math-quizz-backup-2026-09-05.json
```

To validate a file against the schema with any JSON Schema 2020-12 validator:

```bash
npx -y ajv-cli validate --spec=draft2020 \
  -s public/schemas/math-quizz-backup-v1.schema.json \
  -d math-quizz-backup-2026-09-05.json
```

Add `--all-errors` to see every problem at once; ajv stops at the first by
default.

The schema and the importer agree on structure, and differ only where the
importer is deliberately more forgiving: a validator fails a settings value
outside its declared range, while the importer clamps it. Two behaviours the
schema does not express at all: the 50-entry trim on `history` /
`trainingHistory`, and the dropping of unknown envelope fields.

## Changing the format

Additive changes — a new optional field — keep `formatVersion: 1`. Anything that
would make an existing file unreadable bumps it, ships a
`math-quizz-backup-v2.schema.json` next to v1 (the old URL keeps resolving), and
teaches the importer to read both. `src/__tests__/backup.test.ts` pins the
schema's `$id`, `format` and `formatVersion` to the constants in
`src/domain/backup.ts`, so the two cannot drift unnoticed.
