---
phase: 02-playback-display
reviewed: 2026-07-28T06:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/App.tsx
  - src/components/PlaybackControls.tsx
  - src/components/SubtitleDisplay.tsx
  - src/hooks/usePersistedSettings.ts
  - src/hooks/usePlaybackEngine.ts
  - src/index.css
  - src/playback/PlaybackEngine.ts
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-07-28T06:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 02 delivers the core subtitle playback loop: a `PlaybackEngine` class driven by `requestAnimationFrame`, a `usePlaybackEngine` reducer hook, persisted settings via `localStorage`, OLED-optimized subtitle rendering, and an offset/contrast/dim control bar. The timing architecture (single `performance.now()` reference, no accumulated deltas) is sound and well-documented.

The review found one dominant defect — the **Resume button restarts playback from the beginning** because `play()` unconditionally resets `startTime` and `lastIndex` while `pause()` never records the paused position. This is a core playback correctness bug. Several additional warnings cover edge-case robustness (rapid play/pause, rapid Start taps, offset values outside persisted validation range) and minor quality issues.

## Critical Issues

None found.

## Warnings

### WR-01: Resume button restarts playback from the beginning (Broken resume)

**File:** `src/playback/PlaybackEngine.ts:87-92` (play) and `src/playback/PlaybackEngine.ts:97-103` (pause)
**Issue:** The UI offers a "Resume" button when playback is paused (`src/components/PlaybackControls.tsx:63-65` and `src/App.tsx:82-85`). However, `play()` unconditionally resets `startTime = performance.now()` and `lastIndex = -1`, while `pause()` only cancels the rAF loop — it does **not** capture the current elapsed position. On resume, `tick()` computes `elapsed = performance.now() - this.startTime + offsetMs` which is ≈ 0, so `findActiveCue` returns the **first** cue (index 0). The "Resume" button therefore restarts playback from the beginning instead of continuing from the paused position.

This breaks the primary playback state machine transition (paused → playing). A user who pauses mid-movie to answer the door loses their place.

**Fix:**
```typescript
// In PlaybackEngine class
private pausedElapsed: number = 0;

play(): void {
  // If resuming from pause, offset startTime to preserve position
  this.startTime = performance.now() - this.pausedElapsed;
  this.lastIndex = -1;
  this.isPlaying = true;
  this.tick();
}

pause(): void {
  if (this.rafId !== null) {
    cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
  this.isPlaying = false;
  // Save current position so play() can resume from here
  this.pausedElapsed = performance.now() - this.startTime + this.offsetMs;
}

stop(): void {
  // ...existing cleanup...
  this.pausedElapsed = 0;
  this.lastIndex = -1;
  this.onCueChange(-1);
}
```

### WR-02: Rapid play/pause leaves a queued rAF tick that dispatches after pause

**File:** `src/playback/PlaybackEngine.ts:131-150` (tick)
**Issue:** `tick()` checks `this.isPlaying` **at the end** of the function to decide whether to schedule the next frame (line 147). Between the top of `tick()` (where `findActiveCue` runs and `onCueChange` dispatches a TICK action) and that final check, a synchronous `pause()` call from React cannot intervene. If `pause()` is invoked while a `tick` is on the stack, the in-flight tick still runs `findActiveCue` and dispatches a TICK action **after** the reducer has processed PAUSE. This can briefly flash a stale cue before the rAF loop actually stops. In practice the window is sub-millisecond, but on slower devices or when Pause is chained with other state changes, it can be visible.

**Fix:** Capture the playing state at the start of `tick` and skip the dispatch if playback was stopped during this tick:
```typescript
private tick = (): void => {
  const wasPlaying = this.isPlaying;
  const elapsed = performance.now() - this.startTime + this.offsetMs;
  const activeIndex = findActiveCue(this.cues, elapsed, this.lastIndex);

  if (activeIndex !== this.lastIndex && wasPlaying) {
    this.lastIndex = activeIndex;
    this.onCueChange(activeIndex);
  }
  // ...auto-stop check...
  if (this.isPlaying) {
    this.rafId = requestAnimationFrame(this.tick);
  }
}
```

### WR-03: Calling play() multiple times rapidly resets startTime and causes timing jumps

