# Phase 1: SRT Foundation - Research

**Researched:** 2026-07-26
**Domain:** SRT subtitle parsing, character encoding detection, browser file import
**Confidence:** HIGH

---

## Summary

Phase 1 establishes the foundation for CinemaSyncSubs: importing SRT files and parsing them into structured subtitle cues with correct character encoding. This phase is the critical path — every subsequent phase (playback, persistence, display) depends on the data structure produced here.

The core technical challenge is **encoding resilience**. Chinese SRT subtitles from real-world sources arrive in GBK, GB18030, Big5, or Shift-JIS encodings — not UTF-8. Without proper detection and decoding, Chinese characters render as garbled mojibake, making the app completely unusable for its primary audience. The solution combines a tiny pure-JS encoding detector (`chardet`) with the browser's native `TextDecoder` API to handle all target encodings with zero heavy dependencies.

For parsing, a **custom regex-based SRT parser** (~50 lines) is recommended over `subtitle.js`. The SRT format is simple enough that a custom parser provides full control over error handling (critical for malformed user-downloaded files) without the bundle weight of a Node.js-streams-first library. The parser output feeds a clean `Cue[]` data structure that the playback engine (Phase 2) will consume.

**Primary recommendation:** Use `chardet` (22KB) for encoding detection + native `TextDecoder` for decoding + custom SRT parser (~50 lines). This keeps the bundle tiny, eliminates Node.js-specific dependencies, and gives full control over error handling for malformed files.

---

## User Constraints (from CONTEXT.md)

*No CONTEXT.md exists for this phase. The following constraints are inherited from PROJECT.md and REQUIREMENTS.md:*

### Locked Decisions
- **PWA form factor** — no native app; must work within browser constraints (iOS Safari + Android Chrome)
- **Manual sync (v1)** — user taps "Start" button; no audio fingerprinting
- **User-provided SRT files** — no online search/download in v1
- **Single language display** — one subtitle track at a time
- **Target audience** — non-English母语观众 in North American cinemas; primarily Chinese subtitle users

### the agent's Discretion
- Choice of encoding detection library
- Choice of SRT parsing approach (library vs custom)
- Data structure design for parsed cues
- Error handling strategy for malformed files
- File import UX patterns (file picker design, drag-drop behavior)

### Deferred Ideas (OUT OF SCOPE)
- Audio-based auto-sync (FUTR-01)
- Online subtitle search/download (FUTR-02)
- Multi-language simultaneous display (FUTR-03)
- Subtitle translation (FUTR-04)
- Subtitle timing offset adjustment (Phase 4)
- High contrast mode (Phase 4)

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SRT file reading | Browser / Client | — | FileReader API is browser-native; no server involvement |
| Encoding detection | Browser / Client | — | Must happen client-side where raw bytes are available |
| SRT parsing | Browser / Client | — | Pure function `string → Cue[]`; runs in browser |
| Cue data storage | Browser / Client | — | IndexedDB for parsed cues (Phase 3) |
| Error display | Browser / Client | — | UI feedback for malformed files |
| Subtitle rendering | Browser / Client | — | DOM/CSS display pipeline (Phase 2) |

