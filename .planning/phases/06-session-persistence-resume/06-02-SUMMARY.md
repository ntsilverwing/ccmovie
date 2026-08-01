---
phase: 06-session-persistence-resume
plan: 02
subsystem: hooks
tags: [react-hooks, indexeddb, session-persistence, restore-ordering, vitest, tdd]

# Dependency graph
requires:
  - phase: 06-session-persistence-resume
    provides: 06-01 persistence core — sessions.ts CRUD (SESSION_KEY), isValidSession/isSessionExpired, v2 schema
  - phase: 05-lossless-playback-navigation
    provides: clock-free session module (resumeSession/sessionElapsedMs no-jump), PlaybackEngine seekTo offset-inclusive contract
provides:
  - usePlaybackEngine.restoreSession(cues, persisted) — locked setCues → play() → seekTo engine prime
  - guarded write-on-change persist effect (hasPersistedRef; zero boot writes/deletes; StrictMode-idempotent)
  - restore-ordering contract tests locking setCues→play→seekTo and the seek-before-play clobber
affects: [06-03 resume card + App orchestration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Imperative engine prime on restore: setCues → play() → seekTo(sessionElapsedMs(live, now)) — never resync via prop effect"
    - "hasPersistedRef-gated effect-driven deletion: mount-time null session issues no delete (Pitfall-11 kill)"
    - "Characterization contract tests: lock engine ordering so a restoreSession reorder fails loudly"

key-files:
  created: []
  modified:
    - src/hooks/usePlaybackEngine.ts
    - test/unit/playbackEngine.test.ts

key-decisions:
  - "restoreSession ordering locked as setCues → play() → seekTo(sessionElapsedMs(live, now)); paused records unfreeze via resumeSession before play (no-jump); does NOT route through resyncToSession (its statusRef guard no-ops in the fresh-launch gesture batch)"
  - "Persist effect adopts PA-4's effect-driven deletion gated by hasPersistedRef, consciously deviating from RESEARCH Pattern 2's explicit deletes at stop()/onEnded sites — kills Pitfall-11 hook-locally, StrictMode-idempotent"

patterns-established:
  - "Restore engine prime: imperative setCues BEFORE play() inside the gesture batch; prop-effect setCues is one render too late (Pitfall 3)"
  - "Write-on-identity-change persistence: every setSession site allocates fresh/null → effect deps [session] === semantic transition; ticks never write"
  - "Mount-safety guard: instance-local has-persisted flag instead of cross-component hydratedRef"

requirements-completed: [FILE-03]

coverage:
  - id: D1
    description: "restoreSession executes setCues → play() → seekTo(offset-inclusive wall-clock elapsed) in that exact order on a fresh engine; the reversed seek-before-play order provably restarts at position 0 (clobber lock)"
    requirement: FILE-03
    verification:
      - kind: unit
        ref: "test/unit/playbackEngine.test.ts#PlaybackEngine restore ordering contract — fresh-engine restore anchors at the recorded position"
        status: pass
      - kind: unit
        ref: "test/unit/playbackEngine.test.ts#PlaybackEngine restore ordering contract — contract lock: seek BEFORE play() is clobbered to position 0"
        status: pass
      - kind: unit
        ref: "test/unit/playbackEngine.test.ts#PlaybackEngine restore ordering contract — no spurious onEnded when a near-exhausted engine is stopped and restored"
        status: pass
    human_judgment: false
  - id: D2
    description: "Guarded persist effect: writes saveSession on every session identity change, clears only after this instance saved, and performs zero writes/deletes at mount (Pitfall-11 delete-before-hydrate race killed, StrictMode-idempotent); engine ticks never trigger a write"
    requirement: FILE-03
    verification:
      - kind: other
        ref: "grep gates: restoreSession in return type + return object, sessions import, hasPersistedRef, setCues/play/seekTo line order — all PASS; npm test (112) + npm run build (tsc -b) green"
        status: pass
    human_judgment: true
    rationale: "Effect wiring across real IndexedDB + StrictMode double-invocation cannot be exercised in node-env Vitest (VALIDATION.md manual-only row: observe save/clear in devtools); deferred to 06-03 device checkpoint step 2 (kill→relaunch→card renders)"

# Metrics
duration: 3 min
completed: 2026-08-01
status: complete
---

# Phase 06 Plan 02: Hook Resume Path Summary

**usePlaybackEngine gains restoreSession(cues, persisted) with the contract-locked setCues → play() → seekTo engine prime and a hasPersistedRef-guarded write-on-change persist effect that can never wipe a record at boot — the correctness core of one-tap resume (FILE-03).**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-01T22:22:32Z
- **Completed:** 2026-08-01T22:26:02Z
- **Tasks:** 2 (both TDD-flagged)
- **Files modified:** 2 (0 created)

## Accomplishments
- Restore-ordering contract locked in `playbackEngine.test.ts` (18 tests, +3): fresh-engine restore anchors at the recorded position; seek-BEFORE-play provably restarts at position 0 (characterization lock); a stopped near-exhausted engine restored mid-movie never double-fires `onEnded`
- `restoreSession(cues, persisted)` on the hook: `resumeSession` no-jump unfreeze → imperative `setCues` BEFORE `play()` (Pitfall-3 prime) → `play()` → `seekTo(sessionElapsedMs(live, now))` offset-INCLUSIVE → `setSession(live)`; deliberately bypasses `resyncToSession` (statusRef guard no-ops pre-dispatch)
- Guarded persist effect: `saveSession` on every session identity change (create/pause/resume/offset/stop), `clearSessionRecord` only after this instance actually persisted — a fresh mount issues **zero writes and zero deletes**, killing the RESEARCH Pitfall-11 delete-before-hydrate race even under StrictMode double-mount
- Prohibition honored: no IndexedDB write from engine position ticks, rAF callbacks, or ticks of any kind — persistence fires only on session-object identity change

## Task Commits

Each task was committed atomically:

1. **Task 1: Restore-ordering contract tests** — `793acdb` (test)
2. **Task 2: restoreSession + guarded persist effect** — `026df03` (feat)

**Plan metadata:** recorded below in Self-Check (docs commit follows this file).

## Files Created/Modified
- `src/hooks/usePlaybackEngine.ts` — sessions DAL import; `hasPersistedRef` + `[session]`-deps persist effect; `restoreSession` useCallback; return-tuple type + object + JSDoc updated (+56/−2)
- `test/unit/playbackEngine.test.ts` — new `describe('PlaybackEngine restore ordering contract (Phase 6, FILE-03)')` with 3 cases, harness copied verbatim from the onEnded/seekTo block (+88)

## Decisions Made
- **Locked ordering + no resyncToSession on restore** — `play()` re-derives `startTime = performance.now() − pausedElapsed`, so a pre-play seek is discarded on a fresh engine; and `resyncToSession`'s `statusRef !== 'playing'` guard no-ops in the fresh-launch gesture batch (status still 'idle' pre-dispatch). The hook primes imperatively: setCues → play() → seekTo. Contract tests lock both directions.
- **PA-4 persist-effect form (conscious deviation from RESEARCH Pattern 2)** — planner-approved in the plan itself: effect-driven deletion gated by `hasPersistedRef` instead of explicit `clearSessionRecord()` at `stop()`/`onEnded` call sites. The flag starts false, so mount fires no delete (same safety property), without cross-component ref wiring or touching stop/onEnded bodies; StrictMode remounts keep the flag true across the dev double-invoke, so the record survives.

## Deviations from Plan

None - plan executed exactly as written. Both TDD tasks followed their prescribed verification; implementations matched the PATTERNS.md excerpts verbatim.

## TDD Gate Compliance

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| Task 1 (contract tests) | n/a — characterization locks | `793acdb` test | not needed |
| Task 2 (hook feature) | grep gates (restoreSession / sessions import / hasPersistedRef) all FAIL pre-implementation (0 matches) | `026df03` feat — gates PASS, npm test 112 green, tsc -b clean | not needed |

Note: Task 1's three tests are characterization/contract locks against engine behavior that shipped in Phase 5 — the plan prescribes them passing on first run ("frame the assertion as documenting the required ordering, not as desired end behavior"). A first-run failure would have signaled engine-contract drift. The new-feature RED for Task 2 was the failing grep/typecheck gates.

## Issues Encountered

None — both test runs and the build went green on first attempt.

## User Setup Required

None - no external service configuration required.

## Verification Results

| Command | Result |
|---------|--------|
| `npx vitest run test/unit/playbackEngine.test.ts` (Task 1 verify) | PASS (18 tests: 15 pre-existing + 3 contract) |
| `npx vitest run test/unit/session.test.ts test/unit/sessions.test.ts test/unit/playbackEngine.test.ts` (per-task sampling) | PASS (66 tests) |
| `npm test` (Task 2 verify, full suite) | PASS (112 tests, 8 files) |
| `npm run build` (Task 2 verify, tsc -b + vite) | PASS (clean, PWA precache generated) |
| grep: restoreSession in return-type annotation (L120) + returned object (L269) | PASS |
| grep: `from '../db/sessions'` | PASS |
| grep: `hasPersistedRef` | PASS |
| Call order in restoreSession: setCues (L262) → play() (L264) → seekTo (L265) | PASS |

## Next Phase Readiness
- **06-03 (ResumeCard + App orchestration)** fully unblocked: `restoreSession(cues, persisted)` is the gesture-batch entry point; the persist effect already mirrors every transition to IndexedDB; boot `loadSession()` can never race a mount-time delete
- Threat mitigations live: T-06-02-01 (no tick writes), T-06-02-02 (mount no-delete guard), T-06-02-03 (ordering contract tests)
- No blockers.

## Self-Check: PASSED

- Files: test/unit/playbackEngine.test.ts, src/hooks/usePlaybackEngine.ts (FOUND — 18 tests incl. restore contract describe; grep gates pass)
- Commits: `793acdb` test(06-02), `026df03` feat(06-02) — both FOUND in git log
- Acceptance criteria: Task 1 (vitest exit 0; 3 cases present; 15 pre-existing tests unmodified, green) — PASS; Task 2 (all grep gates, ordering line check, npm test, npm run build) — PASS
- Plan-level verification: all three commands exit 0; per-task sampling exits 0

---
*Phase: 06-session-persistence-resume*
*Completed: 2026-08-01*
