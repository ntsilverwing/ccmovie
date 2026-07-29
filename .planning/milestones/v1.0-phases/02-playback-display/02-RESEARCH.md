# Phase 2: Playback & Display - Research

**Researched:** 2026-07-27
**Domain:** React Playback Engine, Timing Architecture, OLED Display
**Confidence:** MEDIUM

## Summary

Phase 2 adds the core cinema experience on top of Phase 1's SRT parsing foundation: a timing-accurate playback engine and OLED-optimized subtitle display. The critical technical decisions are (1) using `useReducer` for playback state management since multiple state values change together in well-defined transitions, (2) a `performance.now()` + `requestAnimationFrame` architecture where `performance.now()` is the sole timing source and rAF only schedules visual updates, and (3) CSS custom properties for runtime theming (font size, dim mode) with `localStorage` persistence.

The playback engine is the heart of the app. Its architecture determines whether subtitles stay synchronized over a 2-hour movie. The proven pattern is: record `startTime = performance.now()` on play, then on each rAF tick compute `elapsed = performance.now() - startTime` and binary-search the cues array for the active cue. This is inherently drift-free because elapsed time is absolute — not accumulated from frame deltas. The rAF callback timestamp should NOT be used for timing due to VSync-related discrepancies.

For display, the OLED-optimized approach uses pure black `#000000` background (zero power on OLED pixels), dimmed white `#E0E0E0` text (reduces halation eye strain), viewport-relative font sizing via `clamp()` for cinema-distance readability, and CSS custom properties for instant theme switching between normal/dim/high-contrast modes.

**Primary recommendation:** Build a `usePlaybackEngine` custom hook with `useReducer` for state + `useRef` for rAF ID and startTime, a `SubtitleDisplay` component driven by CSS custom properties, and a `usePersistedSettings` hook using `localStorage` for font size and dim mode. Keep the playback engine framework-agnostic (pure TypeScript class) with React hooks as a thin wrapper — this enables Phase 3's Wake Lock integration to subscribe to engine events without coupling.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Subtitle timing/schedule | Client (React hook) | — | Timing must be local, zero latency, no server round-trip |
| Cue lookup (binary search) | Client (pure function) | — | O(log n) search on parsed cues array, runs every frame |
| Subtitle rendering | Client (React component) | — | DOM text nodes, CSS-driven styling |
| Font size persistence | Client (localStorage) | — | Simple key-value, synchronous read on mount |
| Dim mode toggle | Client (CSS variables) | — | Instant visual switch, no re-render needed |
| Playback state machine | Client (useReducer) | — | Well-defined transitions: idle → playing → paused → idle |
| Start/Stop user gesture | Client (DOM event) | — | Direct button click handler |

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3.1 | UI framework + hooks | Already in Phase 1; useReducer + useRef + useEffect cover all needs |
| TypeScript | 5.6.3 | Type safety | Already in Phase 1; discriminated unions for reducer actions |

### Supporting (no new libraries needed)
| Feature | Approach | Why |
|---------|----------|-----|
| Playback state | `useReducer` + `useRef` | Built-in React hooks, no library needed |
| Timing | `performance.now()` + `requestAnimationFrame` | Native browser APIs, no library needed |
| Settings persistence | `localStorage` | Synchronous, sufficient for simple key-value settings |
| CSS theming | CSS custom properties (`var(--subtitle-color)`) | Instant runtime switching, no re-render, no library needed |

