# Milestones

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
