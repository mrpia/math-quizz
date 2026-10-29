# F001 · A perfect test earns a trophy and a congratulation

## Outcome

When a child finishes a test without a single mistake, the results screen shows 🏆 and a short congratulation in the profile's language. A test with any mistake looks exactly as it does today. It is a small reward for the drill the app exists for (product principle: timed drills, trilingual, written for a child).

## Scope

- "No mistake" means every answer correct. A wrong answer or a timeout is a mistake. A correct answer past the time target (the 🟡 case) is not.
- Screen and training sessions judge from the recorded answers. Paper sessions follow the live self-marks, so un-marking a row removes the trophy and re-marking restores it.
- Start at `ResultsScreen` (`src/screens/ResultsScreen.tsx`). Put the "is this perfect" decision in `src/domain/` as a pure function if it is more than one line.
- The congratulation is keyed in all three of `src/i18n/{fr,de,en}.ts`: tutoiement in FR, du-form in DE, casual EN.
- First artifact: a failing Vitest case in `src/__tests__/resultsScreen.test.tsx`, committed before any production code.

## Out of scope

- Sounds, animations, confetti (issue #16 owns end-of-session effects).
- Saving a "perfect" flag, a badge history, or anything in `localStorage` or the backup format.
- Release notes, changelog entry, version bump: there is no release in this change.
- Changing the score or the statistics.

## Acceptance

- A screen session with all answers correct shows 🏆 and the congratulation.
- A screen session with one wrong answer shows neither; one timeout shows neither.
- A screen session with a correct but slow answer and no other mistake still shows the trophy.
- A paper session starts with the trophy (all rows default to correct); un-marking a row hides it.
- A training session with every answer self-marked correct shows it; one self-marked wrong hides it.
- The congratulation exists in FR, DE and EN; `pnpm test` and `pnpm build` pass.

## Notes

The brief said `src/tests/`; this repo's Vitest suite lives in `src/__tests__/`, and `test.include` in `vite.config.ts` is pinned to `src/`. Use `src/__tests__/`.
