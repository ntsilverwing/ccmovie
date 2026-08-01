---
phase: 06-session-persistence-resume
plan: 03
subsystem: ui
tags: [react, resume-card, app-orchestration, session-persistence, indexeddb, ios-gesture-chain, d-07-presentation-lock]

# Dependency graph
requires:
  - phase: 06-session-persistence-resume
    provides: 06-01 persistence core (sessions.ts CRUD, SESSION_EXPIRY_MS, isSessionExpired, v2 schema) + 06-02 hook restore path (restoreSession, guarded persist effect)
  - phase: 05-lossless-playback-navigation
    provides: D-07-locked SessionBanner presentation (.session-banner* classes/DOM order), clock-free session module, iOS gesture-chain conventions (handlePlay), enterPlaybackHistory D-01/D-03 marker discipline
provides:
  - src/components/ResumeCard.tsx — sibling component, byte-faithful to D-07 banner presentation, I-7 live tick only for un-paused records
  - App.tsx boot hydration: loadSession() → once-per-launch isSessionExpired gate → persistedSession state
  - handleResumeFromSession: enableWakeLock-first gesture chain → id lookup → fileName fallback → fullscreen + enterPlaybackHistory + restoreSession + setView('playback') on hit; silent clear on dead soft-link
  - handleDismissCard: single-tap clearSessionRecord + card removal, no confirmation
  - ResumeCard/SessionBanner mutual exclusivity (card gated on hook session === null); new-import stop→clear→create→save replacement
