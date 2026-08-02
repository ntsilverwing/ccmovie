---
phase: 06-session-persistence-resume
verified: 2026-08-01T17:00:00Z
status: passed
score: 2/4
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:

  - truth: "User relaunching the app after a kill/refresh sees a resume card atop the selection page (movie title + elapsed duration) and resumes from the correct position in one tap"
    test: "Kill the app mid-playback, relaunch, confirm resume card appears with movie title + live-ticking elapsed meta; tap Resume and confirm playback opens at the offset-inclusive wall-clock position (NOT 0:00:00)"
    expected: "Card appears with correct title + elapsed time; resume lands at the correct wall-clock position; paused-at-kill card shows frozen 'Paused at {time}' with no tick and resumes playing from frozen value"
    why_human: "Real device kill/relaunch, wake-lock, fullscreen, and IndexedDB survival across process death cannot be simulated in node-env Vitest; Task 3 device checkpoint was auto-approved under --chain WITHOUT execution"

  - truth: "User can dismiss the resume card to abandon the session, and sessions older than the expiry threshold (default ~6 hours) are automatically invalidated"
    test: "Dismiss the card with one tap — card disappears and relaunch shows byte-identical v1.0 selection page (no card); hand-edit a stored record's startedAt to >6h in the past in devtools, relaunch — no card renders"
    expected: "Single-tap dismiss clears the record and removes the card; >6h record is cleared on load and renders no card"
    why_human: "The isSessionExpired predicate is unit-tested (boundaries pass), but the end-to-end device behavior (card absence after dismiss on relaunch, >6h record cleared on relaunch) requires a real device and cannot be grep-verified"
human_verification:

  - test: "Kill app mid-playback, relaunch — resume card shows movie title + live-ticking elapsed; tap Resume — playback opens at wall-clock position"
    expected: "Card appears after kill/relaunch; resume lands at correct position (never 0:00:00)"
    why_human: "Process kill and IndexedDB survival across death cannot be simulated in node-env Vitest"

  - test: "Background app, pause playback, kill + relaunch — card shows 'Paused at {time}' frozen (no tick); Resume lands playing from frozen value"
    expected: "Paused-at-kill frozen display with no tick; resume plays from frozen position with no jump"
    why_human: "Paused-at-kill display and resume-from-frozen are device-observable behaviors"

  - test: "Dismiss card with one tap of × — no confirmation; relaunch — selection page byte-identical to v1.0 and session record deleted"
    expected: "Single-tap dismiss with zero friction; record cleared; relaunch shows no card"
    why_human: "Dismiss UX and post-dismiss record state require device confirmation"

  - test: "Hand-edit stored record's startedAt to >6h in the past (or corrupt a field type) in devtools, relaunch — no card renders"
    expected: "Expired/corrupt record cleared on load; no card renders"
    why_human: "Expiry invalidation on relaunch is a device-observable behavior"

  - test: "Import a different subtitle while card visible — card disappears; only new session's record exists under 'current' after pressing Start"
    expected: "New import replaces session; single 'current' record for new session"
    why_human: "Replacement semantics at device level require real IndexedDB observation"
---

# Phase 6: Session Persistence & Resume — Verification Report

**Phase Goal:** Playback session persists across app kill/refresh; the user resumes from the correct position via a resume card and never re-syncs manually
**Verified:** 2026-08-01T17:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User's active session (subtitle ID, startedAt, offset) is persisted to IndexedDB, with every offset adjustment written immediately | ✓ VERIFIED | `sessions.test.ts` proves saveSession/clearSessionRecord CRUD + replacement semantics (7 cases, all green); offset prop effect (usePlaybackEngine L153-157) calls `setSession(updateSessionOffset(...))` → new object → `[session]` effect (L171-179) fires `saveSession`; store layer tested with fake-indexeddb |
| 2 | User relaunching the app after a kill/refresh sees a resume card atop the selection page (movie title + elapsed duration) and resumes from the correct position in one tap | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | ResumeCard.tsx exists + wired in both App branches (L394, L450); `handleResumeFromSession` gesture chain (L186-221) is code-correct (enableWakeLock FIRST → getSubtitle → fileName fallback → enterPlaybackHistory ONLY on hit → restoreSession → setView); `restoreSession` ordering locked by `playbackEngine.test.ts` contract tests (L184-233). But the device behavior — card appears after real kill/relaunch, resume lands at wall-clock position — requires a real device and was never executed (Task 3 auto-approved under --chain) |
| 3 | User can dismiss the resume card to abandon the session, and sessions older than the expiry threshold (default ~6 hours) are automatically invalidated | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `handleDismissCard` (L231-234) clears record + removes card; `isSessionExpired` predicate unit-tested at boundaries (session.test.ts L174-189: at-threshold valid, +1ms expired, negative-age never expired); boot effect gates expiry exactly once per launch (L84-97, `[]` deps). But end-to-end device behavior (card absent after dismiss on relaunch, >6h record cleared on relaunch) requires device verification |
| 4 | User loading a new subtitle replaces any existing session | ✓ VERIFIED | `handleImport` (L107-121) → `stop()` → `setSession(null)` → persist effect fires `clearSessionRecord` + explicit `void clearSessionRecord()` + `setPersistedSession(null)`; new play creates + saves new record under same key; replacement semantics tested in `sessions.test.ts` ("replaces the prior record on a second save under the same key") |

