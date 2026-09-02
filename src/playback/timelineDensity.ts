import type { Cue } from '../types/subtitle'

/**
 * Cue-density bucketing and seek-target clamping (Phase 8, D-07/D-08/D-09).
 *
 * Invariants (design basis: 08-CONTEXT.md, 08-UI-SPEC.md §密度分桶合同):
 * - Buckets are half-open [startMs, endMs) spanning [0, totalDurationMs].
 * - A cue overlapping a bucket boundary counts in EVERY bucket it touches;
 *   a cue ending exactly on a boundary stays in the earlier bucket
 *   (end-1 guard, Pitfall 7).
 * - Cues are parser-ordered and overlapping cues each count independently
 *   in array order (07-D-06) — no deduplication, no reordering.
 * - Tier mapping is the UI-SPEC deterministic threshold: count 0 → tier 0;
 *   ratio = count / max, ratio <= 1/3 → tier 1, ratio <= 2/3 → tier 2,
 *   else tier 3 (D-08 three brightness levels; low density is never
 *   promoted to full brightness, D-09).
 *
 * This module reads NO clock and never throws. All functions are pure and
 * total: degenerate inputs short-circuit, non-finite values are rejected
 * (not clamped) per the tamper-resistant boundary contract (T-08-01).
 */

/** One timeline density bucket. tier 0 = empty (no marker rendered, D-09). */
export interface DensityBucket {
  startMs: number
  endMs: number
  tier: 0 | 1 | 2 | 3
}

/** Keyboard arrow step for the Timeline (Phase 8, D-12): 5 seconds. */
export const KEYBOARD_STEP_MS = 5000

/**
 * Bucket cues into `bucketCount` equal-width buckets over
 * [0, totalDurationMs] and grade each bucket's density into three
 * brightness tiers (Phase 8, D-07/D-08/D-09).
 *
 * Degenerate inputs (empty cues, non-positive total/bucket count) yield []
 * — callers render no markers. Fixed bucketCount keeps the DOM marker
 * count constant regardless of subtitle file size (T-08-02 DoS guard).
 */
export function computeCueDensityBuckets(cues: Cue[], totalDurationMs: number, bucketCount: number): DensityBucket[] {
  if (totalDurationMs <= 0 || cues.length === 0 || bucketCount <= 0) return []
  const bucketMs = totalDurationMs / bucketCount
  const counts = new Array<number>(bucketCount).fill(0)
  for (const cue of cues) {
    // Half-open [start, end): end-1 keeps a cue ending exactly on a
    // boundary inside the earlier bucket (Pitfall 7).
    const first = Math.max(0, Math.floor(cue.start / bucketMs))
    const last = Math.min(bucketCount - 1, Math.floor((cue.end - 1) / bucketMs))
    for (let i = first; i <= last; i++) counts[i]++
  }
  const max = Math.max(...counts)
  return counts.map((count, i) => ({
    startMs: i * bucketMs,
    endMs: (i + 1) * bucketMs,
    // UI-SPEC locked thresholds (supersedes the RESEARCH ceil draft, which
    // only produced two non-empty tiers — D-08 requires three).
    tier: (count === 0 ? 0 : count / max <= 1 / 3 ? 1 : count / max <= 2 / 3 ? 2 : 3) as DensityBucket['tier'],
  }))
}

/**
 * Clamp a seek target to the commit range [0, totalDurationMs]
 * (Phase 7, 07-D-02). Non-finite values (NaN/±Infinity) are rejected to 0
 * — never clamped through — so malformed parse output or tampered records
 * cannot produce a wild position (T-08-01). The commit path intentionally
 * allows the exact end (07-D-03: seeking to total is a legal immediate
 * stop); preview targets use clampPreviewTarget instead.
 */
export function clampToDuration(targetMs: number, totalDurationMs: number): number {
  if (!Number.isFinite(targetMs)) return 0
  return Math.min(Math.max(targetMs, 0), Math.max(0, totalDurationMs))
}

/**
 * Clamp a DRAG-PREVIEW target to [0, totalDurationMs - 1] (Phase 8,
 * Pitfall 2): the engine's tick auto-stops and clears the session when it
 * reaches the exact end, which would unmount the Timeline mid-drag. The
 * preview path must therefore stop strictly before the end; the commit
 * path (clampToDuration) keeps the 07-D-03 exact-end semantics.
 */
export function clampPreviewTarget(targetMs: number, totalDurationMs: number): number {
  const clamped = clampToDuration(targetMs, totalDurationMs)
  return Math.min(clamped, Math.max(0, totalDurationMs - 1))
}

/**
 * Keyboard arrow-step target (Phase 8, D-12): ±KEYBOARD_STEP_MS from the
 * current position, clamped to the commit range [0, totalDurationMs]
 * (07-D-02). Non-finite current positions resolve to 0 via clampToDuration.
 */
export function computeKeyboardStepTarget(currentMs: number, direction: -1 | 1, totalDurationMs: number): number {
  return clampToDuration(currentMs + direction * KEYBOARD_STEP_MS, totalDurationMs)
}
