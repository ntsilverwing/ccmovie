# Architecture Research: Playback UI Redesign & Timeline Integration

**Domain:** Cinema subtitle PWA — playback engine extension
**Researched:** 2026-08-31
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        App.tsx (Orchestrator)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────────┐  │
│  │ SessionBanner│  │  ResumeCard  │  │  usePersistedSettings     │  │
│  └──────────────┘  └──────────────┘  └───────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │              usePlaybackEngine (Hook)                         │    │
│  │  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐  │    │
│  │  │playbackReducer│ │ PlaybackSession│ │   PlaybackEngine   │  │    │
│  │  │ (useReducer) │  │ (wall-clock)  │ │ (performance.now)  │  │    │
│  │  └────────────┘  └──────────────┘  └─────────────────────┘  │    │
│  │  ┌─────────────────────────────────────────────────────────┐ │    │
│  │  │  NEW: seek(targetMs) — re-anchors engine + session     │ │    │
│  │  └─────────────────────────────────────────────────────────┘ │    │
│  └──────────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  Playback View (NEW layered layout)                           │    │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐   │    │
│  │  │Timeline      │  │PlaybackControls│ │ SettingsDrawer    │   │    │
│  │  │(new)         │  │(slimmed)      │  │ (new)             │   │    │
│  │  └─────────────┘  └──────────────┘  └────────────────────┘   │    │
│  │  ┌─────────────────────────────────────────────────────────┐ │    │
│  │  │  useGestureDetection (new hook) — vertical swipes       │ │    │
│  │  └─────────────────────────────────────────────────────────┘ │    │
│  └──────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────┤
│                        Data Layer                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  db/sessions.ts   │  │  db/subtitles.ts  │  │  localStorage    │   │
│  │  (IndexedDB)      │  │  (IndexedDB)      │  │  (settings)      │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Current Implementation |
|-----------|----------------|------------------------|
| `PlaybackEngine` | Monotonic cue timing via `performance.now()` + rAF loop | Class, framework-agnostic |
| `usePlaybackEngine` | React bridge: reducer state, session lifecycle, persistence | Hook with refs for mutable state |
| `PlaybackSession` | Wall-clock position anchor: `now - startedAt + offsetMs` | Pure functions, no clock reads |
| `PlaybackControls` | 10+ button overlay (TO BE REFACTORED) | Single component, flat layout |
| `Timeline` (NEW) | Progress bar, drag-to-seek, current/total time display | Does not exist yet |
| `SettingsDrawer` (NEW) | Settings panel: font, dim, contrast, offset, fullscreen | Does not exist yet |
| `useGestureDetection` (NEW) | Vertical swipe → next/previous cue seek | Does not exist yet |

## Recommended Project Structure

```
src/
├── hooks/
│   ├── usePlaybackEngine.ts      # MODIFIED: add seek(), expose totalDurationMs
│   ├── useGestureDetection.ts    # NEW: vertical swipe detection
│   ├── usePersistedSettings.ts   # unchanged
│   └── useWakeLock.ts            # unchanged
├── playback/
│   ├── PlaybackEngine.ts         # MODIFIED: seekTo already works, no change needed
│   ├── session.ts                # MODIFIED: add seekSession() pure function
│   ├── playbackHistory.ts        # unchanged
│   └── session.test.ts           # MODIFIED: add seekSession tests
├── components/
│   ├── PlaybackControls.tsx      # MODIFIED: slim to Play/Pause/Stop + settings toggle
│   ├── Timeline.tsx              # NEW: progress bar with drag-to-seek
│   ├── SettingsDrawer.tsx        # NEW: slide-up settings panel
│   ├── SubtitleDisplay.tsx       # unchanged
│   └── ...existing components    # unchanged
├── imports/
│   └── srtParser.ts              # MODIFIED: add totalDurationMs to metadata
├── types/
│   └── subtitle.ts               # MODIFIED: add totalDurationMs to ParsedSubtitle
├── db/
│   ├── database.ts               # unchanged (schema unchanged)
│   ├── sessions.ts               # unchanged
│   └── subtitles.ts              # unchanged
└── i18n/
    └── translations.ts           # MODIFIED: add timeline/gesture/drawer keys
```

### Structure Rationale

- **hooks/useGestureDetection.ts:** Isolates touch-event logic from rendering. Returns `{ onTouchStart, onTouchMove, onTouchEnd }` handlers or a ref-binding pattern. Keeps gesture math testable without DOM.
- **components/Timeline.tsx:** Self-contained presentation + interaction. Receives `currentMs`, `totalMs`, `onSeek` as props. No internal state machine — driven by parent polling.
- **components/SettingsDrawer.tsx:** Pure UI extraction from PlaybackControls. Same props subset, wrapped in an animated slide-up panel.
- **playback/session.ts:** New `seekSession()` keeps the dual-source clock rule intact — wall-clock session stays the banner truth source even after arbitrary seek.

