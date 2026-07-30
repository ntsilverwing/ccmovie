/**
 * Wall-clock playback session model (Phase 5, PLAY-08).
 *
 * Dual-source clock rule (design basis: .planning/notes/audio-sync-assessment.md,
 * 05-PATTERNS.md §7 lines 350-364):
 * - Wall-clock Date.now() anchors the SESSION. A session survives view switches
 *   (Phase 5, in-memory) and is designed to survive reloads (Phase 6, IndexedDB
 *   drop-in) — monotonic clocks do neither.
 * - Monotonic performance.now() stays the PlaybackEngine's SOLE cue-timing
 *   source. This module never replaces engine timing; it mirrors its shape.
 *
 * This module itself reads NO clock. Every wall-clock value enters via an
 * explicit `now` parameter, keeping the math deterministic under test and the
 * session shape directly persistable. All functions are pure and total (never
 * throw) and allocate fresh objects for session transitions.
 *
 * Resume formula (PLAY-08 #4): position while playing = now - startedAt + offsetMs
 * — structurally identical to PlaybackEngine.tick()'s
 * `performance.now() - startTime + offsetMs` with the clock source swapped.
 */

/**
 * A playback session anchor. Phase-6 persist target: every field is a
 * JSON-serializable primitive, no runtime handles.
 */
export interface PlaybackSession {
  /** Deterministic subtitle identity (Phase-6 join key). */
  subtitleId: string
  /** Banner title — avoids a lookup round-trip on sessions restored later. */
  fileName: string
  /** Wall-clock anchor. Position while playing = now - startedAt + offsetMs. */
  startedAt: number
  /** Current sync-offset snapshot; mirrors the engine offset for display. */
  offsetMs: number
  /** Position WITHOUT offset frozen at pause; null while playing. */
  pausedElapsedMs: number | null
}

/**
 * Create a fresh playing session: startedAt = now, pausedElapsedMs = null.
 */
export function createSession(init: {
  subtitleId: string
  fileName: string
  offsetMs: number
  now: number
}): PlaybackSession {
  return {
    subtitleId: init.subtitleId,
    fileName: init.fileName,
    startedAt: init.now,
    offsetMs: init.offsetMs,
    pausedElapsedMs: null,
  }
}

/**
 * Freeze the position at `now` (position WITHOUT offset, mirroring the
 * engine's pausedElapsed). Idempotent: pausing an already-paused session
 * keeps the FIRST frozen value (PlaybackEngine.pause() guard mirror).
 */
export function pauseSession(session: PlaybackSession, now: number): PlaybackSession {
  if (session.pausedElapsedMs !== null) return { ...session }
  return { ...session, pausedElapsedMs: now - session.startedAt }
}

/**
 * Re-anchor for continued play: startedAt = now - pausedElapsedMs so the
 * resume moment shows exactly the frozen value, then continues monotonically
 * (PlaybackEngine.play() line 91 mirror). Idempotent: resuming an
 * already-playing session returns an equal session.
 */
export function resumeSession(session: PlaybackSession, now: number): PlaybackSession {
  if (session.pausedElapsedMs === null) return { ...session }
  return { ...session, startedAt: now - session.pausedElapsedMs, pausedElapsedMs: null }
}

/**
 * Display position INCLUDING offset (banner truth source, D-06):
 * playing = (now - startedAt) + offsetMs; paused = pausedElapsedMs + offsetMs.
 * May be negative when offset pulls before zero — formatting callers clamp
 * via formatElapsedHMS. Always a finite number (total function).
 */
export function sessionElapsedMs(session: PlaybackSession, now: number): number {
  const base =
    session.pausedElapsedMs !== null
      ? session.pausedElapsedMs
      : now - session.startedAt
  return base + session.offsetMs
}

/**
 * Runtime offset adjustment: returns a copy with replaced offsetMs so the
 * session + banner stay in sync. The engine receives its own setOffset
 * separately — the two are never coupled through this module.
 */
export function updateSessionOffset(session: PlaybackSession, offsetMs: number): PlaybackSession {
  return { ...session, offsetMs }
}

/** Zero-pad to two digits. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/**
 * Render milliseconds as "h:mm:ss": hours unpadded and unbounded,
 * minutes/seconds zero-padded, sub-second floored, negatives clamped to
 * "0:00:00".
 */
export function formatElapsedHMS(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}:${pad2(minutes)}:${pad2(seconds)}`
}
