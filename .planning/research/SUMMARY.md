# Project Research Summary

**Project:** CinemaSyncSubs (ccmovie)
**Domain:** PWA-based Cinema Subtitle Sync Player for Mobile Browsers
**Researched:** 2026-07-26
**Confidence:** MEDIUM-HIGH

## Executive Summary

CinemaSyncSubs is an offline-first Progressive Web App that displays synchronized subtitles on a phone screen during cinema screenings. The core experience is simple: user imports an SRT file, taps "Start" when the movie begins, and the app shows white text on a black screen timed to the film. The primary audience is Chinese-speaking moviegoers watching foreign films with fan-made SRT subtitles. The app must work flawlessly in a dark theater on iOS/Android phones — meaning screen-on persistence, readable font sizes at 2-3ft distance, and zero network dependency are non-negotiable.

The recommended approach is a lightweight Vite + vite-plugin-pwa build with vanilla TypeScript or a minimal framework (React/Vue optional). The stack centers on three key libraries: `subtitle.js` for SRT parsing, `idb` for IndexedDB persistence, and the native Screen Wake Lock API with a NoSleep.js fallback for older iOS. The architecture follows a 3-layer pipeline: File Import → SRT Parser → Playback Engine (performance.now + rAF) → Render Pipeline (OLED-optimized black/white display). Parsed subtitles are stored in IndexedDB for instant reloading; the app shell is cached via Service Worker for offline use.

Key risks are dominated by iOS Safari's fragmented PWA support. The most critical: Wake Lock API was broken in installed PWAs until iOS 18.4 (March 2025), meaning older iPhones need a NoSleep.js video-loop fallback. iOS also evicts all web storage after 7 days of non-use, so subtitle data must survive via IndexedDB with re-import capability. Chinese SRT encoding (GBK/Big5/BOM) is a silent killer — files must be decoded via `FileReader.readAsArrayBuffer()` with explicit encoding detection. Finally, subtitle timing must use `performance.now()` elapsed-time architecture, never `setInterval`, to prevent multi-minute drift over a 2-hour film.

## Key Findings

### Recommended Stack

The stack is minimal and purpose-built for a client-only PWA. No SSR, no backend, no heavy frameworks. Vite provides the fastest dev experience and smallest config; vite-plugin-pwa handles Service Worker and manifest generation via Workbox.

**Core technologies:**
- **Vite 8.1.5 + vite-plugin-pwa 1.3.0**: Build tool + PWA integration — fastest HMR, zero-config Workbox wrapping, framework-agnostic. Avoids Next.js SSR overhead.
- **subtitle.js 4.2.2**: SRT/VTT parsing — stream-based, returns `{start, end, text}` cues with millisecond timestamps, TypeScript support, 100% coverage.
- **idb 8.0.3**: IndexedDB Promise wrapper — 1.19kB, async/await, supports object stores with indexing on `movieId` + timestamp for playback queries.
- **Screen Wake Lock API (native)**: Keep screen on during playback — supported in Safari 16.4+, Chrome 84+, Firefox 126+. No library needed for primary path.
- **NoSleep.js (fallback)**: Hidden video loop for older iOS where Wake Lock is broken in standalone PWA mode.

**iOS-specific constraints handled by the stack:** No `beforeinstallprompt` (add explicit install UI), only `display: standalone` (no fullscreen), no brightness API (instruct user to set minimum), 7-day storage eviction (IndexedDB + re-cache on launch), EU iOS 17.4+ PWAs open in browser tab (degraded notice).

### Expected Features

**Must have (table stakes):**
- SRT file import with encoding detection (GBK/UTF-8/Big5)
- SRT parsing via subtitle.js
- Manual sync start button (user taps when movie starts)
- Timeline-based playback (performance.now + rAF loop with binary search)
- Black screen + white text display (OLED-optimized)
- Font size adjustment (36-48px, persisted across sessions)
- Screen Wake Lock (native + NoSleep.js fallback)
- Local subtitle storage (IndexedDB)
- Add to home screen (PWA manifest)
- Offline-first (Service Worker precache)

