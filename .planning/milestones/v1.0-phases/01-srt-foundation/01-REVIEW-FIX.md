---
phase: 01-srt-foundation
fixed_at: 2026-07-28T12:30:00Z
review_path: .planning/phases/01-srt-foundation/01-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-07-28T12:30:00Z
**Source review:** .planning/phases/01-srt-foundation/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Unhandled promise rejection in wake lock calls

**Files modified:** `src/App.tsx`
**Commit:** b4539a7
**Applied fix:** Added `.catch()` to `enableWakeLock()` call in `handlePlay`. Note: `disableWakeLock()` returns `void` (not a Promise) per the `@zakj/no-sleep` type definitions, so `.catch()` was only applied to `enableWakeLock()` which is an async function returning `Promise<void>`.

### CR-02: TextDecoder throws on unsupported chardet-detected encoding

**Files modified:** `src/imports/encoding.ts`
**Commit:** c3b02f3
**Applied fix:** Wrapped `new TextDecoder(encoding)` in a try/catch block with fallback chain: first tries `windows-1252` (superset of Latin-1), then falls back to `utf-8` with replacement characters. This prevents `RangeError` crashes when chardet detects encodings like `ISO-8859-1` that TextDecoder doesn't support.

### WR-01: IndexedDB ID collision using filename + file size

**Files modified:** `src/imports/fileImport.ts`, `src/db/database.ts`
**Commit:** 0ccab79
**Applied fix:** Added `file.lastModified` to the IndexedDB ID format, changing from `${file.name}-${file.size}` to `${file.name}-${file.size}-${file.lastModified}`. Updated comments in `database.ts` to reflect the new format. This prevents silent overwrites when two different files have the same name and byte size.

### WR-02: ParseError.line always reports 0 — useless for locating errors

**Files modified:** `src/imports/srtParser.ts`
**Commit:** d3bd394
**Applied fix:** Pre-computed line numbers for each block by tracking newline positions in the original string. Each block now carries its `startLine` which is used in all `ParseError` entries instead of the hardcoded `0`. This enables users to locate problematic blocks in their SRT files.

### WR-03: Duplicate saved movies markup in App.tsx and CuePreview.tsx

**Files modified:** `src/components/SavedMoviesList.tsx` (new), `src/App.tsx`, `src/components/CuePreview.tsx`
**Commit:** 079f470
**Applied fix:** Extracted a shared `SavedMoviesList` component with configurable `title` and optional `onDelete` prop. App.tsx uses it with `title="Continue with saved movie"` and `onDelete={handleDeleteSubtitle}`. CuePreview.tsx uses it with `title="Saved Movies"` and no delete button. This eliminates markup duplication and ensures consistent styling/behavior.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-07-28T12:30:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
