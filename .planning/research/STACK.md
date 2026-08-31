# Stack Research

**Domain:** Cinema subtitle PWA — Playback UI Redesign & Timeline (v1.2)
**Researched:** 2026-08-31
**Mode:** Ecosystem — Stack dimension for NEW capabilities only
**Confidence:** HIGH

---

## Executive Summary

**Zero new dependencies required.** All four v1.2 features (Timeline UI, gesture controls, settings drawer, enhanced seek) can be built with the existing React 18 + TypeScript + pure-CSS stack. The project's deliberate zero-UI-library philosophy is an asset here — the features are simple enough that adding any library would increase bundle size without meaningful development speedup.

Current production bundle: **77 KB gzipped** (234 KB minified), 5 runtime deps. The goal is to keep it under 90 KB gzipped after v1.2.

---

## Recommended Stack

### New Dependencies

**None.** Do not add any new packages.

### Existing Stack (Unchanged)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| **React** | ^18.3.1 | UI framework | Keep |
| **react-dom** | ^18.3.1 | DOM rendering | Keep |
| **Vite** | ^6.0.1 | Build tool + dev server | Keep |
| **vite-plugin-pwa** | ^1.3.0 | Service worker + manifest | Keep |
| **TypeScript** | ^5.6.3 | Type safety | Keep |
| **chardet** | ^2.2.0 | Encoding detection | Keep |
| **idb** | ^8.0.3 | IndexedDB wrapper | Keep |
| **@zakj/no-sleep** | ^0.13.6 | Wake Lock fallback | Keep |

---

## Feature-by-Feature Stack Analysis

### 1. Timeline UI (Progress Bar + Draggable Seek)

| Approach | Bundle Impact | Recommendation |
|----------|---------------|----------------|
| **Custom component (RECOMMENDED)** | +0 KB | Build with `<div>` + Pointer Events API. Track pointer position relative to bar width, convert to time position, call `engine.seek()`. |
| `@mui/material` LinearProgress | +90 KB gzipped | Massive overkill, pulls in entire MUI |
| `react-range` | +5 KB | Unnecessary — single-thumb range is just divs |
| Custom with `<input type="range">` | +0 KB | NOT recommended — hard to style for cinema dark theme, poor touch target control |

**Why custom:** The project already has a pure-CSS design system with CSS custom properties (`--subtitle-color`, `--subtitle-bg`, etc.). A timeline bar is a `<div>` with a positioned fill element and a drag handle. Pointer Events API (`onPointerDown`/`onPointerMove`/`onPointerUp`) handles both touch and mouse uniformly. The existing `PlaybackEngine.seekTo()` already accepts arbitrary elapsed positions.

**Implementation notes:**
- Use Pointer Events (not touch events) — unified touch+mouse, supported in all target browsers (iOS Safari 13+, Chrome 84+)
- Show current time / total time as text labels (reuse existing `formatElapsedHMS` from session.ts)
- Total duration = `cues[cues.length - 1].end` (already available from parsed cues)
- Visual: thin bar (4-6px) with high-contrast fill, large touch target (48px hit area) for dark theater use

### 2. Gesture Controls (Swipe Up = Next, Swipe Down = Previous)

| Approach | Bundle Impact | Maintenance | Recommendation |
|----------|---------------|-------------|----------------|
| **Custom `useSwipeGesture` hook (RECOMMENDED)** | +0 KB | Full control | ~30 lines of code. Track `touchstart`/`touchend` coordinates, calculate delta, fire callback on threshold crossing. |
| `@use-gesture/react` v10.3.1 | +5-8 KB gzipped (drag-only) | Actively maintained (Poimandres, 4.3M weekly downloads) | Viable if gestures become more complex in future. `useDrag` with `state.swipe` detection. Tree-shakeable via `createUseGesture([dragAction])`. |
| `react-swipeable` v7.0.2 | ~25 KB | Stale (last published 2 years ago) | `useSwipeable` hook with `onSwipedUp`/`onSwipedDown` callbacks. Clean API but heavier and unmaintained. |
| `Hammer.js` v2.0.8 | +7 KB | Unmaintained since 2016 | NOT recommended for new projects. |

**Why custom:** The gesture requirement is minimal — only vertical swipes (up/down), no pinch, no pan, no rotation. A custom hook avoids adding a dependency for what is fundamentally `touchstart`/`touchend` coordinate comparison. The project already follows this pattern (see `useWakeLock` — a custom hook wrapping a browser API).