## Architectural Patterns

### Pattern 1: Dual-Source Clock with Seek Re-Anchor

**What:** The wall-clock session and monotonic engine must agree after any seek. The session's `startedAt` is recalculated so `sessionElapsedMs(session, now) === targetMs` at the seek instant.

**When to use:** Any user-initiated position change — Timeline drag, gesture skip, or future skip buttons.

**Trade-offs:**
- (+) Session stays the single source of truth for displayed time (banner, Timeline)
- (+) Persisted session remains correct after seek (resume-from-seek works)
- (−) Requires careful formula: `startedAt = now - (targetMs - offsetMs)` for playing, `pausedElapsedMs = targetMs - offsetMs` for paused

**Example:**
```typescript
// session.ts — new pure function
export function seekSession(
  session: PlaybackSession,
  targetMs: number,
  now: number
): PlaybackSession {
  // targetMs is offset-INCLUSIVE (same space as sessionElapsedMs)
  const basePosition = targetMs - session.offsetMs
  return {
    ...session,
    startedAt: now - basePosition,
    pausedElapsedMs: null, // seek always lands in "playing" time space
  }
}
// For paused seek, caller sets pausedElapsedMs = basePosition instead
```

### Pattern 2: Hook-Exposed Imperative Seek

**What:** The hook exposes a `seek(targetMs)` function that atomically updates both the engine and the session, then triggers a single persist.

**When to use:** Timeline drag end, gesture skip, or any programmatic seek.

**Trade-offs:**
- (+) Single entry point — engine + session + persistence always in sync
- (+) No render storm — session change triggers one re-render, engine tick fires on next rAF
- (−) Must handle both playing and paused states (engine.seekTo works in both, but session math differs)

**Example:**
```typescript
// usePlaybackEngine.ts — new exposed function
const seek = useCallback((targetMs: number) => {
  const engine = engineRef.current
  if (!engine) return
  engine.seekTo(targetMs)  // re-anchors engine startTime
  setSession((prev) => {
    if (!prev) return prev
    const now = Date.now()
    const basePosition = targetMs - prev.offsetMs
    return statusRef.current === 'paused'
      ? { ...prev, pausedElapsedMs: basePosition }
      : { ...prev, startedAt: now - basePosition, pausedElapsedMs: null }
  })
}, [])
```

### Pattern 3: Timeline Position Polling

**What:** The Timeline component polls the session for current position using `requestAnimationFrame`, computing `sessionElapsedMs(session, Date.now())` each frame.

**When to use:** During active playback to show a moving progress indicator.

**Trade-offs:**
- (+) No new state in the hook — session is already the truth source
- (+) rAF pauses in background tabs (battery-friendly)
- (−) Timeline must receive `session` as prop and run its own rAF loop
- (−) Must handle the paused case (position frozen at pausedElapsedMs)

**Example:**
```typescript
// Timeline.tsx — internal position tracking
useEffect(() => {
  if (!session || status !== 'playing') return
  let rafId: number
  const tick = () => {
    const current = sessionElapsedMs(session, Date.now())
    setDisplayMs(current)
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(rafId)
}, [session, status])
```

### Pattern 4: Gesture-to-Seek Bridge

**What:** A gesture hook detects vertical swipes and maps them to cue-boundary seeks. Swipe up → seek to next cue's start. Swipe down → seek to previous cue's start.

**When to use:** On the playback surface (SubtitleDisplay area), not on controls.

**Trade-offs:**
- (+) No visual UI needed — invisible interaction layer
- (+) Works with gloves/dark theater (large touch targets)
- (−) Must avoid conflict with Timeline's horizontal drag (separate surfaces)
- (−) Must handle edge cases: first/last cue, very short swipes, multi-touch

**Example:**
```typescript
// useGestureDetection.ts
interface GestureConfig {
  onSwipeUp: () => void     // next cue
  onSwipeDown: () => void   // previous cue
  threshold?: number        // default 50px
}

export function useGestureDetection(config: GestureConfig) {
  const startY = useRef(0)
  const onTouchStart = (e: TouchEvent) => {
    startY.current = e.touches[0].clientY
  }
  const onTouchEnd = (e: TouchEvent) => {
    const delta = startY.current - e.changedTouches[0].clientY
    if (Math.abs(delta) > (config.threshold ?? 50)) {
      delta > 0 ? config.onSwipeUp() : config.onSwipeDown()
    }
  }
  return { onTouchStart, onTouchEnd }
}
```

