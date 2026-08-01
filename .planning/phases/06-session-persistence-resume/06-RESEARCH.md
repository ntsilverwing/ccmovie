# Phase 6: Session Persistence & Resume - Research

**Researched:** 2026-08-01
**Domain:** IndexedDB-backed client-side session persistence for a React/TypeScript PWA
**Confidence:** HIGH (mechanism pre-designed and locked by Phase 5; codebase integration points fully mapped; all packages registry-verified; authoritative docs cited)

## Summary

Phase 6 layers durability onto Phase 5's in-memory wall-clock session. The heavy design lifting is already done: `src/playback/session.ts` (`PlaybackSession` = `{subtitleId, fileName, startedAt, offsetMs, pausedElapsedMs}`) was explicitly built as a "Phase-6 persist target: every field is a JSON-serializable primitive, no runtime handles" [VERIFIED: src/playback/session.ts lines 22-37], and Phase 5's CONTEXT.md locked two Phase-6-facing decisions: D-07 (the resume card is the same position + component base as the SessionBanner, Phase 6 adds "IndexedDB 来源与过期语义") and D-08 (dismiss = abandon session, one mental model) [VERIFIED: .planning/phases/05-lossless-playback-navigation/05-CONTEXT.md].

The codebase already has a working idb-based persistence layer (`src/db/database.ts` + `src/db/subtitles.ts`, FILE-01, DB `cinemasyncsubs` v1, single `subtitles` store). Phase 6's persistence design is therefore a **DB version 1→2 upgrade adding a single-record `session` store** plus a thin `src/db/sessions.ts` module mirroring the existing `subtitles.ts` module conventions — no new production dependencies. The one new package is `fake-indexeddb` (devDependency) so the DB layer can be unit-tested under Vitest's node environment (`vitest.config.ts` uses `environment: 'node'`).

The genuinely new engineering in this phase is the **relaunch restore flow**: after a kill/refresh, the hook's in-memory session is null and the engine has no cues. The resume tap must rehydrate cues from IndexedDB (soft-link lookup, id first, by-fileName fallback per the documented `SessionIdentity` semantics), imperatively prime the engine (`setCues` → `play` → `seekTo` — order matters), preserve the gesture chain (wake lock FIRST, synchronously), and converge on the persisted session as display truth. All four FILE-03 success criteria then fall out: criterion 1 (immediate writes) from a hook-level effect watching the immutable session object; criterion 2 (resume card) from persisted-session state driving a D-07-locked banner-based card; criterion 3 (dismiss + expiry) from a pure injected-`now` expiry predicate evaluated at app load; criterion 4 (replacement) from the existing `handleImport → stop() → session null` call graph automatically clearing the store.

**Primary recommendation:** Add a `session` object store via the idb `oldVersion < 2` upgrade ladder, persist via a single effect wired to the immutable session state object (write-on-transition, never write-on-unload), evaluate expiry at app load against `startedAt` with a pure `isSessionExpired(session, now, expiryMs)` function, and implement restore as a new imperative `restoreSession(cues, session)` method on `usePlaybackEngine`. Reuse `.session-banner*` CSS and existing i18n keys for the card; test pure logic + DB layer with Vitest + fake-indexeddb; gate the kill-and-relaunch UX on a human device checkpoint matching the 05-UAT format.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FILE-03 | Playback session persists across app kill/refresh; user resumes from the correct position | Fully supported by existing assets: `PlaybackSession` shape is the persist target (session.ts), `idb` layer exists (db/database.ts, db/subtitles.ts), resume formula tested since Phase 5 (test/unit/session.test.ts). New work: DB v2 upgrade + `src/db/sessions.ts`, hook persist effect, expiry predicate, `restoreSession`, ResumeCard UI. See "Design Approach" and "Validation Architecture". |

Sub-criteria from REQUIREMENTS.md § FILE-03 (Chinese original):

| Sub-criterion | Research-mapped mechanism |
|---|---|
| 会话（字幕 ID、startedAt、偏移）持久化到 IndexedDB；偏移调整即时写入 | New `session` store; hook effect writes on every immutable session transition — `updateSessionOffset` produces a new object on every adjust, so "immediate" is structural (see Write Triggers) |
| 重启后选择页顶部续播卡片（片名 + 已播时长），一键续播 | D-07 lock: same base as SessionBanner; `session.fileName` + `formatElapsedHMS(sessionElapsedMs(...))` already exist; restore flow in "Restore Flow" |
| 卡片可关闭=放弃会话；超时自动作废（阈值规划时定，默认 ~6h） | Dismiss → delete record (D-08 semantics); `isSessionExpired(session, now, expiryMs)` pure predicate, checked at app load |
| 载入新字幕即替换现有会话 | `handleImport → stop()` already nulls the session → persist effect deletes record; next `play()` writes the new one |
</phase_requirements>

## Inherited Design Locks (from Phase 5 — treat as locked decisions)

No CONTEXT.md exists for Phase 6, but Phase 5 artifacts lock the following:

