# Domain Pitfalls

**Domain:** PWA-based Cinema Subtitle Sync Tool (CinemaSyncSubs)
**Researched:** 2026-07-26
**Overall confidence:** MEDIUM-HIGH (cross-checked across WebKit bug tracker, Apple docs, multiple developer blogs, and Stack Overflow reports)

---

## Critical Pitfalls

Mistakes that can break the core user experience or make the app unusable in a real cinema setting.

### Pitfall 1: iOS Screen Wake Lock Failure in Installed PWA

**What goes wrong:** The Screen Wake Lock API (`navigator.wakeLock.request()`) did NOT work in installed (Home Screen) PWAs on iOS until iOS 18.4 — a bug (WebKit #254545) existed from 2023 to March 2025. Even after the fix, wake lock requires HTTPS and is released when the page is not visible. On older iOS versions (still widely installed), the API silently fails.

**Why it happens:** Apple shipped the Screen Wake Lock API in iOS 16.4 Safari but the code path for standalone/home-screen web apps was broken. Apple fixed it in iOS 18.4, but users on older iOS versions (iPhone 8-X series can't update past iOS 16) will never get the fix.

**Consequences:** The phone screen dims and locks during the 2-hour movie. The user must periodically tap the screen — disrupting their experience and potentially distracting others with the brightness change.

**Prevention:**
- Use a dual-strategy approach: `navigator.wakeLock.request('screen')` with `try/catch` as primary, and a NoSleep.js-style hidden video fallback (`<video playsinline muted loop>` with a tiny MP4) for older iOS
- The NoSleep.js fallback uses a tiny looping silent video that prevents iOS sleep — it works on all iOS versions
- Must be triggered by a user gesture (click/tap) due to iOS autoplay policy — perfect for our "Start Subtitles" button
- Handle `wakeLock.release` and `visibilitychange` events to re-acquire when user returns
- Test on real devices with various iOS versions, not just simulators

**Detection:** Screen dims during playback on older iOS devices; check `navigator.wakeLock` existence and catch blocks

**Phase mapping:** Core subtitle playback phase — must be addressed before first cinema use

---

### Pitfall 2: iOS 7-Day Cache Expiry Wipes Subtitle Data

**What goes wrong:** iOS Safari deletes ALL service worker caches (including IndexedDB and Cache API data) if the PWA hasn't been opened in 7 days. A user who loads subtitles on Tuesday for a Friday movie will find the app empty on Friday night.

**Why it happens:** Apple's storage management aggressively evicts web app data to conserve device storage. The 7-day timer is per-origin and non-negotiable. `navigator.storage.persist()` is not supported on iOS.

**Consequences:** App shell is gone, subtitle data is gone, user must re-download and re-import SRT files — impossible in a cinema with no/poor WiFi.

**Prevention:**
- **Don't rely on service worker cache for subtitle data** — use IndexedDB as primary storage
- Re-cache the app shell on every launch (network-first strategy for app shell)
- For subtitle content: store parsed subtitle data in IndexedDB, but also implement an "export to file" backup feature
- Set up a notification reminding users to "refresh the app" within 7 days of their movie
- Use `navigator.storage.estimate()` to monitor storage quota and warn if near 50MB cap
- Test offline functionality after exactly 7 days of non-use

**Detection:** App loads but shows no saved subtitles; check `caches.keys()` returns empty after dormancy

**Phase mapping:** Offline/data persistence phase — critical before v1 ship

---

### Pitfall 3: SRT Encoding Corruption (BOM, GBK, Line Endings)

**What goes wrong:** Chinese SRT subtitles frequently arrive encoded in GBK, GB2312, or Big5 instead of UTF-8. Many SRT files have a UTF-8 BOM (byte order mark: `0xEF 0xBB 0xBF`) at the start which JavaScript's `FileReader.readAsText()` handles incorrectly or which breaks regex parsers. Some files use CRLF line endings, others LF. Missing sequence numbers or trailing whitespace breaks naive parsers.

**Why it happens:** The SRT format has no encoding declaration (unlike XML). Chinese subtitle release groups in Asia historically used GBK/Big5 because those encodings use half the bytes for CJK characters. BOM is added by editors like Notepad. Windows-origin files use CRLF.

**Consequences:** Chinese characters render as garbled mojibake (e.g., "æˆ‘çˆ±ä½ " instead of "我爱你"). Parser crashes on first line if BOM present. Subtitles don't display at all — total product failure for the primary target audience.

**Prevention:**
- Use `FileReader.readAsArrayBuffer()` then decode with explicit UTF-8 BOM detection and strip
- Implement encoding auto-detection: try UTF-8 first, detect BOM, fallback to GBK using `TextDecoder` with `fatal: false` and heuristics for valid CJK ranges
- Or use `iconv-lite` (pure JS) for reliable GBK/Big5/Shift-JIS → UTF-8 conversion
- Normalize line endings: `text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')`
- Validate parser output: check for expected SRT pattern (number, timecode, text) and show clear error messages
- Strip BOM before parsing: `if (data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) data = data.slice(3)`
- Test with real-world SRT files from common Chinese subtitle sources

**Detection:** Subtitles display as garbled characters; parse error count > 0; user reports "can't read subtitles"

**Phase mapping:** SRT import and parsing phase

---

### Pitfall 4: Subtitle Timing Drift During Long Playback

**What goes wrong:** Subtitles gradually fall out of sync with the movie audio during a 2-hour film. A common cause: using `setTimeout`/`setInterval` for timing (which drifts due to event loop delays, background tab throttling, and integer rounding) instead of accumulating time from a monotonic clock.

**Why it happens:** `setTimeout(callback, 16.67)` does NOT run every 16.67ms — it runs after at least 16.67ms, plus event loop delays. Over 2 hours (43,200 frames at 60fps), even 1ms of drift per frame accumulates to 43 seconds. On mobile browsers, timer throttling in background tabs makes this worse. Integer rounding (`1000/60 = 17ms`) compounds the error.

**Consequences:** By the end of a 2-hour movie, subtitles appear 10-30 seconds too early or too late — completely unusable.

**Prevention:**
- Use `requestAnimationFrame` (rAF) loop with `performance.now()` delta-time accumulation as the primary timing engine
- Never use setTimeout/setInterval for subtitle scheduling
- Compute "current subtitle time" as `performance.now() - playbackStartTime` (elapsed wall-clock time)
- Use this elapsed time to look up which subtitle cue should be active — NOT by incrementing a counter
- Handle rAF pause when tab is hidden (Page Visibility API): use `visibilitychange` to recompute elapsed time when returning
- For 120Hz+ displays: rAF callback receives a timestamp — always use it, never assume fixed frame rate
- Benchmark: at 2 hours, drift should be < 50ms, not seconds

**Detection:** Compare subtitle timestamps at start vs. end of long playback; log `performance.now()` drift

**Phase mapping:** Core playback/timing engine phase

---

### Pitfall 5: iOS PWA Cannot Lock Screen Orientation

**What goes wrong:** Setting `"orientation": "landscape"` in `manifest.json` does nothing on iOS Safari. The manifest orientation field is supported on Android Chrome but completely ignored on iOS. Users can still rotate to portrait, breaking the cinema display layout.

**Why it happens:** Apple has only partial support for the Web App Manifest on iOS. The `orientation` field is simply not implemented. Even the deprecated `screen.lockOrientation()` API is unavailable on iOS.

**Consequences:** In a dark cinema, a user accidentally rotates their phone. The subtitle UI breaks or rotates to portrait — text becomes tiny, layout is wrong, and they fumble to rotate back while the movie continues.

**Prevention:**
- Use CSS `@media (orientation: portrait)` to detect and show a full-screen "Please rotate your device" overlay in portrait mode
- The overlay should be large, obvious, and hard to miss: "🔄 请旋转手机 / Rotate Phone to Landscape"
- Set `viewport` meta tag properly: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- Use `screen.orientation.lock()` for Android (partial support) and gracefully degrade on iOS
- Design the portrait-mode overlay to be visually identical to the cinema UI (black background, large white text) so it doesn't break the dark-room aesthetic
- Consider using CSS `transform: rotate(90deg)` as a last resort for stubborn cases (but this breaks touch coordinates)

**Detection:** Physical rotation test on real iPhone; orientation media query fires unexpectedly

**Phase mapping:** UI/UX orientation handling phase

---

## Moderate Pitfalls

### Pitfall 6: No File System Access API on iOS

**What goes wrong:** The modern File System Access API (`window.showOpenFilePicker()`) that allows saving/loading files to specific directories does not exist on any version of iOS Safari. Only the Origin Private File System (OPFS) sandbox is available since iOS 15.2.

**Prevention:** Use classic `<input type="file" accept=".srt">` for SRT import — this works reliably on iOS Safari and Chrome for Android. For "save subtitle for later" features, use IndexedDB for data persistence + Blob download for export fallback. Never rely on `showOpenFilePicker` or `showSaveFilePicker` without feature detection and fallback.

---

### Pitfall 7: IndexedDB Instability and Storage Quota on iOS

**What goes wrong:** iOS Safari has a history of IndexedDB bugs (WebKit #196372, #202707, #220776) including hangs and corruption. The storage quota is capped at roughly 50MB (vs Chrome's hundreds of MB). When quota is exceeded, writes fail silently or throw QuotaExceededError.

**Prevention:** Wrap all IndexedDB operations in try/catch; use `navigator.storage.estimate()` to check available space before saving large subtitle files. Consider using the `idb` library (Jake Archibald) which handles edge cases and provides promise-based API. Set realistic expectations: a single SRT file with 1000+ cues is ~100KB, well within limits.

---

### Pitfall 8: Halation Effect (Eye Strain from White-on-Black)

**What goes wrong:** Pure white (#FFFFFF) text on pure black (#000000) causes the "halation effect" — text appears to glow/blur due to the high contrast and how human eyes process light-on-dark. Over a 2-hour movie, this causes eye strain and headaches, especially for older viewers.

**Prevention:** Use slightly dimmed white (`#E0E0E0` or `#F5F5F5`) on `#000000` or `#121212` background. Add a subtle text-shadow (`text-shadow: 0 0 4px rgba(0,0,0,0.8)`) to reduce perceived glow. Use a font weight of 500-600 (medium-semi-bold) rather than bold for reduced visual weight. Test with users over 40 (common target demographic for foreign film audiences).

---

### Pitfall 9: Font Size Inadequate for Cinema Viewing Distance

**What goes wrong:** Typical mobile subtitle designs use 16-20px font — perfectly readable at arm's length in normal use, but invisible when the phone is sitting on a lap or cup holder 2-3 feet away in a dark theater. Users squint, lean forward, miss dialogue.

**Prevention:** Cinema subtitle font size should be 36-48px on a phone screen (viewed from 2-3 feet). Use viewport-relative units: `font-size: clamp(36px, 8vw, 72px)` or compute based on screen height (`1/20` to `1/10` of viewport height). Limit to 32-37 characters per line, max 2 lines. Cap reading speed at 15-17 characters per second. The "one Start button" should be large enough to find by touch in the dark (min 48x48px touch target).

---

### Pitfall 10: iOS PWA Loses State on App Switch

**What goes wrong:** When a user switches to another app (e.g., to check messages) and returns to the PWA, iOS may terminate and reload the web app, losing all playback state — current subtitle position, parsed SRT data, everything.

**Why it happens:** iOS aggressively reclaims memory from backgrounded PWAs. Unlike native apps which can save state to disk, PWAs get killed without warning.

**Prevention:** Persist playback state (current time offset, active subtitle index) to localStorage/IndexedDB every few seconds. On app load, check for "resume state" and offer to continue from last position. This is critical because users WILL switch apps during a movie.

---

## Minor Pitfalls

### Pitfall 11: Brightness API Does Not Exist on iOS

**What goes wrong:** There is no Web API to control screen brightness programmatically. The `ScreenBrightness` API exists only in some Android contexts, never in iOS Safari. Developers who build a brightness slider in their PWA will find it does nothing on iPhone.

**Prevention:** Do NOT build an in-app brightness control. Instead, provide clear instructions: "Set your phone brightness to minimum before starting." Rely on OLED's inherent advantage (black pixels = off). If you must provide control, use a CSS overlay hack (semi-transparent black layer) to simulate lower brightness — but warn that this only works on OLED.

---

### Pitfall 12: Service Worker Push Notification Opt-in Funnel

**What goes wrong:** iOS requires: (1) PWA installed to Home Screen, THEN (2) separate notification permission grant. Each step loses ~50% of users. For a cinema subtitle app, notifications aren't needed in v1, but if used later, expect 75% of users to never enable them.

**Prevention:** Skip push notifications entirely for v1. If needed later, implement proper onboarding that explains WHY notifications are useful (e.g., "remind me to refresh the app") before requesting permission.

---

### Pitfall 13: Standalone PWA Cannot Open External Links

**What goes wrong:** Links to external websites from a standalone iOS PWA open in a full Safari window (not in-app), which can lose the user's playback context. OAuth flows and cross-domain auth also fail in standalone mode due to WebKit restrictions.

**Prevention:** Keep all functionality self-contained within the PWA for v1 — no external links needed during playback. If external links are needed (e.g., "how to install" guide), use `target="_blank" rel="noopener"` and ensure the PWA can recover state when user returns.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| SRT Parsing | GBK/BOM encoding corruption | Encoding detection + BOM stripping + `iconv-lite` fallback |
| Playback Engine | Timing drift over 2 hours | rAF + `performance.now()` elapsed time architecture |
| Wake Lock / Screen | iOS API broken on older versions | NoSleep.js video fallback + dual-strategy |
| UI/Orientation | Can't lock landscape on iOS | Portrait-mode rotate overlay |
| Data Persistence | 7-day cache expiry on iOS | Re-cache on launch + IndexedDB + user reminders |
| Font/UX | Text invisible at cinema distance | 36-48px font + viewport-relative sizing |
| OLED Display | Halation eye strain over 2 hours | Dimmed white + text-shadow + semi-bold weight |
| App State | Lost on app switch/background | Auto-save state to IndexedDB every 5s |

---

## Cross-Cutting Architectural Decision: Wake Lock Strategy

Given the criticality of screen-on-during-movie and iOS's fragmented support, the recommended approach is a **layered fallback**:

1. **Primary:** `navigator.wakeLock.request('screen')` (works on iOS 18.4+, Android Chrome 84+, desktop)
2. **Fallback:** NoSleep.js hidden video loop (works on all iOS versions, all Android)
3. **Last resort:** User education — "disable Auto-Lock in iOS Settings > Display"

The hidden video approach (`<video playsinline muted loop src="silent.mp4">`) is well-established, has zero visual impact, and is triggered by the same user gesture that starts subtitle playback. NoSleep.js (2.4k GitHub stars) bundles both strategies and auto-selects.

---

## Sources

- [PWA iOS Limitations - MagicBell 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) [MEDIUM]
- [WebKit Bug #254545: Wake Lock in Home Screen Web Apps](https://bugs.webkit.org/show_bug.cgi?id=254545) [HIGH - primary source]
- [Progressier: Screen Wake Lock PWA Demo](https://progressier.com/pwa-capabilities/screen-wake-lock) [MEDIUM]
- [Offline-First PWAs: Service Worker Caching Strategies](https://www.magicbell.com/blog/offline-first-pwas-service-worker-caching-strategies) [MEDIUM]
- [File System Access API Browser Support - LambdaTest](https://www.testmuai.com/learning-hub/file-system-access-api-browser-support) [MEDIUM]
- [NoSleep.js GitHub](https://github.com/richtr/NoSleep.js) [MEDIUM]
- [SRT UTF-8 BOM Issue #83 - WhisperS2T](https://github.com/shashikg/WhisperS2T/issues/83) [MEDIUM]
- [requestAnimationFrame vs setTimeout - OpenReplay](https://blog.openreplay.com/requestanimationframe-settimeout-use) [MEDIUM]
- [Optimal Subtitle Font Size 2026 - vsubtitle.com](https://vsubtitle.com/subtitle-font-size-and-reading-speed-2026) [LOW]
- [Dark Mode UX Best Practices - Phil Sennett](https://www.philsennett.com/dark-mode-ux-design) [LOW]
- [Offline Storage for PWAs - Addy Osmani](https://medium.com/dev-channel/offline-storage-for-progressive-web-apps-70d52695513c) [MEDIUM]
- [PWA orientation lock doesn't work on iOS - Stack Overflow](https://stackoverflow.com/questions/59725034/pwa-forcing-orientation-to-landscape-not-working) [MEDIUM]
- [Offline data - web.dev](https://web.dev/learn/pwa/offline-data) [MEDIUM]

---

*Last updated: 2026-07-26 during pitfalls dimension research*
