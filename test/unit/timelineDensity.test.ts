import { describe, it, expect } from 'vitest'
import {
  computeCueDensityBuckets,
  clampToDuration,
  clampPreviewTarget,
  computeKeyboardStepTarget,
  KEYBOARD_STEP_MS,
} from '../../src/playback/timelineDensity'
import type { Cue } from '../../src/types/subtitle'

// Named fixture constants — explicit integers, no Date.now(), no fake timers:
// the module under test reads no clock.
const CUES_EMPTY: Cue[] = []

const CUES_SINGLE: Cue[] = [{ id: 1, start: 0, end: 500, text: 'one' }]

// Cues with counts 1 / 2 / 3 across three buckets (bucketMs = 1000).
const CUES_TIERS: Cue[] = [
  { id: 1, start: 0, end: 400, text: 'a' },
  { id: 2, start: 1050, end: 1100, text: 'b' },
  { id: 3, start: 1150, end: 1200, text: 'c' },
  { id: 4, start: 2050, end: 2100, text: 'd' },
  { id: 5, start: 2150, end: 2200, text: 'e' },
  { id: 6, start: 2250, end: 2300, text: 'f' },
]

// Overlapping cues (parser preserves array order, 07-D-06) landing in one bucket.
const CUES_OVERLAP: Cue[] = [
  { id: 1, start: 0, end: 600, text: 'first' },
  { id: 2, start: 100, end: 300, text: 'second' },
]

describe('computeCueDensityBuckets', () => {
  it('returns [] for empty cues', () => {
    expect(computeCueDensityBuckets(CUES_EMPTY, 10_000, 10)).toEqual([])
  })

  it('returns [] when totalDurationMs <= 0', () => {
    expect(computeCueDensityBuckets(CUES_SINGLE, 0, 10)).toEqual([])
    expect(computeCueDensityBuckets(CUES_SINGLE, -1000, 10)).toEqual([])
  })

  it('returns [] when bucketCount <= 0', () => {
    expect(computeCueDensityBuckets(CUES_SINGLE, 10_000, 0)).toEqual([])
    expect(computeCueDensityBuckets(CUES_SINGLE, 10_000, -3)).toEqual([])
  })

  it('returns exactly bucketCount buckets', () => {
    const buckets = computeCueDensityBuckets(CUES_SINGLE, 10_000, 4)
    expect(buckets).toHaveLength(4)
  })

  it('sets bucket boundaries at i*bucketMs and (i+1)*bucketMs', () => {
    const buckets = computeCueDensityBuckets(CUES_SINGLE, 10_000, 4)
    // bucketMs = 2500
    expect(buckets[0]).toMatchObject({ startMs: 0, endMs: 2500 })
    expect(buckets[1]).toMatchObject({ startMs: 2500, endMs: 5000 })
    expect(buckets[2]).toMatchObject({ startMs: 5000, endMs: 7500 })
    expect(buckets[3]).toMatchObject({ startMs: 7500, endMs: 10_000 })
  })

  it('marks the single occupied bucket tier 3 and the rest tier 0', () => {
    const buckets = computeCueDensityBuckets(CUES_SINGLE, 10_000, 4)
    // cue [0, 500) fully inside bucket 0 → count 1, ratio 1 > 2/3 → tier 3
    expect(buckets[0].tier).toBe(3)
    expect(buckets[1].tier).toBe(0)
    expect(buckets[2].tier).toBe(0)
    expect(buckets[3].tier).toBe(0)
  })

  it('counts a cue spanning a bucket boundary into both buckets', () => {
    // cue [0, 2600) spans buckets 0 and 1 (bucketMs = 2500): end-1 = 2599 → bucket 1
    const cues: Cue[] = [{ id: 1, start: 0, end: 2600, text: 'span' }]
    const buckets = computeCueDensityBuckets(cues, 10_000, 4)
    expect(buckets[0].tier).toBe(3)
    expect(buckets[1].tier).toBe(3)
    expect(buckets[2].tier).toBe(0)
  })

  it('does not spill a cue ending exactly on a bucket boundary into the next bucket', () => {
    // cue [0, 500) with bucketMs = 500: end sits exactly on the boundary.
    // Half-open [start, end): floor((end-1)/bucketMs) = floor(499/500) = 0 → only bucket 0.
    const cues: Cue[] = [{ id: 1, start: 0, end: 500, text: 'edge' }]
    const buckets = computeCueDensityBuckets(cues, 1000, 2)
    expect(buckets[0].tier).toBe(3)
    expect(buckets[1].tier).toBe(0)
  })

  it('gives empty buckets tier 0 (no marker, D-09)', () => {
    // Only bucket 1 has a cue; buckets 0 and 2 stay empty.
    const cues: Cue[] = [{ id: 1, start: 1100, end: 1200, text: 'mid' }]
    const buckets = computeCueDensityBuckets(cues, 3000, 3)
    expect(buckets[0].tier).toBe(0)
    expect(buckets[1].tier).toBe(3)
    expect(buckets[2].tier).toBe(0)
  })

  it('maps three buckets with counts 1/2/3 to tiers 1/2/3 (UI-SPEC deterministic thresholds)', () => {
    // max = 3: ratio 1/3 → tier 1, ratio 2/3 → tier 2, ratio 1 → tier 3.
    const buckets = computeCueDensityBuckets(CUES_TIERS, 3000, 3)
    expect(buckets[0].tier).toBe(1)
    expect(buckets[1].tier).toBe(2)
    expect(buckets[2].tier).toBe(3)
  })

  it('counts overlapping cues independently in array order (07-D-06)', () => {
    // Two overlapping cues land in bucket 0 (bucketMs = 1000) → count 2.
    const buckets = computeCueDensityBuckets(CUES_OVERLAP, 1000, 1)
    expect(buckets[0].tier).toBe(3)
    expect(buckets).toHaveLength(1)
  })
})