1. **Mechanism (STATE.md / ROADMAP.md v1.1 shared mechanism):** session = subtitle ID + `startedAt` wall-clock timestamp + offset; resume position = `now − startedAt + offset`; persisted via idb/IndexedDB. [VERIFIED: .planning/STATE.md lines 59-63, .planning/ROADMAP.md line 31]
2. **D-07 (05-CONTEXT.md):** 续播卡片与 Phase 5 横幅"同位置、同组件基础" — top of the selection page above `.saved-movies`; Phase 6 adds IndexedDB sourcing + expiry semantics on top.
3. **D-08 (05-CONTEXT.md):** dismiss × = stop & abandon the session; identical semantics on the Phase 6 card — single mental model, no confirmation dialogs (影院场景：可逆性优先，禁止弹窗/双击/长按 friction — 05-CONTEXT.md specifics).
4. **Persist-ready shape (05-01 key-decision):** `PlaybackSession` is JSON-serializable end-to-end — "direct IndexedDB drop-in with no shape change".
5. **Soft-link identity (05-04 key-decision):** `subtitleId` may be a saved-record id (`${fileName}-${fileSize}`) OR a raw fileName fallback; the resume path MUST NOT treat it as a hard foreign key.
6. **Testing convention (05-01 pattern):** injected-`now` fixtures (T = 1_000_000), never `Date.now()`/fake timers in session-math tests; module purity enforced by a comment-stripped clock-read grep gate.
7. **Expiry threshold unfinalized** (STATE.md Blockers): "session expiry threshold must be finalized (default ~6 hours)" — a planning-time decision, not research's call.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session record storage (write/read/delete) | Browser / Client (IndexedDB via idb) | — | FILE-03 mandates IndexedDB; app is local-first with no backend tier |
| Expiry evaluation | Browser / Client (pure function) | — | Deterministic, injected-`now` convention; only evaluated at app load |
| Persist trigger (write-on-transition) | Browser / Client (React hook effect) | — | Session state lives in `usePlaybackEngine`; every transition allocates a fresh object, so an effect on `[session]` is the minimal, complete write trigger |
| Resume card rendering | Browser / Client (React component) | — | D-07 lock: selection page, banner base; no SSR/CDN tier exists |
| Resume position computation | Browser / Client (`session.ts` math + `PlaybackEngine.seekTo`) | — | Same formula as Phase 5; engine remains monotonic-clocked, session wall-clocked |
| Cue rehydration on resume | Browser / Client (IndexedDB `subtitles` store) | — | Existing `getSubtitle` / `getAllFromIndex('by-fileName')` fallback covers soft-link ids |

There is no server tier in this project. Nothing in this phase crosses a network or service boundary.

## Current State of the Codebase (what already exists)

| Asset | State | Phase-6 relevance |
|---|---|---|
| `src/playback/session.ts` | Complete, 26 tests green | Persist target shape + all math (create/pause/resume/updateSessionOffset/sessionElapsedMs/formatElapsedHMS). No changes needed. |
| `src/db/database.ts` | DB `cinemasyncsubs` v1, `subtitles` store, singleton `getDB()` | Add `session` store via v2 upgrade ladder; extend `CinemaSyncDB` schema |
| `src/db/subtitles.ts` | save/get/getAll/delete wrappers, try/catch error wrapping | Style template for new `src/db/sessions.ts` |
| `src/hooks/usePlaybackEngine.ts` | Owns in-memory `session` state; `resyncToSession` exists | Add persist effect + `restoreSession(cues, session)`; session cleared on stop/onEnded (auto-clear of store falls out) |
| `src/components/SessionBanner.tsx` | Renders from hook `session`+`status`; returns null when `status==='idle'` or no session | CSS/DOM base for card; CANNOT be driven directly after relaunch (hook session null, status idle → renders nothing) |
| `src/App.tsx` | `handleImport` calls `stop()`; banner mounts on both selection views | Hosts persisted-session state, load/expiry effect, card mount points (two selection branches), restore handler |
| `src/hooks/usePersistedSettings.ts` | `offsetMs` in localStorage, validated load | Offset dual-store nuance: session snapshot is display truth; on restore push `session.offsetMs` into settings so engine/controls/banner agree (see Open Question Q5) |
| i18n keys | `resumePlaying`, `resumePlayingAria`, `sessionElapsed`, `sessionPausedAt`, `dismissSession` exist in en+zh | Card copy likely fully reusable; new keys only if card needs distinct wording |
| `test/` | Vitest 4.1.10, node env, 87 tests green | Add `test/unit/sessions.test.ts` (store CRUD + upgrade) + expiry predicate tests |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `idb` | 8.0.3 (installed `^8.0.3`; registry latest = 8.0.3, published 2025-05-07) [VERIFIED: npm registry] | IndexedDB promise wrapper | Already the project's FILE-01 substrate; tiny (~1.19kB brotli'd), TypeScript-first schema via `DBSchema`, supports `oldVersion` upgrade ladder and per-transaction `durability` [CITED: github.com/jakearchibald/idb autodocs via Context7] |
| React built-ins (`useState`/`useEffect`/`useCallback`) | 18.3.1 (installed) | Persist effect, card state, gesture-chain handlers | No state library exists in this codebase; Phase 5 set the hook-level pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fake-indexeddb` | 6.2.5 (new devDependency; published 2025-11-07) [VERIFIED: npm registry] | In-memory IndexedDB implementation for Node | Unit-testing `src/db/sessions.ts` and the v1→v2 upgrade path under Vitest's `environment: 'node'` (`import 'fake-indexeddb/auto'` sets the `indexedDB` global) |
| `vitest` | 4.1.10 (installed) | Test runner | Existing; `npm test` (`vitest run`), include `test/**/*.test.ts` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom `session` store in existing DB | `idb-keyval` separate DB | idb-keyval is the same author's keyval API, but a second database/wrapper duplicates what two lines of `openDB` upgrade already give us inside the existing schema; also keeps session+subtitle in one DB transaction domain |
| `fake-indexeddb` | `happy-dom`/`jsdom` env switch | DOM envs don't ship a complete IndexedDB; happy-dom's IndexedDB is partial. fake-indexeddb is the de-facto Node implementation (5.0M weekly downloads) and works with idb; no Vitest config change needed |
| Hook-level persist effect | `localStorage` for the session record | Rejected by requirement: FILE-03 says IndexedDB explicitly. (Sync localStorage would also be viable for a ~100-byte record, but the lock stands; the app already splits: settings→localStorage, content→IndexedDB) |
| App-level persist effect | Dexie or other ORM | Dexie (migrations, liveQuery) is overkill for one fixed-key record; idb is already installed and proven in Phase 3 |

**Installation:**
```bash
npm install --save-dev fake-indexeddb@^6.2.5
```

**Version verification performed 2026-08-01:**
```bash
npm view idb version            # → 8.0.3 (installed ^8.0.3 ✓, no bump needed)
npm view fake-indexeddb version # → 6.2.5
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| idb | npm | ~14 yrs lineage (v8.0.3 published 2025-05) | 22.8M/wk | github.com/jakearchibald/idb | OK | Approved (already installed) |
| fake-indexeddb | npm | ~9 yrs lineage (v6.2.5 published 2025-11) | 5.0M/wk | github.com/dumbmatter/fakeIndexedDB | OK | Approved as devDependency |

