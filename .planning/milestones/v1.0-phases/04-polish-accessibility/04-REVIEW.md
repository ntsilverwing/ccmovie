---
phase: 04-polish-accessibility
reviewed: 2026-07-28T12:00:00Z
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
  warning: 6
  info: 4
  total: 10
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-07-28T12:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed 7 source files for the polish-accessibility phase. The code is generally well-structured with good separation of concerns (hooks, engine class, components). No critical security issues were found. However, several bugs were identified in the PlaybackEngine class (rAF loop management), and multiple accessibility gaps exist that are particularly significant given this phase's focus on accessibility polish. The subtitle display lacks ARIA live regions, and form controls lack accessible labels.

## Critical Issues

None found.

## Warnings

### WR-01: PlaybackEngine.play() creates duplicate rAF loops if called while already playing

**File:** `src/playback/PlaybackEngine.ts:89-94`
**Issue:** When `play()` is called while `isPlaying` is already `true`, it calls `tick()` which schedules a new `requestAnimationFrame` without cancelling the existing one. This creates two independent rAF loops that both dispatch TICK actions, causing exponential growth of rAF callbacks and duplicate state dispatches. While the current UI prevents this (Start/Resume buttons are hidden during playback), the engine is a public class and this is a latent correctness bug.

**Fix:**
```typescript
play(): void {
  if (this.isPlaying) return // guard against duplicate play calls
  this.startTime = performance.now() - this.pausedElapsed
  this.lastIndex = -1
  this.isPlaying = true
  this.tick()
}
```

### WR-02: PlaybackEngine.pause() corrupts position on double-pause

**File:** `src/playback/PlaybackEngine.ts:99-106`
**Issue:** Calling `pause()` multiple times without an intervening `play()` overwrites `pausedElapsed` with `performance.now() - this.startTime`. Since `startTime` doesn't change between pause calls, the second call captures a larger elapsed value than the actual paused position, corrupting the resume position. The current UI prevents double-pause (button becomes "Resume"), but the engine API is unsafe.

**Fix:**
```typescript
pause(): void {
  if (!this.isPlaying) return // guard against double-pause
  if (this.rafId !== null) {
    cancelAnimationFrame(this.rafId)
    this.rafId = null
  }
  this.isPlaying = false
  this.pausedElapsed = performance.now() - this.startTime
}
```

### WR-03: PlaybackEngine runs rAF loop indefinitely when cues array is empty

**File:** `src/playback/PlaybackEngine.ts:145`
**Issue:** The auto-stop condition checks `this.cues.length > 0` before comparing elapsed time to the last cue's end. When `cues` is empty, this condition is always false, so the rAF loop never stops. If a user imports a subtitle file with zero valid cues and clicks Start, the rAF loop runs forever, wasting CPU and battery. The `findActiveCue` function correctly returns -1 for empty arrays, but the tick loop has no termination path for this case.

**Fix:**
```typescript
private tick = (): void => {
  if (this.cues.length === 0) {
    this.stop()
    return
  }
  const elapsed = performance.now() - this.startTime + this.offsetMs
  // ... rest of tick
}
```

### WR-04: SubtitleDisplay missing aria-live region for screen reader accessibility

**File:** `src/components/SubtitleDisplay.tsx:39-42`
**Issue:** The subtitle text updates as cues change, but the container has no `aria-live` attribute. Screen reader users have no way to know when a new cue appears. For a cinema subtitle application, this is a primary accessibility barrier — the entire purpose of the app is to display changing text, and screen reader users receive no announcement of changes.

**Fix:**
```tsx
<div ref={containerRef} className="subtitle-container" role="status" aria-live="polite" aria-atomic="true">
  <p className="subtitle-text">{cue?.text ?? ''}</p>
</div>
```

### WR-05: Font size slider missing accessible label

**File:** `src/components/PlaybackControls.tsx:66-73`
**Issue:** The `<input type="range">` for font size has no `aria-label`, `aria-labelledby`, or associated `<label>` element. Screen reader users encounter an unnamed slider and cannot determine its purpose. This fails WCAG 4.1.2 (Name, Role, Value).

**Fix:**
```tsx
<input
  type="range"
  min="36"
  max="72"
  value={fontSize}
  onChange={(e) => onFontSizeChange(Number(e.target.value))}
  className="font-size-slider"
  aria-label="Font size"
  aria-valuetext={`${fontSize} pixels`}
/>
```

### WR-06: Offset display changes not announced by screen readers

**File:** `src/components/PlaybackControls.tsx:51-53`
**Issue:** The offset display `<span>` updates when the user adjusts timing, but has no `aria-live` attribute. Screen reader users cannot perceive offset changes. While less critical than the subtitle display, this is still an accessibility gap for a control that provides important feedback.

**Fix:**
```tsx
<span className="offset-display" aria-live="polite" aria-atomic="true">
  {offsetMs > 0 ? '+' : ''}{(offsetMs / 1000).toFixed(1)}s
</span>
```

## Info

### IN-01: Dead CSS — .playback-view and .ready-controls classes unused

**File:** `src/index.css:183-206, 254-259`
**Issue:** The `.playback-view` and `.ready-controls` CSS classes are not referenced in any current component. The playback view is rendered by App.tsx using `.app` and `.subtitle-container` instead. These are dead code.

**Fix:** Remove `.playback-view` (lines 183-206) and `.ready-controls` (lines 254-259) CSS blocks.

### IN-02: Duplicate CSS — .playback-view .subtitle-text duplicates .subtitle-text

**File:** `src/index.css:195-206`
**Issue:** The `.playback-view .subtitle-text` rule duplicates font-size, font-weight, text-shadow, max-width, line-height, text-align, white-space, margin, and font-family from the base `.subtitle-text` rule (lines 48-59). This duplication is unnecessary and creates maintenance burden.

**Fix:** Remove the duplicate properties from `.playback-view .subtitle-text`, or remove the rule entirely if `.playback-view` is unused (see IN-01).

### IN-03: SubtitleDisplay manipulates document.body directly

**File:** `src/components/SubtitleDisplay.tsx:27-36`
**Issue:** The component toggles CSS classes on `document.body` for dim/high-contrast modes. This is a global side effect from within a component, which can cause conflicts if multiple components attempt to manage body classes. The cleanup function only runs on unmount, not when the prop changes back.

**Fix:** Consider extracting this into a custom hook (e.g., `useBodyClass`) or managing theme classes at the App level via a dedicated effect.

### IN-04: PlaybackControls has 12 props — high surface area

**File:** `src/components/PlaybackControls.tsx:3-16`
**Issue:** The component accepts 12 individual props, making it harder to maintain and reason about. Related props (fontSize/onFontSizeChange, isDimmed/onDimToggle, etc.) could be grouped.

**Fix:** Consider grouping related props into sub-objects (e.g., `fontSettings`, `displaySettings`, `offsetSettings`) or splitting into smaller sub-components.

---

_Reviewed: 2026-07-28T12:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
