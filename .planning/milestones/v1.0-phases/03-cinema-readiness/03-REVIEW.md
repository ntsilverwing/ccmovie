---
phase: 03-cinema-readiness
reviewed: 2026-07-28T12:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - src/App.tsx
  - src/components/CuePreview.tsx
  - src/db/database.ts
  - src/db/subtitles.ts
  - src/hooks/useWakeLock.ts
  - src/imports/fileImport.ts
  - src/index.css
  - src/main.tsx
  - src/pwa/RegisterSW.tsx
  - src/pwa/RotateOverlay.tsx
  - src/vite-env.d.ts
findings:
  critical: 0
  warning: 6
  info: 3
  total: 9
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-07-28T12:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed 11 source files for the cinema-readiness phase of the CinemaSyncSubs PWA. The code is generally well-structured with clean separation of concerns (import pipeline, playback engine, IndexedDB persistence, React hooks). No security vulnerabilities found — no `dangerouslySetInnerHTML`, no hardcoded secrets, no injection vectors. All subtitle text is rendered via React text nodes.

However, several functional bugs were identified: pause/resume does not preserve playback position, the saved-subtitles ordering contradicts its documentation, and the virtualized list's initial height constant is off by 10x. Additionally, the Wake Lock re-acquisition on visibility change will silently fail on platforms using the native Wake Lock API due to missing user-gesture context.

## Critical Issues

None found.

## Warnings

### WR-01: `getAllSubtitles` returns oldest-first, contradicting JSDoc "newest-first"

**File:** `src/db/subtitles.ts:42`
**Issue:** The JSDoc on `getAllSubtitles` states "ordered by importedAt (newest-first)", but `db.getAllFromIndex('subtitles', 'by-importedAt')` returns records in ascending index order (oldest-first). The `idb` library's `getAllFromIndex` defaults to direction `"next"` (ascending). The UI in `App.tsx:134` and `CuePreview.tsx:129` renders saved subtitles in the order returned, so users see oldest imports first — likely not the intent for a "continue watching" list.
**Fix:**
```ts
export async function getAllSubtitles(): Promise<StoredSubtitle[]> {
  try {
    const db = await getDB()
    const results = await db.getAllFromIndex('subtitles', 'by-importedAt')
    return results.reverse() // newest-first
  } catch (err) {
    throw new Error(`Failed to get all subtitles: ${err instanceof Error ? err.message : String(err)}`)
  }
}
```

### WR-02: `LIST_MAX_HEIGHT` constant is 6000px instead of ~600px (60vh)

**File:** `src/components/CuePreview.tsx:14`
**Issue:** `const LIST_MAX_HEIGHT = 60 * 100` evaluates to 6000px. The comment says "60vh in px approximation", but 60vh on a typical mobile viewport (~800px) is ~480px. The constant is off by 10x — likely a typo (`60 * 10` was intended). This value seeds `containerHeight` state, so the virtualization window initially renders up to ~167 items (`6000 / 37 + 5`) instead of ~21. While the ResizeObserver corrects this after mount, the initial render briefly shows too many rows and wastes DOM nodes.
**Fix:**
```ts
const LIST_MAX_HEIGHT = Math.round(window.innerHeight * 0.6) // 60vh
```

### WR-03: Pause/Resume does not preserve playback position

**File:** `src/playback/PlaybackEngine.ts:87-92`
**Issue:** `play()` unconditionally resets `this.startTime = performance.now()` and `this.lastIndex = -1`. When the user pauses and then presses "Resume", playback restarts from elapsed=0 (the beginning of the file) instead of continuing from the pause point. The `pause()` method cancels the rAF loop but does not record the current elapsed time. This breaks the core pause/resume UX.
**Fix:**
```ts
// Add position tracking
private pausedElapsed: number = 0

play(): void {
  this.startTime = performance.now() - this.pausedElapsed
  this.lastIndex = -1
  this.isPlaying = true
  this.tick()
}

pause(): void {
  if (this.rafId !== null) {
    cancelAnimationFrame(this.rafId)
    this.rafId = null
  }
  this.isPlaying = false
  this.pausedElapsed = performance.now() - this.startTime
}
```

### WR-04: Wake Lock re-acquisition silently fails on native Wake Lock API

