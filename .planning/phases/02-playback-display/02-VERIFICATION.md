---
phase: 02-playback-display
verified: 2026-07-27T05:30:00Z
status: gaps_found
score: 4/9 must-haves verified
behavior_unverified: 2
overrides_applied: 0
gaps:
  - truth: "User taps Start and subtitles begin displaying according to their timecodes"
    status: failed
    reason: "PlaybackEngine is created once with empty cues array and never updated when a file is imported. The setCue() method exists but is never called. After importing an SRT and tapping Start, findActiveCue() always returns -1 because this.cues is still []."
    artifacts:
      - path: "src/hooks/usePlaybackEngine.ts"
        issue: "Engine created once in useEffect([], []) with initial empty cues. The cues sync effect updates cuesRef.current but never calls engine.setCues(). Engine's internal this.cues remains [] forever."
    missing:
      - "Add engineRef.current?.setCues(cues) in the cues sync effect, OR pass a getCues callback to PlaybackEngine instead of a static array"
  - truth: "Subtitles remain synchronized with <50ms drift over a 2-hour playback"
    status: partial
    reason: "Architecture is correct (performance.now() + rAF, absolute elapsed time, never setInterval), but the stale cues bug prevents any playback from working, so synchronization cannot be verified."
    artifacts:
      - path: "src/playback/PlaybackEngine.ts"
        issue: "Timing architecture is correct but engine never receives cues to play"
    missing:
      - "Fix the stale cues bug first, then verify synchronization behavior"
behavior_unverified_items:
  - truth: "Subtitles remain synchronized with <50ms drift over a 2-hour playback (performance.now + rAF architecture)"
    test: "Import a 2-hour SRT file, tap Start, let playback run for several minutes, verify displayed cue matches expected timecode"
    expected: "Active cue changes match SRT timecodes with <50ms drift; no cumulative drift over extended playback"
    why_human: "Requires real-time playback verification over an extended period; the stale cues bug must be fixed first"
human_verification:
  - test: "Import an SRT file, tap Start, verify subtitles appear and change according to timecodes"
    expected: "Subtitles display synchronized to the movie timeline; each cue appears at its start time and disappears at its end time"
    why_human: "The stale cues bug prevents automated verification of the core playback flow; a human must confirm the fix works"
  - test: "Tap Start, let playback run for 10+ minutes, verify no visible drift"
    expected: "Subtitles remain synchronized with the movie timeline; no cumulative timing error"
    why_human: "Long-duration timing drift requires real-time observation"
---

# Phase 2: Playback & Display Verification Report

