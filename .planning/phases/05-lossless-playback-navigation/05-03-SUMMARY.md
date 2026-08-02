---
phase: 05-lossless-playback-navigation
plan: 03
subsystem: ui
tags: [react, i18n, session-banner, session-toast, cinema-dark-css, PLAY-08]

requires:
  - phase: 05-lossless-playback-navigation
    provides: "05-01 wall-clock session module (PlaybackSession, sessionElapsedMs, formatElapsedHMS) consumed by the banner meta line"
provides:
  - "SessionBanner component (title + elapsed/paused meta + resume CTA + dismiss ×, null-render without session, D-06/D-07/D-08)"
  - "SessionToast component (passive role=status kept-session toast, 3500ms auto-fade, pointer-events none, I-4)"
  - "PlaybackControls optional onBack prop + .playback-back low-visual-weight control (D-09)"
  - "Six bilingual i18n session keys (resumePlaying, resumePlayingAria, sessionKeptToast, sessionElapsed, sessionPausedAt, dismissSession)"
  - ".session-banner / .session-toast / .playback-back CSS families honoring cinema luminance rule (all fills ≤ #222)"
affects: [05-04 app integration, phase-6 resume card (D-07 continuity lock)]

tech-stack:
  added: []
  patterns:
    - "Trigger-counter toast pattern: parent bumps a number prop, component arms a fresh auto-fade timeout per transition"
    - "Interval-in-effect tick gate: setInterval armed only while status === 'playing', cleared on cleanup; paused renders frozen pausedElapsedMs"
    - "Low-visual-weight destructive/back idiom: transparent fill, dim idle, bright :active, no dialogs anywhere (D-08/D-09)"

key-files:
  created:
    - src/components/SessionBanner.tsx
    - src/components/SessionToast.tsx
  modified:
    - src/components/PlaybackControls.tsx
    - src/i18n/translations.ts
    - src/index.css

key-decisions:
  - "resumePlayingAria split from resumePlaying — one key cannot hold both `Resume` and `Resume {fileName}` (planner-documented deviation accepted)"
  - "Adopted uncommitted partial work from interrupted prior run; verified on-plan, split CSS by hunk into per-task atomic commits"

patterns-established:
  - "锦上添花 presentation-only plan: components own zero session behavior; all wiring arrives in 05-04 via props"
  - "Cinema luminance budget enforcement: every new fill audited ≤ #222, accent luminance reserved for resume CTA + toast/banner title text only"

requirements-completed: [PLAY-08]

coverage:
  - id: D1
    description: "Six bilingual session i18n keys with en/zh key-order parity; zh sessionKeptToast locked to REQUIREMENTS PLAY-08 wording 原字幕已保留，可直接继续播放"
    requirement: PLAY-08
    verification:
      - kind: other
        ref: "npm run build (tsc en/zh parity proof) + grep gates for locked zh string and key parity"
        status: pass
    human_judgment: false
  - id: D2
    description: "SessionToast — passive role=status kept-session toast, 3500ms auto-fade, pointer-events none, null-render pre-trigger (I-4)"
    requirement: PLAY-08
    verification:
      - kind: other
        ref: "npm run build + grep gates (role=status x1, 3500 x1, zero pointer handlers)"
        status: pass
    human_judgment: true
    rationale: "Visual fade timing and top-center placement require live-session verification, deferred by plan design to 05-04's device checkpoint"
  - id: D3
    description: "SessionBanner — D-06 trio + dismiss, I-7 1000ms tick while playing, frozen meta while paused, Phase-6-locked DOM order [text][resume][dismiss]"
    requirement: PLAY-08
    verification:
      - kind: other
        ref: "npm run build + grep gates (session-banner x6, setInterval x1, no dangerouslySetInnerHTML)"
        status: pass
    human_judgment: true
    rationale: "Live ticking/paused-freeze behavior requires a real session; 05-04 device checkpoint covers it"
  - id: D4
    description: "PlaybackControls onBack — low-visual-weight back control as first child of playing‖paused branch (D-09), single tap, CSS opacity 0.55→1"
    requirement: PLAY-08
    verification:
      - kind: other
        ref: "npm run build + grep gates (playback-back x1, opacity 0.55 x1, onBack refs ≥2)"
        status: pass
    human_judgment: true
    rationale: "Mis-tap defense (visual weight) is a judgment call evaluated on device in 05-04's checkpoint"

duration: 2min
completed: 2026-07-31
status: complete
---

# Phase 05 Plan 03: Session UI Surfaces Summary

**SessionBanner (persistent resume banner, D-07 locked DOM), SessionToast (passive 3500ms fade), low-visual-weight PlaybackControls back control (D-09), six bilingual i18n keys, and three cinema-dark CSS families — pure presentation, wiring deferred to 05-04.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-31T02:41:07Z
- **Completed:** 2026-07-31T02:43:06Z
- **Tasks:** 3/3
- **Files modified:** 5 (2 created, 3 edited)

## Accomplishments

