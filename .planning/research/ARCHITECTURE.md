# Architecture Patterns

**Domain:** PWA Cinema Subtitle Sync Player
**Researched:** 2026-07-26
**Overall confidence:** MEDIUM

---

## Recommended Architecture

CinemaSyncSubs follows a **3-layer pipeline** architecture with **state management** and **offline persistence**:

```
┌─────────────────────────────────────────────────────────┐
│                     User Interface                       │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Import   │  │  Playback    │  │  Subtitle Display │  │
│  │  Screen   │  │  Controls    │  │  (Black/White)   │  │
│  └─────┬─────┘  └──────┬───────┘  └────────▲─────────┘  │
│        │               │                    │            │
├────────┼───────────────┼────────────────────┼────────────┤
│        │     Application Layer                │            │
│        │               │                    │            │
│  ┌─────▼─────┐  ┌──────▼───────┐  ┌────────┴─────────┐  │
│  │  SRT      │  │  Playback    │  │  Render          │  │
│  │  Parser   │──│  Engine      │──│  Pipeline        │  │
│  │           │  │  (Timer)     │  │  (DOM/CSS)       │  │
│  └─────┬─────┘  └──────┬───────┘  └──────────────────┘  │
│        │               │                                 │
│  ┌─────▼───────────────▼──────────────────────────────┐  │
│  │              State Store (Lightweight)              │  │
│  │  { cues[], currentIndex, isPlaying, startTime }    │  │
│  └─────────────────────┬──────────────────────────────┘  │
│                        │                                 │
├────────────────────────┼─────────────────────────────────┤
│        Persistence Layer                                │
│  ┌─────────────────────▼──────────────────────────────┐  │
│  │              IndexedDB (via Dexie.js)               │  │
│  │  • subtitle-store: parsed cues + metadata          │  │
│  │  • settings-store: user preferences                │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Cache API (Service Worker)             │  │
│  │  • App shell: HTML, CSS, JS, manifest              │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │           Screen Wake Lock API (navigator.wakeLock) │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **SRT Parser** | Read File → parse to Cue[] objects | State Store (output), IndexedDB (persist) |
| **Playback Engine** | High-resolution timing, cue lookup | State Store (read/write), Render Pipeline (trigger) |
| **Render Pipeline** | DOM updates, CSS styling, OLED optimization | Playback Engine (input), Screen Wake Lock (hold/release) |
| **State Store** | Centralized app state, cue index tracking | All components |
| **File Import** | File picker, validation, encoding detection | SRT Parser (input) |
| **IndexedDB Layer** | Persist parsed subtitles, load on startup | State Store (hydrate), SRT Parser (store) |
| **Service Worker** | App shell caching, offline availability | Cache API |
| **Wake Lock Manager** | Acquire/release screen wake lock during playback | Playback Engine (events) |

---

## Data Flow

### 1. Import Flow (one-time, on user action)
```
User selects .srt file
       │
       ▼
File Import: read as text (handle encoding: UTF-8, fallback to system default)
       │
       ▼
SRT Parser: normalize line endings → split on blank lines → regex parse blocks
       │
       ▼
Validate: check for valid timecodes, sequential ordering
       │
       ▼
IndexedDB: store { id, filename, cues[], importedAt }
       │
       ▼
State Store: hydrate cues[] from IndexedDB
       │
       ▼
UI: show subtitle ready, display "Start" button
```

### 2. Playback Flow (real-time loop)
```
User taps "Start"
       │
       ▼
Wake Lock Manager: navigator.wakeLock.request('screen')
       │
       ▼
Playback Engine: record startTime = performance.now()
       │
       ▼
┌──────┤ requestAnimationFrame loop ◄──────────────────┐
│      │                                                │
│      ▼                                                │
│  Playback Engine:                                     │
│    elapsed = performance.now() - startTime            │
│    activeIndex = binarySearchCues(cues, elapsed)      │
│    if activeIndex changed:                            │
│      State Store: currentIndex = activeIndex          │
│      Render Pipeline: update DOM text                 │
│      schedule next rAF                                │
│      │                                                │
│      └────────────────────────────────────────────────┘
```

### 3. Storage Flow
```
On first visit:
  Service Worker install → Cache API stores app shell
  → PWA installable, works offline

On subtitle import:
  SRT Parser → IndexedDB stores parsed cues
  → Survives app restart, available offline

On app load (returning user):
  IndexedDB → State Store hydrate → UI shows saved subtitles
```

---

## Patterns to Follow

### Pattern 1: Parser as Pure Function
**What:** SRT parser is a stateless pure function: `string → Cue[]`
**When:** Always keep parsing separate from storage and rendering.
**Why:** Pure functions are testable, cacheable, and reusable. The parser should never touch IndexedDB or DOM.
```typescript
interface Cue {
  id: number;
  start: number;  // milliseconds
  end: number;    // milliseconds
  text: string;
}