**No new npm packages required for Phase 2.** All functionality is achievable with React 18 built-ins and native browser APIs already available in the Phase 1 codebase.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  User Interface                      │
│                                                     │
│  ┌──────────────┐  ┌────────────────────────────┐   │
│  │  Start/Stop   │  │    SubtitleDisplay         │   │
│  │  Button       │  │    (CSS custom props)      │   │
│  │  (PLAY-03)    │  │    (PLAY-05, DISP-03)     │   │
│  └──────┬───────┘  └─────────────▲──────────────┘   │
│         │                        │                   │
│  ┌──────┴───────────────────────┬┴────────────────┐  │
│  │      usePlaybackEngine        │                 │  │
│  │  ┌────────────────────────────┴──────────┐      │  │
│  │  │  useReducer (playback state)          │      │  │
│  │  │  { status, currentIndex, activeCue }  │      │  │
│  │  └───────────────────────────────────────┘      │  │
│  │  ┌───────────────────────────────────────┐      │  │
│  │  │  useRef (mutable, no re-render)       │      │  │
│  │  │  { rafId, startTime, cues }           │      │  │
│  │  └───────────────────────────────────────┘      │  │
│  │  ┌───────────────────────────────────────┐      │  │
│  │  │  rAF Loop → performance.now()         │      │  │
│  │  │  → binarySearchCues → dispatch        │──────┼──┼→ activeCue
│  │  └───────────────────────────────────────┘      │  │
│  └─────────────────────────────────────────────────┘  │
│                                                     │
│  ┌─────────────────────────────────────────────────┐  │
│  │  usePersistedSettings (localStorage)            │  │
│  │  { fontSize, isDimmed } → CSS custom props      │  │
│  │  (DISP-01, DISP-03)                             │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── types/
│   └── subtitle.ts          # Phase 1 — Cue, ParsedSubtitle (unchanged)
├── imports/
│   ├── encoding.ts          # Phase 1 — detectAndDecode (unchanged)
│   ├── srtParser.ts         # Phase 1 — parseSRT (unchanged)
│   └── fileImport.ts        # Phase 1 — importSRT (unchanged)
├── hooks/
│   ├── usePlaybackEngine.ts # Phase 2 — playback state machine + rAF loop
│   └── usePersistedSettings.ts # Phase 2 — localStorage for fontSize, isDimmed
├── playback/
│   └── PlaybackEngine.ts    # Phase 2 — framework-agnostic timing engine
├── components/
│   ├── FilePicker.tsx       # Phase 1 — unchanged
│   ├── CuePreview.tsx       # Phase 1 — unchanged
│   ├── SubtitleDisplay.tsx  # Phase 2 — OLED-optimized subtitle renderer
│   └── PlaybackControls.tsx # Phase 2 — Start/Stop button + settings
├── App.tsx                  # Phase 2 — integrate playback + display
└── index.css                # Phase 2 — add CSS custom properties + display styles
```

### Pattern 1: useReducer for Playback State Machine
**What:** Playback has well-defined states and transitions — use a reducer to manage them.
**When:** Always for the playback engine. Multiple state values (status, currentIndex, activeCue) change together.
**Why:** React docs recommend useReducer when state updates involve multiple sub-values or when the next state depends on the previous. The playback engine has clear actions: PLAY, PAUSE, STOP, TICK (cue change). This makes state transitions explicit and debuggable.

```typescript
// Source: React.dev — "Extracting State Logic into a Reducer"
// [CITED: reactjs/react.dev]

type PlaybackStatus = 'idle' | 'playing' | 'paused'

interface PlaybackState {
  status: PlaybackStatus
  currentIndex: number      // -1 when no cue active
  activeCue: Cue | null     // the currently displayed cue
}

type PlaybackAction =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'STOP' }
  | { type: 'TICK'; activeIndex: number }

function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case 'PLAY':
      return { ...state, status: 'playing' }
    case 'PAUSE':
      return { ...state, status: 'paused' }
    case 'STOP':
      return { status: 'idle', currentIndex: -1, activeCue: null }
    case 'TICK': {
      if (action.activeIndex === state.currentIndex) return state // no change → no re-render
      return {
        ...state,
        currentIndex: action.activeIndex,
        activeCue: action.activeIndex >= 0 ? cues[action.activeIndex] : null,
      }
    }
    default:
      return state
  }
}
```

### Pattern 2: useRef for rAF ID and Timing Values
**What:** Store the rAF ID and startTime in refs, not state.
**When:** Values that change frequently but don't need to trigger re-renders.
**Why:** React docs explicitly state: "Changing a ref does not trigger a re-render. This makes refs suitable for storing information that doesn't affect the visual output." The rAF ID and startTime are read by the tick callback but don't need to appear in the UI.

```typescript
// Source: React.dev — "Referencing Values with Refs"
// [CITED: reactjs/react.dev]