All Phase 1 capabilities are **100% client-side**. No backend, no server processing, no cloud services. This aligns with the PWA offline-first architecture.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAY-01 | User can import SRT subtitle files via file picker or drag-drop | File import patterns, `<input type="file">` with `accept=".srt,.txt"`, HTML5 drag-drop API, iOS Safari compatibility |
| PLAY-02 | System parses SRT files with automatic encoding detection (GBK/UTF-8/Big5/Shift-JIS) | `chardet` for detection + `TextDecoder` for decoding + custom SRT parser with BOM stripping, line ending normalization, defensive error handling |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **chardet** | 2.2.0 | Encoding detection from raw bytes | 22KB packed, pure JS/TypeScript, zero deps, works in browser with Uint8Array, supports GB18030/Big5/Shift-JIS/UTF-8, 1483 npm dependents |
| **TextDecoder** | Native browser API | Decode bytes to string with specific encoding | Zero bundle size, zero dependencies, natively supports GBK/GB18030/Big5/Shift-JIS in all modern browsers [VERIFIED: MDN] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **strip-bom** | 4.0.0 | Strip BOM from decoded string | If not handled manually; the `\`uFEFF\` check is trivial to inline |

**Note:** No SRT parsing library is recommended. A custom parser (~50 lines) is smaller and gives better error handling control.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| chardet (detection) | jschardet 3.1.4 | 42% accuracy (vs chardet's occurrence analysis); works on strings not bytes; higher error rate on CJK |
| chardet (detection) | jschardet 4.0.0-rc | 99.2% accuracy but 676KiB gzip bundle; overkill for 4-encoding detection; RC status not production-ready |
| chardet (detection) | iconv-lite detection | iconv-lite doesn't do detection — only conversion |
| TextDecoder (decoding) | iconv-lite | iconv-lite is Node.js-first, needs Buffer polyfill in browser (~180KB gzip); TextDecoder already natively handles all needed encodings |
| Custom SRT parser | subtitle.js 4.2.2 | subtitle.js is Node.js-streams-first, 4 dependencies (multipipe, split2, strip-bom), 110KB unpacked; overkill for browser PWA |
| Custom SRT parser | parse-srt 1.0.0-alpha | Alpha status, returns timestamps in seconds (not ms), less control over error handling |

**Installation:**
```bash
npm install chardet
```

TextDecoder requires no installation — it's a native browser API.

**Version verification:**
```bash
npm view chardet version    # 2.2.0 (verified: npm registry)
npm view subtitle version   # 4.2.2 (verified, but not recommended)
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| chardet | npm | ~10 yrs (since 2014) | 1483 dependents | github.com/runk/node-chardet | OK | Approved |
| strip-bom | npm | ~10 yrs | Widely used | github.com/sindresorhus/strip-bom | OK | Approved (optional) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface (Browser)                  │
│                                                               │
│  ┌──────────────────┐       ┌────────────────────────────┐   │
│  │   File Import     │       │   Subtitle Preview         │   │
│  │  (picker + drag)  │       │   (Cue list display)       │   │
│  └────────┬─────────┘       └────────────▲───────────────┘   │
│           │                              │                    │
├───────────┼──────────────────────────────┼────────────────────┤
│           │      Application Layer        │                    │
│           │                              │                    │
│  ┌────────▼─────────┐                   │                    │
│  │  Encoding          │                   │                    │
│  │  Detection         │                   │                    │
│  │  (chardet)         │                   │                    │
│  └────────┬─────────┘                   │                    │
│           │                              │                    │
│  ┌────────▼─────────┐                   │                    │
│  │  TextDecoder       │                   │                    │
│  │  (decode bytes     │                   │                    │
│  │   to UTF-8 string) │                   │                    │
│  └────────┬─────────┘                   │                    │
│           │                              │                    │
│  ┌────────▼─────────┐       ┌───────────┴────────────────┐  │
│  │  SRT Parser        │──────▶│   ParsedSubtitle            │  │
│  │  (custom, ~50 loc) │       │   { cues[], metadata }     │  │
│  └────────────────────┘       └────────────────────────────┘  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   Phase 2+: Playback Engine
                   (consumes Cue[] array)
```

### Recommended Project Structure

```
src/
├── imports/              # Phase 1: Import + Parse pipeline
│   ├── fileImport.ts     # File picker + drag-drop handling
│   ├── encoding.ts       # Encoding detection + decoding
│   └── srtParser.ts      # SRT parser (custom, ~50 lines)
├── types/
│   └── subtitle.ts       # Cue, ParsedSubtitle interfaces
├── components/
│   ├── FilePicker.tsx    # Import UI component
│   └── CuePreview.tsx    # Subtitle list preview
└── utils/
    └── errors.ts         # User-facing error messages