`gsd-tools query package-legitimacy check --ecosystem npm fake-indexeddb idb` → both `OK`, no postinstall scripts, not deprecated. No packages discovered from non-authoritative sources this phase.

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious SUS:** none

## Architecture Patterns

### System Architecture Diagram

```
Relaunch (fresh page load)
        │
        ▼
┌─────────────────┐   loadSession()    ┌──────────────────────┐
│ App.tsx (mount) │ ─────────────────► │ idb: session store   │
│  persist effect │ ◄─ save/clear ──── │ (cinemasyncsubs v2)  │
└───────┬─────────┘                    └──────────────────────┘
        │ validate shape + isSessionExpired(session, now, expiry)
        ├─ expired/invalid ──► clearSession() → byte-identical v1.0 selection page
        └─ valid ──► persistedSession state
                        │
                        ▼
               ┌─────────────────┐   renders when hook session === null
               │  ResumeCard     │   (.session-banner* base, D-07)
               │ title + elapsed │
               │ [Resume] [ × ]  │
               └───────┬─────────┘
              Resume tap│ (gesture chain: enableWakeLock() FIRST, synchronously)
                        ▼
        cue lookup: getSubtitle(subtitleId)
             │ miss → getAllFromIndex('subtitles','by-fileName')
             │        │ miss → clearSession(), card disappears (soft-link dead)
             ▼ hit
   usePlaybackEngine.restoreSession(cues, session):
     engine.setCues(cues)        ← imperative, NOT the props effect
     dispatch PLAY / setSession(resumeSession-if-paused)
     engine.play()               ← then re-anchor:
     engine.seekTo(sessionElapsedMs(session, Date.now()))
     setView('playback') + enterPlaybackHistory
                        │
                        ▼
        Steady state: every session transition
        (create/pause/resume/offset/stop) → new object →
        hook effect → saveSession()/clearSession() (immediate write)
```

### Recommended Project Structure (delta only)
```
src/
├── db/
│   ├── database.ts      # MODIFY: CinemaSyncDB gains `session` store; openDB v1 → v2 upgrade ladder
│   ├── subtitles.ts     # unchanged (template)
│   └── sessions.ts      # NEW: loadSession / saveSession / clearSession (+ SESSION_KEY = 'current')
├── playback/
│   └── session.ts       # unchanged; ADD pure expiry predicate here or in sessions.ts — recommend session.ts
│                        #   export function isSessionExpired(session, now, expiryMs): boolean
│   └── sessionStorePolicy   # (optional separate file if planner prefers a persistence-policy module:
│                        #   serialize/validate/isExpired — keeps db module thin; see Open Question Q4)
├── hooks/
│   └── usePlaybackEngine.ts  # MODIFY: persist effect + restoreSession(cues, session)
├── components/
│   └── ResumeCard.tsx        # NEW: banner-based card fed by persistedSession (not hook status)
└── App.tsx                   # MODIFY: mount-load + expiry check, persistedSession state, card mount, restore handler
```

### Pattern 1: DB version ladder (add a store without breaking v1 data)
**What:** Bump `openDB` to version 2; create stores per `oldVersion < N` rungs.
**When to use:** Any schema addition — never overwrite the old `upgrade` body unconditionally.
**Example:**
```typescript
// Source: Context7 /jakearchibald/idb (github.com/jakearchibald/idb _autodocs/configuration.md)
dbPromise = openDB<CinemaSyncDB>('cinemasyncsubs', 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      const subStore = db.createObjectStore('subtitles', { keyPath: 'id' })
      subStore.createIndex('by-fileName', 'fileName')
      subStore.createIndex('by-importedAt', 'importedAt')
    }
    if (oldVersion < 2) {
      // single-record session store: out-of-line key SESSION_KEY ('current'),
      // value = PlaybackSession (all JSON primitives — structured-clone safe)
      db.createObjectStore('session')
    }
  },
})
```

