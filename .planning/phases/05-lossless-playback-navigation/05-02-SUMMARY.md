---
phase: 05-lossless-playback-navigation
plan: 02
subsystem: playback/navigation
tags: [vitest, tdd, history-api, popstate, dependency-injection, pure-functions]

requires: []
provides:
  - "Pure, DOM-free history-entry policy (HistoryLike + PLAYBACK_ENTRY + isPlaybackEntry + enter/exitPlaybackHistory) — D-01/D-02/D-03 as tested code"
  - "Shared frozen {view:'playback'} marker contract for App.tsx wiring (05-04) and Phase 6 resume re-entry"
  - "FakeHistory stack-simulator test idiom (entries array + call counters) for host-API-free unit coverage"
affects: [05-03 (back control → exitPlaybackHistory), 05-04 (App.tsx popstate/handlePlay glue consumes all three exports), phase-06 (resume card re-entry walks the D-02 replace path)]

tech-stack:
  added: []
  patterns:
    - "Injectable host-API slice (HistoryLike) — policy modules name the minimal window.history surface and stay DOM-free (no jsdom dependency)"
    - "Frozen shared marker + field-level (not identity) matching — popstate structured clones always match isPlaybackEntry"
    - "Touch-only-own-entry invariant: pops run solely when the top entry is our marker (D-03), foreign/base history never consumed"

key-files:
  created:
    - src/playback/playbackHistory.ts
    - test/unit/playbackHistory.test.ts
  modified: []

key-decisions:
  - "HistoryLike interface injected instead of reading window.history directly: keeps the policy testable in the project's jsdom-free vitest setup and makes App.tsx (05-04) one-line glue"
  - "isPlaybackEntry checks state.view === 'playback' at field level: popstate hands structured clones, never the identical reference — identity checks would be a latent bug"
  - "Re-entry REPLACE (not push) keeps depth flat across pause→resume and banner→resume funnels (D-02); exit pops only when marker is on top so selection-page system back exits the app naturally (D-03)"

patterns-established:
  - "FakeHistory simulator: internal entries array (null-init base), push/replace/back call counters, pop-on-back semantics — assertable depth without a DOM History object"
  - "Policy-module JSDoc maps each function to its CONTEXT decision (D-01/D-02/D-03) and states the touch-only-own-marker invariant"

requirements-completed: [PLAY-08]

coverage:
  - id: D1
    description: "History-entry policy — enterPlaybackHistory push-over-base / replace-on-marker (D-02 anti-stack) / push-over-foreign, double-enter grows depth by exactly one"
    requirement: PLAY-08
    verification:
      - kind: unit
        ref: "test/unit/playbackHistory.test.ts#describe('enterPlaybackHistory') — 5 its passing (fresh push, replace-on-top, single-depth, foreign-preserving push, foreign-view push)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Touch-only-own-marker exit — exitPlaybackHistory pops only when marker on top and restores pre-playback entry; no-op on null/foreign/already-consumed tops (D-03, threat T-05-02-01)"
    requirement: PLAY-08
    verification:
      - kind: unit
        ref: "test/unit/playbackHistory.test.ts#describe('exitPlaybackHistory') — 6 its passing (pop-own, restore-previous-top, null no-op, foreign no-op, idempotent, selection-view untouched)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Marker detection truth table — PLAYBACK_ENTRY and its JSON structured clone both match; null/undefined/primitives/'playback' string/arrays/{}/{view:'selection'} rejected; extra fields tolerated"
    verification:
      - kind: unit
        ref: "test/unit/playbackHistory.test.ts#describe('isPlaybackEntry') — 10 truth-table its passing"
        status: pass
    human_judgment: false
  - id: D4
    description: "DOM-free module guarantee — zero window./document. reads outside comments (comment-excluding grep gate)"
    verification:
      - kind: other
        ref: "grep -vE '^\\s*(\\*|//|/\\*)' src/playback/playbackHistory.ts | grep -c -E 'window\\.|document\\.' → 0"
        status: pass
    human_judgment: false

duration: 2 min
completed: 2026-07-30
status: complete
---

# Phase 5 Plan 02: Playback History-Entry Policy Summary

**Pure, injectable D-01/D-02/D-03 system-back interception policy — push-once marker registration, replace-never-stack on re-entry, pop-own-marker-only on exit — 21 vitest cases over a FakeHistory stack simulator, zero DOM reads, zero new dependencies.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-30T21:26:43Z
- **Completed:** 2026-07-30T21:28:16Z
- **Tasks:** 2 (RED + GREEN; REFACTOR legitimately absent)
- **Files modified:** 2 (both created)

## Accomplishments

- `HistoryLike` interface + `PLAYBACK_ENTRY` frozen marker + `isPlaybackEntry` field-level matcher + `enterPlaybackHistory`/`exitPlaybackHistory` policy functions — five exports, ~70 LOC with decision-cited JSDoc, zero imports, zero DOM reads
- D-01/D-02/D-03 locked as executable policy: one entry per playback visit, re-entry refreshes via replaceState instead of stacking, exit consumes only our own marker (selection-page system back remains a natural app exit per D-03)
- Structured-clone-safe detection: JSON round-trip of the marker passes `isPlaybackEntry`, matching how popstate actually hands state back (pinned by dedicated truth-table test)
- Foreign-history preservation proven: pushes never replace foreign tops, exits never consume them — `{view:'selection'}` and arbitrary app states survive both directions untouched