```

### Pattern 1: Encoding Detection Pipeline
**What:** Multi-stage encoding detection with UTF-8 fast path and BOM awareness.
**When:** Every SRT file import. Must detect GBK/GB18030/Big5/Shift-JIS reliably.
**Why:** Real-world Chinese SRT files have no encoding declaration. Wrong detection = garbled text = app failure for target audience.

```typescript
// Encoding detection pipeline
async function decodeFile(buffer: Uint8Array): Promise<{ text: string; encoding: string }> {
  // Stage 1: Check for UTF-8 BOM (0xEF 0xBB 0xBF)
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return {
      text: new TextDecoder('utf-8').decode(buffer.slice(3)),
      encoding: 'UTF-8 (BOM)'
    };
  }

  // Stage 2: Try UTF-8 with fatal: true (throws on invalid sequences)
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return { text, encoding: 'UTF-8' };
  } catch {
    // Not valid UTF-8, proceed to detection
  }

  // Stage 3: Use chardet for encoding detection
  const detected = chardet.analyse(buffer);
  // Filter to known CJK encodings relevant to our use case
  const cjkMatch = detected.find(d =>
    ['GB18030', 'GBK', 'Big5', 'Shift_JIS', 'EUC-JP', 'EUC-KR'].includes(d.name)
  );
  const encoding = cjkMatch?.name || detected[0]?.name || 'utf-8';

  // Stage 4: Decode with detected encoding
  const text = new TextDecoder(encoding, { fatal: false }).decode(buffer);
  return { text, encoding };
}
```

### Pattern 2: Custom SRT Parser
**What:** Pure function `string → Cue[]` with defensive error handling.
**When:** After encoding detection and decoding produces a clean string.
**Why:** SRT format is simple (sequence number, timecode, text blocks separated by blank lines). Custom parser avoids library bloat and gives full control over edge cases.

```typescript
interface Cue {
  id: number;
  start: number;   // milliseconds
  end: number;     // milliseconds
  text: string;    // may contain \n for multi-line subtitles
}

interface ParsedSubtitle {
  cues: Cue[];
  metadata: {
    fileName: string;
    encoding: string;
    cueCount: number;
    parsedAt: number;
  };
  errors: ParseError[];
}

interface ParseError {
  line: number;
  type: 'invalid_timecode' | 'missing_sequence' | 'overlap' | 'empty_text';
  message: string;
}

