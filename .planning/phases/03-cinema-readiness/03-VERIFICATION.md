---
phase: 03-cinema-readiness
verified: 2026-07-27T05:47:00Z
status: human_needed
score: 0/5
behavior_unverified: 5
overrides_applied: 0
behavior_unverified_items:
  - truth: "Screen stays awake during entire playback via native Wake Lock API, with NoSleep.js hidden video fallback for older iOS (<18.4)"
    test: "Start playback on a real iOS/Android device, wait for normal auto-lock timeout (e.g. 30s), verify screen remains on"
    expected: "Screen stays on indefinitely during playback; releasing Stop or Pause allows sleep"
    why_human: "Wake Lock activation is a device-level behavior grep cannot observe — requires real device testing"
  - truth: "Imported subtitle files persist across app restarts and browser sessions via IndexedDB — returning users see saved movies"
    test: "Import an SRT file, close the browser tab, reopen the app URL, verify saved movie appears in list"
    expected: "Saved movie list is populated from IndexedDB on mount without re-import"
    why_human: "Persistence across browser sessions requires actual browser restart — grep proves the save/load code exists but not that it survives a session"
  - truth: "App works fully offline after first load — Service Worker precaches app shell, no network needed"
    test: "Load the app once (online), then enable Offline mode in DevTools Network tab, reload the page"
    expected: "App loads fully from Service Worker cache with no network requests"
    why_human: "Offline functionality requires actual network interception by the SW — grep proves SW exists with 11 precache entries but not that it serves offline"
  - truth: "User can add the app to home screen (PWA manifest with standalone display, landscape orientation)"
    test: "Open the app in Safari on iOS or Chrome on Android, use 'Add to Home Screen' browser action"
    expected: "App installs and launches in standalone mode with landscape orientation"
    why_human: "Home screen installation is an OS-level behavior — grep proves manifest is correct but not that OS accepts it"
  - truth: "App displays correctly in landscape on Android (manifest lock) and shows rotate-to-landscape overlay on iOS"
    test: "Open the app on an iOS device in portrait mode — verify rotate overlay appears. Rotate to landscape — verify overlay disappears"
    expected: "Overlay visible in portrait, hidden in landscape; Android locks to landscape via manifest"
    why_human: "Orientation behavior requires physical device rotation — grep proves the overlay component exists but not that it triggers correctly"
human_verification:
  - test: "Start playback on a real device — verify screen stays on past normal auto-lock timeout"
    expected: "Screen remains on during playback; stops on Stop/Pause"
    why_human: "Wake Lock is a device-level API — cannot verify activation via grep"
  - test: "Import SRT, close browser, reopen — verify saved movie appears"
    expected: "Saved movies hydrate from IndexedDB on app load"
    why_human: "Persistence across sessions requires actual browser restart"
  - test: "Load app online, then go offline (DevTools Network → Offline), reload"
    expected: "App loads fully from Service Worker cache"
    why_human: "Offline serving requires actual SW network interception"
  - test: "On iOS Safari, use 'Add to Home Screen' — verify app launches standalone in landscape"
    expected: "App installs and launches in standalone display mode"
    why_human: "Home screen installation is OS-level behavior"
  - test: "On iOS device, hold phone in portrait — verify rotate overlay appears; rotate to landscape — verify overlay disappears"
    expected: "Overlay visible in portrait, hidden in landscape"
    why_human: "Orientation detection requires physical device rotation"
---

# Phase 3: Cinema Readiness — Verification Report