describe('clampToDuration', () => {
  it('returns in-range values unchanged', () => {
    expect(clampToDuration(5000, 10_000)).toBe(5000)
    expect(clampToDuration(0, 10_000)).toBe(0)
    expect(clampToDuration(10_000, 10_000)).toBe(10_000)
  })

  it('clamps negative values to 0', () => {
    expect(clampToDuration(-1, 10_000)).toBe(0)
    expect(clampToDuration(-50_000, 10_000)).toBe(0)
  })

  it('clamps values beyond total to total', () => {
    expect(clampToDuration(10_001, 10_000)).toBe(10_000)
    expect(clampToDuration(999_999, 10_000)).toBe(10_000)
  })

  it('rejects NaN as 0', () => {
    expect(clampToDuration(NaN, 10_000)).toBe(0)
  })

  it('rejects +Infinity as 0', () => {
    expect(clampToDuration(Infinity, 10_000)).toBe(0)
  })

  it('rejects -Infinity as 0', () => {
    expect(clampToDuration(-Infinity, 10_000)).toBe(0)
  })

  it('returns 0 for every input when totalDurationMs <= 0', () => {
    expect(clampToDuration(0, 0)).toBe(0)
    expect(clampToDuration(5000, 0)).toBe(0)
    expect(clampToDuration(5000, -1000)).toBe(0)
    expect(clampToDuration(NaN, 0)).toBe(0)
  })
})

describe('clampPreviewTarget', () => {
  it('returns in-range values inside [0, total-1] unchanged', () => {
    expect(clampPreviewTarget(5000, 10_000)).toBe(5000)
    expect(clampPreviewTarget(0, 10_000)).toBe(0)
    expect(clampPreviewTarget(9999, 10_000)).toBe(9999)
  })

  it('clamps target === total to total - 1 (preview never hits the exact end, Pitfall 2)', () => {
    expect(clampPreviewTarget(10_000, 10_000)).toBe(9999)
  })

  it('clamps values beyond total to total - 1', () => {
    expect(clampPreviewTarget(50_000, 10_000)).toBe(9999)
  })

  it('clamps negative values to 0', () => {
    expect(clampPreviewTarget(-1, 10_000)).toBe(0)
  })

  it('rejects NaN as 0', () => {
    expect(clampPreviewTarget(NaN, 10_000)).toBe(0)
  })

  it('returns 0 when totalDurationMs === 0', () => {
    expect(clampPreviewTarget(5000, 0)).toBe(0)
  })

  it('returns 0 when totalDurationMs === 1', () => {
    expect(clampPreviewTarget(5000, 1)).toBe(0)
  })
})

describe('computeKeyboardStepTarget', () => {
  it('steps forward by 5000ms for direction 1', () => {
    expect(computeKeyboardStepTarget(1000, 1, 60_000)).toBe(6000)
  })

  it('steps backward by 5000ms for direction -1', () => {
    expect(computeKeyboardStepTarget(10_000, -1, 60_000)).toBe(5000)
  })

  it('clamps to total near the end', () => {
    expect(computeKeyboardStepTarget(58_000, 1, 60_000)).toBe(60_000)
  })

  it('clamps to 0 near the start', () => {
    expect(computeKeyboardStepTarget(1000, -1, 60_000)).toBe(0)
  })

  it('rejects NaN current position as 0', () => {
    expect(computeKeyboardStepTarget(NaN, 1, 60_000)).toBe(0)
  })

  it('uses a 5000ms step (D-12)', () => {
    expect(KEYBOARD_STEP_MS).toBe(5000)
  })
})
