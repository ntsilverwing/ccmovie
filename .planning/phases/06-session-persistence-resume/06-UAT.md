---
status: complete
phase: 06-session-persistence-resume
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-VERIFICATION.md]
started: 2026-08-01T22:42:00Z
updated: 2026-08-01T23:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Kill/relaunch — resume card appears with live-ticking elapsed
expected: Import/select a saved subtitle, tap Start, play ~30s, tap offset +0.5s. Kill app (swipe away / force stop), relaunch. Resume card appears atop the selection page showing movie title + live-ticking '{time} elapsed'; SessionBanner does NOT appear.
result: pass

### 2. Resume tap lands at wall-clock position (NOT 0:00:00)
expected: From the resume card, tap Resume. Wake lock + fullscreen engage. Playback opens at the offset-inclusive wall-clock position — compare against a real clock; it must NOT start at 0:00:00.
result: pass

### 3. Paused-at-kill → frozen 'Paused at {time}', resumes playing with no jump
expected: Background the app, pause playback, kill, relaunch. Card shows 'Paused at {time}' frozen (no ticking). Tap Resume → lands PLAYING from the frozen value with no jump.
result: pass

### 4. Single-tap dismiss — no confirmation, relaunch byte-identical to v1.0
expected: Tap × once (no confirmation dialog appears). Card removed. Relaunch — selection page is byte-identical to v1.0 and devtools shows the session record deleted.
result: pass

### 5. Expired session (>6h) → no card, record cleared on load
expected: In devtools, hand-edit a stored record's startedAt to more than 6 hours in the past (or corrupt a field type). Relaunch — no card renders and the record is cleared on load.
result: pass

### 6. New subtitle import replaces existing session
expected: Import a different subtitle while the card is visible. Card disappears. Press Start on the new subtitle; only the new session's record exists under key 'current' in devtools.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
