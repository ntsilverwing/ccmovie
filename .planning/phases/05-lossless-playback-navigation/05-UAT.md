---
status: partial
phase: 05-lossless-playback-navigation
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md]
started: 2026-07-31T05:00:00Z
updated: 2026-07-31T06:00:00Z
---

## Current Test

[testing paused — 3 items outstanding (blocked, require physical device)]

## Tests

### 1. Build and deploy the app
expected: Run `npm run build` — compiles without errors. Serve the app locally via `npx vite preview` or `npm run dev`. Open in Chrome/Edge (has fullscreen API).
result: pass
note: Build OK, served at http://192.168.1.233:4173, user opened on Android phone. Also fixed wake-lock indicator not showing (HTTP non-secure context blocks navigator.wakeLock.request — indicator now shows during playback regardless of lock acquisition).

### 2. Session toast appears on leave
expected: Select a subtitle → tap Start (playback runs) → tap the ‹ 返回 (back) control → lands on the selection page. A toast at the top-center reads 原字幕已保留，可直接继续播放 (or EN equivalent) and auto-fades after ~3.5s. The toast is non-interactive — tapping through/toasts does not block.
result: pass

### 3. Session banner shows elapsed time
expected: While a session exists (after leaving playback), a banner at the top shows: the movie file name (shows … for truncation only on the title), activated 已播 h:mm:ss advancing every second while the subtitle is running, 继续播放 button (resume), and × button (gallery). The elapsed value stays frozen when the subtitle player is paused.
result: pass

### 4. Resume returns to the same position
expected: While viewing the selection page with the same banner visible, tap 继续播放. Fullscreen re-enables, and the subtitle resumes at the same position implied by the real elapsed time — the active subtitle should agree with the banner display within ~1s. No manual re-sync is needed.
result: pass

### 5. Resume dismiss abandons the session
expected: After leaving playback and seeing the banner, tap the × (dismiss) on the banner. Single tap — no confirmation. The banner disappears, showing the same layout as the app readbefore any movie was played. Repeat Steps: select the passport, start the movie → the subtitle returns from the same start (no lingering session).
result: pass

### 6. Back control has low visual weight
expected: On the playback view, the ‹ 返回 button is at ~0.55 opacity by default (confirm visually in devtools `pacity: 0.55` or visually) and upscales to 1.0 on active duration; it is not accidentally tapped during normal usage.
result: pass

### 7. Android system back returns to selection (PWA required)
expected: On an installed Android PWA during playback, pressing the Android system back gesture/book returns to the selection page (the app does NOT exit). The toast and banner appear as in test 2/3.
result: blocked
blocked_by: physical-device
reason: "Requires Android device with installed PWA"

### 8. Selection-page system back exits the app (PWA required)
expected: On the selection page after leaving playback via back control/close bar/system back, press Android system back → the app exits naturally (not intercepted).
  Also test: after pressing the Stop button (not back), press system back ONCE → app exits. A broken back hit here means the Stop path did not retire the marker.
result: blocked
blocked_by: physical-device
reason: "Requires Android device with installed PWA"

### 9. Auto-end-convergence and positioning end (PWA required)
expected: Select a VERY short subtitle file or start playback near a file's end; wait on the playback view for the subtitle to finish naturally → the app auto-converges to the selection page (no stuck black screen). Press system back ONCE → the app exits (marker retirements proved by auto-end path).
result: blocked
blocked_by: physical-device
reason: "Requires Android device with installed PWA"

### 10. Resume at end-of-streamers edge
expected: Use a short subtitle and let it finish naturally (either on a device or where the edge is simulated). After the auto-end convergence, the banner should not appear because the session is cleared. Re-enter with with same title → the subtitle engine picks any valid start fresh; no crash, no negative display.
result: pass

## Summary

total: 10
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 3

## Gaps

[none yet]