**Phase Goal:** App works reliably in a real cinema setting — screen stays on, data persists, works offline, installable to home screen
**Verified:** 2026-07-27T05:47:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Screen stays awake during entire playback via native Wake Lock API, with NoSleep.js hidden video fallback for older iOS (<18.4) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `src/hooks/useWakeLock.ts` uses `@zakj/no-sleep` (auto-selects native API + video fallback); `enable()` called synchronously in `handlePlay` click handler (App.tsx:83); `visibilitychange` re-acquisition wired (useWakeLock.ts:40-58). Mechanism present and correct — actual screen-on behavior requires real device testing. |
| 2 | Imported subtitle files persist across app restarts and browser sessions via IndexedDB — returning users see saved movies | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `src/db/database.ts` defines typed CinemaSyncDB schema; `src/db/subtitles.ts` exports saveSubtitle/getAllSubtitles/deleteSubtitle; `fileImport.ts:54-66` calls saveSubtitle after parse; `App.tsx:25-31` hydrates via getAllSubtitles on mount. Mechanism present and correct — actual persistence across sessions requires browser restart testing. |
| 3 | App works fully offline after first load — Service Worker precaches app shell, no network needed | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `vite.config.ts` configures VitePWA with autoUpdate, workbox precaching (globPatterns), navigateFallback; build generates `dist/sw.js` (1480 bytes) with 11 precache entries; `src/pwa/RegisterSW.tsx` registers SW via virtual:pwa-register. Mechanism present and correct — actual offline serving requires browser DevTools testing. |
| 4 | User can add the app to home screen (PWA manifest with standalone display, landscape orientation) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `dist/manifest.webmanifest` has display: standalone, orientation: landscape, 3 icons (192, 512, 512 maskable); `index.html` has all iOS PWA meta tags (apple-mobile-web-app-capable, theme-color, apple-touch-icon, splash); `public/icon-192.png` (192x192), `public/icon-512.png` (512x512), `public/splash.png` (2048x2732) all valid PNGs. Mechanism present and correct — actual installability requires real device testing. |
| 5 | App displays correctly in landscape on Android (manifest lock) and shows rotate-to-landscape overlay on iOS | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `src/pwa/RotateOverlay.tsx` uses `matchMedia('(orientation: portrait)')` with change listener; overlay rendered in all 3 views (App.tsx:101,125,159); `src/index.css` has `.rotate-overlay` styles with rotate-hint animation + `@media (orientation: landscape)` safety net. Mechanism present and correct — actual orientation behavior requires physical device rotation. |

