import { useReducer, useRef, useEffect, useCallback } from 'react'
import type { Cue } from '../types/subtitle'
import { PlaybackEngine } from '../playback/PlaybackEngine'

/**
 * Playback status — the three states of the playback state machine.
 */
export type PlaybackStatus = 'idle' | 'playing' | 'paused'

/**
 * Playback state — what the UI renders from.
 */
export interface PlaybackState {
  status: PlaybackStatus
  currentIndex: number
  activeCue: Cue | null
}

/**
 * Playback actions — well-defined transitions between states.
 */
export type PlaybackAction =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'STOP' }
  | { type: 'TICK'; activeIndex: number; cues: Cue[] }

/**
 * Initial state — idle with no active cue.
 */
const INITIAL_STATE: PlaybackState = {
  status: 'idle',
  currentIndex: -1,
  activeCue: null,
}

/**
 * Playback reducer — pure function, testable in isolation.
 *
 * TICK returns the same state object when activeIndex unchanged,
 * preventing unnecessary re-renders.
 */
export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case 'PLAY':
      return { ...state, status: 'playing' }
    case 'PAUSE':
      return { ...state, status: 'paused' }
    case 'STOP':
      return { status: 'idle', currentIndex: -1, activeCue: null }
    case 'TICK': {
      if (action.activeIndex === state.currentIndex) return state
      return {
        ...state,
        currentIndex: action.activeIndex,
        activeCue: action.activeIndex >= 0 ? action.cues[action.activeIndex] : null,
      }
    }
    default:
      return state
  }
}

/**
 * React hook wrapping PlaybackEngine.
 *
 * Uses useReducer for state that affects rendering (status, currentIndex, activeCue)
 * and useRef for mutable values that don't (rAF ID, startTime, cues).
 *
 * Returns { state, play, pause, stop }.
 */
export function usePlaybackEngine(cues: Cue[]): {
  state: PlaybackState
  play: () => void
  pause: () => void
  stop: () => void
} {
  const [state, dispatch] = useReducer(playbackReducer, INITIAL_STATE)

  // Mutable values that don't trigger re-renders
  const engineRef = useRef<PlaybackEngine | null>(null)
  const cuesRef = useRef<Cue[]>(cues)

  // Keep cues ref in sync with cues prop
  useEffect(() => {
    cuesRef.current = cues
  }, [cues])

  // Create engine instance once
  useEffect(() => {
    engineRef.current = new PlaybackEngine(cuesRef.current, (index) => {
      dispatch({ type: 'TICK', activeIndex: index, cues: cuesRef.current })
    })

    return () => {
      engineRef.current?.stop()
    }
  }, [])

  const play = useCallback(() => {
    dispatch({ type: 'PLAY' })
    engineRef.current?.play()
  }, [])

  const pause = useCallback(() => {
    dispatch({ type: 'PAUSE' })
    engineRef.current?.pause()
  }, [])

  const stop = useCallback(() => {
    dispatch({ type: 'STOP' })
    engineRef.current?.stop()
  }, [])

  return { state, play, pause, stop }
}
