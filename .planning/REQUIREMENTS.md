# Requirements: CinemaSyncSubs

**Defined:** 2026-07-25
**Core Value:** 让非英语母语观众在影院看外语片时能跟上剧情

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Playback

- [ ] **PLAY-01**: User can import SRT subtitle files via file picker or drag-drop
- [ ] **PLAY-02**: System parses SRT files with automatic encoding detection (GBK/UTF-8/Big5/Shift-JIS)
- [ ] **PLAY-03**: User can manually start playback by tapping a "Start" button
- [ ] **PLAY-04**: Subtitles display synchronously using performance.now() + requestAnimationFrame timing
- [ ] **PLAY-05**: Subtitles render as white text on pure black background (OLED-optimized)
- [ ] **PLAY-06**: User can adjust subtitle timing offset (±N seconds) to fix misalignment
- [ ] **PLAY-07**: User can toggle high-contrast mode (yellow text on black)

### Display

- [ ] **DISP-01**: User can adjust font size via slider or +/- buttons
- [ ] **DISP-02**: Screen stays awake during playback via Wake Lock API with NoSleep.js fallback
- [ ] **DISP-03**: UI supports minimum brightness mode (gray text option for darker appearance)

### File Management

- [ ] **FILE-01**: Imported subtitle files persist locally across sessions via IndexedDB
- [ ] **FILE-02**: App works offline via Service Worker + Cache API (no network needed after first load)

### PWA & Distribution

- [ ] **PWA-01**: User can add the app to home screen (PWA manifest)
- [ ] **PWA-02**: App supports landscape orientation (CSS-based with rotate overlay fallback for iOS)
- [ ] **PWA-03**: App shell precached for offline-first experience

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

- **FUTR-01**: Audio-based auto-sync (fingerprint matching to detect current position)
- **FUTR-02**: Online subtitle search and download (OpenSubtitles integration)
- **FUTR-03**: Multi-language simultaneous display (two languages at once)
- **FUTR-04**: Subtitle translation (real-time or pre-translated)

## Out of Scope

| Feature | Reason |
|---------|--------|
| User accounts / auth | No need for identity; local-only app |
| Social features (sharing, ratings) | Not core to the value proposition |
| Cross-device sync | Local-first design; adds backend complexity |
| Native iOS/Android app | PWA sufficient for v1; no App Store |
| Video/audio playback | This is a subtitle-only tool |
| DRM handling | User provides their own SRT files |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAY-01 | — | Pending |
| PLAY-02 | — | Pending |
| PLAY-03 | — | Pending |
| PLAY-04 | — | Pending |
| PLAY-05 | — | Pending |
| PLAY-06 | — | Pending |
| PLAY-07 | — | Pending |
| DISP-01 | — | Pending |
| DISP-02 | — | Pending |
| DISP-03 | — | Pending |
| FILE-01 | — | Pending |
| FILE-02 | — | Pending |
| PWA-01 | — | Pending |
| PWA-02 | — | Pending |
| PWA-03 | — | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 0
- Unmapped: 15 (pending roadmap)

---
*Requirements defined: 2026-07-25*
*Last updated: 2026-07-25 after initial definition*
