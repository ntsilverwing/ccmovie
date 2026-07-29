import { detectAndDecode } from './encoding'
import { parseSRT } from './srtParser'
import type { ParsedSubtitle } from '../types/subtitle'
import { ImportError } from '../utils/errors'
import { saveSubtitle } from '../db/subtitles'
import type { StoredSubtitle } from '../db/database'
import { t } from '../i18n/translations'
import { loadSettings } from '../hooks/usePersistedSettings'

/**
 * Orchestrate SRT file import: validate, read bytes, detect encoding, parse.
 *
 * Delegates encoding detection to detectAndDecode and parsing to parseSRT.
 * This module is the single entry point for the import pipeline.
 *
 * @param file - File object from file picker or drag-drop
 * @returns ParsedSubtitle with cues, metadata, and any parse errors
 * @throws ImportError for invalid file type, oversized file, or zero cues
 */
export async function importSRT(file: File): Promise<ParsedSubtitle> {
  const { lang } = loadSettings()

  // Step 1: Validate file extension
  const ext = file.name.toLowerCase().split('.').pop()
  if (ext !== 'srt' && ext !== 'txt') {
    throw new ImportError('INVALID_TYPE', t(lang, 'invalidType'))
  }

  // Step 2: Validate file size (cap at 5MB)
  const MAX_SIZE = 5 * 1024 * 1024 // 5242880 bytes
  if (file.size > MAX_SIZE) {
    throw new ImportError('FILE_TOO_LARGE', t(lang, 'fileTooLarge'))
  }

  // Step 3: Read file as raw bytes
  const buffer = new Uint8Array(await file.arrayBuffer())

  // Step 4: Detect encoding and decode to string
  const { text, encoding } = detectAndDecode(buffer)

  // Step 5: Parse SRT content
  const result = parseSRT(text)

  // Step 6: Set original filename
  result.metadata.fileName = file.name

  // Step 7: Set detected encoding
  result.metadata.encoding = encoding

  // Step 8: Validate result — must have at least one cue
  if (result.cues.length === 0) {
    throw new ImportError(
      'NO_CUES',
      t(lang, 'noCues'),
    )
  }

  // Step 8b: Persist to IndexedDB — await to surface errors to user
  const stored: StoredSubtitle = {
    id: `${file.name}-${file.size}`,
    fileName: file.name,
    cues: result.cues,
    encoding: result.metadata.encoding,
    cueCount: result.cues.length,
    importedAt: Date.now(),
    fileSize: file.size,
  }
  try {
    await saveSubtitle(stored)
  } catch (err) {
    throw new ImportError(
      'PERSISTENCE_ERROR',
      t(lang, 'persistenceError', { message: err instanceof Error ? err.message : String(err) }),
    )
  }

  // Step 9: Log warnings for partial parse errors (non-blocking)
  if (result.errors.length > 0) {
    console.warn(`Parsed with ${result.errors.length} warnings`, result.errors)
  }

  // Step 10: Return result
  return result
}
