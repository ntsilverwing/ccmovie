/**
 * Cue navigation and touch gesture detection pure functions (Phase 9, UI-04, UI-05).
 *
 * Implements:
 * - D-01: Fullscreen gesture area (touch-action: none)
 * - D-02: 40px short threshold for quick theater swiping
 * - D-03: Vertical-dominant priority (absDeltaY > absDeltaX)
 * - D-04: 300ms gesture throttling
 * - D-05: Up=next, Down=prev
 * - D-06: Boundary stay (no wrap)
 * - D-07: Gap jumping to nearest cue start
 * - D-08: Sequential ordering for overlapping cues
 * - D-11: Target time is cue.start
 * - D-15: Defensive localStorage persistence for first-time gesture guide
 */

export const GESTURE_DELTA_THRESHOLD_PX = 40
export const GESTURE_THROTTLE_MS = 300
export const GESTURE_GUIDE_STORAGE_KEY = 'cinemasyncsubs-gesture-guide-seen'

export type GestureDirection = 'up' | 'down'

/**
 * Evaluates whether a pointer displacement constitutes a valid vertical swipe gesture.
 * Strictly requires vertical displacement magnitude to be >= threshold AND strictly greater than horizontal displacement.
 */
export function detectGesture(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  threshold = GESTURE_DELTA_THRESHOLD_PX
): GestureDirection | null {
  if (
    !Number.isFinite(startX) ||
    !Number.isFinite(startY) ||
    !Number.isFinite(endX) ||
    !Number.isFinite(endY)
  ) {
    return null
  }

  const deltaX = endX - startX
  const deltaY = endY - startY
  const absDeltaX = Math.abs(deltaX)
  const absDeltaY = Math.abs(deltaY)

  // Strictly vertical priority: vertical displacement must dominate horizontal
  if (absDeltaY >= threshold && absDeltaY > absDeltaX) {
    return deltaY < 0 ? 'up' : 'down'
  }

  return null
}

/**
 * Checks whether a gesture should be throttled based on the timestamp of the last trigger.
 */
export function isGestureThrottled(
  now: number,
  lastTriggeredAt: number,
  throttleMs = GESTURE_THROTTLE_MS
): boolean {
  if (lastTriggeredAt <= 0) {
    return false
  }
  return now - lastTriggeredAt < throttleMs
}

import type { Cue } from '../types/subtitle'

/**
 * Calculates the target playback timestamp (ms) when swiping up or down.
 *
 * Rules:
 * - D-05: Up = next subtitle, Down = previous subtitle
 * - D-06: Boundary stay (returns null when already at the first/last boundary)
 * - D-07: In a blank gap between cues, jumping moves to nearest cue start
 * - D-08: Overlapping cues follow original SRT array order
 * - D-11: Target time is cue.start
 */
export function findCueNavigationTarget(
  cues: readonly Cue[],
  currentTimeMs: number,
  direction: GestureDirection
): number | null {
  if (!cues || cues.length === 0 || !Number.isFinite(currentTimeMs)) {
    return null
  }

  // 1. Check if we are currently inside an active cue.
  // In case of overlapping cues, pick the latest matching index in array order.
  let activeIdx = -1
  for (let i = cues.length - 1; i >= 0; i--) {
    const c = cues[i]
    if (c.start <= currentTimeMs && currentTimeMs < c.end) {
      activeIdx = i
      break
    }
  }

  // 2. If inside an active cue:
  if (activeIdx !== -1) {
    if (direction === 'up') {
      return activeIdx + 1 < cues.length ? cues[activeIdx + 1].start : null
    } else {
      return activeIdx - 1 >= 0 ? cues[activeIdx - 1].start : null
    }
  }

  // 3. If in a blank gap:
  // Find first cue that starts after currentTimeMs
  let nextIdx = -1
  for (let i = 0; i < cues.length; i++) {
    if (cues[i].start > currentTimeMs) {
      nextIdx = i
      break
    }
  }

  // Find last cue that ends on or before currentTimeMs
  let prevIdx = -1
  for (let i = cues.length - 1; i >= 0; i--) {
    if (cues[i].end <= currentTimeMs) {
      prevIdx = i
      break
    }
  }

  if (direction === 'up') {
    return nextIdx !== -1 ? cues[nextIdx].start : null
  } else {
    return prevIdx !== -1 ? cues[prevIdx].start : null
  }
}

let memoryFallback = false

export function resetGestureGuideSeenForTesting(): void {
  memoryFallback = false
}

export function hasSeenGestureGuide(storage?: Storage): boolean {
  if (storage !== undefined) {
    try {
      return storage.getItem(GESTURE_GUIDE_STORAGE_KEY) === "true"
    } catch {
      return false
    }
  }
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(GESTURE_GUIDE_STORAGE_KEY) === "true"
    }
  } catch {
    return memoryFallback
  }
  return memoryFallback
}

export function markGestureGuideSeen(storage?: Storage): void {
  if (storage !== undefined) {
    try {
      storage.setItem(GESTURE_GUIDE_STORAGE_KEY, "true")
    } catch {
      // ignore
    }
    return
  }
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(GESTURE_GUIDE_STORAGE_KEY, "true")
      return
    }
  } catch {
    // ignore
  }
  memoryFallback = true
}