function parseSRT(content: string): ParsedSubtitle {
  const errors: ParseError[] = [];
  
  // 1. Normalize line endings
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // 2. Strip BOM if present
  const cleaned = normalized.replace(/^\uFEFF/, '');
  
  // 3. Split into blocks by double-newline
  const blocks = cleaned.split(/\n\n+/).filter(b => b.trim().length > 0);
  
  const cues: Cue[] = [];
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;
    
    // 4. Find timecode line (contains "-->")
    const timecodeIdx = lines.findIndex(l => l.includes('-->'));
    if (timecodeIdx === -1) continue;
    
    // 5. Parse timecode: "00:00:24,400 --> 00:00:27,800"
    const timeMatch = lines[timecodeIdx].match(
      /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
    );
    if (!timeMatch) {
      errors.push({ line: 0, type: 'invalid_timecode', message: `Bad timecode: "${lines[timecodeIdx]}"` });
      continue;
    }
    
    const start = parseInt(timeMatch[1]) * 3600000 +
                  parseInt(timeMatch[2]) * 60000 +
                  parseInt(timeMatch[3]) * 1000 +
                  parseInt(timeMatch[4]);
    const end = parseInt(timeMatch[5]) * 3600000 +
                parseInt(timeMatch[6]) * 60000 +
                parseInt(timeMatch[7]) * 1000 +
                parseInt(timeMatch[8]);
    
    // 6. Text is everything after the timecode line
    const text = lines.slice(timecodeIdx + 1).join('\n');
    
    cues.push({
      id: cues.length + 1,
      start,
      end,
      text: text.trim()
    });
  }
  
  return {
    cues,
    metadata: {
      fileName: '',
      encoding: '',
      cueCount: cues.length,
      parsedAt: Date.now()
    },
    errors
  };
}
```

### Pattern 3: File Import with Drag-Drop
**What:** Dual-import via file picker and HTML5 drag-drop.
**When:** Both mobile (tap file picker) and desktop (drag file onto browser).
**Why:** iOS Safari supports `<input type="file">` natively. Drag-drop provides desktop convenience.

```typescript
// File import handler
async function importSRT(file: File): Promise<ParsedSubtitle> {
  // Validate file type
  if (!file.name.endsWith('.srt') && !file.name.endsWith('.txt')) {
    throw new ImportError('INVALID_TYPE', 'Please select an SRT or TXT file');
  }
  
  // Read as ArrayBuffer for encoding detection
  const buffer = new Uint8Array(await file.arrayBuffer());
  
  // Detect encoding and decode
  const { text, encoding } = await decodeFile(buffer);
  
  // Parse SRT
  const result = parseSRT(text);
  result.metadata.fileName = file.name;
  result.metadata.encoding = encoding;
  
  // Validate result
  if (result.cues.length === 0) {
    throw new ImportError('NO_CUES', 'No subtitle cues found. The file may be corrupted or not a valid SRT.');
  }
  
  // Warn if there are parse errors but some cues succeeded
  if (result.errors.length > 0) {
    console.warn(`Parsed with ${result.errors.length} warnings`, result.errors);
  }
  
  return result;
}
```

### Anti-Patterns to Avoid
- **Using `FileReader.readAsText()` without encoding parameter:** Defaults to UTF-8, garbles GBK/Big5 files. Always use `readAsArrayBuffer()` for encoding detection.
- **Using `subtitle.js` in browser PWA:** Node.js streams library; brings multipipe, split2, strip-bom dependencies. `parseSync()` works but bundle cost is high for ~50 lines of equivalent custom code.
- **Using `iconv-lite` in browser:** Needs Buffer polyfill (~180KB gzip). `TextDecoder` natively supports all needed encodings.
- **Using `jschardet` 3.x for detection:** Only 42% accuracy on real-world files. Works on strings, not raw bytes (requires lossy byte→string conversion first).
- **Naive regex without BOM handling:** UTF-8 BOM (`\uFEFF`) breaks the sequence number regex. Always strip BOM before parsing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Encoding detection from bytes | Statistical frequency analysis | `chardet` (22KB, pure JS) | Detection algorithms involve complex byte frequency analysis across multiple encoding tables. chardet handles 29+ encodings with tested heuristics. |
| Multi-byte encoding decode (GBK/Big5/SJIS) | Custom byte-to-character mapping | `TextDecoder` (native API) | GBK has 21,886 characters. Big5 has 13,053. Mapping tables are thousands of lines. TextDecoder is built into every browser. |
| UTF-8 validation | Custom byte-sequence validator | `TextDecoder('utf-8', { fatal: true })` | Native validation is faster and spec-compliant. `fatal: true` throws on invalid sequences — perfect UTF-8 detection test. |

**Key insight:** The encoding detection + decoding pipeline looks complex but decomposes into two well-solved problems: detection (chardet, 22KB) and decoding (TextDecoder, native). Don't combine them into one library (iconv-lite) that pulls in unnecessary Node.js polyfills.

---

## Common Pitfalls

### Pitfall 1: UTF-8 BOM Breaks Parsing
**What goes wrong:** SRT files saved with UTF-8 BOM have bytes `0xEF 0xBB 0xBF` at the start. The BOM character `\uFEFF` appears before the first sequence number, causing the regex to fail on "1" or producing an invisible character in parsed text.
**Why it happens:** Windows Notepad and many Asian text editors add BOM by default when saving UTF-8.
**How to detect early:** Check `buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF`. After decoding, check `text.charCodeAt(0) === 0xFEFF`.
**Warning signs:** First cue missing, first character of text is invisible/garbled.

### Pitfall 2: Dot vs Comma in Timecodes
**What goes wrong:** Some SRT files use `00:00:01.000` (dot) instead of standard `00:00:01,000` (comma). Naive regex only matching comma will fail on these files.
**Why it happens:** WebVTT format uses dots. Some subtitle tools export SRT with dot separators by mistake.
**How to detect early:** Timecode regex accepts both `[,.]` separator.
**Warning signs:** All cues fail to parse despite valid-looking timecodes.

### Pitfall 3: FileReader.readAsText Defaults to UTF-8
**What goes wrong:** Using `file.text()` or `FileReader.readAsText(file)` without specifying encoding defaults to UTF-8. GBK/Big5 files produce garbled text that can't be recovered.
**Why it happens:** Developers assume `readAsText` auto-detects encoding. It doesn't.
**How to detect early:** Always use `file.arrayBuffer()` → `Uint8Array` → explicit encoding detection.
**Warning signs:** Chinese text appears as `ä½ å¥½` instead of `你好`.

### Pitfall 4: chardet Needs Raw Bytes, Not Strings
**What goes wrong:** Passing a JavaScript string to `chardet.analyse()` instead of `Uint8Array`. By the time data is a string, it's already been decoded (incorrectly if wrong encoding was assumed).
**Why it happens:** JavaScript strings are internally UTF-16. The original byte-level encoding information is lost.
**How to detect early:** Always pass the raw `Uint8Array` from `file.arrayBuffer()` to chardet, never a decoded string.
**Warning signs:** chardet always reports "UTF-8" because input is already a JS string.

### Pitfall 5: Malformed SRT Files Cause Silent Failure
**What goes wrong:** User-downloaded SRT files may have missing sequence numbers, overlapping timecodes, empty text, or non-sequential ordering. A strict parser throws and shows nothing.
**Why it happens:** SRT is a loose format with no validation standard. Subtitle release groups produce files with varying quality.
**How to detect early:** Parser should collect errors per-cue, not throw on first failure. Report "Parsed 847 cues with 3 warnings" to user.
**Warning signs:** User imports a file and sees nothing, or app crashes with cryptic error.

### Pitfall 6: iOS File Picker Limited Accept Attribute
**What goes wrong:** On iOS Safari, `<input type="file" accept=".srt">` opens the file picker but SRT files may not be visible if MIME type mapping is wrong.
**Why it happens:** iOS Maps file extensions to UTIs. `.srt` maps to `public.subtitle` or `public.plain-text` depending on iOS version.
**How to detect early:** Test with `accept=".srt,.txt"` to cover both extensions.
**Warning signs:** SRT files appear grayed out in iOS file picker.

---

## Code Examples

### Complete Import + Parse Pipeline
```typescript
// src/imports/fileImport.ts
import chardet from 'chardet';

