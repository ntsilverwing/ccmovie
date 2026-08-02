---
phase: 06-session-persistence-resume
plan: 01
subsystem: database
tags: [indexeddb, idb, fake-indexeddb, session-persistence, vitest, tdd]

# Dependency graph
requires:
  - phase: 05-lossless-playback-navigation
    provides: pure clock-free PlaybackSession module (session.ts), wall-clock anchors (PLAY-08)
provides:
  - SESSION_EXPIRY_MS + isSessionExpired(session, now, expiryMs) pure expiry policy
  - isValidSession(raw) shape-validation predicate (reject matrix, never throws)
  - cinemasyncsubs v2 schema with oldVersion-guarded upgrade ladder (subtitles preserved)
  - src/db/sessions.ts single-record CRUD (SESSION_KEY = 'current', swallow-warn, never throws)
  - fake-indexeddb devDependency + per-test IDBFactory/resetModules isolation harness
affects: [06-02 hook resume path, 06-03 resume card UX]

# Tech tracking
tech-stack:
  added: [fake-indexeddb@6.2.5 (devDependency)]
  patterns:
    - "IndexedDB oldVersion < N upgrade ladder (never recreate v1 stores outside the < 1 rung)"
    - "swallow-warn never-throw DAL for playback-critical persistence (vs subtitles.ts rethrow)"
    - "fake-indexeddb + vi.resetModules per-test isolation of memoized dbPromise singleton"

key-files:
  created:
    - src/db/sessions.ts
    - test/unit/sessions.test.ts
  modified:
    - src/playback/session.ts
    - src/db/database.ts
    - test/unit/session.test.ts
    - package.json
    - package-lock.json

key-decisions:
  - "SESSION_EXPIRY_MS locked at 6 * 3_600_000 (6h) anchored on startedAt, strictly-greater comparison — resolves STATE blocker 'expiry threshold finalized (~6h)'"
  - "sessions.ts adopts swallow-warn never-throw policy (conscious deviation from subtitles.ts rethrow): persistence failure must never crash playback"
  - "Empty-store reads issue no write/delete (boot-hydration invariant); only structurally-invalid records trigger the unawaited best-effort clear"

patterns-established:
  - "oldVersion < N ladder: guarded schema evolution preserving v1 rows; tested via seeded-v1 fake-indexeddb reopen"
  - "Reject-never-clamp validation on untrusted IndexedDB reads (loadSettings spirit), clear-on-invalid best-effort"
  - "IDBFactory() + vi.resetModules() in beforeEach + dynamic module re-import per test (memoized-singleton isolation)"

requirements-completed: [FILE-03]

coverage:
  - id: D1
    description: "isSessionExpired strictly-greater boundaries: at-threshold valid, +1ms expired, negative-age (clock skew) never expired; SESSION_EXPIRY_MS = 21_600_000"
    requirement: FILE-03
    verification:
      - kind: unit
        ref: "test/unit/session.test.ts#isSessionExpired boundary describes"
        status: pass
    human_judgment: false
  - id: D2
    description: "isValidSession accepts both well-formed variants and rejects the 9-case malformed matrix (missing/wrong-typed/non-finite fields, null/undefined/string input) without throwing"
    requirement: FILE-03
    verification:
      - kind: unit
        ref: "test/unit/session.test.ts#isValidSession accept + it.each reject matrix"
        status: pass
    human_judgment: false
  - id: D3
    description: "cinemasyncsubs v1→v2 upgrade: seeded v1 subtitle row survives reopen at v2 and the 'session' object store is created (oldVersion < 1 / < 2 ladder)"
    requirement: FILE-03
    verification:
      - kind: integration
        ref: "test/unit/sessions.test.ts#cinemasyncsubs v1→v2 upgrade (oldVersion ladder)"
        status: pass
    human_judgment: false
  - id: D4
    description: "sessions.ts CRUD: verbatim PlaybackSession round-trip (null + numeric pausedElapsedMs), replacement semantics on second save, clearSessionRecord removes the record"
    requirement: FILE-03
    verification:
      - kind: integration
        ref: "test/unit/sessions.test.ts#session store CRUD"
        status: pass
    human_judgment: false
  - id: D5
    description: "Corrupt-record handling: malformed record loads as null (never throws) and is cleared best-effort; empty store loads as null with zero delete calls (IDBObjectStore.prototype.delete spy)"
    requirement: FILE-03
    verification:
      - kind: integration
        ref: "test/unit/sessions.test.ts#corrupt-record handling"
        status: pass
    human_judgment: false

# Metrics
duration: 3h 28m
completed: 2026-08-01
status: complete
---

# Phase 06 Plan 01: Persistence Core Summary

**Pure clock-free session expiry/validation predicates plus a v1→v2 IndexedDB upgrade ladder and a never-throwing single-record session store — the durability primitives every later Phase-6 plan builds on (FILE-03).**

## Performance

- **Duration:** 3h 28m
- **Started:** 2026-08-01T18:49:50Z
- **Completed:** 2026-08-01T22:18:16Z
- **Tasks:** 2 (both TDD: RED → GREEN each)
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- `session.ts` stays clock-free while gaining `SESSION_EXPIRY_MS = 6 * 3_600_000`, `isSessionExpired` (strictly-greater; at-threshold valid; clock-skew safe), and `isValidSession` (9-case reject matrix, total, never throws) — comment-stripped clock-read gate = 0
- `database.ts` upgraded `cinemasyncsubs` to version 2 with an `oldVersion < 1` / `oldVersion < 2` ladder — a seeded v1 subtitle row provably survives the upgrade and gains the `session` store (fake-indexeddb-tested)
- `src/db/sessions.ts` provides `SESSION_KEY = 'current'` + load/save/clear with replacement semantics, clear-on-invalid (unawaited, fire-safe), empty-store no-mutation invariant, and a swallow-warn never-throw policy (0 throw paths outside comments)
- Test surface grew from 87 → 109 tests (7 → 8 files), all green; `npm run build` (tsc -b + vite) clean

