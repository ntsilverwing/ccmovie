---
phase: 05-lossless-playback-navigation
plan: 04
subsystem: [ui, playback]
tags: [react, history-api, wake-lock, fullscreen, pwa]

# Dependency graph
requires:
  - phase: 05-01
    provides: "Wall-clock session timing model (createSession, pauseSession, resumeSession, sessionElapsedMs)"
  - phase: 05-02
    provides: "Playback history policy (enterPlaybackHistory, exitPlaybackHistory, isPlaybackEntry)"
  - phase: 05-03
    provides: "Session UI surfaces (SessionBanner, SessionToast, back control, i18n keys, CSS)"
provides:
  - "Engine onEnded callback for auto-end convergence"
  - "Engine seekTo method for wall-clock re-anchor on resume"
  - "Hook session wiring with SessionIdentity and resyncToSession"
  - "App.tsx view decoupling from playback status"
  - "Android back gesture interception via popstate + history marker"
  - "Divergence-free leave/resume flows (double-release leave, gesture-chain resume)"
  - "Idle-convergence effect for auto-end marker retirement"
  - "Full PLAY-08 lossless navigation loop integrated"
affects: [06-persistent-sessions]

# Tech tracking
tech-stack:
  added: []
  patterns: [history-marker-interception, double-release-leave, gesture-chain-resume, idle-convergence]

key-files:
  created: []
  modified:
    - src/playback/PlaybackEngine.ts
    - src/hooks/usePlaybackEngine.ts
    - src/App.tsx
    - test/unit/playbackEngine.test.ts
    - src/components/PlaybackControls.tsx
    - src/hooks/useWakeLock.ts

key-decisions:
  - "onEnded fires on internal auto-stop paths only (natural exhaustion, cues-empty halt), NOT on explicit stop() — symmetric with hook's direct session clear"
  - "seekTo is offset-INCLUSIVE (same position space as banner display) for Android-suspend re-anchor"
  - "SessionIdentity uses fileName fallback for Phase-6 saved-list misses — soft link, not hard FK"
  - "Back control placement moved after fullscreen toggle per user override"
  - "Wake-lock indicator synced with actual NoSleep state"

patterns-established:
  - "History marker interception: popstate handler idempotent via viewRef guard; marker retired at every selection-bound exit"
  - "Double-release leave: disableWakeLock + exitFullscreen without touching engine lifecycle"
  - "Gesture-chain resume: wake + fullscreen + resync + play + setView in fixed order"

requirements-completed: [PLAY-08]

coverage:
  - id: D1
    description: "Engine onEnded signal fires on natural exhaustion, enabling auto-end convergence to idle"
    requirement: PLAY-08
    verification:
      - kind: unit
        ref: "test/unit/playbackEngine.test.ts#onEnded"
        status: pass
    human_judgment: false
  - id: D2
    description: "Engine seekTo re-anchors playback position from wall-clock session for Android-suspend robustness"
    requirement: PLAY-08
    verification:
      - kind: unit
        ref: "test/unit/playbackEngine.test.ts#seekTo"
        status: pass
    human_judgment: false
  - id: D3
    description: "Hook exposes session, resyncToSession, and SessionIdentity with Phase-6 fallback docs"
    requirement: PLAY-08
    verification:
      - kind: unit
        ref: "npm run build (typecheck)"
        status: pass
    human_judgment: false
  - id: D4
    description: "App.tsx view decoupled from playback status; view state drives rendering"
    requirement: PLAY-08
    verification:
      - kind: unit
        ref: "npm run build (typecheck)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Android back gesture intercepted via popstate; lands on selection without exiting PWA"
    requirement: PLAY-08
    verification:
      - kind: manual_procedural
        ref: "Task 3 human verification"
        status: unknown
    human_judgment: true
    rationale: "Requires Android device with installed PWA to verify back gesture behavior"
  - id: D6
    description: "Leave/resume flows: double-release leave keeps clock running, gesture-chain resume restores fullscreen+wake+position"
    requirement: PLAY-08
    verification:
      - kind: manual_procedural
        ref: "Task 3 human verification"
        status: unknown
    human_judgment: true
    rationale: "Requires Android device to verify screen-sleep resume and banner-vs-subtitle agreement"
  - id: D7
    description: "Every selection-bound exit (back control, Stop, auto-end) retires the history marker so system back exits app naturally"
    requirement: PLAY-08
    verification:
      - kind: manual_procedural
        ref: "Task 3 human verification — Stop-path and auto-end-path single-back-exit exams"
        status: unknown
    human_judgment: true
    rationale: "Requires Android device to verify marker retirement across all exit paths"