### Pattern 2: Write-on-transition persist effect
**What:** `useEffect(() => { if (session !== null) saveSession(session).catch(warn) }, [session])` inside `usePlaybackEngine` — **write-only on non-null**. Deletes do NOT live in this effect's null branch; they are placed explicitly at the two sites that null the session (`stop()` and the `onEnded` closure) — see Pitfall 11 for why effect-driven deletion breaks relaunch.
**Why it works:** Phase 5's convention — every session transition returns a NEW object — means effect identity-change === a semantic transition. Offset adjustments flow through `updateSessionOffset` → new object → immediate write (FILE-03 "偏移调整即时写入" satisfied structurally). Playing ticks never touch the session object → zero write amplification (no write/second).
**Delete call-sites (exhaustive):** hook `stop()` (`setSession(null)` — covers Dismiss × via `handleStop`, deselect via `handleDeselectMovie`, and new-import replacement via `handleImport` since all route through `stop()` [VERIFIED: src/App.tsx]) and the engine `onEnded` closure (`setSession(null)` on natural exhaustion). Each calls `void clearSession().catch(warn)` adjacent to its `setSession(null)`.
**Anti-correlation:** NEVER persist in `pagehide`/`beforeunload` — async IndexedDB transactions race process kill; the last write may be silently dropped. Write-on-change leaves at most one in-flight micro-transaction (~ms) at kill time.
**Durability note:** single tiny record; default durability is fine. If desired, `db.transaction('session', 'readwrite', { durability: 'strict' })` forces a disk flush before completion — measurable cost on some platforms, so keep `default` unless the device checkpoint shows loss (durability levels: 'default' browser-dependent / 'strict' flush-to-disk / 'relaxed' fastest [CITED: Context7 /jakearchibald/idb _autodocs/types.md]).

### Pattern 3: Gesture-chain-preserving restore
**What:** The resume tap handler calls `enableWakeLock()` synchronously FIRST (iOS user-gesture requirement — existing `handlePlay` convention), then performs the async cue load, then primes the engine imperatively.
**Example (restore-side ordering — the trap is engine.setCues timing):**
```typescript
// Project pattern (App.tsx handlePlay lines 122-138) extended for restore
const handleResumePersisted = useCallback((stored: PlaybackSession) => {
  enableWakeLock()                      // synchronous — in-gesture (iOS)
  restoreCuesFor(stored)                // async idb lookup w/ fileName fallback
    .then((cues) => {
      if (!cues) { void clearStoredSession(); setPersistedSession(null); return }
      // imperative prime — do NOT route through setSubtitle + props effect
      // (engine.setCues via effect commits a render AFTER play() → first ticks
      //  would read stale/empty cues and auto-stop via onEnded)
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {})
      }
      enterPlaybackHistory(window.history)   // D-01 marker, same as handlePlay
      restoreSession(cues, stored)           // hook: setCues→ PLAY → play() → seekTo(elapsed)
      setView('playback')
    })
    .catch((err) => console.warn('Resume failed:', err))
}, [/* deps */])
```
**Ordering shorthand (locked):** `setCues → play() → seekTo(sessionElapsedMs(session, now))`. `play()` before `seekTo` because `play()` re-derives `startTime = performance.now() − pausedElapsed` and would otherwise overwrite the anchor; `seekTo` is explicitly documented "safe on the playing path" [VERIFIED: src/playback/PlaybackEngine.ts lines 149-152].
**Paused persisted session:** `resumeSession(session, Date.now())` re-anchors `startedAt = now − pausedElapsedMs` with zero display jump (tested: session.test.ts "shows exactly the frozen value at the resume instant"), then the same play+seek path resumes PLAYING from the frozen position.

### Pattern 4: Pure expiry predicate (project testing convention)
```typescript
// Keep clock-free per 05-01 pattern: caller injects now (Date.now() at call site)
export function isSessionExpired(session: PlaybackSession, now: number, expiryMs: number): boolean {
  return now - session.startedAt > expiryMs   // strictly greater: exactly-at-threshold still valid
}
```
**Anchor = `startedAt` (session age), evaluated ONLY at app load.** Rationale: expiry exists to auto-abandon stale screenings; a rolling `updatedAt` changes nothing behaviorally (writes only occur on transitions — a paused-5h session is exactly as stale as a playing-5h one) while complicating the record. Check at load, then trust the in-app lifecycle; nothing re-expires a session mid-use.
**Default `SESSION_EXPIRY_MS = 6 * 60 * 60 * 1000` (21_600_000)** — roadmap-mandated default ~6h, exact value finalized at planning (STATE.md blocker).

### Pattern 5: Shape-validated load (mirrors `loadSettings`)
**What:** `loadSession()` returns `PlaybackSession | null`; validates each field's type/`Number.isFinite` before use — IndexedDB is user-editable via devtools and partial writes are possible after abrupt kills; invalid → treat as absent + best-effort `clearSession()`.

### Anti-Patterns to Avoid
- **Driving the card from hook state:** `SessionBanner` returns null when `status === 'idle'` and hook `session === null` after relaunch — a card bound to the hook would never render post-kill. Feed the card from its own `persistedSession` App state.
- **Restore via `setSubtitle` + normal render flow:** the hook's `setCues` prop effect commits one render later; calling `play()` in the same task ticks with stale cues → possible instant `onEnded` auto-stop. Use the imperative `restoreSession(cues, session)` seam.
- **Writing per second:** persisting "to keep elapsed fresh" — the record stores anchors, not positions; position derives from anchors at read time. Ticks must not write.
- **Awaiting the cue lookup before `enableWakeLock()`:** breaks the iOS gesture chain.
- **Hard-FK cue lookup:** `subtitleId` may be a raw fileName (soft-link fallback, documented on `SessionIdentity`) — always try id-key first, then `by-fileName` index, then abandon.
- **Confirmation dialog on dismiss:** D-08 forbids friction; single tap, reversible by simply starting over.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB async API ergonomics | Raw `indexedDB.open` + request events | `idb` (installed) | Already vetted; upgrade ladder + typed schema; raw API invites transaction-lifetime bugs |
| Session math / formatting | New elapsed/resume utilities | `session.ts` + `formatElapsedHMS` (existing, 26 tests) | D-06 single truth source; Phase-6 persistability was a design goal |
| IndexedDB test doubles | Hand-mocked `indexedDB` global | `fake-indexeddb/auto` | Full spec implementation (transactions, indexes, upgradeneeded); hand mocks drift from real semantics |
| Cross-tab session arbitration | BroadcastChannel / locks | Nothing | Single-user cinema PWA; last-writer-wins on key 'current' is acceptable (see Pitfall 7) |
| Expiry scheduler | `setTimeout`/`setInterval` re-checks | Load-time check only | Expiry auto-invalidates at the only moment it can surface (relaunch); in-app re-checks add code but change no behavior |

