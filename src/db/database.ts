import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Cue } from '../types/subtitle'

/**
 * Typed IndexedDB schema for CinemaSyncSubs.
 *
 * Single `subtitles` store — settings remain in localStorage (Phase 2 decision:
 * synchronous, sufficient for 2 key-values).
 */
export interface CinemaSyncDB extends DBSchema {
  subtitles: {
    /** subtitle id — deterministic: `${fileName}-${fileSize}` */
    key: string
    value: StoredSubtitle
    indexes: {
      /** index for fileName lookups */
      'by-fileName': string
      /** index for importedAt ordering (newest-first) */
      'by-importedAt': number
    }
  }
}

/**
 * Persisted subtitle record stored in IndexedDB.
 */
export interface StoredSubtitle {
  /** deterministic id: `${fileName}-${fileSize}` */
  id: string
  /** original file name (e.g., "movie.cn.srt") */
  fileName: string
  /** parsed cue data */
  cues: Cue[]
  /** detected encoding (e.g., "GB18030", "UTF-8") */
  encoding: string
  /** total number of cues */
  cueCount: number
  /** epoch ms when imported */
  importedAt: number
  /** original file size in bytes */
  fileSize: number
}

/** Memoized openDB promise — singleton pattern. */
let dbPromise: Promise<IDBPDatabase<CinemaSyncDB>> | null = null

/**
 * Get the singleton database instance.
 *
 * Creates the `subtitles` store with keyPath 'id' and both indexes on first call.
 * Subsequent calls return the cached promise.
 */
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
