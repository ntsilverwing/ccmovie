---
phase: 01-srt-foundation
reviewed: 2026-07-28T12:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/App.tsx
  - src/components/CuePreview.tsx
  - src/components/FilePicker.tsx
  - src/imports/encoding.ts
  - src/imports/fileImport.ts
  - src/imports/srtParser.ts
  - src/index.css
  - src/main.tsx
  - src/types/subtitle.ts
  - src/utils/errors.ts
findings:
  critical: 2
  warning: 3
  info: 1
  total: 6
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-07-28T12:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the SRT foundation phase: React UI components, SRT parser, encoding detection, file import orchestration, and error handling. Found 2 critical issues (unhandled promise rejections that may crash the app, and an uncaught exception path in encoding detection), 3 warnings (IndexedDB ID collision, useless error line numbers, duplicated markup), and 1 info item. The SRT parser itself is solid and handles edge cases well, but the import pipeline has gaps that will surface in production with non-UTF-8 files.

## Critical Issues

### CR-01: Unhandled promise rejection in wake lock calls

**File:** `src/App.tsx:83`
**Issue:** `enableWakeLock()` returns a Promise but is called without `.catch()` or `await`. If the Wake Lock API fails (unsupported browser, user permission denied, or transient browser error), the rejected promise becomes an unhandled promise rejection. In React StrictMode (already enabled in `main.tsx`), unhandled rejections can trigger error boundaries or crash the app. The same pattern exists for `disableWakeLock()` on lines 88 and 94. The comment on line 81-82 explains the intent (preserving user-gesture context), but the promise is simply dropped — fire-and-forget promises still surface rejections.

**Fix:**
```ts
// Line 82-85 — handle rejection while keeping synchronous gesture chain
const handlePlay = useCallback(() => {
  enableWakeLock().catch(() => { /* wake lock unavailable — non-fatal */ })
  play()
}, [enableWakeLock, play])

// Line 87-90
const handlePause = useCallback(() => {
  disableWakeLock().catch(() => { /* non-fatal */ })
  pause()
}, [disableWakeLock, pause])

// Line 92-95
const handleStop = useCallback(() => {
  disableWakeLock().catch(() => { /* non-fatal */ })
  stop()
}, [disableWakeLock, stop])
```

### CR-02: TextDecoder throws on unsupported chardet-detected encoding

**File:** `src/imports/encoding.ts:41`
**Issue:** When `chardet.analyse()` detects an encoding that is not in the CJK allow-list, the code falls back to `detected[0]?.name`. chardet can detect encodings that the WHATWG `TextDecoder` API does not support (e.g., `ISO-8859-1`, `ISO-8859-9`, `TIS-620`, `ISO-8859-11`). Passing such a name to `new TextDecoder(encoding)` throws a `RangeError` that is not caught, crashing the entire import pipeline with an unhelpful stack trace. This is especially likely for Latin-1 files (common in Western European subtitle files), where chardet frequently returns `ISO-8859-1` — an encoding TextDecoder explicitly omits from its supported set. The try/catch in Stage 2 only covers the UTF-8 fast path, not this fallback.

**Fix:**
```ts
// Stage 4: Decode with detected encoding, with fallback for unsupported encodings
let text: string
try {
  text = new TextDecoder(encoding, { fatal: false }).decode(buffer)
} catch {
  // chardet may detect encodings unsupported by TextDecoder (e.g., ISO-8859-1).
  // Fall back to windows-1252 (superset of Latin-1) or UTF-8 with replacement.
  try {
    text = new TextDecoder('windows-1252', { fatal: false }).decode(buffer)
  } catch {
    text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  }
}
return { text, encoding }
```

## Warnings

### WR-01: IndexedDB ID collision using filename + file size

**File:** `src/imports/fileImport.ts:56`
**Issue:** The `StoredSubtitle` ID is computed as `${file.name}-${file.size}`. Two different files with the same name and byte size but different content will produce the same ID, causing one to silently overwrite the other in IndexedDB via `saveSubtitle`. This is a data-loss scenario: a user could import `movie.srt` (version 1), then later import a different `movie.srt` of the same size, and the first entry would be replaced without warning. The collision risk is non-trivial for subtitle files because SRT files for the same movie often have similar sizes (e.g., different translation groups producing files within bytes of each other).

