# Roadmap: CinemaSyncSubs

## Milestone: v1.0 — Cinema Subtitle PWA

**Core Value:** 让非英语母语观众在影院看外语片时能跟上剧情

**Total Requirements:** 15 v1 (PLAY-01 to PLAY-07, DISP-01 to DISP-03, FILE-01 to FILE-02, PWA-01 to PWA-03)

**Phases:** 4

**Granularity:** Coarse

---

## Phases

- [ ] **Phase 1: SRT Foundation** — Import and parse subtitle files with encoding resilience
- [ ] **Phase 2: Playback & Display** — Core cinema experience with timing-accurate subtitle rendering
- [ ] **Phase 3: Cinema Readiness** — Offline persistence, wake lock, PWA install, landscape
- [ ] **Phase 4: Polish & Accessibility** — Timing offset, high contrast, error resilience

---

## Phase Details

### Phase 1: SRT Foundation

**Goal:** User can import an SRT file and the system correctly parses subtitle cues with proper encoding handling
**Depends on:** Nothing (first phase)
**Requirements:** PLAY-01, PLAY-02
**Success Criteria** (what must be TRUE):

  1. User can select an SRT file via file picker or drag-drop, and the file content is read correctly
  2. System correctly parses Chinese SRT files encoded in GBK, Big5, Shift-JIS, and UTF-8 — characters display without garbled mojibake
  3. Parsed cues render as a readable list for user verification before playback
  4. Malformed or corrupted SRT files produce clear, actionable error messages instead of silent failure

**Plans:** 2/2 plans executed
Plans:

- [x] 01-01-PLAN.md — SRT Parser with encoding detection (chardet + TextDecoder + custom parser, PLAY-02)
- [x] 01-02-PLAN.md — File import UI (file picker + drag-drop + cue preview, PLAY-01)

---

### Phase 2: Playback & Display

**Goal:** User can tap "Start" and see subtitles synchronized to the movie timeline with cinema-optimized display
**Depends on:** Phase 1
**Requirements:** PLAY-03, PLAY-04, PLAY-05, DISP-01, DISP-03
**Success Criteria** (what must be TRUE):

  1. User taps "Start" button and subtitles begin displaying according to their timecodes
  2. Subtitles remain synchronized with <50ms drift over a 2-hour playback (performance.now + rAF architecture, never setInterval)
  3. Text renders as dimmed white (#E0E0E0) on pure black (#000000) background — OLED-optimized with reduced halation
  4. User can adjust font size from 36px to 72px via slider, and the setting persists across sessions
  5. User can toggle dim mode for darker gray text (#888888) appearance in ultra-dark environments

**Plans:** 2 plans

Plans:

- [ ] 02-01-PLAN.md — Playback Engine: performance.now() timing, rAF loop, binary search cue lookup, useReducer state machine (PLAY-03, PLAY-04)
- [ ] 02-02-PLAN.md — Render Pipeline + Display Controls: OLED-optimized CSS, font size slider, dim mode toggle, persistent settings (PLAY-05, DISP-01, DISP-03)

**UI hint**: yes

---

### Phase 3: Cinema Readiness

**Goal:** App works reliably in a real cinema setting — screen stays on, data persists, works offline, installable to home screen
**Depends on:** Phase 2
**Requirements:** FILE-01, FILE-02, DISP-02, PWA-01, PWA-02, PWA-03
**Success Criteria** (what must be TRUE):

  1. Screen stays awake during entire playback via native Wake Lock API, with NoSleep.js hidden video fallback for older iOS (<18.4)
  2. Imported subtitle files persist across app restarts and browser sessions via IndexedDB — returning users see saved movies
  3. App works fully offline after first load — Service Worker precaches app shell, no network needed
  4. User can add the app to home screen (PWA manifest with standalone display, landscape orientation)
  5. App displays correctly in landscape on Android (manifest lock) and shows rotate-to-landscape overlay on iOS

**Plans:**

- Plan 1: Persistence Layer — IndexedDB storage via idb, parsed cues + metadata persistence, app load hydration (FILE-01, FILE-02)
- Plan 2: Wake Lock + PWA — dual-strategy Wake Lock (native + NoSleep.js), vite-plugin-pwa config, manifest, landscape handling with iOS rotate overlay (DISP-02, PWA-01, PWA-02, PWA-03)

**UI hint**: yes

---

### Phase 4: Polish & Accessibility

**Goal:** User can fine-tune subtitle timing and customize display for accessibility needs
**Depends on:** Phase 3
**Requirements:** PLAY-06, PLAY-07
**Success Criteria** (what must be TRUE):

  1. User can adjust subtitle timing offset by ±N seconds to fix misaligned subtitles (e.g., wrong cut, delayed audio)
  2. Subtitle timing offset updates in real-time during playback without restart
  3. User can toggle high-contrast mode (yellow text #FFD700 on black) for better readability
  4. High contrast mode and offset setting persist across sessions

**Plans:**

- Plan 1: Timing offset + high contrast — offset adjustment UI with real-time preview, yellow high contrast toggle, settings persistence (PLAY-06, PLAY-07)

**UI hint**: yes

---

## Backlog

Deferred to v2 (not in current roadmap):

| Item | Description | Reason |
|------|-------------|--------|
| FUTR-01 | Audio-based auto-sync (fingerprint matching) | Trailers make unreliable; v1 manual is pragmatic |
| FUTR-02 | Online subtitle search/download (OpenSubtitles) | Adds API complexity; v1 user provides own SRT |
| FUTR-03 | Multi-language simultaneous display | Niche use case; v1 single language |
| FUTR-04 | Subtitle translation (real-time or pre-translated) | High complexity; v1 plays existing subtitles |
| Multi-movie management | Switch between multiple stored subtitles | v1 single movie per session sufficient |
| Export-to-file backup | Backup subtitles to file for iOS 7-day eviction recovery | Enhancement after core experience validated |

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. SRT Foundation | 2/2 | In Progress|  |
| 2. Playback & Display | 0/2 | Planned | - |
| 3. Cinema Readiness | 0/2 | Not started | - |
| 4. Polish & Accessibility | 0/1 | Not started | - |

---

## Coverage

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAY-01 | Phase 1 | Pending |
| PLAY-02 | Phase 1 | Pending |
| PLAY-03 | Phase 2 | Pending |
| PLAY-04 | Phase 2 | Pending |
| PLAY-05 | Phase 2 | Pending |
| PLAY-06 | Phase 4 | Pending |
| PLAY-07 | Phase 4 | Pending |
| DISP-01 | Phase 2 | Pending |
| DISP-02 | Phase 3 | Pending |
| DISP-03 | Phase 2 | Pending |
| FILE-01 | Phase 3 | Pending |
| FILE-02 | Phase 3 | Pending |
| PWA-01 | Phase 3 | Pending |
| PWA-02 | Phase 3 | Pending |
| PWA-03 | Phase 3 | Pending |

**Total:** 15/15 requirements mapped (100%)

---

*Roadmap created: 2026-07-26*
*Phase convention: sequential*
*Granularity: coarse (4 phases, 7 plans)*