## Task Commits

Each task was committed atomically (TDD: RED test commit → GREEN feat commit):

1. **Wave 0: install fake-indexeddb@^6.2.5** — `2a68be3` (chore)
2. **Task 1 RED: failing session predicate tests** — `ed6bb7b` (test)
3. **Task 1 GREEN: session expiry + validation predicates** — `07fc237` (feat)
4. **Task 2 RED: failing sessions store/upgrade tests** — `844f3d7` (test)
5. **Task 2 GREEN: v2 schema ladder + sessions.ts CRUD** — `2551b7d` (feat)

## Files Created/Modified
- `src/playback/session.ts` — added SESSION_EXPIRY_MS, isSessionExpired, isValidSession (36 added lines, purity contract untouched)
- `src/db/database.ts` — `session` store in CinemaSyncDB schema; openDB v2 with guarded upgrade ladder
- `src/db/sessions.ts` — new: SESSION_KEY, loadSession, saveSession, clearSessionRecord (swallow-warn)
- `test/unit/session.test.ts` — 15 new cases (expiry boundaries, accept + reject matrix)
- `test/unit/sessions.test.ts` — new: 7 fake-indexeddb cases (upgrade preservation, CRUD, corrupt, empty-store)
- `package.json` / `package-lock.json` — fake-indexeddb 6.2.5 devDependency

## Decisions Made
- **SESSION_EXPIRY_MS = 6h anchored on `startedAt`, load-time check only** — RESEARCH Open Question 1 resolution: covers any theatrical screening + previews with margin; a rolling `updatedAt` anchor would add record complexity with zero behavioral change (writes only occur on transitions). Resolves the STATE.md blocker.
- **`sessions.ts` swallow-warn vs `subtitles.ts` rethrow** — RESEARCH-locked conscious split: the playback path must never crash on persistence failure; subtitle management is user-initiated and surfaces errors. Documented in module JSDoc.
- **Empty-store no-mutation invariant** — `loadSession` returns null on `undefined` raw before any delete branch; initial-mount empty state must stay mutation-free (06-03 boot-flow wiring depends on this).

## Deviations from Plan

None - plan executed exactly as written. All reads honored `read_first`; both TDD cycles followed RED → GREEN with no refactor pass needed (implementations matched the pattern-map excerpts verbatim).

## TDD Gate Compliance

| Task | RED commit | GREEN commit | REFACTOR |
|------|-----------|--------------|----------|
| Task 1 (session predicates) | `ed6bb7b` test | `07fc237` feat | not needed |
| Task 2 (session store) | `844f3d7` test | `2551b7d` feat | not needed |

RED suites failed for the right reasons (missing exports / missing module); GREEN passes all 109 tests; sequence verified in git log.

## Issues Encountered
- `npm audit` reports 1 high-severity advisory in `brace-expansion@2.1.2` — pre-existing, introduced via `vite-plugin-pwa → workbox-build → ejs/jake`, NOT by fake-indexeddb (which has zero runtime dependencies). Out of scope per deviation rules; logged to `deferred-items.md`.
- None blocking: both suites went green on the first post-implementation run.

## User Setup Required

None - no external service configuration required.

## Verification Results

| Command | Result |
|---------|--------|
| `npx vitest run test/unit/session.test.ts test/unit/sessions.test.ts` | PASS (48 tests) |
| `npx vitest run ... test/unit/playbackEngine.test.ts` (sampling incl. untouched engine) | PASS (63 tests) |
| `npm test` (full suite, 8 files) | PASS (109 tests) |
| `npm run build` (tsc -b + vite build) | PASS (clean, sw.js precache generated) |
| Comment-stripped clock gate (`Date./performance.` outside comments in session.ts) | PASS (count = 0) |
| Throw-path gate (sessions.ts, comments stripped) | PASS (count = 0) |

## Next Phase Readiness
- **06-02 (hook resume path)** unblocked: `loadSession`/`saveSession`/`clearSessionRecord` primitives + `isValidSession` guard are in place for the persist effect and `restoreSession(cues, persisted)`
- **06-03 (resume card)** unblocked: expiry predicate + `SESSION_EXPIRY_MS` give the boot effect its accept/reject policy; empty-store/clear-on-invalid semantics are already the card's contract
- No blockers.

## Self-Check: PASSED

- Files: src/db/sessions.ts, src/db/database.ts, src/playback/session.ts (FOUND); test/unit/sessions.test.ts, test/unit/session.test.ts (FOUND)
- Commits: 2a68be3, ed6bb7b, 07fc237, 844f3d7, 2551b7d (all FOUND in git log)
- Acceptance criteria: all Task 1 + Task 2 criteria verified PASS above (grep gates, suite counts, clock/throw counts)
- Plan-level verification: `npx vitest run test/unit/session.test.ts test/unit/sessions.test.ts`, `npm test`, `npm run build` all exit 0

---
*Phase: 06-session-persistence-resume*
*Completed: 2026-08-01*
