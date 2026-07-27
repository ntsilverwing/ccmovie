import { getDB } from './database'
import type { StoredSubtitle } from './database'

/**
 * Save a subtitle record to IndexedDB.
 *
 * Uses `put` (upsert) so re-importing the same file overwrites the existing record.
 *
 * @throws Error if the write fails (e.g., QuotaExceededError)
 */
export async function saveSubtitle(sub: StoredSubtitle): Promise<void> {
  try {
    const db = await getDB()
    await db.put('subtitles', sub)
  } catch (err) {
    throw new Error(`Failed to save subtitle "${sub.fileName}": ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Retrieve a single subtitle by id.
 *
 * @returns The stored subtitle, or undefined if not found.
 */
export async function getSubtitle(id: string): Promise<StoredSubtitle | undefined> {
  try {
    const db = await getDB()
    return db.get('subtitles', id)
  } catch (err) {
    throw new Error(`Failed to get subtitle "${id}": ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Retrieve all stored subtitles, ordered by importedAt (newest-first).
 *
 * Uses the by-importedAt index for efficient ordered retrieval.
 */
export async function getAllSubtitles(): Promise<StoredSubtitle[]> {
  try {
    const db = await getDB()
    return db.getAllFromIndex('subtitles', 'by-importedAt')
  } catch (err) {
    throw new Error(`Failed to get all subtitles: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Delete a subtitle by id.
 *
 * @throws Error if the delete fails.
 */
export async function deleteSubtitle(id: string): Promise<void> {
  try {
    const db = await getDB()
    await db.delete('subtitles', id)
  } catch (err) {
    throw new Error(`Failed to delete subtitle "${id}": ${err instanceof Error ? err.message : String(err)}`)
  }
}
