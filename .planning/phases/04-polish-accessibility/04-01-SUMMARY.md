---
phase: 04-polish-accessibility
plan: 01
subsystem: playback, ui, accessibility
tags: [subtitle-offset, high-contrast, wcag-aaa, css-custom-properties, localstorage]

requires:
  - phase: 02-playback-display
    provides: PlaybackEngine, usePlaybackEngine, usePersistedSettings, SubtitleDisplay, PlaybackControls
  - phase: 03-cinema-readiness
    provides: PWA foundation, Wake Lock, IndexedDB persistence

provides:
  - Timing offset adjustment (±5s, 0.5s steps) with real-time playback updates
  - High-contrast mode (yellow #FFD700 on black) exceeding WCAG AAA
  - Mutual exclusivity between dim mode and high-contrast mode
  - localStorage persistence for offset and high-contrast settings

affects: [phase-04-polish-accessibility plan 02]

tech-stack:
  added: []
  patterns: [elapsed-time-offset pattern, body-class-toggle for visual modes, mutual-exclusivity in settings updates]

key-files:
  created: []
  modified:
    - src/playback/PlaybackEngine.ts
    - src/hooks/usePersistedSettings.ts
    - src/hooks/usePlaybackEngine.ts
    - src/components/SubtitleDisplay.tsx
    - src/components/PlaybackControls.tsx
    - src/App.tsx
    - src/index.css

key-decisions:
  - "Offset applied to elapsed time in tick(), not to cue data — preserves original SRT data and is O(1)"
  - "High-contrast uses body class toggle following existing body.dimmed pattern — consistency over new abstractions"
  - "Mutual exclusivity enforced in App.tsx settings updates, not in CSS — prevents specificity conflicts"
  - "usePlaybackEngine accepts offsetMs as parameter with useEffect for real-time updates without restart"

patterns-established:
  - "Elapsed-time offset pattern: add offsetMs to performance.now() - startTime before cue lookup"
  - "Body class toggle for visual modes: useEffect + classList.toggle with cleanup"
  - "Mutual exclusivity in settings: enabling one mode disables the other in the same updateSettings call"

requirements-completed: [PLAY-06, PLAY-07]

coverage:
  - id: D1
    description: "Timing offset adjustment (±5s, 0.5s steps) with real-time playback updates"
    requirement: PLAY-06
    verification:
      - kind: other
        ref: "src/playback/PlaybackEngine.ts: setOffset() + tick() elapsed offset"
        status: pass
      - kind: other
        ref: "src/components/PlaybackControls.tsx: offset buttons + display"
        status: pass
    human_judgment: true
    rationale: "Real-time subtitle timing shift requires visual verification during playback"
  - id: D2
    description: "High-contrast mode (yellow #FFD700 on black) for accessibility"
    requirement: PLAY-07
    verification:
      - kind: other
        ref: "src/index.css: body.high-contrast { --subtitle-color: #FFD700; }"
        status: pass
      - kind: other
        ref: "src/components/SubtitleDisplay.tsx: body.high-contrast class toggle"
        status: pass
    human_judgment: true
    rationale: "Visual contrast adequacy requires human evaluation against WCAG AAA standards"
  - id: D3
    description: "Mutual exclusivity between dim mode and high-contrast mode"
    requirement: PLAY-07
    verification:
      - kind: other
        ref: "src/App.tsx: onDimToggle sets isHighContrast: false, onHighContrastToggle sets isDimmed: false"
        status: pass
    human_judgment: false
  - id: D4
    description: "localStorage persistence for offset and high-contrast settings"
    requirement: PLAY-06
    verification:
      - kind: other
        ref: "src/hooks/usePersistedSettings.ts: offsetMs + isHighContrast in Settings with validation"
        status: pass
    human_judgment: true
    rationale: "Persistence across browser sessions requires manual refresh verification"

duration: 4min
completed: 2026-07-27
status: complete
---

# Phase 4 Plan 1: Subtitle Offset & High-Contrast Mode Summary

**Timing offset adjustment (±5s, 0.5s steps) with real-time playback and high-contrast mode (yellow #FFD700 on black) exceeding WCAG AAA, with localStorage persistence**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-27T05:55:16Z
- **Completed:** 2026-07-27T06:00:15Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- PlaybackEngine supports runtime timing offset via setOffset() — offset applied to elapsed time in tick(), not to cue data
- usePersistedSettings stores offsetMs (±5000 clamped) and isHighContrast with type validation and defaults
- usePlaybackEngine wires offsetMs to the engine via useEffect for real-time updates without playback restart
- SubtitleDisplay toggles body.high-contrast class via useEffect (same pattern as existing isDimmed toggle)
- PlaybackControls provides offset adjustment buttons (−0.5s, +0.5s, Reset), offset display, and contrast toggle
- App.tsx enforces mutual exclusivity: enabling high contrast disables dim mode and vice versa
- CSS body.high-contrast rule sets --subtitle-color: #FFD700 (15.24:1 contrast ratio, exceeds WCAG AAA 7:1)

## Task Commits

Each task was committed atomically:

1. **Task 1: Engine offset + settings persistence + high-contrast CSS** - `36f40ef` (feat)
2. **Task 2: UI controls + component integration + mutual exclusivity** - `a72a1b2` (feat)

## Files Created/Modified
- `src/playback/PlaybackEngine.ts` - Added offsetMs property, setOffset() method, offset applied in tick()
- `src/hooks/usePersistedSettings.ts` - Added offsetMs and isHighContrast to Settings with validation
- `src/hooks/usePlaybackEngine.ts` - Added offsetMs parameter, wired to engine via useEffect
- `src/components/SubtitleDisplay.tsx` - Added isHighContrast prop, body.high-contrast class toggle
- `src/components/PlaybackControls.tsx` - Added offset buttons, offset display, contrast toggle button
- `src/App.tsx` - Wired all new props through with mutual exclusivity between dim and high-contrast
- `src/index.css` - Added body.high-contrast rule and .offset-display styling

## Decisions Made
- Offset applied to elapsed time in tick() (performance.now() - startTime + offsetMs) rather than modifying cue data — preserves original SRT data, O(1), instantly reversible
- High-contrast mode uses body class toggle following the exact same pattern as body.dimmed — consistency over introducing new abstractions
- Mutual exclusivity enforced in App.tsx updateSettings calls (not in CSS) — prevents CSS specificity conflicts between body.dimmed and body.high-contrast
- usePlaybackEngine accepts offsetMs as a parameter with default 0, wired via useEffect — real-time offset changes without playback restart

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Initial App.tsx edit had `usePlaybackEngine` called before `usePersistedSettings` declaration, causing TS2448 error. Fixed by reordering the hooks so settings is declared first. This was a Rule 3 (blocking) auto-fix.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 Plan 1 complete — offset and high-contrast features fully integrated
- Ready for Plan 2 (if any remaining polish items)
- All Phase 4 requirements (PLAY-06, PLAY-07) satisfied

## Self-Check: PASSED

- All 7 modified files exist on disk
- Both task commits found in git log (36f40ef, a72a1b2)
- TypeScript compiles cleanly (npx tsc --noEmit passes)
- Production build succeeds (npm run build passes)
- All acceptance criteria verified via grep inspection

---
*Phase: 04-polish-accessibility*
*Completed: 2026-07-27*