**Implementation notes:**
- Threshold: 50px minimum distance, vertical-dominant (deltaY > deltaX * 1.5)
- Prevent default on touchmove within the gesture area to avoid scroll interference
- Use `{ passive: false }` on touchmove only when needed (Lighthouse consideration)
- Swipe up → `engine.seekTo(cues[currentIndex + 1].start)` (next cue)
- Swipe down → `engine.seekTo(cues[currentIndex - 1].start)` (previous cue)
- Attach to the subtitle display container (full-screen gesture area)

**When to reconsider @use-gesture/react:** If v1.3+ adds horizontal swipe (scrubbing), pinch (font size), or complex multi-touch. The migration path is clean — the custom hook's interface can mirror `useSwipeable`.

### 3. Settings Drawer (Replaces 10+ Button Flat Layout)

| Approach | Bundle Impact | Recommendation |
|----------|---------------|----------------|
| **Custom slide-up panel (RECOMMENDED)** | +0 KB | CSS `transform: translateY()` transition + backdrop overlay. Consistent with existing pure-CSS approach. |
| `Vaul` (shadcn/ui) | +15 KB | Requires Radix UI primitives. Heavy for this project. |
| `@radix-ui/react-dialog` | +12 KB | Overkill for a simple settings panel. |
| Bottom sheet libraries | Varies | Most are React Native only. |

**Why custom:** The project already uses CSS custom properties, `position: fixed`, and transitions (see `.playback-controls` in index.css). A drawer is a fixed-position panel with a `transform` transition. The existing auto-hide controls pattern (3-second timer, `controlsVisible` state) provides the interaction model.

**Implementation notes:**
- Panel: `position: fixed; bottom: 0; left: 0; right: 0; transform: translateY(100%)` → `translateY(0)` when open
- Backdrop: semi-transparent overlay with `opacity` transition
- Content: the settings currently in `PlaybackControls` (font size, dim, high contrast, offset, fullscreen)
- Main control bar: reduced to Play/Pause, Timeline, Settings toggle (3 buttons max)
- Use CSS transitions (not animation library) — 200-300ms ease-out
- Swipe down on drawer to dismiss (reuse the gesture hook pattern)

### 4. Enhanced Seek (`seek(targetMs)` for Playing + Paused States)

| Approach | Bundle Impact | Recommendation |
|----------|---------------|----------------|
| **Extend existing `PlaybackEngine.seekTo()` (RECOMMENDED)** | +0 KB | The engine already has `seekTo(elapsedMs)`. Add a public `seek(targetMs)` method that works in both playing and paused states. |
| Any library | N/A | Seek is pure timing logic, no library involved. |

**Why pure logic:** The `PlaybackEngine` already has `seekTo()` which re-anchors `startTime`. The enhancement is:
1. Add a `seek(targetMs)` method that works in paused state (currently `seekTo` is designed for the resume path)
2. Update the session model to reflect the new position (re-anchor `startedAt`)
3. The session module already has the math — `resumeSession` re-anchors `startedAt`

**Implementation notes:**
- Playing seek: same as current `seekTo` — adjust `startTime` so the next tick computes the correct elapsed
- Paused seek: update `pausedElapsedMs` to the target, then re-anchor `startTime` so resume continues from there
- Session sync: after seek, re-anchor `startedAt = now - targetMs` (so `sessionElapsedMs` returns the new position)
- Timeline drag should call this method on `pointerUp` (or live during `pointerMove` for real-time scrubbing)

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **@use-gesture/react** (for now) | +5-8 KB for a simple swipe up/down. Premature optimization if gestures stay simple. | Custom `useSwipeable` hook (~30 lines). Migrate to @use-gesture if gestures complexify. |
| **react-swipeable** | ~25 KB bundle, unmaintained (2 years since publish). | Custom hook or @use-gesture/react. |
| **Hammer.js** | Unmaintained since 2016. Not worth the tech debt for new code. | Custom touch events. |
| **Any UI framework** (MUI, Chakra, Ant) | +90-200 KB gzipped. Would triple the bundle. The app has ~15 components — a UI framework provides no benefit. | Pure CSS + CSS custom properties (existing pattern). |
| **Framer Motion / React Spring** | +15-30 KB. The app only needs simple opacity/transform transitions. | CSS transitions (existing pattern). |
| **Vaul / Radix Drawer** | +12-15 KB. A drawer is a positioned div with a transform. | CSS `transform: translateY()` transition. |
| **react-range / rc-slider** | +5-10 KB. A seek bar is a div with a positioned fill. | Custom Pointer Events component. |