**File:** `src/playback/PlaybackEngine.ts:87-92`
**Issue:** Each call to `play()` resets `startTime = performance.now()` and `lastIndex = -1` without guarding against re-entrancy. If the user double-taps "Start" or "Resume" quickly (or React invokes play twice due to a render race), `startTime` is reset mid-playback, causing `elapsed` to jump back toward zero and the active cue to flash back to the beginning. While no rAF loop stacks (the old `rafId` is overwritten), the timing base is silently corrupted.

**Fix:** Guard against re-entrant play:
```typescript
play(): void {
  if (this.isPlaying) return; // already playing — ignore re-entrant call
  this.startTime = performance.now() - this.pausedElapsed;
  this.lastIndex = -1;
  this.isPlaying = true;
  this.tick();
}
```

### WR-04: offsetMs slider accepts values outside the validated persistence range

**File:** `src/components/PlaybackControls.tsx:48,54` and `src/hooks/usePersistedSettings.ts:47`
**Issue:** The settings layer clamps `offsetMs` to `[-5000, 5000]` only when **loading** from localStorage (`loadSettings` line 47). The **write** path (`updateSettings` line 70-80) and the **UI controls** (the ±0.5s buttons at lines 48/54) perform no clamping. A user who taps "+0.5s" eleven times reaches `offsetMs = 5500`, which persists to localStorage, and `loadSettings` will then silently clamp it back to 5000 on next reload — producing a surprise jump. Worse, there is no visual indication of a hard limit. The Settings interface contract (JSDoc line 11: "range -5000 to 5000") is not enforced.

**Fix:** Clamp in `updateSettings`:
```typescript
const updateSettings = useCallback((partial: Partial<Settings>) => {
  setSettings((prev) => {
    const next = { ...prev, ...partial };
    // Enforce invariants on write, not just on load
    if (typeof next.offsetMs === 'number') {
      next.offsetMs = Math.max(-5000, Math.min(5000, next.offsetMs));
    }
    if (typeof next.fontSize === 'number') {
      next.fontSize = Math.max(36, Math.min(72, next.fontSize));
    }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
    return next;
  });
}, []);
```

### WR-05: Buttons missing explicit `type="button"` attribute

**File:** `src/components/PlaybackControls.tsx:41,48,54,57,60,63,74,77`
**Issue:** None of the control buttons declare `type="button"`. The HTML default button type is `"submit"`. Currently there is no `<form>` wrapper so this has no observable effect today, but if any future refactor wraps these controls in a `<form>` (e.g., for accessibility or settings panel), every button click will trigger a form submission and page reload. This is a latent defect with a trivial fix.

**Fix:** Add `type="button"` to all `<button>` elements in `PlaybackControls.tsx`. Same applies to buttons in `App.tsx` (lines 137, 146) and `CuePreview.tsx` (line 133).

## Info

### IN-01: Unused `.playback-view` CSS class

**File:** `src/index.css:183-206`
**Issue:** The `.playback-view` CSS class (and its `.playback-view .subtitle-text` rules) duplicate the same values already defined on `.subtitle-container` / `.subtitle-text` (lines 35-59). The JSX in `App.tsx` never applies the `playback-view` class — playback view uses `SubtitleDisplay` which uses `subtitle-container`. This is dead CSS.

**Fix:** Remove the `.playback-view` block from `src/index.css` (lines 183-206) to avoid future drift between the two rule sets.

### IN-02: Duplicate "Saved Movies" rendering between App and CuePreview

**File:** `src/App.tsx:131-155` and `src/components/CuePreview.tsx:126-143`
**Issue:** The saved-movies list is rendered in two places: inside `App.tsx` (when no subtitle is loaded) and inside `CuePreview.tsx` (when a subtitle is loaded). The markup, styling, and click handlers are nearly identical. If one copy is updated the other must be manually kept in sync, which is a maintenance hazard.

**Fix:** Extract a shared `SavedMoviesList` component (or lift the single source of truth to `App`) and render it from one place.

### IN-03: `handleImport` calls `stop()` on every import, including first import when nothing is playing

**File:** `src/App.tsx:43`
**Issue:** `handleImport` unconditionally calls `stop()` even on first import when playback is idle. The engine's `stop()` method is safe to call when idle (it resets `lastIndex = -1` and dispatches `onCueChange(-1)`, which the reducer handles as a no-op when already idle). This is not a bug, but the call is unnecessary work on first import.

**Fix:** Minor — guard with `if (playbackState.status !== 'idle') stop()`. Not required for correctness.

---

_Reviewed: 2026-07-28T06:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
