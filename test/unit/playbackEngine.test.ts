import { describe, it, expect } from 'vitest'
import { findActiveCue } from '../../src/playback/PlaybackEngine'
import type { Cue } from '../../src/types/subtitle'

const CUES: Cue[] = [
  { id: 1, start: 0, end: 1000, text: 'First' },
  { id: 2, start: 1000, end: 2000, text: 'Second' },
  { id: 3, start: 2000, end: 3000, text: 'Third' },
  { id: 4, start: 5000, end: 6000, text: 'Gap after' },
]

describe('findActiveCue', () => {
  it('returns -1 for empty cues', () => {
    expect(findActiveCue([], 500, -1)).toBe(-1)
  })

  it('finds cue at exact start time', () => {
    expect(findActiveCue(CUES, 0, -1)).toBe(0)
  })

  it('finds cue mid-duration', () => {
    expect(findActiveCue(CUES, 1500, -1)).toBe(1)
  })

  it('returns -1 just before cue end (exclusive)', () => {
    // end is exclusive: elapsed == end means not active
    expect(findActiveCue(CUES, 1000, -1)).toBe(1)
    expect(findActiveCue(CUES, 2000, -1)).toBe(2)
  })

  it('returns -1 in gap between cues', () => {
    expect(findActiveCue(CUES, 3500, -1)).toBe(-1)
    expect(findActiveCue(CUES, 4000, -1)).toBe(-1)
  })

  it('handles time before first cue', () => {
    expect(findActiveCue(CUES, -100, -1)).toBe(-1)
  })

  it('handles time after last cue', () => {
    expect(findActiveCue(CUES, 10000, -1)).toBe(-1)
  })

  it('uses hint fast path for same cue', () => {
    // hint=1 means we checked cues[1] last; should hit fast path 1
    expect(findActiveCue(CUES, 1500, 1)).toBe(1)
  })

  it('uses hint fast path for next cue', () => {
    // hint=0 means last cue was 0; when time advances to cue 1, hits fast path 2
    expect(findActiveCue(CUES, 1500, 0)).toBe(1)
  })

  it('falls back to binary search when hint is stale', () => {
    // hint=2 (last was cue 2), time is now in cue 0 — not adjacent, needs binary search
    expect(findActiveCue(CUES, 500, 2)).toBe(0)
  })
})