const rafIdRef = useRef<number | null>(null)
const startTimeRef = useRef<number>(0)
const cuesRef = useRef<Cue[]>([])  // updated when cues change, no re-render needed
```

### Pattern 3: performance.now() + rAF Timing Architecture
**What:** Use `performance.now()` as the sole timing source. rAF only schedules visual updates.
**When:** Every tick of the playback loop. Never derive time from rAF timestamps.
**Why:** `performance.now()` is monotonic (never jumps backward, starts from page load). rAF timestamps can have VSync-related discrepancies (Stack Overflow reports up to 6ms differences). The elapsed-time approach is inherently drift-free: `elapsed = performance.now() - startTime` is an absolute measurement, not an accumulation of frame deltas.

```typescript
// Architecture pattern — timing source separated from render loop
// [VERIFIED: performance.now() monotonic per MDN + web.dev "A tale of two clocks"]

class PlaybackEngine {
  private startTime: number = 0
  private lastIndex: number = -1

  play() {
    this.startTime = performance.now()
    this.lastIndex = -1
    this.tick()
  }

  private tick = () => {
    const elapsed = performance.now() - this.startTime  // absolute, drift-free
    const activeIndex = this.findActiveCue(elapsed)

    if (activeIndex !== this.lastIndex) {
      this.lastIndex = activeIndex
      this.onCueChange(activeIndex)  // dispatch TICK action
    }

    if (this.isPlaying) {
      this.rafId = requestAnimationFrame(this.tick)  // rAF only for scheduling
    }
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.isPlaying = false
  }
}
```

### Pattern 4: Binary Search with Sequential Optimization
**What:** O(log n) search for active cue, with a fast-path check of the current/next cue.
**When:** Every tick. Movies can have 1000+ cues.
**Why:** Linear scan O(n) per frame at 60fps = 60,000 comparisons/sec for 1000 cues. Binary search = ~10 comparisons. The sequential optimization (check currentIndex first, then next) makes the common case O(1).

```typescript
// Binary search for cue where cue.start <= elapsed < cue.end
// [ASSUMED: standard binary search pattern for interval lookup]

function findActiveCue(cues: Cue[], elapsed: number, hintIndex: number): number {
  // Fast path: still in current cue?
  if (hintIndex >= 0 && hintIndex < cues.length) {
    const cue = cues[hintIndex]
    if (elapsed >= cue.start && elapsed < cue.end) return hintIndex
  }
  // Fast path: check next cue (most common transition)
  const next = hintIndex + 1
  if (next >= 0 && next < cues.length) {
    const cue = cues[next]
    if (elapsed >= cue.start && elapsed < cue.end) return next
  }
  // Binary search fallback
  let lo = 0, hi = cues.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const cue = cues[mid]
    if (elapsed < cue.start) hi = mid - 1
    else if (elapsed >= cue.end) lo = mid + 1
    else return mid
  }
  return -1
}
```

### Pattern 5: CSS Custom Properties for Runtime Theming
**What:** Define subtitle colors, font size, and background as CSS custom properties. Change them by setting `element.style.setProperty()`.
**When:** Font size slider, dim mode toggle, high contrast mode (Phase 4).
**Why:** CSS custom properties enable instant visual changes without React re-renders. The browser updates the rendering directly. This is critical for smooth slider dragging — updating state on every slider tick would cause 60 re-renders/sec.

```css
/* CSS custom properties for cinema display */
/* [VERIFIED: CSS custom properties widely supported in all modern browsers] */

