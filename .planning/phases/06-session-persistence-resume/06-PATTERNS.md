# Phase 6: Session Persistence & Resume - Pattern Map

**Mapped:** 2026-08-01
**Files analyzed:** 9 (4 new/edit in src, 1 new db module, 1 new component, 3 test files)
**Analogs found:** 8 / 9 (only the fake-indexeddb DB-test harness has no in-repo precedent — excerpt taken from RESEARCH.md)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/db/sessions.ts` (new) | db-store module | CRUD (single-record keyval) | `src/db/subtitles.ts` | exact (role-match; swallow-warn error policy deviation documented in RESEARCH) |
| `src/db/database.ts` (edit) | config / db schema | CRUD (schema + v1→v2 upgrade) | `src/db/database.ts` itself (existing v1 upgrade body) | exact — extend in place via idb `oldVersion` ladder |
| `src/playback/session.ts` (edit — add `isSessionExpired`, `isValidSession`) | utility (pure) | transform (injected-now predicate) | `src/playback/session.ts` itself | exact — co-locate with 26 existing pure tests |
| `src/hooks/usePlaybackEngine.ts` (edit — persist effect + `restoreSession`) | hook | event-driven (effect on state identity) + request-response (imperative prime) | `src/hooks/usePlaybackEngine.ts` itself (`resyncToSession`, offset effect) | exact — extend existing patterns |
| `src/components/ResumeCard.tsx` (new) | component | request-response (props-driven render, 1s tick) | `src/components/SessionBanner.tsx` | exact — D-07 lock mandates same DOM/classes |
| `src/App.tsx` (edit) | controller (orchestration) | event-driven (mount effect, gesture-chain handlers) | `src/App.tsx` itself (mount hydration effect, `handlePlay`, banner mounts) | exact |
| `test/unit/sessions.test.ts` (new) | test | CRUD (fake-indexeddb store tests) | `test/unit/playbackEngine.test.ts` (harness idiom) + RESEARCH.md §"DB-layer unit test" | partial — no existing DB test file; harness style matches, fake-idb setup is new |
| `test/unit/session.test.ts` (edit) | test | transform (pure predicates) | `test/unit/session.test.ts` itself | exact — injected-`T` fixture convention |
| `test/unit/playbackEngine.test.ts` (edit) | test | event-driven (engine ordering contract) | `test/unit/playbackEngine.test.ts` itself (`PlaybackEngine onEnded / seekTo` describe) | exact — fake rAF + fake `performance.now` harness exists |

## Pattern Assignments

### `src/db/sessions.ts` (new — db-store module, single-record CRUD)

**Analog:** `src/db/subtitles.ts` (whole file, 61 lines)

**Imports pattern** (lines 1-2):
```typescript
import { getDB } from './database'
import type { StoredSubtitle } from './database'
```
→ For sessions.ts: `import { getDB } from './database'` + `import type { PlaybackSession } from '../playback/session'`.

**Core CRUD pattern — async function, try/catch, singleton getDB** (lines 11-18, 39-47, 54-60):
```typescript
export async function saveSubtitle(sub: StoredSubtitle): Promise<void> {
  try {
    const db = await getDB()
    await db.put('subtitles', sub)
  } catch (err) {
    throw new Error(`Failed to save subtitle "${sub.fileName}": ${err instanceof Error ? err.message : String(err)}`)
  }
}
```

**Deviation (conscious, RESEARCH-locked):** `subtitles.ts` rethrows wrapped errors; `sessions.ts`
must **swallow-to-warn and never throw** — playback must never crash on persistence failure
(RESEARCH.md lines 332-352). Copy the RESEARCH Pattern "DB layer module" verbatim:
```typescript
// Source: RESEARCH.md lines 320-353 — sessions module, swallow-warn policy
const SESSION_KEY = 'current' as const