**Key insight:** this phase's complexity is all in *ordering and boundaries* (gesture chain, engine priming, effect triggers), not in storage mechanics — the storage layer is ~60 lines following an existing module template.

## Common Pitfalls

### Pitfall 1: Persisting on unload instead of on change
**What goes wrong:** Last offset adjustment (or the session itself) missing after a hard kill.
**Why it happens:** `beforeunload`/`pagehide` handlers racing async IndexedDB transactions; iOS may never fire them.
**How to avoid:** Write-on-transition effect (Pattern 2). No unload handlers anywhere in this design.
**Warning signs:** Resume position off by exactly the last adjustment after a kill.

### Pitfall 2: Card bound to hook state never appears
**What goes wrong:** After relaunch, no resume card even though the record exists.
**Why it happens:** Hook session is null and status is 'idle'; `SessionBanner` renders null on both.
**How to avoid:** Separate `persistedSession` App state feeding the card; hide card only when hook session is non-null (mutually exclusive by construction).

### Pitfall 3: Stale-cues restore (auto-stop on resume)
**What goes wrong:** Resume tap lands, then immediately converges back to selection (engine saw zero/old cues → auto-end).
**Why it happens:** `play()` executed before the hook's `setCues` effect committed.
**How to avoid:** Imperative `restoreSession(cues, session)` that calls `engine.setCues(cues)` before `play()`; unit-test the ordering inside the hook method.
**Warning signs:** Banner flashes and disappears; `onEnded` fired on the resume path.

### Pitfall 4: Gesture-chain break on restore
**What goes wrong:** Wake Lock / fullscreen requests rejected on iOS after resume tap.
**Why it happens:** `await`ing the IndexedDB cue lookup before calling `enableWakeLock()`.
**How to avoid:** Call `enableWakeLock()` synchronously first in the tap handler (existing `handlePlay` convention, lines 122-138); fullscreen remains fire-and-forget with silent catch.

### Pitfall 5: Soft-link identity treated as hard FK
**What goes wrong:** Resume fails (or resumes the wrong cues) when the `subtitles` record was deleted/re-imported after the session was stored; users with `fileName`-fallback ids (unsaved subtitle) can never resolve an id-key lookup.
**How to avoid:** Lookup ladder id → by-fileName → abandon-and-clear. When found by fileName, RESUME with those cues (same filename = best-effort same movie under v1 single-session model — documented ambiguity accepted).
**Warning signs:** Resume card present but tap does nothing.

### Pitfall 6: iOS storage eviction assumptions
**What goes wrong:** Expecting IndexedDB to survive indefinitely.
**Facts:** WebKit ITP deletes all script-writable storage (IndexedDB, localStorage) after 7 days of Safari use without site interaction; **home-screen-installed PWAs are exempt** (separate use-counter) [CITED: webkit.org/blog/10218/full-third-party-cookie-blocking-and-more; webkit.org/tracking-prevention]. Chrome Android applies LRU storage eviction only under disk pressure (origin is "best-effort" unless persisted).
**Phase-6 impact:** negligible — the 6h expiry threshold sits far below every eviction horizon; this fact belongs to the backlog's export-to-file item (subtitles store), not to session correctness. Note it; don't engineer for it here.

