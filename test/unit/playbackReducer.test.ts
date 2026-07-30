import { describe, it, expect } from 'vitest'
import { playbackReducer } from '../../src/hooks/usePlaybackEngine'
import type { PlaybackState } from '../../src/hooks/usePlaybackEngine'

const CUES = [
  { id: 1, start: 0, end: 1000, text: 'First' },
  { id: 2, start: 1000, end: 2000, text: 'Second' },
]

const INITIAL: PlaybackState = {
  status: 'idle',
  currentIndex: -1,
  activeCue: null,
}

describe('playbackReducer', () => {
  it('transitions to playing on PLAY', () => {
    const state = playbackReducer(INITIAL, { type: 'PLAY' })
    expect(state.status).toBe('playing')
    expect(state.currentIndex).toBe(-1)
  })

  it('transitions to paused on PAUSE', () => {
    const playing = playbackReducer(INITIAL, { type: 'PLAY' })
    const state = playbackReducer(playing, { type: 'PAUSE' })
    expect(state.status).toBe('paused')
  })

  it('resets on STOP', () => {
    const playing = playbackReducer(INITIAL, { type: 'PLAY' })
    const ticked = playbackReducer(playing, { type: 'TICK', activeIndex: 0, cues: CUES })
    const state = playbackReducer(ticked, { type: 'STOP' })
    expect(state.status).toBe('idle')
    expect(state.currentIndex).toBe(-1)
    expect(state.activeCue).toBeNull()
  })

  it('sets active cue on TICK with valid index', () => {
    const state = playbackReducer(INITIAL, { type: 'TICK', activeIndex: 1, cues: CUES })
    expect(state.currentIndex).toBe(1)
    expect(state.activeCue).toEqual(CUES[1])
  })

  it('clears active cue on TICK with -1', () => {
    const ticked = playbackReducer(INITIAL, { type: 'TICK', activeIndex: 0, cues: CUES })
    const state = playbackReducer(ticked, { type: 'TICK', activeIndex: -1, cues: CUES })
    expect(state.activeCue).toBeNull()
  })

  it('returns same reference when index unchanged', () => {
    const first = playbackReducer(INITIAL, { type: 'TICK', activeIndex: 0, cues: CUES })
    const second = playbackReducer(first, { type: 'TICK', activeIndex: 0, cues: CUES })
    expect(first).toBe(second)
  })

  it('returns NEW state when index changes', () => {
    const first = playbackReducer(INITIAL, { type: 'TICK', activeIndex: 0, cues: CUES })
    const second = playbackReducer(first, { type: 'TICK', activeIndex: 1, cues: CUES })
    expect(first).not.toBe(second)
  })

  it('handles unknown action gracefully', () => {
    // @ts-expect-error testing unknown action
    const state = playbackReducer(INITIAL, { type: 'UNKNOWN' })
    expect(state).toBe(INITIAL)
  })
})