**Fix:**
```ts
// Use a content-based hash or UUID for the ID
import { randomUUID } from 'crypto' // or a simple hash of file.name + file.size + lastModified
const stored: StoredSubtitle = {
  id: `${file.name}-${file.size}-${file.lastModified}`,
  // ... rest of fields
}
```
Or better, use `file.lastModified` (already available on `File`) to disambiguate same-name/size files, or generate a UUID and let filename be a separate indexed field.

### WR-02: ParseError.line always reports 0 — useless for locating errors

**File:** `src/imports/srtParser.ts:39,51,64,85,93,106`
**Issue:** Every `ParseError` pushed in the parser sets `line: 0`. The `ParseError.line` field is documented as "approximate line number in source" in `types/subtitle.ts:26`, but the parser never tracks or computes the actual line number. When users see "Parsed with N warnings" in the UI (`CuePreview.tsx:97`), they have no way to locate the problematic blocks in their SRT file. This undermines the value of collecting non-fatal errors — users cannot act on warnings they cannot find.

**Fix:** Track the running line offset as you iterate blocks. Since blocks are split by `\n\n+`, the line number for each block can be computed by counting newlines up to that block's start position in the original string:

```ts
// Pre-compute line offsets for each block
let runningLine = 1
let searchFrom = 0
const blocks = cleaned.split(/\n\n+/).filter((b) => b.trim().length > 0)
const blockLines: number[] = []

for (const block of blocks) {
  const blockStart = cleaned.indexOf(block, searchFrom)
  runningLine += cleaned.slice(searchFrom, blockStart).split('\n').length - 1
  blockLines.push(runningLine)
  searchFrom = blockStart + block.length
  runningLine += block.split('\n').length
}

// Then in the loop, use blockLines[i] for the error's line field
```

A simpler alternative: track `lineOffset` by accumulating the length of each block plus separator lengths.

### WR-03: Duplicate saved movies markup in App.tsx and CuePreview.tsx

**File:** `src/App.tsx:131-154` and `src/CuePreview.tsx:126-143`
**Issue:** The "saved movies" list markup is duplicated across two components with subtle differences:
- App.tsx uses title "Continue with saved movie" and includes a delete button per item
- CuePreview.tsx uses title "Saved Movies" and omits the delete button

This duplication means styling changes must be made in two places, and behavioral differences (delete button present vs. absent) create inconsistent UX — users can delete saved movies from the import view but not from the ready/playback view. If the markup should be identical, extract a shared `SavedMoviesList` component. If the differences are intentional, document why deletion is unavailable in the ready view.

**Fix:** Extract a shared component:
```tsx
// src/components/SavedMoviesList.tsx
interface SavedMoviesListProps {
  title?: string
  savedSubtitles: StoredSubtitle[]
  onSelect: (stored: StoredSubtitle) => void
  onDelete?: (id: string) => void
}

export const SavedMoviesList: React.FC<SavedMoviesListProps> = ({
  title = 'Saved Movies',
  savedSubtitles,
  onSelect,
  onDelete,
}) => (
  <div className="saved-movies">
    <h2 className="saved-movies-title">{title}</h2>
    {savedSubtitles.map((stored) => (
      <div key={stored.id} className="saved-movie-item">
        <button className="saved-movie-button" onClick={() => onSelect(stored)}>
          <span className="saved-movie-name">{stored.fileName}</span>
          <span className="saved-movie-meta">
            {stored.cueCount} cues · {new Date(stored.importedAt).toLocaleDateString()}
          </span>
        </button>
        {onDelete && (
          <button
            className="saved-movie-delete"
            onClick={() => onDelete(stored.id)}
            aria-label={`Delete ${stored.fileName}`}
          >
            ×
          </button>
        )}
      </div>
    ))}
  </div>
)
```

## Info

### IN-01: Misleading comment for LIST_MAX_HEIGHT constant

**File:** `src/components/CuePreview.tsx:14`
**Issue:** The comment says `// 60vh in px approximation` but `60 * 100 = 600px`, which is not equivalent to 60vh on most viewports (60vh on a 1080px tall screen = 648px; on a 800px screen = 480px). The constant is actually just a fixed pixel value, not a viewport approximation. The comment is misleading for anyone trying to reason about the layout.

**Fix:**
```ts
const LIST_MAX_HEIGHT = 600 // fixed max height in px for the cue list container
```

---

_Reviewed: 2026-07-28T12:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