### Pitfall 7: Concurrent tabs double-writing
**What goes wrong:** Two tabs with the app → last writer wins on key `'current'`; one tab's card state goes stale.
**Why acceptable:** v1 single-movie single-session model; PWA usage is single-tab on a phone. Mitigate for free by re-reading on `visibilitychange`→visible IF cheap (the agent's discretion; not required by FILE-03).

### Pitfall 8: Clock skew between kill and relaunch
**What goes wrong:** User/system clock moved backward (session looks younger) or forward (premature expiry, negative `now − startedAt`).
**How to avoid:** Expiry check uses only the threshold (forward skew → session dropped — fail-safe direction). Backward skew → `sessionElapsedMs` clamped at display by `formatElapsedHMS` (negatives → "0:00:00"); past-end positions converge via `onEnded`. No extra machinery.

### Pitfall 9: Expiry anchoring on writes, not session start
**What goes wrong:** Chooses `updatedAt` anchor → offset tweak at 5h59m "refreshes" a dead screening's session.
**How to avoid:** Anchor on `startedAt`; check at load only (Pattern 4).

### Pitfall 10: Upgrade migration clobbering v1 subtitles
**What goes wrong:** Rewriting `upgrade` for v2 without the ladder creates duplicate `createObjectStore('subtitles')` → `ConstraintError` on fresh… actually guarded both ways; the real failure is replacing rather than laddering.
**How to avoid:** Exactly the `oldVersion < N` ladder from the cited idb docs; never `if (oldVersion === 1)` only.
**Warning signs:** Existing users lose saved subtitles after deploy (would be caught by the Wave-0 upgrade test with fake-indexeddb).

### Pitfall 11: Boot delete-before-hydrate race wipes the record at relaunch
**What goes wrong:** If the persist effect carries a null-branch (`session === null → clearSession()`), relaunch shows NO resume card, ever. React flushes effects in hook-call order: the hook's persist effect (registered during `usePlaybackEngine`, called early in App's render) runs **before** App's boot `loadSession()` effect, so the delete is issued first; on the shared (memoized) DB connection, requests queue FIFO — the clear commits before the boot read resolves, and the read returns undefined.
**Why it happens:** "Null means delete" conflates boot state (`session` is null until the async read lands) with abandon semantics (null AFTER an explicit stop). The two are indistinguishable to a bare effect.
**How to avoid (Pattern 2 as amended):** the effect is write-only on non-null session; record deletion is placed explicitly at the two code sites that null the session (`stop()`, `onEnded`). All user-level abandon paths (Dismiss, deselect, new import, natural exhaustion) already route through those two. Alternative if the planner insists on effect-driven delete: gate it behind a `hydratedRef` that the boot load flips true on resolve — strictly more shared state for the same outcome.
**Warning signs:** Criterion-2 UAT fails deterministically ("kill app → relaunch → no card") despite a valid record having existed pre-kill.

## Code Examples

Verified patterns from official sources and this codebase:

### DB layer module (template = existing `subtitles.ts` style)
```typescript
// Source: src/db/subtitles.ts (project convention — try/catch wrapped errors, async singleton getDB)
const SESSION_KEY = 'current' as const

export async function loadSession(): Promise<PlaybackSession | null> {
  try {
    const db = await getDB()
    const raw = await db.get('session', SESSION_KEY)
    return isValidSession(raw) ? raw : null     // Pattern 5: validate shape
  } catch (err) {
    console.warn('Failed to load session:', err)
    return null                                  // persistence failure ≠ app failure
  }
}

export async function saveSession(session: PlaybackSession): Promise<void> {
  try {
    const db = await getDB()
    await db.put('session', session, SESSION_KEY)
  } catch (err) {
    console.warn('Failed to save session:', err) // never throw into the playback path
  }
}

export async function clearSessionRecord(): Promise<void> {
  try {
    const db = await getDB()
    await db.delete('session', SESSION_KEY)
  } catch (err) {
    console.warn('Failed to clear session:', err)
  }
}
```
(Note: project `subtitles.ts` rethrows wrapped errors; for the session store, swallow-to-warn is deliberate — playback must never crash on persistence failure. Planner to keep one convention consciously; recommend swallow-warn here, documented.)

### Persist effect (inside `usePlaybackEngine`, co-located with session state)
```typescript
// Source: project hook pattern (useEffect on identity/cues props) + Pattern 2
useEffect(() => {
  if (session === null) {
    void clearSessionRecord()
  } else {
    void saveSession(session)
  }
}, [session])
```
Covers: create on play, freeze on pause, re-anchor on resume, **offset adjust** (the `offsetMs` prop effect already calls `setSession(updateSessionOffset(...))` → this effect fires), clear on stop/onEnded/`handleImport` — FILE-03 criteria 1 & 4 with zero new call sites.

### Restore engine prime (hook method)
```typescript
// Source: PlaybackEngine.seekTo JSDoc (offset-inclusive position space) + resyncToSession precedent
const restoreSession = useCallback((cues: Cue[], persisted: PlaybackSession) => {
  const engine = engineRef.current
  if (!engine) return
  const now = Date.now()
  const live = resumeSession(persisted, now)          // unfreeze if paused (no-jump, tested shape)
  engine.setCues(cues)                                 // imperative — Pitfall 3
  dispatch({ type: 'PLAY' })
  engine.play()
  engine.seekTo(sessionElapsedMs(live, now))           // offset-INCLUSIVE space (seekTo contract)
  setSession(live)
}, [])
```

