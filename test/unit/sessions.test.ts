import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { openDB } from 'idb'
import type { PlaybackSession } from '../../src/playback/session'

const KEY = 'current'

const BASE: PlaybackSession = {
  subtitleId: 'sub-42',
  fileName: 'movie.srt',
  startedAt: 1_000_000,
  offsetMs: 0,
  pausedElapsedMs: null,
}

/**
 * Reopen the app's modules against the current fake IndexedDB instance.
 * src/db/database.ts memoizes its dbPromise singleton, so every test must
 * reset the module graph and re-import after swapping the global factory.
 */
async function importModules() {
  const database = await import('../../src/db/database')
  const sessions = await import('../../src/db/sessions')
  return { database, sessions }
}

beforeEach(() => {
  indexedDB = new IDBFactory() // fresh DB namespace per test
  vi.resetModules() // drop the memoized dbPromise between tests
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** Seed a v1 database exactly as the pre-Phase-6 openDB body did. */
async function seedV1WithSubtitle(): Promise<void> {
  const v1 = await openDB('cinemasyncsubs', 1, {
    upgrade(db) {
      const subStore = db.createObjectStore('subtitles', { keyPath: 'id' })
      subStore.createIndex('by-fileName', 'fileName')
      subStore.createIndex('by-importedAt', 'importedAt')
    },
  })
  await v1.put('subtitles', {
    id: 'movie.srt-100',
    fileName: 'movie.srt',
    cues: [],
    encoding: 'UTF-8',
    cueCount: 0,
    importedAt: 1_700_000_000_000,
    fileSize: 100,
  })
  v1.close()
}

/** Flush macrotasks so a fire-and-forget best-effort clear can settle. */
async function flushMacrotasks(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0))
  await new Promise((r) => setTimeout(r, 0))
}

describe('cinemasyncsubs v1→v2 upgrade (oldVersion ladder)', () => {
  it('preserves existing subtitle rows and adds the session store', async () => {
    await seedV1WithSubtitle()
    const { database } = await importModules()

    const db = await database.getDB()

    const row = await db.get('subtitles', 'movie.srt-100')
    expect(row?.fileName).toBe('movie.srt')
    expect(row?.fileSize).toBe(100)
    expect(db.objectStoreNames.contains('session')).toBe(true)
  })
})

describe('session store CRUD', () => {
  it('round-trips a full PlaybackSession verbatim (pausedElapsedMs null variant)', async () => {
    const { sessions } = await importModules()

    await sessions.saveSession(BASE)
    const loaded = await sessions.loadSession()

    expect(loaded).toEqual(BASE)
  })

  it('round-trips a full PlaybackSession verbatim (numeric pausedElapsedMs variant)', async () => {
    const { sessions } = await importModules()
    const paused: PlaybackSession = { ...BASE, pausedElapsedMs: 60_000 }

    await sessions.saveSession(paused)
    const loaded = await sessions.loadSession()

    expect(loaded).toEqual(paused)
  })

  it('replaces the prior record on a second save under the same key', async () => {
    const { sessions } = await importModules()

    await sessions.saveSession(BASE)
    await sessions.saveSession({ ...BASE, offsetMs: 8000 })
    const loaded = await sessions.loadSession()

    expect(loaded).toEqual({ ...BASE, offsetMs: 8000 })
  })

  it('clearSessionRecord removes the record (dismiss path)', async () => {
    const { sessions } = await importModules()

    await sessions.saveSession(BASE)
    await sessions.clearSessionRecord()

    expect(await sessions.loadSession()).toBeNull()
  })
})

describe('corrupt-record handling', () => {
  it('treats a malformed record as absent and clears it best-effort', async () => {
    const { database, sessions } = await importModules()
    const db = await database.getDB()
    // Hand-plant a structurally-invalid record (every field wrong-typed).
    const corrupt = {
      subtitleId: 42,
      fileName: null,
      startedAt: 'not-a-number',
      offsetMs: '0',
      pausedElapsedMs: 'never',
    }
    await db.put('session', corrupt as unknown as PlaybackSession, KEY)

    const loaded = await sessions.loadSession()
    expect(loaded).toBeNull()

    // The fired clear is fire-and-forget: flush macrotasks, then re-read raw.
    await flushMacrotasks()
    const raw = await db.get('session', KEY)
    expect(raw).toBeUndefined()
  })

  it('reads an empty store as null without issuing any delete', async () => {
    const { sessions } = await importModules()
    const deleteSpy = vi.spyOn(IDBObjectStore.prototype, 'delete')

    const loaded = await sessions.loadSession()

    expect(loaded).toBeNull()
    expect(deleteSpy).not.toHaveBeenCalled()
  })
})
