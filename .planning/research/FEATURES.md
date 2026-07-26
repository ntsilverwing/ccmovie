# Feature Landscape

**Project:** CinemaSyncSubs (ccmovie)
**Researched:** 2026-07-25
**Mode:** Ecosystem — Features dimension

---

## Feature Categories

### 1. Subtitle Playback (Core)

| Feature | Type | Complexity | Notes |
|---------|------|------------|-------|
| SRT file import | Table Stakes | Low | File picker + drag-drop. Must handle encoding detection (GBK/UTF-8/Big5). |
| SRT parsing | Table Stakes | Low | Use subtitle.js library. Returns cue array with start/end/text. |
| Manual sync start | Table Stakes | Low | User presses play when movie starts. Simple button. |
| Timeline-based playback | Table Stakes | Medium | performance.now() + rAF loop. Binary search for current cue. |
| Black screen + white text display | Table Stakes | Low | OLED-optimized: true black background, white text. |
| Landscape mode support | Table Stakes | Low | CSS orientation handling. iOS ignores manifest orientation. |

### 2. Display & Visibility

| Feature | Type | Complexity | Notes |
|---------|------|------------|-------|
| Font size adjustment | Table Stakes | Low | Slider or +/- buttons. Must persist across sessions. |
| Brightness/dim mode | Table Stakes | Low | No native API. Use gray text on black for dimmer appearance. |
| Screen Wake Lock | Table Stakes | Medium | Native API + NoSleep.js fallback for older iOS. |
| High contrast mode | Differentiator | Low | Yellow text on black for better readability. |

### 3. File Management

| Feature | Type | Complexity | Notes |
|---------|------|------------|-------|
| Local subtitle storage | Table Stakes | Medium | IndexedDB via Dexie.js. Persist imported files across sessions. |
| Multiple subtitle files | Differentiator | Low | Store and switch between multiple movies. |
| Offline access | Table Stakes | Medium | Service Worker + Cache API for app shell. |

### 4. Sync & Timing

| Feature | Type | Complexity | Notes |
|---------|------|------------|-------|
| Subtitle offset adjustment | Differentiator | Low | ±N seconds to fix misaligned subtitles. |
| Playback speed trim | Anti-feature | Medium | Minor speed adjustment (±5%). Not needed for v1. |
| Audio auto-sync | Anti-feature | High | Audio fingerprint matching. Too unreliable due to trailers. |

### 5. PWA & Distribution

| Feature | Type | Complexity | Notes |
|---------|------|------------|-------|
| Add to home screen | Table Stakes | Low | PWA manifest + service worker. |
| Offline-first | Table Stakes | Medium | Service Worker precaches app shell. |
| Cross-device sync | Anti-feature | High | Cloud sync of subtitle files. Out of scope. |

### 6. Future / Anti-Features

| Feature | Type | Complexity | Notes |
|---------|------|------------|-------|
| Online subtitle search/download | Anti-feature | High | Connect to OpenSubtitles etc. v2+. |
| Multi-language simultaneous | Anti-feature | Medium | Two languages at once. v2+. |
| Subtitle translation | Anti-feature | High | Real-time translation. v2+. |
| User accounts | Anti-feature | High | No account system needed. |
| Social features | Anti-feature | High | Sharing, ratings, etc. |

---

## Feature Priority for v1

### Must Have (Table Stakes)
1. SRT file import with encoding detection
2. SRT parsing (subtitle.js)
3. Manual sync start button
4. Timeline-based playback (performance.now + rAF)
5. Black screen + white text display
6. Font size adjustment
7. Screen Wake Lock (native + fallback)
8. Local subtitle storage (IndexedDB)
9. Add to home screen (PWA)
10. Offline-first (Service Worker)

### Should Have (Differentiators in v1)
11. Subtitle offset adjustment (±N seconds)
12. High contrast mode (yellow text)

### Won't Have (v1)
- Audio auto-sync
- Online subtitle search
- Multi-language simultaneous
- Subtitle translation
- User accounts
- Social features
- Cross-device sync

---

## Dependencies

- SRT import → SRT parsing → Playback engine (strict sequence)
- Wake Lock can be built in parallel with playback engine
- IndexedDB storage depends on file import flow
- PWA manifest/service worker independent of playback logic
- Font size adjustment depends on render pipeline