:root {
  --subtitle-bg: #000000;
  --subtitle-color: #e0e0e0;
  --subtitle-font-size: clamp(36px, 8vw, 72px);
  --subtitle-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
  --subtitle-font-weight: 500;
}

/* Dim mode — gray text for ultra-dark environments */
body.dimmed {
  --subtitle-color: #888888;
}

/* High contrast mode (Phase 4) */
body.high-contrast {
  --subtitle-color: #ffd700;
}
```

```typescript
// React component sets CSS custom props — no re-render needed for visual change
function SubtitleDisplay({ cue, fontSize, isDimmed }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.style.setProperty('--subtitle-font-size', `${fontSize}px`)
  }, [fontSize])

  useEffect(() => {
    document.body.classList.toggle('dimmed', isDimmed)
  }, [isDimmed])

  return (
    <div ref={containerRef} className="subtitle-container">
      <p className="subtitle-text">{cue?.text ?? ''}</p>
    </div>
  )
}
```

### Pattern 6: usePersistedSettings Hook
**What:** A custom hook that reads/writes settings to localStorage with a fallback default.
**When:** Font size, dim mode, and any user preference that should persist across sessions.
**Why:** localStorage is synchronous (reads complete before first render), has sufficient capacity for simple key-values, and is simpler than IndexedDB for this use case. IndexedDB is reserved for structured subtitle data (Phase 3).

```typescript
// Settings persistence pattern
// [VERIFIED: localStorage API per MDN — synchronous, ~5MB capacity]

const SETTINGS_KEY = 'cinemasyncsubs-settings'

interface Settings {
  fontSize: number    // pixels, range 36-72
  isDimmed: boolean   // gray text mode
}

