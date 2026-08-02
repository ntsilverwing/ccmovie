# Milestones

## v1.1 Session Resilience (Shipped: 2026-08-01)

**Phases completed:** 2 phases, 7 plans, 18 tasks

**Key accomplishments:**

- Pure, clock-free session timing module implementing the PLAY-08 resume formula (`now − startedAt + offset`) with engine-mirrored pause/resume guards and a fully pinned h:mm:ss formatter — 26 injected-now unit tests, zero dependencies, Phase-6-ready shape.
- Pure, injectable D-01/D-02/D-03 system-back interception policy — push-once marker registration, replace-never-stack on re-entry, pop-own-marker-only on exit — 21 vitest cases over a FakeHistory stack simulator, zero DOM reads, zero new dependencies.
- SessionBanner (persistent resume banner, D-07 locked DOM), SessionToast (passive 3500ms fade), low-visual-weight PlaybackControls back control (D-09), six bilingual i18n keys, and three cinema-dark CSS families — pure presentation, wiring deferred to 05-04.
- Lossless navigation fully integrated: engine onEnded + seekTo, hook session wiring, App view decoupling, history interception, leave/resume flows, and PLAY-08 loop on Android PWA
- Pure clock-free session expiry/validation predicates plus a v1→v2 IndexedDB upgrade ladder and a never-throwing single-record session store — the durability primitives every later Phase-6 plan builds on (FILE-03).
- usePlaybackEngine gains restoreSession(cues, persisted) with the contract-locked setCues → play() → seekTo engine prime and a hasPersistedRef-guarded write-on-change persist effect that can never wipe a record at boot — the correctness core of one-tap resume (FILE-03).
- D-07-locked ResumeCard sibling component plus full App.tsx orchestration — boot hydration with once-per-launch expiry gating, one-tap gesture-chained resume to the wall-clock position, single-tap dismiss, and banner/card mutual exclusivity — completing the FILE-03 user surface: kill the app, relaunch, one tap back into the movie.

---

## v1.0 Cinema Subtitle PWA (Shipped: 2026-07-29)

**Phases completed:** 4 phases, 11 plans, 25 tasks

**Key accomplishments:**

- SRT parsing foundation with encoding detection pipeline (chardet + TextDecoder), custom defensive SRT parser, and Cue/ParsedSubtitle type system
- File import pipeline with drag-drop FilePicker, encoding-aware importSRT orchestrator, and CuePreview cinema-styled cue list
- Timing-accurate playback engine using performance.now() + rAF with binary search cue lookup, useReducer state machine, and localStorage settings persistence
- OLED-optimized subtitle renderer with CSS custom properties for instant font size/dim mode switching, plus polished playback controls with large touch targets
- Verified stale cues fix (commit 0acba98) restores subtitle synchronization — engineRef.current?.setCues(cues) called in cues sync effect, verification report updated to passed status
- idb-based persistence layer with typed schema, subtitle CRUD, auto-save on import, and app load hydration for returning users
- PWA with Wake Lock (native + NoSleep.js fallback), Service Worker offline support, iOS rotate overlay, and autoUpdate SW registration
- Fullscreen API integration with auto-hiding playback controls and pure black fullscreen background for dark cinema experience
- Responsive playback bar with 90vw max-width, compact 64px buttons, labeled 'Aa' slider, and 36px default font for phone landscape cinema use
- Bilingual UI (en/zh) with React Context, 30+ translated strings, persistent language preference, and toggle button
- Timing offset adjustment (±5s, 0.5s steps) with real-time playback and high-contrast mode (yellow #FFD700 on black) exceeding WCAG AAA, with localStorage persistence

---