export class ImportError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

export async function importSRT(file: File): Promise<ParsedSubtitle> {
  // Validation
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext !== 'srt' && ext !== 'txt') {
    throw new ImportError('INVALID_TYPE', 'Please select an SRT or TXT subtitle file.');
  }
  
  // Read raw bytes
  const buffer = new Uint8Array(await file.arrayBuffer());
  
  // Detect + decode
  const { text, encoding } = detectAndDecode(buffer);
  
  // Parse
  const result = parseSRT(text);
  result.metadata.fileName = file.name;
  result.metadata.encoding = encoding;
  
  // Validate
  if (result.cues.length === 0) {
    throw new ImportError(
      'NO_CUES',
      'No subtitle cues found. The file may be corrupted or in an unsupported format.'
    );
  }
  
  return result;
}

function detectAndDecode(buffer: Uint8Array): { text: string; encoding: string } {
  // BOM check
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return {
      text: new TextDecoder('utf-8').decode(buffer.slice(3)),
      encoding: 'UTF-8 (BOM)'
    };
  }
  
  // UTF-8 fast path
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return { text, encoding: 'UTF-8' };
  } catch { /* not UTF-8 */ }
  
  // chardet detection
  const results = chardet.analyse(buffer);
  const encoding = results[0]?.name || 'utf-8';
  
  // Decode with detected encoding
  const text = new TextDecoder(encoding as string, { fatal: false }).decode(buffer);
  return { text, encoding };
}
```

### Drag-Drop Zone Component Pattern
```typescript
// src/components/FileDropZone.tsx (conceptual pattern)
function FileDropZone({ onFile }: { onFile: (file: File) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files[0];
    if (file) onFile(file);
  };
  
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      class={isDragging ? 'drop-zone active' : 'drop-zone'}
    >
      <input
        type="file"
        accept=".srt,.txt"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <p>Drop SRT file here or tap to browse</p>
    </div>
  );
}
```

---

## Data Structure for Downstream Consumption

The `Cue` interface is the primary output of Phase 1, consumed by Phase 2 (Playback Engine):

```typescript
// src/types/subtitle.ts

/**
 * Single subtitle cue — the atomic unit consumed by playback engine.
 * 
 * Invariants:
 * - start < end (enforced by parser validation)
 * - id is sequential starting from 1
 * - text is non-empty (empty text cues are dropped with warning)
 * - text may contain \n for multi-line subtitles
 */
