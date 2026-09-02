import type { Cue } from '../types/subtitle'

export interface DensityBucket {
  startMs: number
  endMs: number
  tier: 0 | 1 | 2 | 3
}

export const KEYBOARD_STEP_MS = 0

export function computeCueDensityBuckets(_cues: Cue[], _totalDurationMs: number, _bucketCount: number): DensityBucket[] {
  return []
}

export function clampToDuration(_targetMs: number, _totalDurationMs: number): number {
  return 0
}

export function clampPreviewTarget(_targetMs: number, _totalDurationMs: number): number {
  return 0
}

export function computeKeyboardStepTarget(_currentMs: number, _direction: -1 | 1, _totalDurationMs: number): number {
  return 0
}