**File:** `src/hooks/useWakeLock.ts:40-58`
**Issue:** The `visibilitychange` handler calls `noSleepRef.current.enable()` when the page becomes visible. On platforms using the native Wake Lock API (`navigator.wakeLock.request()`), this call MUST originate from a user gesture (click/touch). The `visibilitychange` event is not a user gesture, so the browser rejects the request with a SecurityError. The `.catch(() => {})` swallows the error, meaning the wake lock is never re-acquired when returning to the app during playback. The feature is effectively broken on Android/modern platforms.
**Fix:** Track playback-active state separately and only re-acquire wake lock on the next user gesture (e.g., when the user taps Resume), or display a subtle "tap to keep screen on" prompt when `visibilitychange` fires during active playback.

### WR-05: `TextDecoder` with chardet-detected encoding may throw for unsupported encodings

**File:** `src/imports/encoding.ts:41`
**Issue:** `new TextDecoder(encoding, { fatal: false })` uses the encoding name returned by `chardet.analyse`. If chardet returns an encoding not supported by the browser's `TextDecoder` (e.g., some exotic ISO variant), the constructor throws a `RangeError`. This error is not caught within `detectAndDecode` and propagates up through `importSRT` (which has no try-catch around the `detectAndDecode` call at line 35) to `FilePicker.handleFile`, where it becomes a generic "unexpected error" message — unhelpful for debugging.
**Fix:**
```ts
// Stage 4: Decode with detected encoding (fatal: false for resilience)
try {
  const text = new TextDecoder(encoding, { fatal: false }).decode(buffer)
  return { text, encoding }
} catch {
  // Unsupported encoding — fall back to UTF-8 with replacement
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  return { text, encoding: 'UTF-8 (fallback)' }
}
```

### WR-06: NoSleep wake lock not released on component unmount

**File:** `src/hooks/useWakeLock.ts:13-61`
**Issue:** The `useWakeLock` hook has no cleanup effect to call `disable()` when the component unmounts. If the component unmounts while wake lock is active (e.g., navigation, hot reload), the screen will stay awake indefinitely. On iOS, the NoSleep library creates a hidden video element that continues playing in the background.
**Fix:** Add a cleanup effect:
```ts
useEffect(() => {
  return () => {
    noSleepRef.current?.disable()
  }
}, [])
```

## Info

### IN-01: `parseInt` without explicit radix in srtParser.ts

**File:** `src/imports/srtParser.ts:72-80`
**Issue:** `parseInt(timeMatch[1])` through `parseInt(timeMatch[8])` omit the radix parameter. While modern JS engines default to base 10 (ES5+), omitting the radix is a well-known anti-pattern that can cause subtle bugs with leading-zero strings in older environments and triggers linter warnings.
**Fix:** Append `, 10` to each `parseInt` call:
```ts
const start =
  parseInt(timeMatch[1], 10) * 3600000 +
  parseInt(timeMatch[2], 10) * 60000 +
  parseInt(timeMatch[3], 10) * 1000 +
  parseInt(timeMatch[4], 10)
```

### IN-02: `console.log` debug artifact in RegisterSW.tsx

**File:** `src/pwa/RegisterSW.tsx:24`
**Issue:** `console.log('App ready for offline use')` is a debug artifact that will log in production. While harmless, it adds noise to the console.
**Fix:** Remove the log or gate it behind a development flag:
```ts
onOfflineReady() {
  if (import.meta.env.DEV) console.log('App ready for offline use')
},
```

### IN-03: Duplicate timecode formatting logic across modules

**File:** `src/components/CuePreview.tsx:16-22` and `src/imports/srtParser.ts:136-142`
**Issue:** Two separate timecode formatting functions exist: `formatTimecode` (HH:MM:SS) in CuePreview and `formatTimeMs` (HH:MM:SS,mmm) in srtParser. While they serve different display purposes, the logic is nearly identical and could drift. Consider extracting a shared `formatTime` utility with a precision parameter.
**Fix:** Create `src/utils/time.ts`:
```ts
export function formatTime(ms: number, showMillis = false): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const base = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return showMillis ? `${base},${String(ms % 1000).padStart(3, '0')}` : base
}
```

---

_Reviewed: 2026-07-28T12:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