**Score:** 0/5 truths verified (5 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/database.ts` | Typed CinemaSyncDB schema with singleton getDB() | ✓ VERIFIED | 64 lines; CinemaSyncDB extends DBSchema; StoredSubtitle interface; memoized openDB; subtitles store with keyPath 'id' + 2 indexes |
| `src/db/subtitles.ts` | Four CRUD functions with error handling | ✓ VERIFIED | 60 lines; saveSubtitle (put/upsert), getSubtitle, getAllSubtitles (by-importedAt index), deleteSubtitle; all with try/catch |
| `src/hooks/useWakeLock.ts` | Wake Lock hook with NoSleep lazy init + visibilitychange | ✓ VERIFIED | 61 lines; useRef for NoSleep instance; useCallback for getNoSleep/enable/disable; enable() in try/catch; visibilitychange re-acquisition in useEffect |
| `src/pwa/RotateOverlay.tsx` | Portrait detection overlay | ✓ VERIFIED | 35 lines; matchMedia('(orientation: portrait)') with addEventListener('change'); renders overlay when portrait, null when landscape |
| `src/pwa/RegisterSW.tsx` | SW registration with update prompt | ✓ VERIFIED | 30 lines; registerSW from virtual:pwa-register; onNeedRefresh with confirm(); onOfflineReady logs |
| `src/imports/fileImport.ts` | Fire-and-forget save after parse | ✓ VERIFIED | 75 lines; saveSubtitle called after successful parse (line 54-66); StoredSubtitle constructed with deterministic id `${file.name}-${file.size}` |
| `src/App.tsx` | Hydration, Wake Lock wrappers, RotateOverlay, saved movies UI | ✓ VERIFIED | 180 lines; useEffect hydration (line 25-31); handlePlay/handlePause/handleStop with Wake Lock; handleDeleteSubtitle; handleSelectSaved; RotateOverlay in all views; saved movies in import + ready views |
| `src/components/CuePreview.tsx` | Optional savedSubtitles prop + onSelectSaved callback | ✓ VERIFIED | 98 lines; savedSubtitles and onSelectSaved props; renders saved movies section when provided |
| `src/main.tsx` | RegisterSW rendered in component tree | ✓ VERIFIED | 12 lines; `<RegisterSW />` rendered alongside `<App />` in StrictMode |
| `src/index.css` | Rotate overlay styles with animation | ✓ VERIFIED | 377 lines; .rotate-overlay (fixed, z-index 9999, black bg); .rotate-icon with rotate-hint animation; @media (orientation: landscape) safety net |
| `src/vite-env.d.ts` | Type declaration for virtual:pwa-register | ✓ VERIFIED | 12 lines; declares module 'virtual:pwa-register' with RegisterSWOptions and registerSW function |
| `vite.config.ts` | VitePWA plugin with manifest + workbox | ✓ VERIFIED | 37 lines; VitePWA with registerType autoUpdate, manifest (standalone, landscape, 3 icons), workbox (globPatterns, navigateFallback, cleanupOutdatedCaches), devOptions disabled |
| `index.html` | iOS PWA meta tags | ✓ VERIFIED | 18 lines; viewport-fit=cover, apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style, apple-mobile-web-app-title, theme-color, apple-touch-icon, apple-touch-startup-image |
| `public/icon-192.png` | 192x192 PWA icon | ✓ VERIFIED | Valid PNG, 192x192, 658 bytes |
| `public/icon-512.png` | 512x512 PWA icon | ✓ VERIFIED | Valid PNG, 512x512, 2324 bytes |
| `public/splash.png` | 2048x2732 iOS splash | ✓ VERIFIED | Valid PNG, 2048x2732, 28173 bytes |
| `package.json` | idb, @zakj/no-sleep, vite-plugin-pwa, workbox-window | ✓ VERIFIED | idb@^8.0.3, @zakj/no-sleep@^0.13.6 in deps; vite-plugin-pwa@^1.3.0, workbox-window@^7.4.1 in devDeps |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/imports/fileImport.ts` | `src/db/subtitles.ts` | saveSubtitle() call after parseSRT | ✓ WIRED | fileImport.ts:54-66 constructs StoredSubtitle and calls saveSubtitle (fire-and-forget) |
| `src/App.tsx` (mount) | `src/db/subtitles.ts` | getAllSubtitles() in useEffect | ✓ WIRED | App.tsx:25-31 useEffect calls getAllSubtitles().then(setSavedSubtitles) |
| `src/App.tsx` (delete) | `src/db/subtitles.ts` | deleteSubtitle() + state filter | ✓ WIRED | App.tsx:55-63 handleDeleteSubtitle calls deleteSubtitle then filters state |
| `src/App.tsx` (play) | `src/hooks/useWakeLock.ts` | enableWakeLock() in handlePlay | ✓ WIRED | App.tsx:82-85 handlePlay calls enableWakeLock() synchronously (no await) then play() |
| `src/App.tsx` (stop) | `src/hooks/useWakeLock.ts` | disableWakeLock() in handleStop | ✓ WIRED | App.tsx:92-95 handleStop calls disableWakeLock() then stop() |
| `src/main.tsx` | `src/pwa/RegisterSW.tsx` | `<RegisterSW />` rendered | ✓ WIRED | main.tsx:10 renders RegisterSW in StrictMode |
| `src/App.tsx` (all views) | `src/pwa/RotateOverlay.tsx` | `<RotateOverlay />` rendered | ✓ WIRED | App.tsx:101 (playback), 125 (import), 159 (ready) — all views |
| `src/pwa/RegisterSW.tsx` | virtual:pwa-register | registerSW() in useEffect | ✓ WIRED | RegisterSW.tsx:15-27 calls registerSW with onNeedRefresh/onOfflineReady |
| `src/components/CuePreview.tsx` | `src/App.tsx` | onSelectSaved callback | ✓ WIRED | CuePreview.tsx:85 calls onSelectSaved(stored) on button click; App.tsx:164 passes handleSelectSaved |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/App.tsx` | `savedSubtitles` (StoredSubtitle[]) | IndexedDB via getAllSubtitles() | Yes — reads from real IDB store | ✓ FLOWING |
| `src/App.tsx` | `subtitle` (ParsedSubtitle) | fileImport.ts importSRT() or handleSelectSaved() | Yes — from file parse or IDB reconstruction | ✓ FLOWING |
| `src/imports/fileImport.ts` | `stored` (StoredSubtitle) | Constructed from parse result | Yes — derived from real file content | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build succeeds | `npm run build` | Exit 0 — tsc + vite build OK, SW + manifest generated | ✓ PASS |
| TypeScript compiles | `npx tsc --noEmit` | No output (clean) | ✓ PASS |
| SW generated with precache | `cat dist/sw.js \| head -5` | 1480 bytes, 11 precache entries | ✓ PASS |
| Manifest correct | `cat dist/manifest.webmanifest` | standalone, landscape, 3 icons | ✓ PASS |
| Icons valid | `file public/*.png` | All 3 valid PNGs at correct dimensions | ✓ PASS |
| Wake Lock runtime | Requires real device | — | ? SKIP |
| Offline runtime | Requires browser DevTools | — | ? SKIP |
| Persistence runtime | Requires browser restart | — | ? SKIP |

### Probe Execution

Step 7c: SKIPPED — no probe scripts declared or conventional for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FILE-01 | 03-01 | Imported subtitle files persist locally across sessions via IndexedDB | ✓ COMPLETE | database.ts + subtitles.ts + fileImport.ts save + App.tsx hydration |
| FILE-02 | 03-02 | App works offline via Service Worker + Cache API | ✓ COMPLETE | vite-plugin-pwa configured, SW generated with 11 precache entries, RegisterSW component |
| DISP-02 | 03-02 | Screen stays awake during playback via Wake Lock API with NoSleep.js fallback | ✓ COMPLETE | useWakeLock.ts with @zakj/no-sleep, enable in gesture chain, visibilitychange re-acquisition |
| PWA-01 | 03-02 | User can add the app to home screen (PWA manifest) | ✓ COMPLETE | manifest with standalone display, landscape orientation, 3 icons; iOS meta tags in index.html |
| PWA-02 | 03-02 | App supports landscape orientation with rotate overlay fallback for iOS | ✓ COMPLETE | manifest orientation: landscape; RotateOverlay component with matchMedia portrait detection |
| PWA-03 | 03-02 | App shell precached for offline-first experience | ✓ COMPLETE | workbox globPatterns precache; SW generated with 11 entries (255.30 KiB); autoUpdate enabled |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | — |

No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers found. No empty implementations. No hardcoded empty data. No stub patterns detected.

### Human Verification Required

### 1. Wake Lock Screen-On Behavior

**Test:** Start playback on a real iOS or Android device. Wait for the normal auto-lock timeout (e.g. 30 seconds). Verify the screen remains on.
**Expected:** Screen stays on indefinitely during playback. Pressing Stop or Pause allows the screen to sleep normally.
**Why human:** Wake Lock activation is a device-level API behavior — grep can confirm the code calls `NoSleep.enable()` but cannot confirm the screen actually stays on.

### 2. IndexedDB Persistence Across Sessions

**Test:** Import an SRT file. Close the browser tab entirely. Reopen the app URL. Verify the saved movie appears in the "Continue with saved movie" list.
**Expected:** Saved movie list is populated from IndexedDB on mount without requiring re-import.
**Why human:** Persistence across browser sessions requires an actual browser restart — grep proves the save/load code exists but not that it survives a session boundary.

### 3. Offline Functionality

**Test:** Load the app once while online (to precache). Then enable Offline mode in DevTools (Network → Offline checkbox). Reload the page.
**Expected:** App loads fully from Service Worker cache with no network requests.
**Why human:** Offline serving requires actual Service Worker network interception — grep proves the SW exists with 11 precache entries but not that it serves content offline.

### 4. PWA Home Screen Installation

**Test:** Open the app in Safari on iOS or Chrome on Android. Use the browser's "Add to Home Screen" action. Launch the app from the home screen icon.
**Expected:** App installs and launches in standalone display mode (no browser chrome) with landscape orientation.
**Why human:** Home screen installation is an OS-level behavior — grep proves the manifest is correct but not that the OS accepts and installs it.

### 5. Landscape Orientation and Rotate Overlay

**Test:** On an iOS device, hold the phone in portrait mode while the app is open. Verify the rotate-to-landscape overlay appears. Rotate to landscape. Verify the overlay disappears.
**Expected:** Overlay visible in portrait with 🔄 icon and "请旋转手机 / Rotate to Landscape" text. Overlay hidden in landscape.
**Why human:** Orientation detection requires physical device rotation — grep proves the `matchMedia('(orientation: portrait)')` code exists but not that it triggers correctly on a real device.

### Gaps Summary

No implementation gaps found. All 16 artifacts exist, are substantive, and are correctly wired. All 8 key links are connected. All 6 requirements are covered by code. The build succeeds and TypeScript compiles cleanly.

The only open items are **behavioral verifications** — the runtime behaviors (screen staying on, offline serving, persistence across sessions, home screen installation, landscape display) cannot be verified by grep/presence checks alone. These require real device or browser DevTools testing.

**This is expected for Phase 3** — the deliverables are PWA infrastructure (Service Worker, manifest, Wake Lock, IndexedDB) whose correctness is primarily proven at runtime, not at code-scan time. The implementation is complete; the behavior needs human validation.

### Readiness for Phase 4

Phase 3 implementation is **complete** from a code perspective:
- IndexedDB persistence layer is fully functional (save, load, delete, hydrate)
- Wake Lock is integrated with playback controls (enable on play, disable on stop)
- PWA infrastructure is configured (manifest, Service Worker, icons, iOS meta tags)
- RotateOverlay handles iOS portrait mode
- All builds pass, no type errors, no anti-patterns

Phase 4 (Polish & Accessibility — timing offset, high contrast) can proceed. The Phase 3 deliverables it depends on (playback engine, App.tsx structure, settings persistence) are all in place.

---

_Verified: 2026-07-27T05:47:00Z_
_Verifier: the agent (gsd-verifier)_