- `SessionBanner.tsx` — D-06 trio (title `#e0e0e0` 500 / `已播 h:mm:ss` monospace `#888` meta / 48px resume CTA) plus dismiss × (D-08 single-tap, no confirm); I-7 1000ms interval tick armed only while `playing`, frozen `pausedElapsedMs` render while paused; null-renders pre-session so selection page stays byte-identical to v1.0
- `SessionToast.tsx` — passive `role="status"` overlay keyed on a trigger counter, 3500ms dwell, 0.3s opacity fade (mirrors `.playback-controls` idiom), `pointer-events: none`, zero pointer handlers in file
- `PlaybackControls.tsx` — optional `onBack?: () => void`; `.playback-back` button renders as first child of the playing‖paused branch with `‹ {t('back')}` label (reuses existing `back` key — no new i18n key)
- Six type-locked bilingual keys appended with identical en/zh key order; zh `sessionKeptToast` pinned to REQUIREMENTS wording `原字幕已保留，可直接继续播放`
- Three CSS class families; every new fill audited ≤ `#222` (banner `#111`, toast `rgba(17,17,17,0.95)`, resume `#222`, dismiss `:active` `#331111`) per cinema luminance rule; all new touch targets ≥ 48×48px

## Task Commits

Each task was committed atomically:

1. **Task 1: i18n session keys + SessionToast component + toast CSS** — `fffd981` (feat)
2. **Task 2: SessionBanner component + banner CSS** — `1117915` (feat)
3. **Task 3: PlaybackControls low-visual-weight back control + CSS** — `5db7695` (feat)

**Plan metadata:** see final docs commit below (docs: complete plan)

## Files Created/Modified

- `src/components/SessionBanner.tsx` — created: PLAY-08 banner component (69 lines)
- `src/components/SessionToast.tsx` — created: PLAY-08 toast component (35 lines)
- `src/components/PlaybackControls.tsx` — modified: added optional `onBack` prop + `.playback-back` first-child button in playing‖paused branch
- `src/i18n/translations.ts` — modified: `// SessionBanner.tsx / SessionToast.tsx` section with 6 keys in both `en` and `zh`
- `src/index.css` — modified: `.session-toast`(+`.hidden`), `.session-banner` family (7 rules), `.playback-back`(+`:active`)

## Decisions Made

- **resumePlayingAria as a separate key** (planner-documented deviation, accepted): UI-SPEC's copywriting table lists the resume aria-label under the `resumePlaying` row with `{fileName}` interpolation, but one key cannot hold both `Resume` and `Resume {fileName}` — resolved as two keys, both in en+zh, preserving tsc key-parity.
- **Adopted uncommitted partial work** from an interrupted prior executor run (user-approved takeover): all five files were reviewed line-by-line against the plan's must_haves, the UI-SPEC color/typography/spacing tables, and the per-task acceptance criteria — no content changes were needed; `src/index.css` was temporarily reverted and re-appended in three task-scoped hunks so each commit stays atomic.

## Deviations from Plan

### Auto-fixed Issues

None — adopted work matched the plan contract exactly; every per-task automated verify gate passed on first run.

### Takeover Note (not a plan deviation)

**Adopted uncommitted partial work from an interrupted prior run.** Diff review confirmed: correct keys/values/order in `translations.ts`; `SessionToast` matches Task 1 action step-for-step (trigger prop, 3500ms timeout + cleanup, `session-toast`/`.hidden` root, `role="status"`); `SessionBanner` matches Task 2 (null guards, locked DOM order, playing-only interval, aria-labels with `{fileName}` interpolation, text-node rendering only); `PlaybackControls` matches Task 3 (optional prop, guarded first-child, `‹` prefix label); CSS matches every value in the UI-SPEC tables. Only the staging was redone (CSS split per task) — file contents are byte-identical to the reviewed takeover state.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** Plan executed exactly as written; pre-approved partial-work adoption only affected commit grouping.

## Issues Encountered

- `STATE.md` position had been left at "Plan: 1 of 4" by the interrupted run; corrected to "Plan: 4 of 4" via `state.advance-plan` after execution.
- `state.update-progress` reported "Progress field not found in STATE.md" (scaffold lacks the progress block the helper expects) — non-blocking; ROADMAP plan progress updated via `roadmap.update-plan-progress` instead.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. Threat register dispositions from the plan hold: T-05-03-01 (fileName → DOM) mitigated by text-node rendering, asserted by the `dangerouslySetInnerHTML` grep gate (0 matches); zero new dependencies (T-05-03-SC).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 05-04 can now wire against finished components: mount `SessionBanner`/`SessionToast` above `.saved-movies`, pass `onBack` into the playback-view `PlaybackControls`, supply `onResume`/`onDismiss` + session state from the 05-01 engine integration
- Visual/interactive verification of all three surfaces is intentionally deferred to 05-04's device checkpoint (integration context required — banner tick, toast lifecycle, back-control glanceability in darkness)

## Self-Check: PASSED

- FOUND: `src/components/SessionBanner.tsx`, `src/components/SessionToast.tsx` (created files exist)
- FOUND: commits `fffd981`, `1117915`, `5db7695` in `git log` (all `feat(05-03):`)
- PASS: `npm run build` exits 0 (tsc en/zh key parity structurally proven)
- PASS: all three tasks' automated verify gates (re-run post-commit)
- PASS: luminance audit — no fill brighter than `#222` in new CSS; touch targets ≥ 48×48px
- PASS: 05-03 row flipped in ROADMAP.md plan list; root `config.json` (untracked junk) excluded from all commits

---
*Phase: 05-lossless-playback-navigation*
*Completed: 2026-07-31*
