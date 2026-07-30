import { describe, it, expect } from 'vitest'
import {
  createSession,
  pauseSession,
  resumeSession,
  updateSessionOffset,
  sessionElapsedMs,
  formatElapsedHMS,
} from '../../src/playback/session'

// Wall-clock anchor for every fixture — small integer, injected explicitly.
// Never Date.now(), never fake timers: the module under test reads no clock.
const T = 1_000_000

const BASE = { subtitleId: 'sub-42', fileName: 'movie.srt', offsetMs: 0 }

describe('session timing model', () => {
  describe('createSession', () => {
    it('anchors startedAt at the injected now', () => {
      const s = createSession({ ...BASE, now: T })
      expect(s.startedAt).toBe(T)
    })

    it('starts playing (pausedElapsedMs === null)', () => {
      const s = createSession({ ...BASE, now: T })
      expect(s.pausedElapsedMs).toBeNull()
    })

    it('echoes subtitleId, fileName, and offsetMs', () => {
      const s = createSession({ ...BASE, offsetMs: 5000, now: T })
      expect(s.subtitleId).toBe('sub-42')
      expect(s.fileName).toBe('movie.srt')
      expect(s.offsetMs).toBe(5000)
    })
  })

  describe('sessionElapsedMs while playing', () => {
    it('is (now - startedAt) + offsetMs', () => {
      const s = createSession({ ...BASE, offsetMs: 5000, now: T })
      expect(sessionElapsedMs(s, T + 12_000)).toBe(17_000)
    })

    it('may go negative when offset pulls before zero (raw number returned)', () => {
      const s = createSession({ ...BASE, offsetMs: -8000, now: T })
      expect(sessionElapsedMs(s, T + 5_000)).toBe(-3000)
    })

    it('stays a finite number for positions far beyond the cue range', () => {
      const s = createSession({ ...BASE, offsetMs: 0, now: T })
      const elapsed = sessionElapsedMs(s, T + 86_400_000_000)
      expect(Number.isFinite(elapsed)).toBe(true)
    })
  })

  describe('pauseSession', () => {
    it('freezes the position without offset in pausedElapsedMs', () => {
      const s = createSession({ ...BASE, offsetMs: 5000, now: T })
      const paused = pauseSession(s, T + 60_000)
      expect(paused.pausedElapsedMs).toBe(60_000)
    })

    it('frozen elapsed (with offset added back) does not drift after pause', () => {
      const s = createSession({ ...BASE, offsetMs: 0, now: T })
      const paused = pauseSession(s, T + 60_000)
      expect(sessionElapsedMs(paused, T + 90_000)).toBe(60_000)
      expect(sessionElapsedMs(paused, T + 3_600_000)).toBe(60_000)
    })

    it('returns a NEW object (no in-place mutation)', () => {
      const s = createSession({ ...BASE, now: T })
      const paused = pauseSession(s, T + 60_000)
      expect(paused).not.toBe(s)
      expect(s.pausedElapsedMs).toBeNull()
    })

    it('is idempotent — double-pause keeps the FIRST frozen value', () => {
      const s = createSession({ ...BASE, now: T })
      const first = pauseSession(s, T + 60_000)
      const second = pauseSession(first, T + 90_000)
      expect(second.pausedElapsedMs).toBe(60_000)
    })
  })

  describe('resumeSession', () => {
    it('shows exactly the frozen value at the resume instant (no jump)', () => {
      const s = createSession({ ...BASE, now: T })
      const paused = pauseSession(s, T + 60_000)
      const resumed = resumeSession(paused, T + 3_600_000)
      expect(sessionElapsedMs(resumed, T + 3_600_000)).toBe(60_000)
    })

    it('continues monotonically after resume', () => {
      const s = createSession({ ...BASE, now: T })
      const paused = pauseSession(s, T + 60_000)
      const resumed = resumeSession(paused, T + 3_600_000)
      expect(sessionElapsedMs(resumed, T + 3_605_000)).toBe(61_000)
    })

    it('re-anchors startedAt = now - pausedElapsedMs (engine play() mirror)', () => {
      const s = createSession({ ...BASE, now: T })
      const paused = pauseSession(s, T + 60_000)
      const resumed = resumeSession(paused, T + 3_600_000)
      expect(resumed.startedAt).toBe(T + 3_600_000 - 60_000)
      expect(resumed.pausedElapsedMs).toBeNull()
    })

    it('is idempotent — double-resume returns an equal session', () => {
      const s = createSession({ ...BASE, now: T })
      const paused = pauseSession(s, T + 60_000)
      const resumed = resumeSession(paused, T + 3_600_000)
      const again = resumeSession(resumed, T + 3_700_000)
      expect(again).toEqual(resumed)
    })
  })

  describe('PLAY-08 resume formula shape', () => {
    it('preserves position across a 600s absence with a -2500ms offset', () => {
      const s = createSession({ ...BASE, offsetMs: 0, now: T })
      const paused = pauseSession(s, T + 600_000)
      const shifted = updateSessionOffset(paused, -2500)
      // 600s wall-clock absence while paused
      const resumed = resumeSession(shifted, T + 1_200_000)
      // elapsed = now - startedAt + offset → 600000 - 2500
      expect(sessionElapsedMs(resumed, T + 1_200_000)).toBe(597_500)
    })
  })

  describe('updateSessionOffset', () => {
    it('shifts the display position by the delta immediately', () => {
      const s = createSession({ ...BASE, offsetMs: 5000, now: T })
      expect(sessionElapsedMs(s, T + 10_000)).toBe(15_000)
      const shifted = updateSessionOffset(s, 8000)
      expect(sessionElapsedMs(shifted, T + 10_000)).toBe(18_000)
    })

    it('returns a NEW session with replaced offsetMs', () => {
      const s = createSession({ ...BASE, offsetMs: 5000, now: T })
      const shifted = updateSessionOffset(s, 8000)
      expect(shifted).not.toBe(s)
      expect(shifted.offsetMs).toBe(8000)
      expect(s.offsetMs).toBe(5000)
    })
  })

  describe('formatElapsedHMS', () => {
    const cases: Array<[number, string]> = [
      [0, '0:00:00'],
      [999, '0:00:00'],
      [60_000, '0:01:00'],
      [452_000, '0:07:32'],
      [3_599_000, '0:59:59'],
      [3_600_000, '1:00:00'],
      [5_025_000, '1:23:45'],
      [90_061_000, '25:01:01'],
      [-5000, '0:00:00'],
    ]

    it.each(cases)('%s ms → "%s"', (ms, expected) => {
      expect(formatElapsedHMS(ms)).toBe(expected)
    })
  })
})