**Should have (competitive):**
- Subtitle offset adjustment (±N seconds for misaligned subtitles)
- High contrast mode (yellow text on black for better readability)

**Defer (v2+):**
- Audio auto-sync, online subtitle search, multi-language simultaneous display, subtitle translation, user accounts, social features, cross-device sync

### Architecture Approach

The app follows a 3-layer pipeline with a centralized state store and dual persistence (Cache API for app shell, IndexedDB for subtitle data). The critical insight from research is time-separation: the timing source (`performance.now()`) must be completely decoupled from the rendering loop (`requestAnimationFrame`). This prevents subtitle drift over 2-hour films. Parser is kept as a pure function (`string → Cue[]`) for testability and reusability.

**Major components:**
1. **SRT Parser** — Pure function converting SRT text to `Cue[]` objects. Never touches IndexedDB or DOM. Handles BOM stripping, line ending normalization, defensive parsing.
2. **Playback Engine** — Owns the rAF loop and timing. Computes `elapsed = performance.now() - startTime` each tick, performs binary search on cues, emits cue-change events. Never uses setTimeout/setInterval.
3. **Render Pipeline** — DOM updates for subtitle text display. OLED-optimized: true black (#000) background, dimmed white (#E0E0E0) text with subtle text-shadow to reduce halation.
4. **State Store** — Lightweight reactive container (`{ cues[], currentIndex, isPlaying, startTime }`). Single source of truth, subscription-based updates.
5. **Wake Lock Manager** — Dual-strategy: native `navigator.wakeLock.request()` primary, NoSleep.js hidden video fallback. Triggered by user gesture on "Start" button.

**Data flow:** File Import → SRT Parser → IndexedDB (persist) → State Store (hydrate) → Playback Engine (timing) → Render Pipeline (display). On app load: IndexedDB → State Store → UI shows saved subtitles.

**Build order from architecture:**
- Phase 1: SRT Parser + State Store + UI shell
- Phase 2: Playback Engine + Render Pipeline + binary search
- Phase 3: IndexedDB layer + Service Worker + hydration
- Phase 4: Wake Lock + OLED optimization + PWA manifest
- Phase 5: Encoding detection + error handling + dim mode

### Critical Pitfalls

1. **iOS Wake Lock failure in installed PWA** — The API was broken until iOS 18.4 (March 2025). Prevention: dual-strategy with `navigator.wakeLock` primary + NoSleep.js hidden video loop fallback for older iOS. Must be triggered by user gesture.

2. **iOS 7-day storage eviction** — Safari deletes all PWA storage after 7 days of non-use. Prevention: IndexedDB for subtitle data (not just Cache API), re-cache app shell on every launch, export-to-file backup option, warn users before movie day.

3. **SRT encoding corruption (BOM, GBK, line endings)** — Chinese subtitles frequently arrive in GBK/Big5 with BOM markers. Prevention: `FileReader.readAsArrayBuffer()` with explicit UTF-8 BOM detection + strip, fallback to GBK via `TextDecoder` or `iconv-lite`, normalize line endings.

4. **Subtitle timing drift over 2 hours** — Using `setInterval` accumulates 10-30 seconds of drift. Prevention: `performance.now()` elapsed-time architecture with rAF only for visual updates. Never derive time from rAF timestamps.

5. **iOS cannot lock screen orientation** — `manifest.json` orientation field ignored on iOS. Prevention: CSS `@media (orientation: portrait)` overlay prompting user to rotate. Design portrait overlay to match cinema UI aesthetic.

**Additional notable pitfalls:** No brightness API on iOS (instruct user, don't build slider), font size must be 36-48px for cinema viewing distance, PWA loses state on app switch (auto-save state every 5s), halation eye strain from pure white on black (use dimmed #E0E0E0), File System Access API absent on iOS (use classic `<input type="file">`).

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation — Parser + State + UI Shell
**Rationale:** The SRT Parser is the foundation for everything downstream. It must be a pure, testable function before any other component depends on its output format. The State Store defines the app's data model. The UI shell (file picker, basic layout) enables manual testing.
**Delivers:** Working SRT import → parse → display cue list. Basic app skeleton with file picker and import button.
**Addresses:** SRT file import (with encoding detection), SRT parsing
**Avoids:** Encoding corruption pitfall (BOM/GBK handling built into parser from day one)

### Phase 2: Playback Core — Engine + Timing + Render
**Rationale:** The Playback Engine and Render Pipeline form the core user experience. They depend on the Parser output format (fixed in Phase 1) and the State Store. This phase delivers the "tap Start, see subtitles" experience.
**Delivers:** Functional subtitle playback with manual sync start, rAF loop, binary search cue lookup, black/white display.
**Addresses:** Manual sync start, timeline-based playback, black screen + white text display
**Avoids:** Timing drift pitfall (performance.now architecture from the start)

### Phase 3: Persistence — IndexedDB + Service Worker + Hydration
**Rationale:** Persistence can be built in parallel with playback (it only depends on the Parser output format, already fixed). Service Worker is independent of playback logic. This phase enables offline-first and subtitle reloading.
**Delivers:** Subtitles persist across sessions, app works offline, returning users see saved movies.
**Addresses:** Local subtitle storage, offline-first
**Avoids:** 7-day eviction pitfall (IndexedDB primary + re-cache on launch)

### Phase 4: Cinema Optimization — Wake Lock + OLED + PWA + Orientation
**Rationale:** These are the features that transform a "working prototype" into a "usable in a dark theater" product. Wake Lock depends on Playback Engine (Phase 2). PWA manifest is independent. OLED rendering depends on Render Pipeline (Phase 2).
**Delivers:** Screen stays on during movie, PWA installable to home screen, landscape orientation handling, readable font sizes, dim mode.
**Addresses:** Screen Wake Lock, Add to home screen, font size adjustment, brightness/dim mode
**Avoids:** Wake Lock failure pitfall (dual-strategy), orientation lock pitfall (portable overlay), halation pitfall (dimmed white)

### Phase 5: Polish — Offset + High Contrast + Error Handling
**Rationale:** Differentiators and robustness. Offset adjustment requires the playback engine to be stable. High contrast mode is a simple render pipeline addition.
**Delivers:** Subtitle offset adjustment, yellow high contrast mode, graceful error handling for malformed SRT, export-to-file backup.
**Addresses:** Subtitle offset adjustment, high contrast mode, multiple subtitle files
**Avoids:** Remaining encoding edge cases, state loss on app switch (auto-save)

### Phase Ordering Rationale

- Parser must come first: every downstream component depends on the `Cue[]` data structure. Changing the parser output format later is expensive.
- Playback Engine before Persistence: you need the engine working before you can test that persisted subtitles load and play correctly.
- Persistence before Cinema Opt: Wake Lock integration requires the playback engine's start/stop events. You also need subtitles loading from IndexedDB before testing offline scenarios.
- PWA manifest can be added anytime after Phase 1 (it's independent of app logic).
- Polish last: offset and contrast are nice-to-haves that don't affect core functionality.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Encoding detection):** GBK/Big5 auto-detection is poorly documented. Need to research `TextDecoder` fatal-mode heuristics or `iconv-lite` integration approach.
- **Phase 2 (Timing precision):** Need to validate performance.now() + rAF approach handles Page Visibility changes correctly when user switches apps mid-movie.
- **Phase 4 (iOS Wake Lock):** The iOS 18.4+ boundary for native Wake Lock in PWAs needs real-device testing. NoSleep.js fallback needs a tiny silent MP4 asset.
- **Phase 4 (PWA install on iOS):** EU iOS 17.4+ PWA behavior (opens in browser tab, not standalone) needs detection logic and UX design for degraded mode.

Phases with standard patterns (skip research-phase):
- **Phase 3 (IndexedDB):** Well-established pattern with `idb` library. Jake Archibald's documentation is authoritative.
- **Phase 3 (Service Worker):** vite-plugin-pwa handles this with zero config. Standard Workbox precaching.
- **Phase 5 (Offset adjustment):** Simple elapsed-time offset, no architectural risk.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Vite, vite-plugin-pwa, subtitle.js, idb all verified via npm registry + Context7. Versions confirmed. |
| Features | HIGH | Feature set is well-defined with clear table-stakes vs differentiators. Dependencies mapped. |
| Architecture | MEDIUM-HIGH | Pipeline pattern and component boundaries are clear. Some tension between STACK.md (recommends idb) and ARCHITECTURE.md (recommends Dexie.js) — needs resolution. |
| Pitfalls | MEDIUM-HIGH | iOS Wake Lock bug confirmed via WebKit bug tracker (#254545). 7-day eviction well-documented. Encoding issues widely reported. Timing drift pattern confirmed via web.dev. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Stack discrepancy — idb vs Dexie.js:** STACK.md recommends `idb` (Jake Archibald), ARCHITECTURE.md recommends Dexie.js. Both are valid; Dexie.js has more features (compound indexes, where clauses) but larger bundle. For this app's simple needs, `idb` is sufficient. Resolve during Phase 3 planning.
- **NoSleep.js asset creation:** The silent MP4 for the wake lock fallback needs to be generated. Not a research gap, but a build task.
- **Encoding detection strategy:** Need to decide between `TextDecoder` with heuristics vs `iconv-lite` (larger bundle but more reliable GBK detection). Spike during Phase 1 planning.
- **Real-device iOS testing:** Simulator testing is insufficient for Wake Lock, orientation, and PWA install behavior. Need access to physical iOS devices across versions (16.x, 17.x, 18.x).
- **EU iOS PWA degraded experience:** The iOS 17.4+ EU situation is evolving. Need to decide what "degraded mode" looks like and when to show it.

## Sources

### Primary (HIGH confidence)
- npm registry API — Verified all package versions (Vite 8.1.5, vite-plugin-pwa 1.3.0, subtitle.js 4.2.2, idb 8.0.3)
- Context7 `/vite-pwa/vite-plugin-pwa` — PWA plugin API and configuration
- Context7 `/gsantiago/subtitle.js` — Subtitle parsing API verification
- WebKit Bug #254545 — Wake Lock in Home Screen Web Apps fix confirmed for iOS 18.4
- MDN Screen Wake Lock API — API reference and security model

### Secondary (MEDIUM confidence)
- magicbell.com PWA iOS Limitations Guide — iOS PWA constraint overview
- Offline Storage for PWAs (Addy Osmani) — IndexedDB vs Cache API guidance
- web.dev Screen Wake Lock Supported in All Browsers — Cross-browser support
- web.dev A Tale of Two Clocks — Timing source vs rendering loop pattern
- NoSleep.js GitHub — Fallback wake lock strategy
- SRT UTF-8 BOM Issue #83 (WhisperS2T) — Encoding corruption evidence
- Stack Overflow PWA orientation lock iOS — Orientation limitation confirmation
- vsubtitle.com Optimal Subtitle Font Size 2026 — Font sizing research

### Tertiary (LOW confidence)
- OLED Burn-In Prevention (zbotic.in) — OLED design principles, needs UX validation
- Dark Mode UX Best Practices (Phil Sennett) — Halation effect mitigation, anecdotal
- PWA install funnel statistics — Notification opt-in rates, cited from memory not primary source

---
*Research completed: 2026-07-26*
*Ready for roadmap: yes*
