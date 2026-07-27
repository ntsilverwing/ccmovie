/**
 * Single subtitle cue — the atomic unit consumed by playback engine.
 *
 * Invariants:
 * - start < end (enforced by parser validation)
 * - id is sequential starting from 1
 * - text is non-empty (empty text cues are dropped with warning)
 * - text may contain \n for multi-line subtitles
 */
export interface Cue {
  /** 1-based sequence number */
  id: number
  /** start time in milliseconds from movie beginning */
  start: number
  /** end time in milliseconds */
  end: number
  /** subtitle text, trimmed, may contain newlines */
  text: string
}

/**
 * Non-fatal parse warning for a single cue or block.
 */
export interface ParseError {
  /** approximate line number in source */
  line: number
  /** category of parse error */
  type: 'invalid_timecode' | 'missing_sequence' | 'overlap' | 'empty_text'
  /** human-readable description */
  message: string
}

/**
 * Complete parsed subtitle file result.
 *
 * The cues array is the primary data consumed by PlaybackEngine (Phase 2).
 * The metadata is used for display and debugging.
 * The errors array provides user feedback on parse warnings.
 */
export interface ParsedSubtitle {
  cues: Cue[]
  metadata: {
    /** original file name (e.g., "movie.cn.srt") */
    fileName: string
    /** detected encoding (e.g., "GB18030", "UTF-8") */
    encoding: string
    /** total number of valid cues */
    cueCount: number
    /** timestamp of parse */
    parsedAt: number
  }
  /** non-fatal parse warnings */
  errors: ParseError[]
}