const DEFAULT_SETTINGS: Settings = {
  fontSize: 48,
  isDimmed: false,
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Storage full or unavailable — fail silently, use in-memory
  }
}
```

### Anti-Patterns to Avoid
- **Using rAF timestamp for timing:** The timestamp passed to the rAF callback can differ from `performance.now()` by up to 6ms due to VSync timing. Always call `performance.now()` inside the tick function for accurate elapsed time.
- **Accumulating frame deltas:** `elapsed += delta` drifts over time due to floating-point rounding. Use `elapsed = performance.now() - startTime` (absolute) instead.
- **Storing rAF ID in state:** Causes unnecessary re-renders. Use `useRef`.
- **Re-rendering on every rAF tick:** Only dispatch a TICK action when the active cue changes. The rAF loop runs at 60fps but subtitles change at most a few times per second.
- **Using setTimeout/setInterval for subtitle timing:** Timers drift, throttle in background tabs, and fire at inconsistent intervals. The PITFALLS.md documents this as the #1 cause of subtitle desync.
- **CSS filter: brightness() for dimming:** Doesn't reduce actual screen backlight/LED power. On OLED, use gray text color instead.
- **IndexedDB for simple settings:** Overkill for a few key-values. localStorage is synchronous and sufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Binary search for cue lookup | Custom linear scan | Binary search with hint | O(log n) vs O(n) per frame; 1000 cues × 60fps = 60K comparisons/sec |
| Monotonic clock | Date.now() | performance.now() | Date.now() jumps with system clock changes; performance.now() is monotonic |
| Frame scheduling | setTimeout(callback, 16) | requestAnimationFrame | rAF syncs with display refresh, pauses in background tabs, battery-friendly |
| CSS theming | Inline styles on every element | CSS custom properties | Instant updates without React re-renders; slider dragging stays smooth |
| Settings persistence | Custom cookie or IndexedDB | localStorage | Synchronous, simple API, sufficient for small key-value data |

**Key insight:** The playback loop is deceptively simple-looking but has subtle timing pitfalls. The combination of `performance.now()` (absolute elapsed time) + `requestAnimationFrame` (visual update scheduling) + binary search (efficient cue lookup) is the industry-standard pattern for subtitle/audio synchronization. Every component of this pattern is a native browser API — no libraries needed.

## Common Pitfalls

### Pitfall 1: rAF Timestamp vs performance.now() Discrepancy
**What goes wrong:** The timestamp passed to the rAF callback can differ from `performance.now()` called inside the same callback. Stack Overflow reports discrepancies where rAF `now` is earlier than a `performance.now()` recorded before the frame.
**Why it happens:** rAF timestamps are derived from VSync signals and may represent the time the frame was prepared, not when the callback executes.
**How to avoid:** Always call `performance.now()` inside the tick function to compute elapsed time. Never use the rAF callback's `timestamp` parameter for timing logic.
**Warning signs:** Subtitles consistently early or late by a few milliseconds; drift that correlates with frame rate.

### Pitfall 2: Storing rAF ID in State
**What goes wrong:** `const [rafId, setRafId] = useState(null)` causes a re-render every time the rAF ID is set or cleared.
**Why it happens:** State updates trigger re-renders. The rAF ID is a mutable value that doesn't affect rendering.
**How to avoid:** Use `useRef` for the rAF ID, startTime, and cues array. Only use state for values that affect the UI (status, currentIndex, activeCue).
**Warning signs:** Console warnings about "Maximum update depth exceeded"; unnecessary re-renders in React DevTools.

### Pitfall 3: Re-rendering on Every Frame
**What goes wrong:** Dispatching a TICK action every frame (60/sec) even when the active cue hasn't changed.
**Why it happens:** The rAF loop runs at display refresh rate, but subtitles change infrequently.
**How to avoid:** In the reducer, check `if (action.activeIndex === state.currentIndex) return state` — returning the same state object prevents re-render.
**Warning signs:** React DevTools shows 60 state updates/sec during playback; battery drain.

### Pitfall 4: Font Size Inadequate for Cinema Viewing Distance
**What goes wrong:** Standard mobile font sizes (16-20px) are invisible at 2-3 feet distance in a dark theater.
**Why it happens:** Developers design at arm's length, not cinema distance.
**How to avoid:** Use `clamp(36px, 8vw, 72px)` for subtitle text. The slider should range from 36px to 72px. Default to 48px.
**Warning signs:** User testing reveals squinting or leaning forward to read subtitles.

### Pitfall 5: Halation Effect from Pure White on Pure Black
**What goes wrong:** `#FFFFFF` on `#000000` causes eye strain over 2 hours due to the extreme contrast and how human eyes process light-on-dark.
**Why it happens:** Maximum contrast ratio (21:1) causes text to appear to glow/blur.
**How to avoid:** Use `#E0E0E0` (dimmed white) on `#000000`. Add `text-shadow: 0 0 4px rgba(0,0,0,0.8)` to reduce perceived glow. Use font-weight 500-600 instead of bold.
**Warning signs:** User reports of headaches or eye strain after 30+ minutes.

### Pitfall 6: Visibility Change Breaks Timing
**What goes wrong:** When the user switches apps and returns, `performance.now()` continues from where it was, but the rAF loop was paused during backgrounding.
**Why it happens:** Browsers suspend rAF in background tabs. On return, the elapsed time is correct (performance.now() is monotonic), but the visual state may be stale.
**How to avoid:** Listen for `visibilitychange` event. On `visibility === 'visible'`, the next tick will naturally compute the correct elapsed time and jump to the current cue. No special handling needed — the absolute elapsed time approach handles this automatically.
**Warning signs:** After returning from another app, subtitles show the wrong cue or no cue.

## Code Examples

