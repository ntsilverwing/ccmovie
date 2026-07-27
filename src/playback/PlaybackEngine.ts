import type { Cue } from '../types/subtitle'

/**
 * Find the active cue for a given elapsed time using binary search with
 * sequential hint optimization.
 *
 * Fast path 1: still in current cue (hint index) → O(1)
 * Fast path 2: check next cue (most common transition) → O(1)
 * Fallback: binary search → O(log n)
 *
 * Returns -1 when no cue is active.
 */
export function findActiveCue(cues: Cue[], elapsed: number, hint: number): number {
  if (cues.length === 0) return -1

  // Fast path 1: still in current cue
  if (hint >= 0 && hint < cues.length) {
    const cue = cues[hint]
    if (elapsed >= cue.start && elapsed < cue.end) return hint
  }

  // Fast path 2: check next cue (most common transition)
  const next = hint + 1
  if (next >= 0 && next < cues.length) {
    const cue = cues[next]
    if (elapsed >= cue.start && elapsed < cue.end) return next
  }

  // Binary search fallback
  let lo = 0
  let hi = cues.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const cue = cues[mid]
    if (elapsed < cue.start) {
      hi = mid - 1
    } else if (elapsed >= cue.end) {
      lo = mid + 1
    } else {
      return mid
    }
  }

  return -1
}

/**
 * Framework-agnostic playback engine.
 *
 * Timing architecture:
 * - performance.now() is the sole timing source (monotonic, drift-free)
 * - requestAnimationFrame only schedules visual updates
 * - elapsed = performance.now() - startTime (absolute, never accumulated)
 *
 * NEVER use setTimeout/setInterval for subtitle timing.
 * NEVER use the rAF callback timestamp for timing.
 * NEVER accumulate frame deltas.
 */
export class PlaybackEngine {
  private startTime: number = 0
  private isPlaying: boolean = false
  private rafId: number | null = null
  private lastIndex: number = -1
  private cues: Cue[]

  private onCueChange: (index: number) => void

  constructor(cues: Cue[], onCueChange: (index: number) => void) {
    this.cues = cues
    this.onCueChange = onCueChange
  }

  /**
   * Start playback from the beginning.
   * Records startTime via performance.now() and starts the rAF loop.
   */
  play(): void {
    this.startTime = performance.now()
    this.lastIndex = -1
    this.isPlaying = true
    this.tick()
  }

  /**
   * Pause playback. Cancels the rAF loop but preserves position.
   */
  pause(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.isPlaying = false
  }

  /**
   * Stop playback. Cancels rAF, resets state, notifies cue change to -1.
   */
  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.isPlaying = false
    this.lastIndex = -1
    this.onCueChange(-1)
  }

  /**
   * Update the cues array (e.g., when a new file is imported).
   */
  setCues(cues: Cue[]): void {
    this.cues = cues
  }

  /**
   * Tick function — the rAF callback.
   *
   * Computes absolute elapsed time, finds active cue, and notifies
   * only when the active cue changes. Auto-stop when all cues passed.
   */
  private tick = (): void => {
    const elapsed = performance.now() - this.startTime
    const activeIndex = findActiveCue(this.cues, elapsed, this.lastIndex)

    if (activeIndex !== this.lastIndex) {
      this.lastIndex = activeIndex
      this.onCueChange(activeIndex)
    }

    // Auto-stop when elapsed exceeds last cue's end time
    if (activeIndex === -1 && this.cues.length > 0 && elapsed >= this.cues[this.cues.length - 1].end) {
      this.stop()
      return
    }

    // Continue loop if still playing
    if (this.isPlaying) {
      this.rafId = requestAnimationFrame(this.tick)
    }
  }
}