affects: [06-UAT device verification, v1.1 milestone close, any future selection-view or App-boot work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling component over extension: persisted-session card copies SessionBanner's render tree verbatim (D-07) rather than widening the Phase-5-tested banner's props"
    - "Boot-once expiry evaluation: isSessionExpired runs exactly once per app launch in a []-deps mount effect — no timer, visibilitychange, or tap-time re-check (PA-7)"
    - "Gesture-chain ownership in App: wake lock synchronous-first, D-01 history marker ONLY on the cue-hit path (D-03 natural-exit preserved on dead soft-link)"

key-files:
  created:
    - src/components/ResumeCard.tsx
  modified:
    - src/App.tsx

key-decisions:
  - "PA-2 executed: ResumeCard is a SIBLING of SessionBanner; zero new CSS, zero new i18n keys — index.css session-banner rules unchanged (7) and translations.ts untouched across this plan's diff"
  - "PA-3 executed: paused-at-kill record resumes PLAYING from the frozen position (cinema relaunch intent), card shows the frozen 'Paused at {time}' with no tick"
  - "PA-5 executed: successful resume pushes updateSettings({ offsetMs: record.offsetMs }) for four-way agreement (engine/session/banner/controls)"
  - "PA-6/PA-7 executed: no visibilitychange re-read, no storage.persist, no BroadcastChannel; expiry evaluated exactly once per launch, tap-time re-check rejected (orphaned card converges via onEnded)"
  - "In-memory savedSubtitles fileName fallback accepted: card can only render after boot hydration settles (tap-before-hydration window is sub-human-reaction-time); fallback miss degrades to designed silent I-3 clear"

patterns-established:
  - "Persisted-session UI fed by App-level persistedSession state, NOT the playback hook (hook is idle post-relaunch); gated on hook session === null for exclusivity (UI-SPEC I-6)"
  - "Silent-absence error contract: corrupt record, DB load failure, and dead soft-link all resolve to card removal/absence — no error UI, no toasts, in a dark theater (I-3/I-8)"
  - "Gesture-batch restore entry: App composes wake lock → cue lookup → history marker → restoreSession → setView; the hook's restoreSession stays UI-free (06-02 seam)"

requirements-completed: [FILE-03]

coverage:
  - id: D1
    description: "ResumeCard component: reuses .session-banner* classes verbatim (session-banner, session-banner-resume, session-banner-dismiss present), derives paused state from record.pausedElapsedMs with zero PlaybackStatus imports, arms the 1000ms tick only while pausedElapsedMs === null, renders null without a persisted session; tsc -b clean"
    requirement: FILE-03
    verification:
      - kind: other
        ref: "grep gates on src/components/ResumeCard.tsx (session-banner/session-banner-resume/session-banner-dismiss/pausedElapsedMs present; PlaybackStatus count = 0) — all PASS; npm run build exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "App.tsx orchestration: persistedSession state + boot load/expiry effect (isSessionExpired single gate), handleResumeFromSession with enableWakeLock() (L186) BEFORE getSubtitle (L187) and enterPlaybackHistory (L202) only on the hit path, handleDismissCard, ResumeCard mounted in BOTH selection branches gated persistedSession !== null && session === null; full suite green"
    requirement: FILE-03
    verification:
      - kind: other
        ref: "grep gates on src/App.tsx (persistedSession/ResumeCard/isSessionExpired/clearSessionRecord/handleResumeFromSession/handleDismissCard present; gesture-chain line-order check) — all PASS"
        status: pass
      - kind: unit
        ref: "npm test — 112 tests, 8 files, PASS (includes 06-01/06-02 suites)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Device kill/relaunch resume loop: record written during play, card on relaunch with live tick, one-tap resume at wall-clock position, paused-at-kill frozen display, single-tap dismiss with byte-identical v1.0 selection page, expiry invalidation, new-import replacement"
    requirement: FILE-03
    verification:
      - kind: manual_procedural
        ref: "Task 3 checkpoint 7-step how-to-verify (PLAN Task 3) — DEFERRED: checkpoint auto-approved under --chain; carried to 06-UAT.md as human_needed"
        status: unknown
    human_judgment: true
    rationale: "Real-device kill/relaunch, wake-lock, fullscreen, and IndexedDB survival cannot be exercised in node/jsdom; Task 3's device checkpoint was auto-approved by the orchestrator (--chain mode) WITHOUT device execution — the seven-step checklist is recorded for gsd-verifier as human_needed in 06-UAT.md (/gsd-verify-work 6). Device verification did NOT happen in this plan's execution."

# Metrics
duration: 3 min
completed: 2026-08-01
status: complete
---

# Phase 06 Plan 03: Resume Card & App Orchestration Summary

**D-07-locked ResumeCard sibling component plus full App.tsx orchestration — boot hydration with once-per-launch expiry gating, one-tap gesture-chained resume to the wall-clock position, single-tap dismiss, and banner/card mutual exclusivity — completing the FILE-03 user surface: kill the app, relaunch, one tap back into the movie.**

## Performance

- **Duration:** 3 min (Tasks 1–2) + short continuation finalization (Task 3 disposition, gates re-run, docs)
- **Started:** 2026-08-01T22:29:30Z
- **Completed:** 2026-08-01T22:33:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 2 (1 created)

## Accomplishments
- `ResumeCard.tsx` created as a SessionBanner sibling: identical `.session-banner*` classes and DOM order [text block][resume][dismiss] (D-07 continuity lock), existing i18n keys only, paused presentation derived from `pausedElapsedMs !== null`, I-7 1000ms tick armed only for un-paused records, `session === null → null` guard
- App boot hydration: `loadSession()` resolves → `isSessionExpired(record, Date.now(), SESSION_EXPIRY_MS)` gates exactly once per launch (PA-7 / RESEARCH Pattern 4 lock — no timers, no visibilitychange, no tap-time re-check); expired/invalid records cleared leaving zero UI trace; empty store treated as normal (no writes)
- `handleResumeFromSession` gesture chain: `enableWakeLock()` synchronous FIRST (L186, iOS requirement) → `getSubtitle(record.subtitleId)` → fileName fallback over hydrated `savedSubtitles` → on hit: best-effort fullscreen, `enterPlaybackHistory` (D-01 marker on the hit path ONLY), `restoreSession` (06-02), `updateSettings({ offsetMs })` (PA-5), `setView('playback')`; on dead soft-link: silent clear + card removal (I-3, no toast/dialog, no history marker — D-03 natural-exit preserved)
- `handleDismissCard`: one × tap → `clearSessionRecord()` + card gone, zero confirmation friction (I-4, D-08)
- Exclusivity by construction: `ResumeCard` mounts in BOTH selection-view branches gated `persistedSession !== null && session === null`; loading a new subtitle runs stop → clear → create → save leaving exactly one `current` record
- Zero CSS, zero copy: `src/index.css` session-banner rules unchanged (7), `src/i18n/translations.ts` untouched across this plan's diff

## Task Commits

Each auto task was committed atomically:

1. **Task 1: Create ResumeCard.tsx (D-07-locked presentation, I-7 tick)** — `6456905` (feat)
2. **Task 2: App.tsx — boot hydration, resume/dismiss gesture chains, exclusive card mounts** — `b79afc9` (feat)
3. **Task 3: Device checkpoint (human-verify)** — no code commit; disposition recorded in "Checkpoint Disposition" below

**Plan metadata:** docs commit recorded below in Self-Check.

## Files Created/Modified
- `src/components/ResumeCard.tsx` — new sibling card component (+79): props `{ session, onResume, onDismiss }`; verbatim banner classes/DOM; record-derived paused presentation; I-7 interval with cleanup; D-07 lock JSDoc header
- `src/App.tsx` — (+126/−14): `persistedSession` state, boot load+expiry effect ([] deps, warn-fallback shape), `handleResumeFromSession`, `handleDismissCard`, conditional `ResumeCard` mounts in both selection branches, new-import replacement wiring

## Decisions Made

None beyond executing the planner-locked assumptions: PA-2 (sibling component, verbatim presentation reuse), PA-3 (paused-at-kill resumes PLAYING from frozen position), PA-5 (`updateSettings({ offsetMs })` four-way agreement), PA-6 (no visibilitychange/storage.persist/BroadcastChannel), PA-7 (boot-once expiry; tap-time re-check rejected — orphaned card converges via `onEnded`).

## Deviations from Plan

None — plan executed exactly as written. Both auto tasks matched the PATTERNS.md excerpts and all acceptance grep gates passed on first verification.

## Checkpoint Disposition (Task 3)

**Task 3 is a `checkpoint:human-verify` (gate: blocking) for the on-device kill/relaunch resume loop. It was AUTO-APPROVED by the orchestrator under auto-chain mode; NO device verification was performed during this plan's execution.**

- The seven-step device checklist (PLAN Task 3 `how-to-verify`) is carried to `.planning/phases/06-session-persistence-resume/06-UAT.md` as `human_needed` and will be exercised by `/gsd-verify-work 6` on a real Android PWA at minimum brightness.
- What WAS verified at finalization (this continuation): `npm test` PASS (112 tests, 8 files), `npm run build` PASS (tsc -b + vite, PWA precache), all Task 1–2 acceptance grep gates PASS, gesture-chain ordering re-confirmed by line inspection.
- Device-facing truths that MUST NOT be considered verified until UAT: record visibility in devtools during play, card appearance + live tick across real kill/relaunch, wake-lock + fullscreen engagement, wall-clock resume position against a real clock, paused-at-kill frozen display, single-tap dismiss + v1.0-identical selection page, >6h expiry invalidation on device, and new-import replacement.

## Prohibition Compliance

| Prohibition | Status |
|---|---|
| No expiry/staleness messaging in UI | Honored at code level — no expiry copy exists in component or translations (UAT step 6 confirms device presentation) |
| No dismiss confirmation/friction (D-08) | Honored at code level — `handleDismissCard` clears in a single tap; no dialog/interstitial exists |
| No new CSS/colors; banner classes untouched (D-07) | Verified — plan diff touches only ResumeCard.tsx + App.tsx; `grep -c session-banner src/index.css` = 7 (unchanged); translations.ts untouched in plan diff |
| No network transmission of session/movie identity | Honored — no fetch/XHR added; record stays in origin-isolated IndexedDB |
| Expiry evaluated exactly once per launch | Verified by construction — single []-deps boot effect; no timer/interval/visibilitychange re-check anywhere in App.tsx (device-observable behavior confirmed at UAT) |

## Issues Encountered

None — both task commits landed green; continuation re-ran all gates with first-attempt pass.

## User Setup Required

None - no external service configuration required.

## Verification Results

| Gate | Result |
|------|--------|
| `npm test` (full suite) | PASS — 112 tests, 8 files |
| `npm run build` (tsc -b + vite + PWA) | PASS |
| ResumeCard: session-banner / -resume / -dismiss / pausedElapsedMs greps | PASS |
| ResumeCard: `grep -c PlaybackStatus` = 0 | PASS |
| App.tsx: persistedSession / ResumeCard / isSessionExpired / clearSessionRecord / handleResumeFromSession / handleDismissCard greps | PASS |
| Gesture-chain line order: enableWakeLock L186 → getSubtitle L187 → enterPlaybackHistory L202 (hit-path only) | PASS |
| index.css session-banner count = 7; translations.ts absent from plan diff | PASS |
| Task 3 device verification | NOT PERFORMED — auto-approved under --chain; carried to 06-UAT.md (human_needed) |

## Next Phase Readiness
- **Phase 06 complete (3 of 3 plans):** FILE-03's full stack shipped — persistence core (06-01), hook restore path (06-02), user surface + orchestration (06-03)
- **Outstanding:** Task 3's seven-step device checklist is the phase's only remaining gate, queued as `human_needed` in 06-UAT.md for `/gsd-verify-work 6`; then v1.1 milestone close
- Threat mitigations live at code level: T-06-03-01 (isValidSession upstream + boot-once expiry), T-06-03-02 (strictly-greater predicate + clamped format), T-06-03-03 (React text-node rendering, accepted), T-06-03-04 (id→fileName fallback→silent clear)
- No blockers.

## Self-Check: PASSED

- Files: src/components/ResumeCard.tsx (FOUND), src/App.tsx (FOUND, modified) — plan-scope diff (632f423...HEAD) touches exactly these two files
- Commits: `6456905` feat(06-03) task 1, `b79afc9` feat(06-03) task 2 — both FOUND in git log
- Docs commit for this SUMMARY + STATE.md + ROADMAP.md recorded in the completion message
- Acceptance criteria: Task 1 (all greps, build) PASS; Task 2 (all greps, ordering, npm test, npm run build) PASS; Task 3 — checkpoint disposition recorded above (auto-approved, device loop carried to UAT; not claimed as verified)
- Plan-level verification: npm test + npm run build re-run at finalization, both exit 0

---
*Phase: 06-session-persistence-resume*
*Completed: 2026-08-01*