## Data Flow

### Seek Flow (Timeline Drag or Gesture)

```
User drags Timeline / swipes screen
    ↓
Timeline.onSeek(targetMs) / Gesture.onSwipeUp()
    ↓
App.tsx handler: seekToCue(targetMs)
    ↓
usePlaybackEngine.seek(targetMs)
    ├── engine.seekTo(targetMs)           [engine startTime re-anchored]
    ├── setSession(seekSession(...))      [session startedAt re-anchored]
    │       ↓
    │   persist-on-change effect fires
    │       ↓
    │   saveSession(session) → IndexedDB
    │       ↓
    │   re-render with new session
    │       ↓
    └── next rAF tick → findActiveCue() → onCueChange(index)
            ↓
        dispatch({ type: 'TICK', activeIndex: index })
            ↓
        SubtitleDisplay shows new cue
```

### Gesture Skip Flow

```
User swipes up on playback surface
    ↓
useGestureDetection → onSwipeUp()
    ↓
App.tsx: find next cue after current position
    ↓
const nextCue = cues.find(c => c.start > currentMs)
    ↓
seek(nextCue.start)  →  [same seek flow as above]
```

### Timeline Live Update Flow

```
usePlaybackEngine exposes session + status
    ↓
Timeline receives { session, status, totalMs, onSeek }
    ↓
Timeline internal rAF loop (only when status === 'playing')
    ↓
Each frame: sessionElapsedMs(session, Date.now()) → setDisplayMs
    ↓
DOM update: progress bar width + time label (no React re-render of parent)
```

## Integration Points

### Modified Files

| File | Change | Risk |
|------|--------|------|
| `playback/session.ts` | Add `seekSession()` pure function | Low — additive, pure, testable |
| `hooks/usePlaybackEngine.ts` | Add `seek()` callback, accept `totalDurationMs` | Medium — must preserve existing play/pause/stop semantics |
| `components/PlaybackControls.tsx` | Slim to core controls + settings toggle | Medium — UI refactor, must preserve all existing functionality |
| `imports/srtParser.ts` | Add `totalDurationMs` to metadata | Low — additive field |
| `types/subtitle.ts` | Add `totalDurationMs` to `ParsedSubtitle.metadata` | Low — additive field |
| `i18n/translations.ts` | Add ~10 new keys (timeline, drawer, gesture hints) | Low |
| `App.tsx` | Wire new components, add gesture handlers, pass totalDurationMs | Medium — orchestration changes |

### New Files

| File | Purpose | Dependencies |
|------|---------|--------------|
| `components/Timeline.tsx` | Progress bar with drag-to-seek | session.ts, usePlaybackEngine |
| `components/SettingsDrawer.tsx` | Slide-up settings panel | usePersistedSettings, i18n |
| `hooks/useGestureDetection.ts` | Vertical swipe detection | None (pure touch events) |
| `components/Timeline.test.ts` | Timeline interaction tests | — |
| `hooks/useGestureDetection.test.ts` | Gesture math tests | — |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `usePlaybackEngine` ↔ `Timeline` | Props: `session`, `status`, `totalMs`, `onSeek` | Timeline is a pure consumer |
| `usePlaybackEngine` ↔ `useGestureDetection` | Gesture hook calls `seek()` via callback | No direct coupling |
| `Timeline` ↔ `SettingsDrawer` | Sibling components, no direct communication | Both driven by App.tsx state |
| `useGestureDetection` ↔ `PlaybackControls` | Separate surfaces — gestures on display area, controls on bottom bar | Must not overlap touch targets |
| `session.ts` ↔ `usePlaybackEngine` | Hook calls `seekSession()` inside `setSession` | Pure function, no clock read |

## Anti-Patterns

### Anti-Pattern 1: Accumulating Seek Offset

**What people do:** Track a separate `seekOffset` that gets added to the position on every tick.
**Why it's wrong:** The engine already handles offset via `startTime` re-anchorage. A second offset source creates double-counting and makes the session/engine agreement impossible to maintain.
**Do this instead:** Always re-anchor `startTime` (engine) and `startedAt` (session) to the absolute target position. The existing `offsetMs` sync mechanism handles sync adjustments.

### Anti-Pattern 2: Seeking via pause→setPosition→play

**What people do:** Pause, mutate state, then resume to "simulate" a seek.
**Why it's wrong:** Causes a visible flash of the wrong subtitle, breaks the rAF cycle, and creates a window where the session and engine disagree.
**Do this instead:** Use `engine.seekTo()` directly — it works in both playing and paused states without stopping the rAF loop.