### DB-layer unit test with fake-indexeddb
```typescript
// Source: vitest + fake-indexeddb convention (auto-registers globals under node env)
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'

beforeEach(() => { indexedDB = new IDBFactory() })     // fresh DB per test

it('v1→v2 upgrade preserves subtitles and adds session store', async () => {
  // open v1 with the OLD upgrade body, write a subtitle, close,
  // re-open v2 with the laddered upgrade, assert subtitle intact + 'session' in objectStoreNames
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WebKit 7-day cap applied to home-screen web apps' storage | Home-screen web app first-party domain explicitly exempt from ITP eviction | WebKit policy (documented at webkit.org/tracking-prevention) | Installed-PWA sessions/subtitles not subject to the 7-day wipe; browser-tab Safari still is |
| IndexedDB commit durability implicit/unspecified | `IDBTransactionOptions.durability` ('default'\|'strict'\|'relaxed') exposed; idb supports a third `transaction()` options arg | Chrome 83+/spec; idb v7+ | Optional strict-flush for the kill-durability margin; default is fine for a single small record |

**Deprecated/outdated:**
- `beforeunload`/`pagehide` persistence: never reliable on mobile; write-on-change is the modern pattern (state this phase's effect design on it).
- localStorage for structured app records: two-machine sync-API jank + the project already standardized on IndexedDB for content (FILE-01) with localStorage reserved for tiny settings.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `db.get('session', key)`/`put('session', v, key)` out-of-line-key usage requires no keyPath — standard IndexedDB, matches idb docs' keyval-style stores | Storage shape | Trivial —唯一 alternative is keyPath+fixed id; same effort |
| A2 | Chrome transient activation (~5s) still covers `requestFullscreen` fired after a sub-second IndexedDB read in the same tap chain | Pattern 3 | Fullscreen silently skipped (existing catch); user loses only auto-fullscreen on restore — graceful |
| A3 | fake-indexeddb v6 works with idb v8 under Vitest node env with zero config beyond `/auto` import | Validation Architecture | Low — both are mainstream and commonly paired; Wave-0 test run confirms immediately |
| A4 | Chrome Android "best-effort" storage eviction under disk pressure can include non-persisted origins | Pitfall 6 | One-line note; no behavior change (6h expiry dominates) |
| A5 | `resumePlaying`/`sessionElapsed`/`dismissSession` copy is acceptable verbatim on the card (no distinct wording needed) | Design Approach | New i18n keys added later — additive only |

**No LOW-confidence claims affect architecture.** All library behavior claims are Context7/npm-verified; all WebKit behavior claims are webkit.org-cited.

## Open Questions

1. **Exact expiry threshold** (roadmap says finalize during planning; default 6h)
   - What we know: default ~6h mandated; anchor + load-time check recommended here.
   - What's unclear: the final constant (6h exactly? 8h?).
   - Recommendation: ship `SESSION_EXPIRY_MS = 6 * 3_600_000` as a single exported constant so planning can tune it in one line; unit tests cover boundary at exactly-at-threshold.

2. **ResumeCard: sibling component vs. SessionBanner extension**
   - What we know: D-07 demands same position/base; banner is hook-coupled and nulls on idle.
   - What's unclear: whether planner extracts shared presentational markup or duplicates the small JSX.
   - Recommendation: sibling `ResumeCard.tsx` reusing `.session-banner*` classes and i18n keys — lowest coupling, preserves the Phase-5-tested banner untouched.

3. **Paused persisted session: resume playing vs. resume paused**
   - What we know: `resumeSession` unfreeze is no-jump and tested; engine play+seek handles both.
   - What's unclear: whether "一键续播" from a paused-at-kill session should land playing or paused.
   - Recommendation: land PLAYING (cinema context: relaunch intent is to continue watching); the user can pause immediately. Planner/discuss may override.

4. **Persist-effect placement: inside the hook vs. App-level**
   - Recommendation: inside `usePlaybackEngine` (co-located with the state it mirrors; App stays orchestration-only) — **with the Pitfall-11 amendment**: the effect must not delete on null (deletes are explicit at `stop()`/`onEnded` sites), or the boot hydration race makes relaunch-card criterion 2 fail deterministically. File placement of `isSessionExpired`/`isValidSession`: `src/playback/session.ts` keeps purity tests co-located with 26 existing session tests.

5. **On restore, push `session.offsetMs` into settings?**
   - What we know: settings.offsetMs (localStorage) and session.offsetMs share one write path in-app, so they cannot diverge today; but the hook's offset effect would overwrite the engine from settings post-restore.
   - Recommendation: on restore, `updateSettings({ offsetMs: session.offsetMs })` to guarantee four-way agreement (engine/session/banner/controls). One line, kills the divergence class.

6. **Re-read persisted session on `visibilitychange` → visible (multi-tab hygiene)?**
   - Recommendation: skip unless planner wants it — out of FILE-03 scope; note in plan risks.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vitest / build | ✓ | 20.20.2 | — |
| npm | dependency install | ✓ | 10.8.2 | — |
| idb (installed) | persistence layer | ✓ | 8.0.3 (latest) | — |
| fake-indexeddb | unit tests | ✓ registry | 6.2.5 (latest) | hand-rolled mock (worse) |
| Vitest | tests | ✓ | 4.1.10 | — |
| Real browser / Android PWA device | kill-and-relaunch UAT | ✗ (not in this environment) | — | `checkpoint:human-verify` task (05-UAT precedent: 3 device-blocked items documented) |

**Missing dependencies with no fallback:** none blocking planning or CI tests.
**Missing dependencies with fallback:** physical Android/iOS device → human checkpoint task at execution (established project pattern).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`npm test` → `vitest run`) |
| Config file | `vitest.config.ts` — `include: ['test/**/*.test.ts']`, `environment: 'node'` (no change needed) |
| Quick run command | `npx vitest run test/unit/session.test.ts test/unit/sessions.test.ts` |
| Full suite command | `npm test` (currently 7 files / 87 tests, all green) + `npm run build` (tsc -b gate) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| FILE-03 #1 | Every session transition (create/pause/resume/offset) lands in `session` store immediately | unit (DB layer) | `npx vitest run test/unit/sessions.test.ts` | ❌ Wave 0 |
| FILE-03 #1 | Persist effect fires exactly on identity change of the session object | unit (policy-level: sequence of save/clear calls against fake-idb) | same file — drive via direct function calls simulating the effect body; the 3-line effect itself is wiring (manual verify) | ❌ Wave 0 |
| FILE-03 #2 | Valid persisted session → card data correct (title + `formatElapsedHMS(sessionElapsedMs)`) | unit (pure selector) | `npx vitest run test/unit/session.test.ts` (extend existing) | exists (extend) |
| FILE-03 #2 | Kill→relaunch→card renders→one-tap resume lands at wall-clock position | manual_procedural | human device checkpoint (kill app, relaunch, compare banner vs wall clock) | n/a — UAT |
| FILE-03 #3 | `isSessionExpired` boundary: age == threshold valid; age > threshold invalid; expired → record cleared on load | unit (injected-now) | `npx vitest run test/unit/session.test.ts` | exists (extend) |
| FILE-03 #3 | Dismiss × deletes record; relaunch shows no card | unit (clear semantics) + manual | `test/unit/sessions.test.ts` + device checkpoint | ❌ Wave 0 |
| FILE-03 #4 | stop→clear→create→save sequence: loading new subtitle replaces stored session | unit (store-level sequence) | `test/unit/sessions.test.ts` | ❌ Wave 0 |
| FILE-03 (infra) | v1→v2 upgrade preserves existing `subtitles` rows, adds `session` store | unit (fake-idb reopen at both versions) | `test/unit/sessions.test.ts` | ❌ Wave 0 |
| FILE-03 (restore) | `restoreSession` ordering: setCues before play; seekTo receives offset-inclusive elapsed; paused persisted resumes no-jump | unit with real PlaybackEngine + fake rAF — follows `test/unit/playbackEngine.test.ts` precedent (engine is framework-agnostic, no DOM needed) | `npx vitest run test/unit/playbackEngine.test.ts` (extend) | exists (extend) |

### Sampling Rate
- **Per task commit:** `npx vitest run test/unit/session.test.ts test/unit/sessions.test.ts test/unit/playbackEngine.test.ts`
- **Per wave merge:** `npm test && npm run build`
- **Phase gate:** Full suite green + build green before `/gsd-verify-work`; human device checkpoint for kill/relaunch UX.

### Wave 0 Gaps
- [ ] `test/unit/sessions.test.ts` — store CRUD, upgrade ladder, expiry-clear-on-load, replacement sequence, **Pitfall-11 regression: a null-session mount must NOT clear a seeded record** (FILE-03 #1/#3/#4)
- [ ] Extend `test/unit/session.test.ts` — `isSessionExpired` boundaries, `isValidSession` rejection table (FILE-03 #3)
- [ ] Extend `test/unit/playbackEngine.test.ts` — restore ordering contract (play→seekTo sequence observable via injected callbacks)
- [ ] `npm install --save-dev fake-indexeddb@^6.2.5` — Wave 0 install (legitimacy: OK)
- [ ] Manual UAT script entry (05-UAT format): kill/refresh → card → resume position agreement; dismiss → relaunch no card; stale session (devtools-edited `startedAt`) → no card

*(Component render tests for ResumeCard would need a DOM env — the project has no component-test setup and Phase 5 shipped UI with manual verification; follow that precedent: unit-test the data/predicates, checkpoint the rendering.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (local-only app, no accounts) |
| V3 Session Management | no | — ("session" here is a playback session, not an auth session) |
| V4 Access Control | no | — (single-user local data) |
| V5 Input Validation | yes | Validate the persisted record on load (`isValidSession`: typeof + finite-number checks per field; invalid → null + clear) — IndexedDB content is user-tamperable input, mirror the `loadSettings` validation pattern |
| V6 Cryptography | no | — (no secrets stored) |

### Known Threat Patterns for {React PWA + IndexedDB}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered `session` record (devtools edit) → absurd `startedAt`/offset | Tampering | Shape validation on load + expiry threshold as fail-safe + `formatElapsedHMS` negative clamp + engine `onEnded` natural convergence past cue end |
| GIGO crash from partial/corrupt write after abrupt kill | Tampering / DoS (self) | `loadSession` swallows to `null` (fail-closed); persistence errors warn-logged, never crash playback |
| No injection surface | — | Record contains only numbers/strings rendered via React text nodes (no `dangerouslySetInnerHTML` anywhere in project) |

## Sources

### Primary (HIGH confidence)
- Context7 `/jakearchibald/idb` — upgrade-ladder shape, `oldVersion` semantics, `IDBTransactionOptions.durability`, put/get/delete API
- npm registry via `gsd-tools query package-legitimacy check` — idb 8.0.3, fake-indexeddb 6.2.5 (verdict OK both)
- Codebase ground truth — `src/playback/session.ts`, `src/db/database.ts`, `src/db/subtitles.ts`, `src/hooks/usePlaybackEngine.ts`, `src/App.tsx`, `src/components/SessionBanner.tsx`, `test/unit/session.test.ts`, `vitest.config.ts` (all read this session)
- `.planning/phases/05-lossless-playback-navigation/05-CONTEXT.md` (D-07/D-08), `05-01/05-04-SUMMARY.md`, `05-PATTERNS.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`

### Secondary (MEDIUM confidence)
- https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more — 7-day script-writable storage deletion; home-screen apps keep a separate use-counter
- https://webkit.org/tracking-prevention — "Home Screen Web Application Domain Exempt From ITP", storage forms list

### Tertiary (LOW confidence)
- Chrome transient-activation window covering async-post-tap fullscreen (A2); Chrome best-effort storage eviction nuance (A4) — both graceful-failure assumptions, flagged in Assumptions Log

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — registry + legitimacy seam verified; idb already proven in production code since Phase 3
- Architecture: HIGH — restore/persist/expiry all rest on verified codebase facts + cited idb patterns; only UX-level choices remain open (Open Questions)
- Pitfalls: HIGH for code-level pitfalls (traceable to actual lines); MEDIUM for platform-eviction edges (cited but not locally reproducible)

**Research date:** 2026-08-01
**Valid until:** 2026-08-31 (stable deps; re-verify fake-indexeddb/idb versions at planning)