---

## Integration Points

### PlaybackEngine.seek(targetMs) — New Method

```typescript
// New method to add to PlaybackEngine class
seek(targetMs: number): void {
  // Re-anchor startTime so the computed elapsed equals targetMs
  // Works in both playing and paused states
  this.startTime = performance.now() - (targetMs - this.offsetMs)
  this.lastIndex = -1
  // If paused, also update pausedElapsed so resume continues from target
  if (!this.isPlaying) {
    this.pausedElapsed = targetMs - this.offsetMs
  }
}
```

### Session Sync After Seek

```typescript
// New function in session.ts
export function seekSession(session: PlaybackSession, targetMs: number, now: number): PlaybackSession {
  // Re-anchor startedAt so sessionElapsedMs returns targetMs
  return { ...session, startedAt: now - targetMs, pausedElapsedMs: null }
}
```

### usePlaybackEngine Hook — New Return Value

```typescript
// Add to usePlaybackEngine return:
seek: (targetMs: number) => void

// Implementation:
const seek = useCallback((targetMs: number) => {
  engineRef.current?.seek(targetMs)
  setSession((prev) => (prev ? seekSession(prev, targetMs, Date.now()) : prev))
}, [])
```

### Gesture Hook — New File

```typescript
// New file: src/hooks/useSwipeGesture.ts
// Returns ref + direction callback. Attaches to subtitle container.
// Fires onSwipeUp / onSwipedown callbacks.
```

### Timeline Component — New File

```typescript
// New file: src/components/Timeline.tsx
// Props: currentTime, totalDuration, onSeek
// Renders: time labels + draggable progress bar
// Uses: Pointer Events API for drag
```

### Settings Drawer — New File

```typescript
// New file: src/components/SettingsDrawer.tsx
// Props: open, onClose, settings values + change handlers
// Renders: slide-up panel with current PlaybackControls settings
// Uses: CSS transitions for open/close animation
```

---

## Bundle Budget

| Scenario | JS (gzipped) | CSS (gzipped) | Total |
|----------|-------------|---------------|-------|
| Current v1.1 | 77 KB | 2 KB | 79 KB |
| v1.2 with zero new deps (est.) | ~82 KB | ~3 KB | ~85 KB |
| v1.2 with @use-gesture/react | ~87 KB | ~3 KB | ~90 KB |
| v1.2 with react-swipeable | ~102 KB | ~3 KB | ~105 KB |

**Target:** Stay under 90 KB gzipped. Zero new deps keeps us at ~85 KB.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| React 18.3.1 | All existing code | No upgrade needed for v1.2 |
| Pointer Events API | iOS Safari 13+, Chrome 84+, Safari 16+ | All target browsers supported |
| CSS Custom Properties | All target browsers | Already in use |
| CSS Transitions | All target browsers | Already in use |

---

## Alternatives Considered

| Feature | Recommended | Alternative | When to Use Alternative |
|---------|-------------|-------------|------------------------|
| Gestures | Custom hook | @use-gesture/react | If v1.3+ adds pinch-to-resize-font, horizontal scrub, or multi-touch |
| Gestures | Custom hook | react-swipeable | Never — unmaintained and heavier |
| Timeline | Custom component | react-range | If dual-thumb range selection is needed (e.g., loop a section) |
| Drawer | Custom CSS panel | Vaul | If iOS-style snap points + swipe-to-dismiss become requirements |
| Seek | Extend PlaybackEngine | New engine class | Never — existing engine already handles arbitrary positions |

---

## Sources

- @use-gesture/react v10.3.1: Context7 `/pmndrs/use-gesture` (MEDIUM confidence) — API docs confirm `useDrag` with `state.swipe` detection, tree-shakeable via `createUseGesture`
- react-swipeable v7.0.2: npm registry + jsdocs.io (LOW confidence) — `useSwipeable` hook API confirmed, last published 2 years ago
- Hammer.js v2.0.8: GitHub issue #1278 + hammerjs.github.io (LOW confidence) — confirmed unmaintained since 2016
- Pointer Events API: MDN (not fetched, but well-established standard)
- Custom touch swipe pattern: Multiple community sources via tavily (LOW confidence) — consistent pattern across sources
- Current bundle size: `npm run build` output (HIGH confidence) — 77 KB gzipped measured 2026-08-31

---

*Stack research for: CinemaSyncSubs v1.2 Playback UI Redesign & Timeline*
*Researched: 2026-08-31*