### Anti-Pattern 3: Storing Current Position in React State

**What people do:** `const [currentMs, setCurrentMs] = useState(0)` updated every frame.
**Why it's wrong:** 60 state updates per second = 60 re-renders per second. The entire playback view re-renders including SubtitleDisplay.
**Do this instead:** The session object (updated only on transitions) is the truth source. The Timeline reads position via `sessionElapsedMs(session, Date.now())` inside its own rAF loop and updates only its own DOM (or uses a ref + direct style manipulation for the progress bar).

### Anti-Pattern 4: Gesture Handler on the Entire Screen

**What people do:** Attach touch listeners to the root div, intercepting all touches including controls.
**Why it's wrong:** Conflicts with button taps, slider drags on Timeline, and scroll gestures.
**Do this instead:** Attach gesture detection only to the SubtitleDisplay area (the large center region). Controls and Timeline have their own touch handlers that stop propagation.

## Build Order (Dependency-Respecting)

### Step 1: Foundation — Total Duration (ENG-03)
- **Files:** `types/subtitle.ts`, `imports/srtParser.ts`
- **What:** Add `totalDurationMs: number` to `ParsedSubtitle.metadata`, computed as `cues[cues.length - 1].end`
- **Why first:** Zero dependencies, needed by Timeline. Parser already iterates cues — this is a one-line addition.
- **Risk:** None. Additive only.

### Step 2: Enhanced Seek + Session Sync (ENG-01, ENG-02)
- **Files:** `playback/session.ts`, `hooks/usePlaybackEngine.ts`
- **What:** Add `seekSession()` to session.ts, add `seek()` callback to hook
- **Why second:** Timeline and Gestures both depend on `seek()`. Engine already supports arbitrary `seekTo()` — this is the bridge.
- **Risk:** Medium. Must verify seek works correctly in both playing and paused states. Must verify session persistence fires correctly.

### Step 3: Timeline Component (UI-03)
- **Files:** `components/Timeline.tsx`, `App.tsx` (wire it)
- **What:** Progress bar with drag-to-seek, current/total time display, rAF position polling
- **Why third:** Depends on `seek()` and `totalDurationMs`. The most visible new feature.
- **Risk:** Medium. Touch drag interaction needs testing. Must handle edge cases (drag beyond bounds, very short content).

### Step 4: Gesture Detection (UI-02)
- **Files:** `hooks/useGestureDetection.ts`, `App.tsx` (wire handlers)
- **What:** Vertical swipe detection → next/previous cue seek
- **Why fourth:** Depends on `seek()`. Independent of Timeline (different touch surface).
- **Risk:** Low-Medium. Gesture math is simple. Main risk is false positives on short swipes.

### Step 5: Settings Drawer + Control Layering (UI-01)
- **Files:** `components/SettingsDrawer.tsx`, `components/PlaybackControls.tsx` (refactor), `App.tsx`
- **What:** Extract settings from PlaybackControls into a drawer. Slim controls to Play/Pause/Stop + Timeline + Settings toggle.
- **Why last:** Pure UI refactor. No new logic. Can be done in parallel with Step 4 if needed.
- **Risk:** Medium. Must preserve all existing functionality (offset controls, font slider, dim, contrast, fullscreen). Dark-theater usability is critical.

### Dependency Graph

```
ENG-03 (totalDurationMs)
    ↓
ENG-01/02 (seek + session sync)
    ↓
    ├── UI-03 (Timeline)
    │
    └── UI-02 (Gestures)
    
UI-01 (Settings Drawer) — independent, can parallel with UI-02/UI-03
```

## Scaling Considerations

This is a single-user offline PWA. Scaling is not a concern. The architecture prioritizes:
1. **Battery life** — rAF-based timing, no setInterval for position tracking
2. **Dark theater usability** — large touch targets, gesture alternatives to visual controls
3. **Session persistence correctness** — seek must not corrupt the persisted session

## Sources

- Existing codebase analysis: `src/hooks/usePlaybackEngine.ts`, `src/playback/PlaybackEngine.ts`, `src/playback/session.ts`
- Existing component analysis: `src/components/PlaybackControls.tsx`, `src/App.tsx`
- Existing type definitions: `src/types/subtitle.ts`, `src/imports/srtParser.ts`
- Existing DB layer: `src/db/sessions.ts`, `src/db/database.ts`

---

*Architecture research for: Playback UI Redesign & Timeline (v1.2 milestone)*
*Researched: 2026-08-31*
