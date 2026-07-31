import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { findActiveCue, PlaybackEngine } from '../../src/playback/PlaybackEngine'
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

describe('PlaybackEngine onEnded / seekTo', () => {
  // Minimal harness in this file's existing vitest idiom (no new mocking
  // libraries): stub rAF so engine ticks run synchronously under test
  // control, and stub performance.now so elapsed advances deterministically.
  let fakeNow: number
  let rafQueue: Array<(t: number) => void>

  /** Run every queued rAF callback once (each tick re-queues itself if playing). */
  function runFrame(): void {
    const pending = rafQueue
    rafQueue = []
    for (const cb of pending) cb(fakeNow)
  }

  /** Advance the fake clock by `ms` then run one frame. */
  function advance(ms: number): void {
    fakeNow += ms
    runFrame()
  }

  beforeEach(() => {
    fakeNow = 1000
    rafQueue = []
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.spyOn(performance, 'now').mockImplementation(() => fakeNow)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fires onEnded exactly once when elapsed passes the last cue end (natural exhaustion)', () => {
    const onEnded = vi.fn()
    const engine = new PlaybackEngine(CUES, () => {}, onEnded)
    engine.play() // synchronous first tick; elapsed = 0 at fakeNow = 1000
    advance(6100) // elapsed 6100 >= last cue end (6000) → auto-stop
    expect(onEnded).toHaveBeenCalledTimes(1)
  })

  it('fires onEnded for the cues-empty halt path as well', () => {
    const onEnded = vi.fn()
    const engine = new PlaybackEngine([], () => {}, onEnded)
    engine.play() // first tick hits the empty-cues branch
    expect(onEnded).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire onEnded on explicit stop()', () => {
    const onEnded = vi.fn()
    const engine = new PlaybackEngine(CUES, () => {}, onEnded)
    engine.play()
    advance(500)
    engine.stop()
    expect(onEnded).not.toHaveBeenCalled()
  })

  it('seekTo re-anchors to the target cue and playback continues uninterrupted', () => {
    const seen: number[] = []
    const onEnded = vi.fn()
    const engine = new PlaybackEngine(CUES, (i) => seen.push(i), onEnded)
    engine.play()
    advance(1500) // elapsed 1500 → cue 1 active
    expect(seen[seen.length - 1]).toBe(1)

    engine.seekTo(2500) // offset-inclusive target inside cue 2 [2000,3000)
    advance(16) // one tick — hint reset must re-fire the cue at the target
    expect(seen[seen.length - 1]).toBe(2)
    advance(16) // still playing: rAF loop re-queued, no stop, no onEnded
    expect(onEnded).not.toHaveBeenCalled()
    expect(rafQueue.length).toBeGreaterThan(0)
  })

  it('seekTo at/past the final cue end converges via natural exhaustion (no crash, no negative display)', () => {
    const onEnded = vi.fn()
    const engine = new PlaybackEngine(CUES, () => {}, onEnded)
    engine.play()
    advance(1000)
    engine.seekTo(6100) // past last cue end (6000)
    advance(16) // first tick hits natural exhaustion → idle convergence
    expect(onEnded).toHaveBeenCalledTimes(1)
    expect(rafQueue.length).toBe(0)
  })
})