### usePlaybackEngine Hook (Core Pattern)
```typescript
// usePlaybackEngine.ts — combines useReducer + useRef + rAF
// [CITED: reactjs/react.dev — useReducer, useRef, useEffect patterns]

import { useReducer, useRef, useEffect, useCallback } from 'react'
import type { Cue } from '../types/subtitle'

// --- Reducer (pure function, testable in isolation) ---
type PlaybackStatus = 'idle' | 'playing' | 'paused'

interface PlaybackState {
  status: PlaybackStatus
  currentIndex: number
  activeCue: Cue | null
}

type PlaybackAction =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'STOP' }
  | { type: 'TICK'; activeIndex: number; cues: Cue[] }

function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case 'PLAY':
      return { ...state, status: 'playing' }
    case 'PAUSE':
      return { ...state, status: 'paused' }
    case 'STOP':
      return { status: 'idle', currentIndex: -1, activeCue: null }
    case 'TICK': {
      if (action.activeIndex === state.currentIndex) return state
      return {
        ...state,
        currentIndex: action.activeIndex,
        activeCue: action.activeIndex >= 0 ? action.cues[action.activeIndex] : null,
      }
    }
    default:
      return state
  }
}

const INITIAL_STATE: PlaybackState = {
  status: 'idle',
  currentIndex: -1,
  activeCue: null,
}

// --- Hook ---
export function usePlaybackEngine(cues: Cue[]) {
  const [state, dispatch] = useReducer(playbackReducer, INITIAL_STATE)
  const rafIdRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)
  const lastIndexRef = useRef<number>(-1)
  const cuesRef = useRef<Cue[]>(cues)

  // Keep cues ref in sync without triggering re-renders
  useEffect(() => {
    cuesRef.current = cues
  }, [cues])

  // --- Tick function (rAF callback) ---
  const tick = useCallback(() => {
    const elapsed = performance.now() - startTimeRef.current
    const activeIndex = findActiveCue(cuesRef.current, elapsed, lastIndexRef.current)

    if (activeIndex !== lastIndexRef.current) {
      lastIndexRef.current = activeIndex
      dispatch({ type: 'TICK', activeIndex, cues: cuesRef.current })
    }

    // Continue loop if still playing
    if (cuesRef.current.length > 0 && lastIndexRef.current < cuesRef.current.length) {
      rafIdRef.current = requestAnimationFrame(tick)
    }
  }, [])

  // --- Control functions ---
  const play = useCallback(() => {
    startTimeRef.current = performance.now()
    lastIndexRef.current = -1
    dispatch({ type: 'PLAY' })
    rafIdRef.current = requestAnimationFrame(tick)
  }, [tick])

  const pause = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    dispatch({ type: 'PAUSE' })
  }, [])

  const stop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    lastIndexRef.current = -1
    dispatch({ type: 'STOP' })
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [])

  return { state, play, pause, stop }
}

// --- Binary search with sequential hint ---
function findActiveCue(cues: Cue[], elapsed: number, hint: number): number {
  if (cues.length === 0) return -1

  // Fast path: still in current cue
  if (hint >= 0 && hint < cues.length) {
    const cue = cues[hint]
    if (elapsed >= cue.start && elapsed < cue.end) return hint
  }

  // Fast path: check next cue (most common transition)
  const next = hint + 1
  if (next >= 0 && next < cues.length) {
    const cue = cues[next]
    if (elapsed >= cue.start && elapsed < cue.end) return next
  }

  // Binary search fallback
  let lo = 0, hi = cues.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const cue = cues[mid]
    if (elapsed < cue.start) hi = mid - 1
    else if (elapsed >= cue.end) lo = mid + 1
    else return mid
  }
  return -1
}
```

### SubtitleDisplay Component
```typescript
// SubtitleDisplay.tsx — OLED-optimized subtitle renderer
// [VERIFIED: CSS custom properties pattern per MDN]

import { useRef, useEffect } from 'react'
import type { Cue } from '../types/subtitle'

interface SubtitleDisplayProps {
  cue: Cue | null
  fontSize: number
  isDimmed: boolean
}

export function SubtitleDisplay({ cue, fontSize, isDimmed }: SubtitleDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Update font size via CSS custom property (no re-render needed for visual)
  useEffect(() => {
    containerRef.current?.style.setProperty('--subtitle-font-size', `${fontSize}px`)
  }, [fontSize])

  // Toggle dim mode via body class
  useEffect(() => {
    document.body.classList.toggle('dimmed', isDimmed)
    return () => document.body.classList.remove('dimmed')
  }, [isDimmed])

  return (
    <div ref={containerRef} className="subtitle-container">
      <p className="subtitle-text">{cue?.text ?? ''}</p>
    </div>
  )
}
```

