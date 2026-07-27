---
phase: 03-cinema-readiness
plan: 01
subsystem: persistence
tags: [indexeddb, idb, persistence, crud, hydration]

requires:
  - phase: 01-srt-foundation
    provides: Cue/ParsedSubtitle types, importSRT orchestrator
  - phase: 02-playback-display
    provides: App.tsx with playback/import/ready views, CuePreview component

provides:
  - idb-based database module with typed CinemaSyncDB schema
  - StoredSubtitle CRUD operations (save, get, getAll, delete)
  - Import flow persistence (auto-save after parse)
  - App load hydration from IndexedDB
  - Saved movies UI with select and delete

affects: [03-cinema-readiness plan 02, phase-04-accessibility]

tech-stack:
  added: [idb 8.0.3]
  patterns: [typed DBSchema, singleton getDB, fire-and-forget persistence, useEffect hydration]

key-files:
  created:
    - src/db/database.ts
    - src/db/subtitles.ts
  modified:
    - package.json
    - src/imports/fileImport.ts
    - src/App.tsx
    - src/components/CuePreview.tsx
    - src/index.css

key-decisions:
  - "Deterministic id (${fileName}-${fileSize}) for deduplication — re-importing same file overwrites"
  - "Fire-and-forget save in importSRT — persistence is a side effect, not blocking the import UI"
  - "No settings store in IndexedDB — settings remain in localStorage (Phase 2 decision)"

patterns-established:
  - "Typed DBSchema with idb: CinemaSyncDB interface extending DBSchema for compile-time safety"
  - "Singleton getDB(): memoized openDB promise for connection reuse"
  - "useEffect hydration: load from IndexedDB on mount, refresh after mutations"

requirements-completed: [FILE-01]

coverage:
  - id: D1
    description: "idb database layer with typed CinemaSyncDB schema and singleton getDB()"
    requirement: FILE-01
    verification:
      - kind: other
        ref: "src/db/database.ts exports getDB() returning Promise<IDBPDatabase<CinemaSyncDB>>"
        status: pass
    human_judgment: false
  - id: D2
    description: "Four CRUD functions: saveSubtitle, getSubtitle, getAllSubtitles, deleteSubtitle"
    requirement: FILE-01
    verification:
      - kind: other
        ref: "src/db/subtitles.ts exports all four CRUD functions with try/catch error handling"
        status: pass
    human_judgment: false
  - id: D3
    description: "Import flow persistence — parsed subtitles auto-saved to IndexedDB after parse"
    requirement: FILE-01
    verification:
      - kind: other
        ref: "src/imports/fileImport.ts calls saveSubtitle after successful parse (fire-and-forget)"
        status: pass
    human_judgment: true
    rationale: "Verifying persistence across page reloads requires manual browser testing"
  - id: D4
    description: "App load hydration — saved subtitles loaded from IndexedDB on mount"
    requirement: FILE-01
    verification:
      - kind: other
        ref: "src/App.tsx useEffect calls getAllSubtitles() on mount"
        status: pass
    human_judgment: true
    rationale: "Verifying hydration works requires manual browser testing with saved data"
  - id: D5
    description: "Saved movies UI — select for playback, delete from list and IndexedDB"
    requirement: FILE-01
    verification:
      - kind: other
        ref: "src/App.tsx shows saved movies in import view with delete buttons, CuePreview shows in ready view"
        status: pass
    human_judgment: true
    rationale: "Visual verification of saved movie list interaction requires human evaluation"

duration: 6min
completed: 2026-07-27
status: complete
---

# Phase 3 Plan 1: IndexedDB Persistence Layer Summary

**idb-based persistence layer with typed schema, subtitle CRUD, auto-save on import, and app load hydration for returning users**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-27T05:21:37Z
- **Completed:** 2026-07-27T05:28:02Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Installed idb@8.0.3 and created typed CinemaSyncDB schema with subtitles store and two indexes (by-fileName, by-importedAt)
- Implemented four CRUD functions (saveSubtitle, getSubtitle, getAllSubtitles, deleteSubtitle) with descriptive error handling
- Integrated fire-and-forget persistence into importSRT — subtitles saved to IndexedDB immediately after parsing
- Added app load hydration via useEffect — returning users see saved movies without re-importing
- Built saved movies UI in both import view (with delete) and ready view (selectable list with cue count and date)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create idb database layer for subtitle persistence** - `a5ad4a4` (feat)
2. **Task 2: Integrate persistence into import flow and app load hydration** - `6c244bf` (feat)

## Files Created/Modified
- `package.json` - Added idb@8.0.3 dependency
- `src/db/database.ts` - Typed CinemaSyncDB DBSchema with singleton getDB() and StoredSubtitle interface
- `src/db/subtitles.ts` - Four async CRUD functions with try/catch error handling
- `src/imports/fileImport.ts` - Fire-and-forget saveSubtitle call after successful parse
- `src/App.tsx` - savedSubtitles state, useEffect hydration, handleDeleteSubtitle, handleSelectSaved, saved movies UI in import view
- `src/components/CuePreview.tsx` - Optional savedSubtitles prop with selectable list in ready view
- `src/index.css` - Saved movies section styling (dark cinema theme)

## Decisions Made
- Deterministic id (`${fileName}-${fileSize}`) for deduplication — re-importing the same file overwrites the existing record instead of creating duplicates
- Fire-and-forget save in importSRT — persistence is a side effect that doesn't block the import UI or affect the return value
- No settings store in IndexedDB — settings remain in localStorage (Phase 2 decision: synchronous, sufficient for 2 key-values)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- IndexedDB persistence layer complete, ready for Plan 2 (PWA installation, Wake Lock, Service Worker)
- StoredSubtitle CRUD functions are available for any future persistence needs
- Hydration pattern established for returning user experience

## Self-Check: PASSED

- All 6 created/modified files exist on disk
- Both task commits found in git log (a5ad4a4, 6c244bf)
- npx tsc --noEmit passes
- npm run build succeeds
- No dangerouslySetInnerHTML usage anywhere

---
*Phase: 03-cinema-readiness*
*Completed: 2026-07-27*