**Phase Goal:** User can tap "Start" and see subtitles synchronized to the movie timeline with cinema-optimized display
**Verified:** 2026-07-27T05:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User taps Start and subtitles begin displaying according to their timecodes | ✗ FAILED | Stale cues bug: PlaybackEngine created once with `[]`, never updated after import |
| 2 | Subtitles remain synchronized with <50ms drift over a 2-hour playback | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Architecture correct (performance.now + rAF, absolute elapsed), but playback broken |
| 3 | Playback uses performance.now() + requestAnimationFrame, never setInterval | ✓ VERIFIED | PlaybackEngine.ts:122 uses `performance.now() - this.startTime`; line 138 uses `requestAnimationFrame`; no setInterval/setTimeout in code |
| 4 | Binary search cue lookup is O(log n) with O(1) sequential hint | ✓ VERIFIED | PlaybackEngine.ts:13-45 implements fast-path check for current/next cue + binary search fallback |
| 5 | Text renders as dimmed white (#E0E0E0) on pure black (#000000) background — OLED-optimized with reduced halation | ✓ VERIFIED | index.css:7-8 defines `--subtitle-bg: #000000`, `--subtitle-color: #e0e0e0`; line 10 text-shadow for halation reduction |
| 6 | User can adjust font size from 36px to 72px via slider with instant visual feedback | ✓ VERIFIED | PlaybackControls.tsx:47-52 renders `<input type="range" min="36" max="72">`; SubtitleDisplay.tsx:22 sets `--subtitle-font-size` via useEffect |
| 7 | User can toggle dim mode for darker gray text (#888888) appearance in ultra-dark environments | ✓ VERIFIED | PlaybackControls.tsx:54-56 renders Dim button; SubtitleDisplay.tsx:27 toggles `body.dimmed`; index.css:26 `--subtitle-color: #888888` |
| 8 | CSS custom properties enable instant theme switching without React re-render | ✓ VERIFIED | SubtitleDisplay.tsx:22 `containerRef.current?.style.setProperty('--subtitle-font-size', ...)`; index.css uses `var(--subtitle-font-size)` and `var(--subtitle-color)` |
| 9 | User can adjust font size from 36px to 72px via slider, and the setting persists across sessions | ✓ VERIFIED | usePersistedSettings.ts:56 reads from localStorage on mount; line 62 writes on every update; key `'cinemasyncsubs-settings'` |

**Score:** 7/9 truths verified (2 behavior-unverified due to stale cues bug)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/playback/PlaybackEngine.ts` | Framework-agnostic timing engine with binary search | ✓ VERIFIED | 141 lines, exports `findActiveCue` + `PlaybackEngine` class, performance.now + rAF |
| `src/hooks/usePlaybackEngine.ts` | React hook with useReducer + useRef | ⚠️ ORPHANED | 116 lines, structurally correct, but engine cues never updated after import |
| `src/hooks/usePersistedSettings.ts` | localStorage persistence for fontSize, isDimmed | ✓ VERIFIED | 71 lines, reads/writes localStorage with validation |
| `src/components/SubtitleDisplay.tsx` | OLED renderer with CSS custom properties | ✓ VERIFIED | 36 lines, sets CSS custom property for font size, toggles body.dimmed |
| `src/components/PlaybackControls.tsx` | Start/Stop/Pause + font slider + dim toggle | ✓ VERIFIED | 61 lines, conditional rendering based on PlaybackStatus |
| `src/App.tsx` | Integrated playback UI | ✓ VERIFIED | 80 lines, three views (import/ready/playback), wires all components |
| `src/index.css` | CSS custom properties + display classes | ✓ VERIFIED | 260 lines, :root tokens, body.dimmed, subtitle-container/text, controls |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `performance.now()` → `findActiveCue` → `onCueChange` → `dispatch TICK` → `activeCue` update | PlaybackEngine → usePlaybackEngine → reducer | rAF loop + callback | ⚠️ PARTIAL | Wiring correct but engine's `this.cues` is always `[]` so `findActiveCue` always returns -1 |
| `usePlaybackEngine(cues)` → `{ state, play, pause, stop }` → `App.tsx` | Hook → Component | React hook return | ✓ WIRED | App.tsx:15 destructures and uses all four |
| `fontSize` → `--subtitle-font-size` → `.subtitle-text` | SubtitleDisplay → CSS | `style.setProperty` in useEffect | ✓ WIRED | SubtitleDisplay.tsx:22 → index.css:45 |
| `isDimmed` → `body.dimmed` → `--subtitle-color: #888888` | SubtitleDisplay → CSS | `classList.toggle` in useEffect | ✓ WIRED | SubtitleDisplay.tsx:27 → index.css:26 |
| `activeCue.text` → `SubtitleDisplay` → DOM text node | App.tsx → Component | React text node | ✓ WIRED | SubtitleDisplay.tsx:33 `{cue?.text ?? ''}` — never dangerouslySetInnerHTML |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| SubtitleDisplay | `cue` | `playbackState.activeCue` from usePlaybackEngine | Depends on engine's `this.cues` | ✗ DISCONNECTED | Engine's `this.cues` is always `[]` — activeCue is always null after Play |
| PlaybackControls | `fontSize`, `isDimmed` | `usePersistedSettings` | localStorage | ✓ FLOWING | Settings read from localStorage on mount |
| App.tsx | `subtitle` | `importSRT` via FilePicker | Parsed SRT file | ✓ FLOWING | File import works (Phase 1 verified) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build succeeds | `npm run build` | ✓ Built in 1.00s, 59 modules | ✓ PASS |
| TypeScript compiles | `npx tsc --noEmit` | No output (clean) | ✓ PASS |
| Git commits exist | `git log --oneline` | a4682b0, ff1fb4f, ff970d9, 126b7aa all present | ✓ PASS |
| No anti-patterns | grep for TODO/FIXME/placeholder | No matches | ✓ PASS |
| No dangerouslySetInnerHTML | grep in components | No matches (only comments) | ✓ PASS |
| No setInterval/setTimeout | grep in playback code | No matches (only in comments as warnings) | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no probes declared or implied for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PLAY-03 | 02-01 | User can manually start playback by tapping a "Start" button | ✗ BLOCKED | Start button exists and is clickable, but subtitles don't display due to stale cues bug |
| PLAY-04 | 02-01 | Subtitles display synchronously using performance.now() + rAF | ⚠️ PARTIAL | Architecture correct but playback broken — cannot verify synchronization |
| PLAY-05 | 02-02 | Subtitles render as white text on pure black background | ✓ SATISFIED | CSS custom properties define #E0E0E0 on #000000 with text-shadow |
| DISP-01 | 02-02 | User can adjust font size via slider | ✓ SATISFIED | Range input 36-72px with CSS custom property for instant updates |
| DISP-03 | 02-02 | UI supports minimum brightness mode (gray text) | ✓ SATISFIED | Dim toggle switches body.dimmed class, --subtitle-color: #888888 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (None) | — | — | — | No TODO/FIXME/placeholder markers found |

### Human Verification Required

### 1. Core Playback Flow After Bug Fix

**Test:** Import an SRT file → tap Start → observe subtitles appearing according to timecodes → tap Pause → tap Resume → tap Stop
**Expected:** Subtitles display synchronized to timeline; Pause freezes current cue; Resume continues from paused position; Stop returns to ready view
**Why human:** The stale cues bug prevents automated verification; a human must confirm the fix restores core functionality

### 2. Long-Duration Timing Accuracy

**Test:** Import a 2-hour SRT file, tap Start, let playback run for 10+ minutes
**Expected:** Subtitles remain synchronized with the movie timeline; no visible drift
**Why human:** Long-duration timing drift requires real-time observation; the bug must be fixed first

### Gaps Summary

**1 Critical Bug Found:**

The `usePlaybackEngine` hook creates a `PlaybackEngine` instance once (in a `useEffect` with `[]` dependency) with the initial empty cues array. When a file is imported, the `cuesRef` is updated but the engine's internal `this.cues` is never updated — `setCues()` is defined on `PlaybackEngine` but never called.

**Impact:** After importing an SRT file and tapping Start, the engine's `findActiveCue()` always returns -1 (because `this.cues` is `[]`), so no subtitles ever display. The core user flow is completely broken.

**Fix:** Add `engineRef.current?.setCues(cues)` to the cues sync effect in `usePlaybackEngine.ts`:

```typescript
useEffect(() => {
  cuesRef.current = cues
  engineRef.current?.setCues(cues)  // Add this line
}, [cues])
```

**All other aspects of Phase 2 are complete and correct:**
- Build and TypeScript compilation pass cleanly
- Timing architecture (performance.now + rAF) is correctly implemented
- Binary search with O(1) sequential hint is correctly implemented
- OLED-optimized display (colors, text-shadow, CJK font stack) is correctly implemented
- CSS custom properties for instant theming are correctly implemented
- Font size slider (36-72px) and dim mode toggle are correctly implemented
- localStorage persistence for settings is correctly implemented
- All components are properly wired in App.tsx
- No anti-patterns or debt markers found
- All git commits from summaries are present in git log

---

_Verified: 2026-07-27T05:30:00Z_
_Verifier: the agent (gsd-verifier)_
