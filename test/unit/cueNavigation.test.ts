import { describe, it, expect } from 'vitest'
import {
  detectGesture,
  isGestureThrottled,
  GESTURE_DELTA_THRESHOLD_PX,
  GESTURE_THROTTLE_MS,
} from '../../src/playback/cueNavigation'

describe('detectGesture (T-09-Math, UI-04, D-02, D-03)', () => {
  it('identifies vertical upward swipe when displacement >= 40px and vertical dominates', () => {
    // startY: 100, endY: 60 -> deltaY = -40
    expect(detectGesture(0, 100, 0, 60)).toBe('up')
    expect(detectGesture(10, 100, 15, 40)).toBe('up') // deltaX = 5, deltaY = -60
  })

  it('identifies vertical downward swipe when displacement >= 40px and vertical dominates', () => {
    // startY: 100, endY: 140 -> deltaY = 40
    expect(detectGesture(0, 100, 0, 140)).toBe('down')
    expect(detectGesture(10, 100, 15, 160)).toBe('down') // deltaX = 5, deltaY = 60
  })

  it('rejects vertical displacement less than 40px (short threshold D-02)', () => {
    // 39px upward
    expect(detectGesture(0, 100, 0, 61)).toBeNull()
    // 39px downward
    expect(detectGesture(0, 100, 0, 139)).toBeNull()
    // 0 displacement
    expect(detectGesture(50, 50, 50, 50)).toBeNull()
  })

  it('rejects horizontal-dominant or diagonal swipes (strictly vertical priority D-03)', () => {
    // horizontal swipe: deltaX = 50, deltaY = -20
    expect(detectGesture(0, 100, 50, 80)).toBeNull()
    // diagonal tie: deltaX = 45, deltaY = 45 -> strictly vertical required
    expect(detectGesture(0, 0, 45, 45)).toBeNull()
    expect(detectGesture(0, 0, -45, -45)).toBeNull()
  })

  it('rejects non-finite coordinate inputs safely', () => {
    expect(detectGesture(NaN, 0, 0, 50)).toBeNull()
    expect(detectGesture(0, Infinity, 0, 50)).toBeNull()
    expect(detectGesture(0, 0, 0, NaN)).toBeNull()
  })

  it('uses default threshold GESTURE_DELTA_THRESHOLD_PX = 40', () => {
    expect(GESTURE_DELTA_THRESHOLD_PX).toBe(40)
  })
})

describe('isGestureThrottled (UI-04, D-04)', () => {
  it('exposes GESTURE_THROTTLE_MS = 300', () => {
    expect(GESTURE_THROTTLE_MS).toBe(300)
  })

  it('returns true when time since last trigger is strictly less than 300ms', () => {
    const lastTriggered = 1000
    expect(isGestureThrottled(1000, lastTriggered)).toBe(true)
    expect(isGestureThrottled(1150, lastTriggered)).toBe(true)
    expect(isGestureThrottled(1299, lastTriggered)).toBe(true)
  })

  it('returns false when time since last trigger is >= 300ms', () => {
    const lastTriggered = 1000
    expect(isGestureThrottled(1300, lastTriggered)).toBe(false)
    expect(isGestureThrottled(1500, lastTriggered)).toBe(false)
  })

  it('returns false when lastTriggeredAt is 0 (initial state)', () => {
    expect(isGestureThrottled(500, 0)).toBe(false)
  })
})

import type { Cue } from '../../src/types/subtitle'
import { findCueNavigationTarget } from '../../src/playback/cueNavigation'

