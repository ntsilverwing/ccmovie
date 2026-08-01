import { getDB } from './database'
import { isValidSession } from '../playback/session'
import type { PlaybackSession } from '../playback/session'

/**
 * Fixed key for the single-session record. The `session` store holds exactly
 * one record under this key; a second save overwrites the previous record
 * (replacement semantics) so only one session ever exists.
 */
const SESSION_KEY = 'current' as const

/**
 * Load the persisted playback session, or null when absent.
 *
 * Every record read is shape-validated (IndexedDB is user-editable via
 * devtools; partial writes are possible after abrupt kills). A malformed
 * record is treated as absent and cleared best-effort — the fired clear is
 * fire-and-forget and can never reject into the playback path. An EMPTY
 * store (undefined raw) returns null without issuing any write or delete.
 *
 * Swallow-warn policy: persistence failure must never crash playback, so
 * errors are logged and read as null rather than thrown.
 */
export async function loadSession(): Promise<PlaybackSession | null> {
  try {
    const db = await getDB()
    const raw = await db.get('session', SESSION_KEY)
    if (raw === undefined) return null
    if (!isValidSession(raw)) {
      void clearSessionRecord()
      return null
    }
    return raw
  } catch (err) {
    console.warn('Failed to load session:', err)
    return null
  }
}

/**
 * Persist the playback session under the fixed key, replacing any prior
 * record. Swallow-warn: a failed write degrades resume only; playback must
 * never crash on it.
 */
export async function saveSession(session: PlaybackSession): Promise<void> {
  try {
    const db = await getDB()
    await db.put('session', session, SESSION_KEY)
  } catch (err) {
    console.warn('Failed to save session:', err)
  }
}

/**
 * Remove the persisted session record (dismiss/stop paths). Swallow-warn:
 * never throws into the playback path, even when fired un-awaited from
 * loadSession's clear-on-invalid branch.
 */
export async function clearSessionRecord(): Promise<void> {
  try {
    const db = await getDB()
    await db.delete('session', SESSION_KEY)
  } catch (err) {
    console.warn('Failed to clear session:', err)
  }
}