function parseSRT(content: string): Cue[] {
  // 1. Normalize line endings to \n
  // 2. Split on double-newline to get blocks
  // 3. Regex parse each block: number, timecode, text
  // 4. Return sorted array of Cue objects
}
```

### Pattern 2: Time-Separation Architecture
**What:** Separate the **timing source** from the **rendering loop**.
**When:** Always. Never derive time from rAF timestamps.
**Why:** `requestAnimationFrame` timestamps are imprecise (can be delayed by GC, layout). `performance.now()` is the high-resolution monotonic clock that gives accurate elapsed time regardless of frame drops.
```typescript
class PlaybackEngine {
  private startTime: number = 0;
  private cues: Cue[];
  
  play() {
    this.startTime = performance.now();
    this.tick();
  }
  
  private tick = () => {
    const elapsed = performance.now() - this.startTime;
    const idx = this.findActiveCue(elapsed);
    if (idx !== this.lastIndex) {
      this.onCueChange(idx);
      this.lastIndex = idx;
    }
    if (this.isPlaying) {
      requestAnimationFrame(this.tick);
    }
  };
  
  private findActiveCue(elapsed: number): number {
    // Binary search for cue where cue.start <= elapsed < cue.end
    let lo = 0, hi = this.cues.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.cues[mid].start > elapsed) hi = mid - 1;
      else if (this.cues[mid].end <= elapsed) lo = mid + 1;
      else return mid;
    }
    return -1;
  }
}
```

### Pattern 3: State Store as Single Source of Truth
**What:** Lightweight reactive state container.
**When:** Any component needs shared state.
**Why:** Avoids prop drilling, keeps UI in sync with playback.
```typescript
interface AppState {
  cues: Cue[];
  currentIndex: number;
  isPlaying: boolean;
  fileName: string | null;
}
```

### Pattern 4: Binary Search Cue Lookup
**What:** O(log n) search for active cue by elapsed time.
**When:** Every tick of the playback loop.
**Why:** Movies can have 1000+ subtitles. Linear scan O(n) per frame is wasteful. Binary search is O(log n).
```typescript
// For even better performance with sequential access:
// Track currentIndex, check if still active, else check neighbors first
// before falling back to binary search
```

### Pattern 5: Defensive Parsing
**What:** Handle malformed SRT gracefully (common in user-downloaded files).
**When:** Always. Real-world SRT files have encoding issues, BOM markers, wrong separators (dot instead of comma), missing sequence numbers.
**Why:** Users download SRTs from various sources. Parser must be resilient.
```typescript
// Handle:
// - UTF-8 BOM marker (\uFEFF)
// - Dot vs comma in timecodes (00:00:01.000 vs 00:00:01,000)
// - Missing or non-sequential cue numbers
// - Extra blank lines
// - Windows (\r\n) vs Unix (\n) line endings
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Using setTimeout/setInterval for Timing
**What:** Driving subtitle display with setInterval(check, 100)
**Why bad:** Timers drift, throttle in background tabs, and fire at inconsistent intervals. Subtitles will desync over time.
**Instead:** Use `performance.now()` to measure actual elapsed time. rAF only triggers visual updates.

### Anti-Pattern 2: Storing Parsed Cues in localStorage
**What:** `localStorage.setItem('cues', JSON.stringify(cues))`
**Why bad:** localStorage is limited to ~5MB, synchronous (blocks main thread), and not designed for structured data. Large subtitle files can exceed quota.
**Instead:** Use IndexedDB. It's async, supports much larger storage, and allows indexing.

### Anti-Pattern 3: Re-parsing SRT on Every App Load
**What:** Storing raw SRT text and parsing it each time the app opens.
**Why bad:** Parsing is CPU-bound. For a 2-hour movie with 1000+ cues, this causes visible startup delay.
**Instead:** Parse once on import, store structured Cue[] in IndexedDB. Load is instant.

### Anti-Pattern 4: Fullscreen API for Cinema Display
**What:** Using `requestFullscreen()` to go fullscreen in the theater.
**Why bad:** Fullscreen API is unreliable on iOS Safari. It also shows system UI on exit, which is jarring in a dark theater.
**Instead:** Design the UI to work in normal browser view with PWA "standalone" display mode (via manifest `display: standalone`). The app launched from home screen already has no browser chrome.

### Anti-Pattern 5: Brightness Control via CSS Filter
**What:** Using `filter: brightness(0.1)` to dim the display.
**Why bad:** CSS filters don't reduce actual screen backlight/LED power. On LCD, the backlight stays at minimum hardware brightness. On OLED, black pixels are already off — the issue is white text being too bright.
**Instead:** Use the Screen Wake Lock API to keep screen on. For brightness, instruct users to set system brightness to minimum before starting. Consider a "dim mode" that uses gray text instead of pure white.

---