**Score:** 2/{4 truths verified (2 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/playback/session.ts` | Exports SESSION_EXPIRY_MS, isSessionExpired, isValidSession | ✓ VERIFIED | L106 SESSION_EXPIRY_MS = 6 * 3_600_000; L115 isSessionExpired(session, now, expiryMs); L126 isValidSession(raw) — all pure, clock-free (comment-stripped clock gate = 0) |
| `src/db/database.ts` | v2 schema with guarded upgrade ladder + session store | ✓ VERIFIED | L64 openDB('cinemasyncsubs', 2); L66 `oldVersion < 1` wraps subtitles + both indexes; L71 `oldVersion < 2` creates session store; L24-28 session: { key: string; value: PlaybackSession } |
| `src/db/sessions.ts` | SESSION_KEY='current', loadSession, saveSession, clearSessionRecord | ✓ VERIFIED | L10 SESSION_KEY = 'current'; L24 loadSession (validates + clears corrupt best-effort, empty store returns null with zero writes); L45 saveSession; L59 clearSessionRecord; swallow-warn policy (0 throw paths outside comments) |
| `src/hooks/usePlaybackEngine.ts` | Returns restoreSession + guarded persist effect | ✓ VERIFIED | L12 imports saveSession/clearSessionRecord from ../db/sessions; L120/L269 restoreSession in return type + object; L160 hasPersistedRef guard; L171-179 [session] effect (save on non-null, clear only after this instance persisted); L257-267 restoreSession body: setCues → play() → seekTo (locked order) |
| `src/components/ResumeCard.tsx` | D-07-locked card, I-7 tick, no PlaybackStatus | ✓ VERIFIED | L52-70 reuses .session-banner* classes verbatim (session-banner, session-banner-resume, session-banner-dismiss); L42 tick only while pausedElapsedMs === null; L56 paused detection from record; PlaybackStatus count = 0; L47 null guard renders nothing |
| `src/App.tsx` | persistedSession state, boot effect, handlers, card mounts in both branches | ✓ VERIFIED | L83 persistedSession state; L84-97 boot load+expiry effect (`[]` deps); L183-226 handleResumeFromSession; L231-234 handleDismissCard; L394 + L450 ResumeCard mounts in BOTH selection branches gated `persistedSession !== null && session === null` |
| `test/unit/session.test.ts` | Extended with expiry + validation, green | ✓ VERIFIED | 41 tests pass; L168-172 SESSION_EXPIRY_MS = 21_600_000; L174-189 isSessionExpired boundary cases; L191-216 isValidSession accept + 9-case reject matrix |
| `test/unit/sessions.test.ts` | Created with fake-indexeddb CRUD + upgrade, green | ✓ VERIFIED | 7 tests pass; L64-76 v1→v2 upgrade preservation; L78-116 CRUD round-trip + replacement + clear; L118-149 corrupt-record + empty-store no-delete |
| `test/unit/playbackEngine.test.ts` | Extended with restore ordering, green | ✓ VERIFIED | 18 tests pass; L148-233 restore ordering contract: fresh-engine restore anchors (L184-198), seek-before-play clobbered to 0 (L200-214), no spurious onEnded (L216-233) |
| `package.json` | fake-indexeddb devDependency | ✓ VERIFIED | `"fake-indexeddb": "^6.2.5"` present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/db/sessions.ts` | `src/db/database.ts` + `src/playback/session` | Imports getDB (L1) + isValidSession (L2); loadSession validates every record + clears corrupt best-effort (L29-31); empty store returns null before any delete (L28) | ✓ WIRED | Code-verified; sessions.test.ts proves both branches |
| fake-indexeddb test | v1→v2 upgrade path | `seedV1WithSubtitle()` seeds v1, reopens via app getDB() at v2 | ✓ WIRED | sessions.test.ts L64-76 proves subtitle row survives + session store exists |
| `restoreSession` | resumeSession + sessionElapsedMs + engine.setCues/play/seekTo | L261 resumeSession(persisted, now) → L262 engine.setCues → L264 engine.play() → L265 engine.seekTo(sessionElapsedMs(live, now)) | ✓ WIRED | Order locked by playbackEngine.test.ts contract describe |
| persist effect | `saveSession` + `clearSessionRecord` from ../db/sessions | L12 import; L174 saveSession on non-null; L177 clearSessionRecord only when hasPersistedRef true | ✓ WIRED | Line-order verified; hasPersistedRef starts false so mount issues no delete |
| ResumeCard | App-level persistedSession state | L394/L450 `persistedSession !== null && session === null` → ResumeCard mounts; fed by persistedSession prop | ✓ WIRED | Mutual exclusivity by construction |
| `handleResumeFromSession` | enableWakeLock + getSubtitle + savedSubtitles fallback + restoreSession + updateSettings | L186 enableWakeLock (FIRST) → L187 getSubtitle → L189 fileName fallback → L202 enterPlaybackHistory (hit only) → L217 restoreSession → L220 updateSettings | ✓ WIRED | Gesture-chain line order verified; history marker only on hit path (D-01/D-03 discipline) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| ResumeCard | `session` (persistedSession) | App boot `loadSession()` from IndexedDB | Yes — reads persisted record at boot | ✓ FLOWING (verified by loadSession + boot effect) |
| ResumeCard meta | `time` via `sessionElapsedMs(session, now)` | `now` from 1s interval (un-paused) or frozen pausedElapsedMs | Yes — wall-clock derived | ✓ FLOWING |
| saveSession writes | `session` object | React state transitions (create/pause/resume/offset/stop) | Yes — store CRUD tested with fake-indexeddb | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite | `npm test` (vitest run) | 112 tests, 8 files, all pass (626ms) | ✓ PASS |
| Typecheck + build | `npm run build` (tsc -b + vite) | Clean build, PWA precache generated (11 entries) | ✓ PASS |
| Store CRUD round-trip | `npx vitest run test/unit/sessions.test.ts` | 7 tests pass (upgrade, CRUD, corrupt, empty-store) | ✓ PASS |
| Expiry boundary predicate | `npx vitest run test/unit/session.test.ts` | 41 tests pass (expiry boundaries + validation reject matrix) | ✓ PASS |
| Restore ordering contract | `npx vitest run test/unit/playbackEngine.test.ts` | 18 tests pass (3 contract cases) | ✓ PASS |
| Clock-purity gate | comment-stripped `Date./performance.` grep in session.ts | 0 matches | ✓ PASS |
| Throw-path gate | comment-stripped `throw` grep in sessions.ts | 0 matches | ✓ PASS |

### Probe Execution

Step 7c: SKIPPED — no probe scripts declared for this phase (pure unit/UI phase; verification via Vitest suites).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FILE-03 | 06-01, 06-02, 06-03 | 会话（字幕 ID、startedAt、偏移）持久化到 IndexedDB；偏移调整即时写入 | ✓ SATISFIED | sessions.ts + store effect; sessions.test.ts CRUD tested |
| FILE-03 | 06-01, 06-02, 06-03 | 重启后续播卡片（片名 + 已播时长），一键从正确位置续播 | ⚠️ NEEDS HUMAN | Code wired; device behavior unverified |
| FILE-03 | 06-01, 06-03 | 卡片可关闭=放弃会话；超时自动作废（~6h） | ⚠️ NEEDS HUMAN | Predicate tested; device behavior unverified |
| FILE-03 | 06-01, 06-02, 06-03 | 载入新字幕即替换现有会话 | ✓ SATISFIED | handleImport → stop → clear → create → save; replacement tested |

No orphaned requirements — FILE-03 is the only requirement mapped to Phase 6, fully claimed by plans 06-01/06-02/06-03.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | — |

No FIXME/TODO/HACK/PLACEHOLDER markers found in any phase-modified file. No stub patterns detected. No debt markers. ResumeCard reuses real banner classes (not placeholder DOM). All API functions perform real IndexedDB operations (tested via fake-indexeddb).

### Prohibition Compliance (judgment-tier — verified by code inspection)

| Prohibition | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| MUST NOT write to IndexedDB from engine position ticks | 06-02 | ✓ HONORED | `[session]` effect fires only on identity change; TICK action updates PlaybackState only, never session; ticks never allocate session object |
| MUST NOT surface expiry threshold/staleness messaging in UI | 06-03 | ✓ HONORED | No expiry copy in ResumeCard or translations; isSessionExpired is internal-only |
| MUST NOT add confirmation dialog/friction to dismiss | 06-03 | ✓ HONORED | `handleDismissCard` clears record + removes card in single tap; no dialog/interstitial |
| MUST NOT introduce new CSS/colors/visual treatments; banner classes untouched | 06-03 | ✓ HONORED | `grep -c session-banner src/index.css` = 7 (unchanged); translations.ts untouched across phase diff |
| MUST NOT transmit session/movie identity over network | 06-03 | ✓ HONORED | No fetch/XHR added; record stays in origin-isolated IndexedDB |
| Expiry MUST NOT run from timer/interval/visibilitychange | 06-03 | ✓ HONORED | Single `[]`-deps boot effect (L84-97); no timer/interval/visibilitychange re-check anywhere |

All prohibitions verified at code level (grep + structural inspection). None flagged — evidence is conclusive for each.

### Human Verification Required

The Task 3 device checkpoint (`checkpoint:human-verify`, gate: blocking) was auto-approved by the orchestrator under `--chain` mode WITHOUT execution. The seven-step device checklist was never run on a real device. The following items require human testing on the Android PWA at minimum brightness:

### 1. Kill/Relaunch → Resume Card Appears + Live Tick

**Test:** Import/select a saved subtitle, tap Start, play ~30s, tap offset +0.5s once. Kill the app (swipe away / force stop) and relaunch.
**Expected:** A resume card appears atop the selection page showing the movie title + a live-ticking `{time} elapsed` meta. The Phase-5 SessionBanner does NOT co-render. Devtools shows one record under key `current` with subtitleId, fileName, startedAt, offsetMs=500, pausedElapsedMs=null.
**Why human:** Real process kill and IndexedDB survival across death cannot be simulated in node-env Vitest.

### 2. One-Tap Resume Lands at Wall-Clock Position

**Test:** Tap Resume on the resume card.
**Expected:** Wake lock + fullscreen engage; playback opens at the offset-inclusive wall-clock position (compare against a real clock — it must NOT start at 0:00:00).
**Why human:** Wall-clock resume position against a real clock requires a real device.

### 3. Paused-at-Kill Frozen Display + Resume from Frozen

**Test:** Background the app, pause playback, then kill and relaunch.
**Expected:** Card shows `Paused at {time}` frozen (no ticking). Resume lands PLAYING from the frozen value with no jump.
**Why human:** Paused-at-kill display and resume-from-frozen are device-observable behaviors.

### 4. Single-Tap Dismiss + Byte-Identical v1.0 Relaunch

**Test:** Dismiss the card with one tap of ×. Relaunch.
**Expected:** No confirmation dialog. Card gone. Selection page byte-identical to v1.0. Devtools shows session record deleted.
**Why human:** Dismiss UX and post-dismiss record state require device confirmation.

### 5. Expiry Invalidation on Relaunch

**Test:** In devtools, hand-edit a stored record's startedAt to >6h in the past (or corrupt a field type). Relaunch.
**Expected:** No card renders. Record is cleared on load.
**Why human:** Expiry invalidation on relaunch is a device-observable behavior (predicate logic itself is unit-tested).

### 6. New-Import Replacement

**Test:** Import a different subtitle while the card is visible.
**Expected:** Card disappears. After pressing Start, only the new session's record exists under `current`.
**Why human:** Replacement semantics at device level require real IndexedDB observation.

### Gaps Summary

No code gaps found. All artifacts exist, are substantive, wired, and data-flowing. All key links are wired. All prohibitions are honored at code level. 112 unit/integration tests pass; build is clean.

The phase is `human_needed` (not `gaps_found`) because:

- The codebase is complete and correct at the code level — no missing/stub/unwired artifacts.
- Two roadmap success criteria (#2 resume card + correct position, #3 dismiss + expiry invalidation) assert device-runtime behaviors that cannot be verified in node-env Vitest. The `restoreSession` ordering is locked by contract tests, and the `isSessionExpired` predicate is unit-tested at boundaries, but the end-to-end device experience requires a real Android PWA.
- The Task 3 device checkpoint (blocking `checkpoint:human-verify`) was auto-approved under `--chain` without execution — its seven-step checklist is the primary outstanding verification item.

The store layer (IndexedDB CRUD, replacement, clear-on-invalid, empty-store no-mutation) is thoroughly tested with fake-indexeddb. The pure logic (expiry boundaries, validation reject matrix, restore ordering) is locked by green contract tests. What remains is exclusively the device-observable UX: kill/relaunch survival, resume position against a real clock, dismiss friction, and expiry presentation.

---

_Verified: 2026-08-01T17:00:00Z_
_Verifier: the agent (gsd-verifier)_
