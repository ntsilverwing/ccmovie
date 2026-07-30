import type { Cue, ParsedSubtitle, ParseError } from '../types/subtitle'

/**
 * Parse SRT subtitle content into structured Cue objects.
 *
 * Pure function: string → ParsedSubtitle. Never throws on a single bad cue.
 * Malformed blocks are collected as ParseError entries and parsing continues.
 *
 * Handles:
 * - CRLF/CR line ending normalization to LF
 * - BOM character stripping
 * - Both dot (.) and comma (,) timecode separators
 * - Multi-line subtitle text (preserved with \n)
 * - Missing sequence numbers (uses array index + 1)
 * - Extra blank lines between blocks
 *
 * @param content - clean UTF-8 string (already decoded by detectAndDecode)
 * @returns ParsedSubtitle with cues, metadata, and any parse errors
 */
export function parseSRT(content: string): ParsedSubtitle {
  const errors: ParseError[] = []

  // Step 1: Normalize line endings — CRLF and CR to LF
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Step 2: Strip BOM character if present
  const cleaned = normalized.replace(/^\uFEFF/, '')

  // Step 3: Split into blocks by double-newline, filter empty blocks
  const blocks = cleaned.split(/\n\n+/).filter((b) => b.trim().length > 0)

  const cues: Cue[] = []

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 2) {
      // Block too short to contain timecode + text — collect as error
      errors.push({
        line: 0,
        type: 'invalid_timecode',
        message: `Block too short (expected timecode + text): "${lines[0].slice(0, 40)}"`,
      })
      continue
    }

    // Step 4: Find timecode line (contains '-->')
    const timecodeIdx = lines.findIndex((l) => l.includes('-->'))
    if (timecodeIdx === -1) {
      errors.push({
        line: 0,
        type: 'invalid_timecode',
        message: `Block has no timecode line: "${lines[0].slice(0, 40)}"`,
      })
      continue
    }

    // Step 5: Parse timecode with regex accepting both dot and comma, variable hour digits
    const timeMatch = lines[timecodeIdx].match(
      /(\d{2,}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2,}):(\d{2}):(\d{2})[,.](\d{3})/,
    )
    if (!timeMatch) {
      errors.push({
        line: 0,
        type: 'invalid_timecode',
        message: `Bad timecode: "${lines[timecodeIdx].slice(0, 50)}"`,
      })
      continue
    }

    // Step 6: Convert timecode to milliseconds
    const start =
      parseInt(timeMatch[1]) * 3600000 +
      parseInt(timeMatch[2]) * 60000 +
      parseInt(timeMatch[3]) * 1000 +
      parseInt(timeMatch[4])
    const end =
      parseInt(timeMatch[5]) * 3600000 +
      parseInt(timeMatch[6]) * 60000 +
      parseInt(timeMatch[7]) * 1000 +
      parseInt(timeMatch[8])

    // Step 6a: Validate end > start
    if (end <= start) {
      errors.push({
        line: 0,
        type: 'invalid_timecode',
        message: `End time (${timeMatch[5]}) must be after start time (${timeMatch[1]})`,
      })
      continue
    }

    // Step 6b: Detect overlap with previous cue
    if (cues.length > 0 && start < cues[cues.length - 1].end) {
      errors.push({
        line: 0,
        type: 'overlap',
        message: `Cue at ${timeMatch[0]} overlaps with previous cue ending at ${formatTimeMs(cues[cues.length - 1].end)}`,
      })
    }

    // Step 7: Text is everything after the timecode line, joined with \n, trimmed
    const text = lines.slice(timecodeIdx + 1).join('\n').trim()

    // Step 8: Skip empty text blocks with error
    if (text.length === 0) {
      errors.push({
        line: 0,
        type: 'empty_text',
        message: `Empty text for cue at ${timeMatch[0]}`,
      })
      continue
    }

    // Step 9: Push Cue with sequential id (cues.length + 1)
    cues.push({
      id: cues.length + 1,
      start,
      end,
      text,
    })
  }

  // Step 10: Return structured result
  return {
    cues,
    metadata: {
      fileName: '',
      encoding: '',
      cueCount: cues.length,
      parsedAt: Date.now(),
    },
    errors,
  }
}

function formatTimeMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const millis = ms % 1000
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`
}
