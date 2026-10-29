# Build

> Coordinator-maintained narrative board. Reconcile it with the planned and active feature folders before selecting, starting, resuming, reviewing, merging, proving, or dropping work. Update it in the same coherent change that changes feature state. Drift is an advisory, never a runtime gate.

TRACK at most three bullets. NOW one clause per feature plus one clause for the current slice, about forty words. NEXT one clause. PROVEN keeps the last ten landed features, then one line per older month: count landed, three highlights in product words, and the month's folder.

Status marks are prose only: 🟠 ACTIVE · 🔴 PLANNED · 🟢 PROVEN · ⚪ DROPPED. Nothing in `limen` treats them as workflow state.

## TRACK

- Engine and models: engine `pi`, provider `openrouter`, model `anthropic/claude-sonnet-5.5`. Workers run at `high` reasoning; coordination runs at `xhigh`.
- Review: the owner reviews personally. Do not start an independent reviewer unless the owner asks.

## NOW

- `FNNN-slug` (ACTIVE): <!-- One clause of outcome plus one clause of the current slice; about forty words. -->

## NEXT

- `FNNN-slug` (PLANNED): <!-- One clause: likely outcome, dependency, or sequencing reason. -->

## PROVEN

- `F001-perfect-score-trophy` (PROVEN): a test with no mistakes shows 🏆 and a congratulation on the results screen; landed `09a754d`, owner-reviewed.
- <!-- 2026-08: 40 landed. Hosted jobs end themselves; wakes reach the owning session; reviews stop at the ceiling. spec/features/done/2026-08/ -->