export async function loadSession(): Promise<PlaybackSession | null> {
  try {
    const db = await getDB()
    const raw = await db.get('session', SESSION_KEY)
    return isValidSession(raw) ? raw : null
  } catch (err) {
    console.warn('Failed to load session:', err)
    return null
  }
}
export async function saveSession(session: PlaybackSession): Promise<void> {
  try {
    const db = await getDB()
    await db.put('session', session, SESSION_KEY)
  } catch (err) {
    console.warn('Failed to save session:', err)
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

**JSDoc convention:** every exported function carries a `/** ... */` doc block (see lines 4-10, 20-24 of subtitles.ts) — match that density.

---

### `src/db/database.ts` (edit — schema + v1→v2 upgrade ladder)

**Analog:** itself (whole file, 64 lines)

**Current schema declaration** (lines 10-22) — add a `session` store entry:
```typescript
export interface CinemaSyncDB extends DBSchema {
  subtitles: {
    /** subtitle id — deterministic: `${fileName}-${fileSize}` */
    key: string
    value: StoredSubtitle
    indexes: {
      'by-fileName': string
      'by-importedAt': number
    }
  }
}
```

**Current openDB singleton** (lines 44-64) — the `dbPromise` memoization pattern STAYS unchanged;
only the version arg and upgrade body change:
```typescript
let dbPromise: Promise<IDBPDatabase<CinemaSyncDB>> | null = null

export function getDB(): Promise<IDBPDatabase<CinemaSyncDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CinemaSyncDB>('cinemasyncsubs', 1, {
      upgrade(db) {
        const subStore = db.createObjectStore('subtitles', { keyPath: 'id' })
        subStore.createIndex('by-fileName', 'fileName')
        subStore.createIndex('by-importedAt', 'importedAt')
      },
    })
  }
  return dbPromise
}
```

**Replacement pattern (RESEARCH Pattern 1, lines 181-198 — idb `oldVersion < N` ladder):**
```typescript
dbPromise = openDB<CinemaSyncDB>('cinemasyncsubs', 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      const subStore = db.createObjectStore('subtitles', { keyPath: 'id' })
      subStore.createIndex('by-fileName', 'fileName')
      subStore.createIndex('by-importedAt', 'importedAt')
    }
    if (oldVersion < 2) {
      // single-record session store: out-of-line key SESSION_KEY ('current')
      db.createObjectStore('session')
    }
  },
})
```
**Anti-pattern guard (RESEARCH Pitfall 10):** ladder with `oldVersion < N`, never `=== 1` only, never recreate `subtitles` outside the `< 1` rung.

---

### `src/playback/session.ts` (edit — add `isSessionExpired` + `isValidSession`)

**Analog:** itself (whole file, 117 lines)

**Module purity contract** (header comment, lines 12-15) — new functions MUST obey it:
> "This module itself reads NO clock. Every wall-clock value enters via an explicit `now` parameter, keeping the math deterministic under test and the session shape directly persistable. All functions are pure and total (never throw) and allocate fresh objects for session transitions."

**Pure-function pattern with injected `now`** (lines 62-76, 84-90):
```typescript
export function pauseSession(session: PlaybackSession, now: number): PlaybackSession {
  if (session.pausedElapsedMs !== null) return { ...session }
  return { ...session, pausedElapsedMs: now - session.startedAt }
}
```

**New functions to add (RESEARCH Pattern 4, lines 234-241 + Pattern 5):**
```typescript
export function isSessionExpired(session: PlaybackSession, now: number, expiryMs: number): boolean {
  return now - session.startedAt > expiryMs   // strictly greater: exactly-at-threshold still valid
}
```
Plus `isValidSession(raw: unknown): raw is PlaybackSession` — per-field `typeof`/`Number.isFinite` checks
mirroring the field-by-field validation style of `loadSettings` (see Shared Patterns → Validation).
Also add `export const SESSION_EXPIRY_MS = 6 * 3_600_000` (RESEARCH Open Question 1: single exported
constant, one-line tunable at planning).

---

### `src/hooks/usePlaybackEngine.ts` (edit — persist effect + `restoreSession`)

**Analog:** itself (whole file, 216 lines)

**Live-value refs + `useCallback([])` discipline** (lines 124-131) — `restoreSession` follows this idiom:
```typescript
const identityRef = useRef<SessionIdentity | null>(identity)
const sessionRef = useRef<PlaybackSession | null>(session)
const statusRef = useRef<PlaybackStatus>(state.status)
const offsetMsRef = useRef<number>(offsetMs)

// Imperative readers: mirror session and status every render.
sessionRef.current = session
statusRef.current = state.status
```

**Prop-sync effect pattern** (lines 146-150) — the persist effect mirrors this exact shape:
```typescript
useEffect(() => {
  offsetMsRef.current = offsetMs
  engineRef.current?.setOffset(offsetMs)
  setSession((prev) => (prev ? updateSessionOffset(prev, offsetMs) : prev))
}, [offsetMs])
```

**Persist effect to add (RESEARCH Pattern 2 / Code Examples, lines 359-366):**
```typescript
useEffect(() => {
  if (session === null) {
    void clearSessionRecord()
  } else {
    void saveSession(session)
  }
}, [session])
```
(Write-on-transition; every `setSession` site — `play` line 172-187, `pause` line 189-193, `stop`
line 195-199, engine `onEnded` line 161-164, offset effect line 149 — already allocates a fresh
object or null, so effect identity-change === semantic transition. Ticks never touch the session
object → zero write amplification.)

**Imperative engine-prime precedent — `resyncToSession`** (lines 210-213):
```typescript
const resyncToSession = useCallback(() => {
  if (statusRef.current !== 'playing' || sessionRef.current === null) return
  engineRef.current?.seekTo(sessionElapsedMs(sessionRef.current, Date.now()))
}, [])
```

**`restoreSession` to add (RESEARCH "Restore engine prime", lines 372-382):**
```typescript
const restoreSession = useCallback((cues: Cue[], persisted: PlaybackSession) => {
  const engine = engineRef.current
  if (!engine) return
  const now = Date.now()
  const live = resumeSession(persisted, now)   // unfreeze if paused (no-jump, tested)
  engine.setCues(cues)                          // imperative — BEFORE play() (Pitfall 3)
  dispatch({ type: 'PLAY' })
  engine.play()
  engine.seekTo(sessionElapsedMs(live, now))    // offset-INCLUSIVE space (seekTo JSDoc)
  setSession(live)
}, [])
```
Ordering locked: `setCues → play() → seekTo`. `play()` before `seekTo` because `play()` re-derives
`startTime` (PlaybackEngine.ts lines 94-100) and would clobber the anchor; `seekTo` is documented
"Safe on the playing path" (PlaybackEngine.ts lines 145-152).

**Return-tuple update** (line 215): add `restoreSession` to the returned object and its type
annotation (lines 107-114).

---

### `src/components/ResumeCard.tsx` (new — banner-based card)

**Analog:** `src/components/SessionBanner.tsx` (whole file, 69 lines) — D-07 mandates same DOM order,
same `.session-banner*` classes, same i18n keys.

**Imports pattern** (lines 1-5):
```typescript
import { useState, useEffect } from 'react'
import type { PlaybackSession } from '../playback/session'
import { sessionElapsedMs, formatElapsedHMS } from '../playback/session'
import { useLanguage } from '../i18n/LanguageContext'
```
(drop only the `PlaybackStatus` import — the card is fed `persistedSession`, not hook status.)

**Tick pattern (I-7)** (lines 30-37) — arm the 1s interval only while the record is un-paused
(`session.pausedElapsedMs === null`), not on a `status` prop:
```typescript
const [now, setNow] = useState(Date.now())
const { t } = useLanguage()

useEffect(() => {
  if (status !== 'playing') return
  const interval = setInterval(() => setNow(Date.now()), 1000)
  return () => clearInterval(interval)
}, [status])
```

**DOM order FINAL (D-07 lock): text block → resume → dismiss** (lines 43-67) — copy verbatim,
substituting paused-detection from `session.pausedElapsedMs !== null`:
```typescript
return (
  <div className="session-banner">
    <div className="session-banner-text">
      <div className="session-banner-title">{session.fileName}</div>
      <div className="session-banner-meta">
        {status === 'paused' ? t('sessionPausedAt', { time }) : t('sessionElapsed', { time })}
      </div>
    </div>
    <button
      className="session-banner-resume"
      type="button"
      onClick={onResume}
      aria-label={t('resumePlayingAria', { fileName: session.fileName })}
    >
      {t('resumePlaying')}
    </button>
    <button
      className="session-banner-dismiss"
      type="button"
      onClick={onDismiss}
      aria-label={t('dismissSession')}
    >
      ×
    </button>
  </div>
)
```

**Null-render rule (Pitfall 2 / I-6):** the card's guard becomes `if (session === null) return null`
on the **persisted** session — it must NOT consume hook `status` (the hook is null/idle post-relaunch).
Exclusivity is enforced in App by rendering the card only when hook `session === null`.

---

### `src/App.tsx` (edit — persistedSession state, mount load+expiry, card mounts, restore handler)

**Analog:** itself (whole file, 400 lines)

**Mount-hydration effect pattern** (lines 64-71) — the session-load effect copies this shape exactly
(async DB read → `setState` → `.catch(console.warn)`, persistence failure ≠ app failure):
```typescript
useEffect(() => {
  getAllSubtitles()
    .then(setSavedSubtitles)
    .catch((err) => {
      console.warn('Failed to load saved subtitles:', err)
    })
}, [])
```
New version: `loadSession()` → `isValidSession` (inside `loadSession`) →
`isSessionExpired(session, Date.now(), SESSION_EXPIRY_MS)` → expired → `clearSessionRecord()` + leave
`persistedSession` null (byte-identical v1.0 selection page); valid → `setPersistedSession(session)`.

**Gesture-chain pattern — `enableWakeLock()` synchronously FIRST** (lines 122-138) — the resume
handler MUST follow this ordering (RESEARCH Pitfall 4: awaiting the cue lookup before
`enableWakeLock()` breaks the iOS gesture chain):
```typescript
const handlePlay = useCallback(() => {
  enableWakeLock() // synchronous call within gesture chain — satisfies iOS requirement
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {})
  }
  enterPlaybackHistory(window.history)
  resyncToSession()
  play()
  setView('playback')
}, [enableWakeLock, play, resyncToSession])
```
Restore handler per RESEARCH Pattern 3 (lines 211-227): `enableWakeLock()` sync → async cue lookup
(`getSubtitle(subtitleId)` → miss → `getAllFromIndex('subtitles','by-fileName')` fallback →
miss → `clearSessionRecord()` + `setPersistedSession(null)`) → hit → fullscreen fire-and-forget →
`enterPlaybackHistory` → `restoreSession(cues, stored)` → `setView('playback')` →
`updateSettings({ offsetMs: stored.offsetMs })` (RESEARCH Open Question 5: four-way agreement) →
`setPersistedSession(null)`.

**Banner mount points (two selection branches)** (lines 298-303 and 346-351) — `ResumeCard` mounts
immediately alongside/instead, same position above `.saved-movies`, gated on exclusivity:
```typescript
<SessionBanner
  session={session}
  status={playbackState.status}
  onResume={handlePlay}
  onDismiss={handleStop}
/>
```
becomes: render `<ResumeCard>` when `session === null && persistedSession !== null`, else
`<SessionBanner>` as today (I-6 mutual exclusivity by construction).

**Dismiss handler:** mirrors `handleStop`'s no-confirm single-tap (D-08) but lighter:
`clearSessionRecord()` + `setPersistedSession(null)` — no engine/view interaction (engine is idle
post-relaunch).

---

### `test/unit/sessions.test.ts` (new — DB store CRUD + upgrade ladder)

**Analogs:** `test/unit/playbackEngine.test.ts` (vitest idiom: `describe`/`it`/`beforeEach`/`afterEach`,
`vi.stubGlobal`, minimal harness, lines 1-3, 60-94) + RESEARCH.md "DB-layer unit test" (lines 387-398).

**No existing DB test in the repo** — this file introduces the fake-indexeddb setup. From RESEARCH:
```typescript
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'

beforeEach(() => { indexedDB = new IDBFactory() })     // fresh DB per test
```

**Cases to cover (RESEARCH Validation Architecture, lines 483-485):** store CRUD round-trip;
v1→v2 reopen upgrade preserves `subtitles` rows and adds `session` store (Pitfall 10); dismiss-clear;
stop→clear→create→save replacement sequence (FILE-03 #4). **Wave-0 prerequisite:**
`npm install --save-dev fake-indexeddb@^6.2.5`.

---

### `test/unit/session.test.ts` (edit — `isSessionExpired` / `isValidSession` boundaries)

**Analog:** itself (whole file, 163 lines)

**Injected-fixture convention** (lines 11-15) — follow exactly; the comment-stripped clock-read grep
gate (05-01 lock #6) applies to new predicates:
```typescript
// Wall-clock anchor for every fixture — small integer, injected explicitly.
// Never Date.now(), never fake timers: the module under test reads no clock.
const T = 1_000_000

const BASE = { subtitleId: 'sub-42', fileName: 'movie.srt', offsetMs: 0 }
```

**`describe`/`it` block style** (lines 17-35) + **`it.each` table style** (lines 146-162) — the
`isValidSession` rejection table (missing field, wrong type, non-finite number, wrong
`pausedElapsedMs` type) is a natural `it.each`; the `isSessionExpired` boundary tests are plain `it`s:
age `== expiryMs` → valid; age `> expiryMs` by 1 → invalid (strictly-greater contract).

---

### `test/unit/playbackEngine.test.ts` (edit — `restoreSession` ordering contract)

**Analog:** itself, `describe('PlaybackEngine onEnded / seekTo')` block (lines 60-146)

**Fake-rAF + fake-clock harness** (lines 64-94) — reuse verbatim; `restoreSession`-driven engines
tick synchronously under this harness:
```typescript
let fakeNow: number
let rafQueue: Array<(t: number) => void>

function runFrame(): void {
  const pending = rafQueue
  rafQueue = []
  for (const cb of pending) cb(fakeNow)
}

beforeEach(() => {
  fakeNow = 1000
  rafQueue = []
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    rafQueue.push(cb)
    return rafQueue.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(performance, 'now').mockImplementation(() => fakeNow)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
```
**New assertions:** after `restoreSession`-equivalent ordering (`setCues` → `play()` → `seekTo(elapsed)`),
the engine must (a) NOT fire `onEnded` on the resume path (regression for Pitfall 3 stale-cues
auto-stop), (b) surface the cue at the offset-inclusive re-anchored position on the next frame
(observable via the `onCueChange` callback injection — line 98, 107, 113 precedent), (c) resume
playing from the frozen value for a paused persisted record (`resumeSession` no-jump, asserted via
`sessionElapsedMs` in session.test.ts; engine-side assert position lands in expected cue).

---

## Shared Patterns

### Async-DB-read-with-warn-fallback (persistence failure ≠ app failure)
**Source:** `src/App.tsx` lines 64-71 and `src/App.tsx` lines 95-103
**Apply to:** `App.tsx` session-load effect, `App.tsx` cue-rehydration lookup, `src/db/sessions.ts` (all three functions)
```typescript
getAllSubtitles()
  .then(setSavedSubtitles)
  .catch((err) => {
    console.warn('Failed to load saved subtitles:', err)
  })
```

### Gesture-chain wake lock (iOS)
**Source:** `src/App.tsx` lines 120-138 (`handlePlay`)
**Apply to:** `App.tsx` resume handler — `enableWakeLock()` FIRST, synchronously, before any `await`/`.then`.
```typescript
enableWakeLock() // synchronous call within gesture chain — satisfies iOS requirement
if (!document.fullscreenElement) {
  document.documentElement.requestFullscreen?.().catch(() => {
    // Fullscreen not supported or denied — fail silently, playback continues
  })
}
enterPlaybackHistory(window.history)
```

### Field-by-field shape validation on untrusted load
**Source:** `src/hooks/usePersistedSettings.ts` lines 38-62 (`loadSettings`)
**Apply to:** `isValidSession` (in `src/playback/session.ts`), consumed by `loadSession` in `src/db/sessions.ts`
```typescript
const fontSize = typeof parsed.fontSize === 'number'
  ? Math.max(36, Math.min(72, parsed.fontSize))
  : DEFAULT_SETTINGS.fontSize
// ... per-field typeof checks; invalid → fallback, never throw
```
Session version REJECTS (no clamping): any field wrong-typed or non-finite → return null + best-effort clear.

### Injected-`now` pure clock-free testing
**Source:** `test/unit/session.test.ts` lines 11-13
**Apply to:** all new tests for `isSessionExpired`, `isValidSession`, restore elapsed math
```typescript
const T = 1_000_000
// Never Date.now(), never fake timers: the module under test reads no clock.
```

### i18n + DOM/class reuse (D-07 lock)
**Source:** `src/components/SessionBanner.tsx` lines 44-67
**Apply to:** `ResumeCard.tsx` — `.session-banner*` classes byte-identical; keys `resumePlaying`,
`resumePlayingAria`, `sessionElapsed`, `sessionPausedAt`, `dismissSession` already exist in en+zh
(RESEARCH A5); zero new CSS (`src/index.css` unchanged — 06-UI-SPEC Component Inventory).

### Soft-link subtitle identity (never a hard FK)
**Source:** `src/hooks/usePlaybackEngine.ts` lines 73-87 (`SessionIdentity` doc block)
**Apply to:** `App.tsx` cue-rehydration ladder — id-key lookup → `by-fileName` index fallback →
abandon (clear record + remove card silently, I-3)
```typescript
// Phase-6 fallback semantics: ... Phase 6's resume card MUST treat a
// fileName-fallback subtitleId as a SOFT link, not a hard IndexedDB foreign key.
export interface SessionIdentity {
  subtitleId: string
  fileName: string
}
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `test/unit/sessions.test.ts` (fake-indexeddb setup portion) | test | CRUD | No IndexedDB-backed test exists in the repo yet (Phase 3/5 shipped DB code untested at the store layer). Harness *style* matches `playbackEngine.test.ts`; the `import 'fake-indexeddb/auto'` + `new IDBFactory()` per-test reset is new — use RESEARCH.md lines 387-398 verbatim. |

All production-code files have exact in-repo analogs. The only genuinely new test infrastructure is
the fake-indexeddb global setup, which RESEARCH pre-validated (A3: fake-indexeddb v6 + idb v8 + Vitest
node env, zero config beyond the `/auto` import).

## Metadata

**Analog search scope:** `src/db/`, `src/hooks/`, `src/components/`, `src/playback/`, `src/App.tsx`, `test/unit/`, `vitest.config.ts`
**Files scanned:** 12 (`database.ts`, `subtitles.ts`, `session.ts`, `PlaybackEngine.ts`, `usePlaybackEngine.ts`, `usePersistedSettings.ts`, `SessionBanner.tsx`, `App.tsx`, `session.test.ts`, `playbackEngine.test.ts`, plus dir listings of `src/components`, `src/hooks`, `test/unit`)
**Pattern extraction date:** 2026-08-01