### CSS for OLED Display
```css
/* index.css additions for Phase 2 — OLED-optimized display */
/* [VERIFIED: CSS custom properties, clamp(), viewport units per MDN] */

:root {
  /* Cinema display tokens */
  --subtitle-bg: #000000;
  --subtitle-color: #e0e0e0;
  --subtitle-font-size: 48px;
  --subtitle-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
  --subtitle-font-weight: 500;
  --subtitle-max-width: 80vw;
  --subtitle-line-height: 1.4;
}

/* Dim mode — gray text for ultra-dark environments (DISP-03) */
body.dimmed {
  --subtitle-color: #888888;
}

/* High contrast mode (Phase 4) */
body.high-contrast {
  --subtitle-color: #ffd700;
}

/* Subtitle display container — fills viewport, centers text */
.subtitle-container {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--subtitle-bg);
  padding: 5vw;
  /* Prevent text selection in cinema mode */
  user-select: none;
  -webkit-user-select: none;
}

/* Subtitle text — cinema-optimized */
.subtitle-text {
  color: var(--subtitle-color);
  font-size: var(--subtitle-font-size);
  font-weight: var(--subtitle-font-weight);
  text-shadow: var(--subtitle-shadow);
  max-width: var(--subtitle-max-width);
  line-height: var(--subtitle-line-height);
  text-align: center;
  white-space: pre-wrap;
  margin: 0;
  /* System font stack for CJK character support */
  font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* Playback controls overlay */
.playback-controls {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 16px;
  align-items: center;
  z-index: 100;
}

/* Start button — large touch target for dark theater use */
.start-button {
  min-width: 120px;
  min-height: 56px;
  padding: 16px 32px;
  font-size: 1.2rem;
  background: #222;
  color: #e0e0e0;
  border: 1px solid #444;
  border-radius: 8px;
  cursor: pointer;
}

.start-button:active {
  background: #333;
}

/* Font size slider */
.font-size-slider {
  width: 160px;
  accent-color: #888;
}
```