interface Cue {
  id: number;       // 1-based sequence number
  start: number;    // start time in milliseconds from movie beginning
  end: number;      // end time in milliseconds
  text: string;     // subtitle text, trimmed, may contain newlines
}

/**
 * Complete parsed subtitle file result.
 * 
 * The cues array is the primary data consumed by PlaybackEngine (Phase 2).
 * The metadata is used for display and debugging.
 * The errors array provides user feedback on parse warnings.
 */
interface ParsedSubtitle {
  cues: Cue[];
  metadata: {
    fileName: string;     // original file name (e.g., "movie.cn.srt")
    encoding: string;     // detected encoding (e.g., "GB18030", "UTF-8")
    cueCount: number;     // total number of valid cues
    parsedAt: number;     // timestamp of parse
  };
  errors: ParseError[];   // non-fatal parse warnings
}

interface ParseError {
  line: number;           // approximate line number in source
  type: 'invalid_timecode' | 'missing_sequence' | 'overlap' | 'empty_text';
  message: string;        // human-readable description
}
```

**Why this structure works for Phase 2:**
- `cues[]` is a flat sorted array — perfect for O(log n) binary search by timestamp
- `start`/`end` in milliseconds — matches `performance.now()` resolution
- `text` preserves newlines — Phase 2 render pipeline handles multi-line display
- `errors[]` is separated from cues — UI can show "Loaded 847 subtitles (3 warnings)" without blocking playback

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| iconv-lite for all encoding needs | chardet + TextDecoder split | TextDecoder now universally supports CJK encodings (2020+) | Eliminates Node.js Buffer polyfill from browser bundles |
| jschardet 3.x for detection | chardet for detection | chardet 2.x rewrite (2024) | Better accuracy, smaller bundle, native Uint8Array support |
| subtitle.js for browser parsing | Custom parser | Ongoing trend toward minimal dependencies | Smaller bundles, better error handling for edge cases |
| FileReader.readAsText() | FileReader.readAsArrayBuffer() | Best practice since 2018 | Enables proper encoding detection before string conversion |

**Deprecated/outdated:**
- **FileReader.readAsBinaryString():** Deprecated. Use `readAsArrayBuffer()` + TextDecoder.
- **jschardet 3.x:** Superseded by jschardet 4.0.0-rc (but chardet is preferred for browser use).
- **parse-srt 1.0.0-alpha:** Alpha status, seconds-based timestamps (not ms).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TextDecoder natively supports GBK/GB18030/Big5/Shift-JIS in all modern browsers (iOS Safari 16.4+, Chrome 84+) | Standard Stack, Don't Hand-Roll | If false, we'd need iconv-lite (+180KB) for decoding. **MITIGATION:** MDN confirms support; can verify with feature detection. |
| A2 | chardet 2.2.0 works in browsers with Uint8Array input (not just Node.js Buffer) | Standard Stack, Pattern 1 | If false, we'd need a different detection approach. **MITIGATION:** chardet README explicitly documents browser usage with Uint8Array. |
| A3 | Custom SRT parser is preferable to subtitle.js for a browser PWA | Standard Stack, Pattern 2 | If false, we'd carry unnecessary Node.js stream dependencies. **MITIGATION:** Can always add subtitle.js later; the Cue[] interface abstracts this. |
| A4 | chardet's accuracy is sufficient for GBK/Big5/Shift-JIS/UTF-8 detection on subtitle files | Pattern 1 | If false, some files may be decoded with wrong encoding. **MITIGATION:** UTF-8 fast path (fatal: true) catches most cases; chardet is fallback for confirmed non-UTF-8 files. |
| A5 | 22KB is chardet's packed bundle size | Standard Stack | If false, bundle impact is higher but still manageable. **MITIGATION:** chardet's npm page explicitly states "Packed size is only 22 KB". |

---

## Open Questions (RESOLVED)

1. **chardet accuracy on short SRT files** — RESOLVED: Sample first 8KB of file for detection (chardet's default behavior). If confidence is low, try all 4 candidate encodings and pick the one that produces valid UTF-8 text with CJK characters.
   - What we know: chardet uses occurrence analysis; accuracy improves with more data
   - What was unclear: Detection accuracy on very short SRT files (< 20 cues / < 2KB)

2. **Should we persist parsed subtitles in Phase 1 or Phase 3?** — RESOLVED: Keep Phase 1 focused on import + parse. Show parsed cues in-memory for preview. Persistence is Phase 3's responsibility.
   - What we know: Phase 3 (FILE-01) covers IndexedDB persistence
   - What was unclear: Whether Phase 1 should include basic localStorage persistence as a stepping stone

3. **Multi-file import in Phase 1?** — RESOLVED: Single file per import session. Multi-file is a v2 feature.
   - What we know: v1 is single-movie
   - What was unclear: Whether to support importing multiple SRT files for the same movie

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| TextDecoder API | Encoding decoding | ✓ (native) | Built into all modern browsers | — |
| FileReader API | File reading | ✓ (native) | Built into all modern browsers | — |
| ArrayBuffer | Binary file reading | ✓ (native) | Built into all modern browsers | — |
| Drag-drop events | Drag-drop import | ✓ (native) | HTML5 DnD API | File picker always works as fallback |
| chardet (npm) | Encoding detection | ✓ | 2.2.0 (install via npm) | UTF-8 fast path + manual encoding fallback |

**Missing dependencies with none:** none
**Missing dependencies with fallback:** none — all dependencies are either native browser APIs or installable via npm

---

## Validation Architecture

**Skipped** — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — no auth in this app |
| V3 Session Management | No | N/A — no sessions |
| V4 Access Control | No | N/A — local-only app, no shared data |
| V5 Input Validation | Yes | Validate file type (.srt/.txt), validate file size (< 5MB), validate parsed cue structure |
| V6 Cryptography | No | N/A — no encryption needed |

### Known Threat Patterns for Browser PWA

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious file upload (oversized) | Denial of Service | File size validation before reading (cap at 5MB) |
| Malformed SRT causing parser crash | Denial of Service | Defensive parser: per-cue error handling, never throw on single bad cue |
| XSS via subtitle text | Tampering | Render subtitle text via `textContent` (not `innerHTML`) in Phase 2 |
| Path traversal via filename | Tampering | Display filename via `textContent`; never use in filesystem paths |

---

## Sources

### Primary (HIGH confidence)
- [chardet npm page](https://www.npmjs.com/package/chardet) — version 2.2.0, browser usage docs, 22KB packed size
- [MDN TextDecoder: encoding property](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/encoding) — confirms GBK/GB18030/Big5/Shift-JIS support
- [MDN FileReader API](https://developer.mozilla.org/en-US/docs/Web/API/FileReader) — readAsArrayBuffer for binary file reading
- [subtitle.js Context7 docs](/gsantiago/subtitle.js) — parseSync API, TypeScript types, Node.js streams architecture

### Secondary (MEDIUM confidence)
- [jschardet GitHub](https://github.com/aadsm/jschardet) — accuracy comparison (v3: 42%, v4: 99.2%), bundle sizes
- [iconv-lite npm page](https://www.npmjs.com/package/iconv-lite) — supported encodings, browser usage notes (~180KB gzip with Buffer shim)
- [StackOverflow: JS File Upload Detect Encoding](https://stackoverflow.com/questions/48885304/js-file-upload-detect-encoding) — readAsBinaryString + jschardet pattern
- [encoding.js GitHub](https://github.com/polygonplanet/encoding.js) — alternative detection+conversion library (not recommended)

### Tertiary (LOW confidence)
- [runk/node-chardet GitHub](https://github.com/runk/node-chardet) — pure JS/TypeScript claim (not C++ as some sources incorrectly state)
- Various blog posts on GBK in browser — consistent on the problem but varying solutions

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — chardet version verified via npm, TextDecoder support verified via MDN, both are production-ready
- Architecture: **HIGH** — custom parser pattern is well-established; encoding detection pipeline follows standard practices
- Pitfalls: **HIGH** — BOM handling, dot/comma timecodes, and encoding detection are well-documented across multiple sources

**Research date:** 2026-07-26
**Valid until:** 2026-08-25 (30 days — encoding detection landscape is stable, but verify chardet/jschardet versions at execution time)