# Metrics
duration: 42min
completed: 2026-07-30
status: complete
---

# Phase 05 Plan 04 Summary

**Lossless navigation fully integrated: engine onEnded + seekTo, hook session wiring, App view decoupling, history interception, leave/resume flows, and PLAY-08 loop on Android PWA**

## Performance

- **Duration:** 42 min
- **Started:** 2026-07-30T20:55:36Z
- **Completed:** 2026-07-30T21:37:04Z
- **Tasks:** 3 (2 auto + 1 human checkpoint)
- **Files modified:** 10

## Accomplishments
- Engine onEnded callback fires on natural exhaustion for auto-end convergence to idle
- Engine seekTo method re-anchors playback from wall-clock session (Android-suspend robustness)
- Hook session wiring with SessionIdentity (Phase-6 fallback documented) and resyncToSession
- App.tsx fully decoupled from playback status — view state drives rendering
- Android back gesture intercepted via popstate with idempotent viewRef guard
- Leave/resume flows: double-release leave, gesture-chain resume, idle-convergence marker retirement
- Full PLAY-08 loop integrated — ready for human verification on Android PWA

## Task Commits

Each task was committed atomically:

1. **Task 1: Engine onEnded signal + hook session wiring** - `b7b83ee` (test) + `7bcf463` (feat)
2. **Task 2: App.tsx view decoupling + history interception + leave/resume flows** - `903a1e7` (feat)
3. **Task 2 fixes** - `684538c` (fix) + `acf01e6` (fix) + `aa3b021` (fix) + `b3ffe02` (docs)

## Files Created/Modified
- `src/playback/PlaybackEngine.ts` - Added onEnded constructor param and seekTo public method
- `src/hooks/usePlaybackEngine.ts` - Added SessionIdentity, session state, resyncToSession, identity param
- `src/App.tsx` - View decoupling, popstate interception, leavePlayback, handleBackControl, idle-convergence
- `test/unit/playbackEngine.test.ts` - New onEnded and seekTo test cases
- `src/components/PlaybackControls.tsx` - Back control placement adjustment
- `src/hooks/useWakeLock.ts` - Wake-lock indicator sync with NoSleep state

## Decisions Made
- onEnded fires on internal auto-stop paths only, NOT on explicit stop() — symmetric with hook
- seekTo is offset-INCLUSIVE matching banner position space for consistent resume calculations
- SessionIdentity uses fileName fallback for Phase-6 — soft link semantics, not hard FK
- Back control moved after fullscreen toggle per user override for better UX flow

## Deviations from Plan

### Auto-fixed Issues

**1. [User override] Back control placement after fullscreen toggle**
- **Found during:** Task 2 (App.tsx integration)
- **Issue:** User requested back control sit after fullscreen toggle in controls order
- **Fix:** Moved back control rendering position in PlaybackControls
- **Files modified:** src/components/PlaybackControls.tsx
- **Verification:** Build passes
- **Committed in:** acf01e6

**2. [Bug fix] Wake-lock indicator not syncing with NoSleep state**
- **Found during:** Task 2 (integration testing)
- **Issue:** Visual wake-lock indicator didn't reflect actual NoSleep.js state
- **Fix:** Synced indicator with actual NoSleep wake state
- **Files modified:** src/hooks/useWakeLock.ts
- **Verification:** Build passes
- **Committed in:** aa3b021

---

**Total deviations:** 2 auto-fixed (1 user override, 1 bug fix)
**Impact on plan:** Minor adjustments — no scope creep. Both fixes improve correctness.

## Issues Encountered
- None beyond the auto-fixed deviations above

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 05 complete — all plans executed and summarized
- Ready for phase verification (verify-work)
- Phase 06 (persistent sessions) can build on the session model and history interception

---
*Phase: 05-lossless-playback-navigation*
*Completed: 2026-07-30*