## Task Commits

1. **Task 1 (RED): failing playbackHistory test suite** — `45fce6c` (test)
2. **Task 2 (GREEN): implement src/playback/playbackHistory.ts** — `55fd8fb` (feat)

**Plan metadata:** see `docs(05-02)` commit (SUMMARY + STATE/ROADMAP).

_Note: 2 tasks → 2 production commits; REFACTOR omitted because GREEN self-review found nothing to clean (threshold: commit only if changes occur)._

## Files Created/Modified

- `src/playback/playbackHistory.ts` — the policy module: HistoryLike injection contract, frozen marker, field-level matcher, enter/exit policy fns; JSDoc maps each function to D-01/D-02/D-03 and states the touch-only-own invariant
- `test/unit/playbackHistory.test.ts` — 21 vitest cases (10 truth-table + 5 enter + 6 exit) driven by a module-local FakeHistory with entries array and push/replace/back counters

## Decisions Made

- **Injected `HistoryLike` over direct `window.history` reads:** the project's vitest setup has no jsdom; injection keeps policy testable and reduces Plan 05-04's App.tsx wiring to passing the real history object once.
- **Field-level marker check instead of identity:** `history.state` on popstate is a structured clone — object-identity comparison would silently never match. Equality on `view === 'playback'` with null/array/primitive rejection is the whole check; extra fields tolerated.
- **No REFACTOR commit:** GREEN output is already minimal (five exports, single-branch policy fns); self-review found no duplication, naming drift, or dead branches.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertion miscounted setup pushes**
- **Found during:** Task 2 (GREEN) — first run had 20/21 passing; the single failure was in the test, not the module
- **Issue:** The "pushes over arbitrary foreign states" case asserted `pushCount === 1`, but the test's own setup `h.pushState({view:'selection'}, '')` already incremented the counter — the correct expectation is setup-pushes + 1. (Same failure class as 05-01's deviation: assertion arithmetic, not implementation.)
- **Fix:** Captured `pushesBeforeEnter` before the `enterPlaybackHistory` call and asserted `pushesBeforeEnter + 1`; `replaceCount === 0` (the behavior actually under test — push, never replace, over foreign tops) kept as the load-bearing assertion.
- **Files modified:** test/unit/playbackHistory.test.ts
- **Verification:** full suite green — 7 files / 82 tests
- **Committed in:** `55fd8fb` (GREEN commit, test fix included)

---

**Total deviations:** 1 auto-fixed (Rule 1 - test assertion arithmetic)
**Impact on plan:** None on scope or architecture; the exported contract (five symbols), the D-01/02/03 behavior, and the DOM-free gate all landed exactly as specified.

## Issues Encountered

None beyond the deviation above. (Pre-existing noise, out of scope: editor LSP stale-resolved both `src/playback/session.ts` and the new module while `tsc -b` and vitest resolved them fine — actual toolchain unaffected.)

## Threat Notes

- **T-05-02-01 (Tampering, mitigate):** satisfied — `isPlaybackEntry` field-checks before any `replaceState`/`back()`; no-op-on-foreign-top cases (null, foreign object, `{view:'selection'}`, already-consumed) are pinned by 6 exit tests.
- **T-05-02-02 (Info disclosure, accept):** satisfied — `PLAYBACK_ENTRY` is `{view:'playback'}` only; no user data enters history state.
- **T-05-02-SC (Tampering via npm, accept):** satisfied — zero new dependencies; `package.json`/lockfile untouched.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **05-03 (UI surfaces):** back control and banner/toast build independent of this module; no blockers.
- **05-04 (App.tsx integration):** all three exports are the documented consumers — `enterPlaybackHistory` in the play entry, `exitPlaybackHistory` in back-control/stop/idle-convergence exits, `isPlaybackEntry` in the popstate guard. The plan's `prohibitions` statement (interception touches only its own entries) is test-pinned here, so 05-04's glue is constrained to wiring.
- **TDD gate sequence verified:** `test(05-02)` (`45fce6c`) precedes `feat(05-02)` (`55fd8fb`); REFACTOR legitimately absent.
- **Note for reconciliation:** PLAY-08 lives in this plan's `requirements:` frontmatter; per orchestrator guidance requirement completion is reconciled at phase completion, not marked per-plan (05-01 marked it early — left as-is).

## Self-Check: PASSED

- `src/playback/playbackHistory.ts` — FOUND on disk
- `test/unit/playbackHistory.test.ts` — FOUND on disk
- Commit `45fce6c` (RED) — FOUND in git log
- Commit `55fd8fb` (GREEN) — FOUND in git log
- `npx vitest run` — 7 files / 82 tests, all passing (exit 0)
- `npm run build` — tsc -b + vite build (exit 0)
- Exports gate — module exports exactly: HistoryLike, PLAYBACK_ENTRY, isPlaybackEntry, enterPlaybackHistory, exitPlaybackHistory
- DOM gate: `grep -vE '^\s*(\*|//|/\*)' src/playback/playbackHistory.ts | grep -c -E 'window\.|document\.'` → 0

---
*Phase: 05-lossless-playback-navigation*
*Completed: 2026-07-30*
