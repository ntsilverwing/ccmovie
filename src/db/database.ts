import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Cue } from '../types/subtitle'
import type { PlaybackSession } from '../playback/session'

/**
 * Typed IndexedDB schema for CinemaSyncSubs.
 *
 * Two stores — `subtitles` (v1) and `session` (v2, single-record keyval for
 * the Phase-6 playback-session anchor). Settings remain in localStorage
 * (Phase 2 decision: synchronous, sufficient for 2 key-values).
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
  session: {
    /** fixed key 'current' — single-session record, replacement semantics */
    key: string
    value: PlaybackSession
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
 * Schema upgrades run through an `oldVersion < N` ladder (RESEARCH Pitfall
 * 10): each rung guards its own additions so a v1 install keeps every
 * subtitle record while gaining the v2 `session` store, and a fresh install
 * runs both rungs. Subsequent calls return the cached promise.
 */
export function getDB(): Promise<IDBPDatabase<CinemaSyncDB>> {
  if (!dbPromise) {
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
  }
  return dbPromise
}