## Mobile Browser Limitations & Mitigations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| **Screen auto-lock** | Screen dims/turns off during movie | Screen Wake Lock API (`navigator.wakeLock.request('screen')`). Supported in all modern browsers. Acquire on play, release on pause/stop. |
| **iOS Home Screen Wake Lock** | Wake Lock didn't work in PWA home screen mode before iOS 18.4 | Target iOS 18.4+. For older iOS, show instructions to disable auto-lock in Settings. |
| **No brightness control API** | Cannot programmatically dim screen below system minimum | Use dark gray text (#888) instead of pure white for "dim mode". Instruct users to set brightness to minimum. |
| **Background JS throttling** | Playback stops when tab is backgrounded | Not an issue — subtitle display requires screen to be visible. Wake Lock keeps it foreground. |
| **Fullscreen API on iOS** | Not supported in Safari iOS | Use PWA `display: standalone` in manifest. App launched from home screen has no browser UI. |
| **Storage eviction** | Browser may clear IndexedDB under storage pressure | Use `navigator.storage.persist()` to request persistent storage. Re-import is always possible. |
| **File picker on iOS** | `<input type="file">` works but limited to iCloud/Photos | Use standard file input with `accept=".srt,.txt"`. iOS Files app supports SRT. |

---

## Scalability Considerations

| Concern | At 1 user | At 100 sessions | At 1000 sessions |
|---------|-----------|-----------------|------------------|
| **Subtitle storage** | Single movie, ~100KB parsed | Multiple movies in IndexedDB | IndexedDB handles GBs; no issue |
| **Parse performance** | <50ms for typical SRT | Same — parsing is one-time | Same |
| **Playback accuracy** | performance.now() ±1ms | Same | Same |
| **Wake Lock battery** | ~2hr movie, ~10-20% extra drain | Same per session | Same per session |
| **Offline availability** | Service Worker caches app shell | Same | Same |

---

## Build Order Implications

The architecture suggests this dependency-based build order:

```
Phase 1: Foundation
├── SRT Parser (pure function, testable in isolation)
├── State Store (simple reactive container)
└── Basic UI shell (import button, file picker)

Phase 2: Playback Core
├── Playback Engine (depends on Parser + State Store)
├── Render Pipeline (depends on Playback Engine)
└── Binary search cue lookup (depends on Parser output format)

Phase 3: Persistence
├── IndexedDB layer (depends on Parser output format)
├── Service Worker + Cache API (independent, can parallelize)
└── App load hydration (depends on IndexedDB + State Store)

Phase 4: Cinema Optimization
├── Screen Wake Lock integration (depends on Playback Engine)
├── OLED rendering optimization (depends on Render Pipeline)
├── Landscape orientation lock (depends on UI shell)
└── PWA manifest + install flow (independent)

Phase 5: Polish
├── Encoding detection (depends on File Import)
├── Error handling for malformed SRT (depends on Parser)
└── Dim mode / brightness mitigation (depends on Render Pipeline)
```

**Critical path:** Parser → State Store → Playback Engine → Render Pipeline → Wake Lock

**Can build in parallel:** Service Worker, PWA manifest, IndexedDB schema (after Parser output format is fixed)

---

## Technology Recommendations

| Concern | Recommendation | Why |
|---------|---------------|-----|
| **SRT Parsing** | Custom regex parser (~50 lines) | SRT format is simple; no library needed. Full control over error handling. |
| **State Management** | Lightweight custom store (Proxy-based or tiny library like Zustand) | No need for Redux/Vue. Single state object with subscriptions. |
| **IndexedDB** | Dexie.js | Clean promise-based API, handles transactions, widely supported. |
| **Service Worker** | Workbox (Google) | Handles app shell caching, precaching, and offline fallback with minimal code. |
| **PWA Manifest** | Static manifest.json | `display: standalone`, `orientation: landscape`, dark theme color. |
| **Wake Lock** | Native `navigator.wakeLock` | No library needed. Feature-detect and fallback gracefully. |
| **Styling** | Plain CSS with CSS variables | No framework needed. CSS variables for theming (brightness levels). |
| **Build Tool** | Vite | Fast, PWA plugin available, simple config, great DX. |
| **Framework** | Vanilla TS or lightweight (Preact/Svelte) | App is simple; no need for React. If framework desired, Preact for small bundle. |

---

## Sources

- [subplay - simple SRT parser/player](https://github.com/algesten/subplay) — Parser/player pipeline pattern
- [subtitle.js - stream-based subtitle library](https://github.com/gsantiago/subtitle.js) — TypeScript SRT parsing reference
- [Screen Wake Lock API - Chrome Developers](https://developer.chrome.com/docs/capabilities/web-apis/wake-lock) — Wake Lock usage and support
- [Screen Wake Lock API supported in all browsers - web.dev](https://web.dev/blog/screen-wake-lock-supported-in-all-browsers) — Cross-browser support confirmation
- [Offline Storage for PWAs - Addy Osmani](https://medium.com/dev-channel/offline-storage-for-progressive-web-apps-70d52695513c) — IndexedDB vs Cache API guidance
- [web.dev - Offline Data](https://web.dev/learn/pwa/offline-data) — Storage strategy patterns
- [web.dev - A tale of two clocks](https://web.dev/articles/audio-scheduling) — Timing source vs rendering loop separation
- [MDN - Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) — API reference and security model
- [WebKit Bug 254545](https://bugs.webkit.org/show_bug.cgi?id=254545) — Wake Lock in Home Screen Web Apps on iOS 18.4+
- [OLED Burn-In Prevention](https://zbotic.in/oled-display-burn-in-how-to-prevent-pixel-degradation) — OLED layout design principles