describe('findCueNavigationTarget (T-09-Boundary, UI-04, D-05, D-06, D-07, D-08, D-11)', () => {
  const sampleCues: Cue[] = [
    { id: '1', start: 1000, end: 3000, text: 'First line' },
    { id: '2', start: 4000, end: 6000, text: 'Second line' },
    { id: '3', start: 7000, end: 9000, text: 'Third line' },
  ]

  it('returns null if cues array is empty', () => {
    expect(findCueNavigationTarget([], 1500, 'up')).toBeNull()
    expect(findCueNavigationTarget([], 1500, 'down')).toBeNull()
  })

  it('navigates to adjacent cues when currently active inside a cue (D-05, D-11)', () => {
    // In Cue 1 (4000-6000) at 5000ms
    expect(findCueNavigationTarget(sampleCues, 5000, 'up')).toBe(7000) // Cue 2 start
    expect(findCueNavigationTarget(sampleCues, 5000, 'down')).toBe(1000) // Cue 0 start
  })

  it('stays at boundaries when at first or last cue (no loop D-06)', () => {
    // In Cue 0 (1000-3000) at 1500ms
    expect(findCueNavigationTarget(sampleCues, 1500, 'down')).toBeNull()
    expect(findCueNavigationTarget(sampleCues, 1500, 'up')).toBe(4000)

    // In Cue 2 (7000-9000) at 8000ms
    expect(findCueNavigationTarget(sampleCues, 8000, 'up')).toBeNull()
    expect(findCueNavigationTarget(sampleCues, 8000, 'down')).toBe(4000)
  })

  it('navigates correctly from gaps between cues (D-07)', () => {
    // Gap between Cue 0 and Cue 1: 3500ms
    expect(findCueNavigationTarget(sampleCues, 3500, 'up')).toBe(4000) // Next cue start
    expect(findCueNavigationTarget(sampleCues, 3500, 'down')).toBe(1000) // Prev cue start

    // Gap between Cue 1 and Cue 2: 6500ms
    expect(findCueNavigationTarget(sampleCues, 6500, 'up')).toBe(7000)
    expect(findCueNavigationTarget(sampleCues, 6500, 'down')).toBe(4000)
  })

  it('handles intro and outro gaps (D-06, D-07)', () => {
    // Before first cue: 500ms
    expect(findCueNavigationTarget(sampleCues, 500, 'up')).toBe(1000)
    expect(findCueNavigationTarget(sampleCues, 500, 'down')).toBeNull()

    // After last cue: 10000ms
    expect(findCueNavigationTarget(sampleCues, 10000, 'up')).toBeNull()
    expect(findCueNavigationTarget(sampleCues, 10000, 'down')).toBe(7000)
  })

  it('handles overlapping cues in original SRT array order (D-08, 07-D-06)', () => {
    const overlappingCues: Cue[] = [
      { id: '1', start: 1000, end: 5000, text: 'Cue 1' },
      { id: '2', start: 2000, end: 4000, text: 'Cue 2 (nested)' },
      { id: '3', start: 6000, end: 8000, text: 'Cue 3' },
    ]

    // At 2500ms, both Cue 1 and Cue 2 are active. Active index = 1 (most recent or last active in array order)
    // Moving up should target Cue 3 (6000)
    expect(findCueNavigationTarget(overlappingCues, 2500, 'up')).toBe(6000)
    // Moving down should target Cue 1 start (1000)
    expect(findCueNavigationTarget(overlappingCues, 2500, 'down')).toBe(1000)
  })

  it('correctly handles boundary timestamps (cue.start is inclusive, cue.end is exclusive)', () => {
    // Exactly at start of Cue 1 (4000ms)
    expect(findCueNavigationTarget(sampleCues, 4000, 'up')).toBe(7000)
    expect(findCueNavigationTarget(sampleCues, 4000, 'down')).toBe(1000)

    // Exactly at end of Cue 0 (3000ms) -> treated as in gap between Cue 0 and Cue 1
    expect(findCueNavigationTarget(sampleCues, 3000, 'up')).toBe(4000)
    expect(findCueNavigationTarget(sampleCues, 3000, 'down')).toBe(1000)
  })
})

import {
  hasSeenGestureGuide,
  markGestureGuideSeen,
  GESTURE_GUIDE_STORAGE_KEY,
} from '../../src/playback/cueNavigation'

describe('GestureGuide storage helpers (T-09-Storage, UI-05, D-15)', () => {
  it('reads and writes to provided storage correctly', () => {
    const store: Record<string, string> = {}
    const mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value
      },
      removeItem: (key: string) => {
        delete store[key]
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k]
      },
      length: 0,
      key: () => null,
    } as Storage

    expect(hasSeenGestureGuide(mockStorage)).toBe(false)
    markGestureGuideSeen(mockStorage)
    expect(mockStorage.getItem(GESTURE_GUIDE_STORAGE_KEY)).toBe('true')
    expect(hasSeenGestureGuide(mockStorage)).toBe(true)
  })

  it('handles storage exceptions defensively without throwing (private browsing / SecurityError)', () => {
    const errorStorage = {
      getItem: () => {
        throw new Error('SecurityError: access denied')
      },
      setItem: () => {
        throw new Error('QuotaExceededError: storage quota exceeded')
      },
    } as unknown as Storage

    expect(() => hasSeenGestureGuide(errorStorage)).not.toThrow()
    expect(hasSeenGestureGuide(errorStorage)).toBe(false)
    expect(() => markGestureGuideSeen(errorStorage)).not.toThrow()
  })

  it('handles null/undefined storage gracefully', () => {
    expect(hasSeenGestureGuide(undefined)).toBe(false)
    expect(() => markGestureGuideSeen(undefined)).not.toThrow()
  })
})