### usePersistedSettings Hook
```typescript
// usePersistedSettings.ts — localStorage persistence for user preferences
// [VERIFIED: localStorage API per MDN — synchronous, ~5MB capacity]

import { useState, useCallback } from 'react'

const SETTINGS_KEY = 'cinemasyncsubs-settings'

export interface Settings {
  fontSize: number
  isDimmed: boolean
}

const DEFAULT_SETTINGS: Settings = {
  fontSize: 48,
  isDimmed: false,
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    return {
      fontSize: typeof parsed.fontSize === 'number' ? Math.max(36, Math.min(72, parsed.fontSize)) : DEFAULT_SETTINGS.fontSize,
      isDimmed: Boolean(parsed.isDimmed),
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function usePersistedSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial }
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch {
        // Storage full — fail silently, keep in-memory
      }
      return next
    })
  }, [])

  return { settings, updateSettings }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| setInterval for subtitle timing | performance.now() + rAF | Always the correct pattern | Eliminates timer drift over 2 hours |
| Inline styles for theming | CSS custom properties | CSS3 (2014+) | Instant theme switching without re-render |
| useState for complex state | useReducer for state machines | React 16.8+ (2019) | Explicit state transitions, easier debugging |
| localStorage for everything | localStorage for settings, IndexedDB for data | Best practice | Right tool for right data size |
| Pure white #FFFFFF on black | Dimmed white #E0E0E0 on black | OLED UX research | Reduces halation eye strain over 2 hours |

**Deprecated/outdated:**
- `setTimeout`/`setInterval` for subtitle scheduling: Causes drift. Use `performance.now()` elapsed time.
- `Date.now()` for elapsed time measurement: Not monotonic. Use `performance.now()`.
- CSS `filter: brightness()` for dimming: Doesn't reduce actual screen power. Use gray text color.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Binary search with hint check is O(1) for sequential playback | Pattern 4 | If cues are non-sequential (rare), falls back to O(log n) — still correct |
| A2 | localStorage is sufficient for settings persistence (font size, dim mode) | Pattern 6 | If settings grow complex, migrate to IndexedDB — but current scope is 2 key-values |
| A3 | CSS custom properties work for runtime font size updates without re-render | Pattern 5 | If browser doesn't support (IE11), falls back to inline style — but PWA targets modern browsers |
| A4 | rAF callback timestamp should not be used for timing | Pitfall 1 | If rAF timestamp is used, subtitles may drift by a few ms per frame — cumulative over 2 hours |
| A5 | `visibilitychange` handling is automatic with absolute elapsed time | Pitfall 6 | If not, subtitles would be wrong after app switch — but absolute elapsed time handles this |

## Open Questions (RESOLVED)

1. **PlaybackControls visibility during playback** — RESOLVED: Always-visible controls for v1 (simpler, no auto-hide).
   - What we know: Controls should be accessible but not distracting in a dark theater.
   - What was unclear: Should controls auto-hide after a few seconds of playback, or remain visible?

2. **Font size slider interaction during playback** — RESOLVED: Include slider in playback controls overlay with CSS custom properties for instant updates.
   - What we know: Slider should update font size in real-time.
   - What was unclear: Should the slider be visible during playback, or only in a settings panel?

3. **End-of-movie behavior** — RESOLVED: Auto-stop when elapsed time exceeds the last cue's end time.
   - What we know: After the last cue, the display should go blank.
   - What was unclear: Should playback auto-stop at the end, or continue running?

## Environment Availability

Step 2.6: SKIPPED — Phase 2 requires no external dependencies beyond the existing React 18 + TypeScript + Vite stack. All playback timing uses native browser APIs (`performance.now`, `requestAnimationFrame`) available in all modern browsers.

## Validation Architecture

Skipped — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`.

## Security Domain

Phase 2 does not introduce new security concerns. The playback engine operates entirely on data already in memory (parsed cues from Phase 1). No network requests, no user input beyond button clicks and slider adjustments. The `localStorage` usage is limited to user preferences (font size, dim mode) — no sensitive data.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | No new user input vectors in Phase 2 |
| V6 Cryptography | no | — |

## Sources

### Primary (HIGH confidence)
- React 18.3.1 (installed) — useReducer, useRef, useEffect hooks
- TypeScript 5.6.3 (installed) — type-safe reducer actions
- performance.now() + requestAnimationFrame — native browser APIs

### Secondary (MEDIUM confidence)
- React.dev — "Extracting State Logic into a Reducer" — useReducer vs useState comparison [CITED: reactjs/react.dev]
- React.dev — "Referencing Values with Refs" — useRef for mutable values [CITED: reactjs/react.dev]
- idb library (Jake Archibald) — key-value store pattern reference [CITED: jakearchibald/idb]

### Tertiary (LOW confidence)
- Stack Overflow — rAF timestamp vs performance.now() discrepancy analysis [VERIFIED: stackoverflow.com/q/38360250]
- CSS-Tricks — Viewport-sized typography techniques [CITED: css-tricks.com]
- Various — OLED dark mode best practices [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all built-in React hooks and native browser APIs
- Architecture: MEDIUM — patterns verified against React docs and timing research, but specific cinema-distance UX is assumed
- Pitfalls: MEDIUM — timing drift and OLED pitfalls well-documented in PITFALLS.md; React-specific pitfalls verified against official docs

**Research date:** 2026-07-27
**Valid until:** 2026-08-27 (stable — React 18 patterns and browser APIs are stable)
