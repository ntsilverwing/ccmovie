import { useReducer, useRef, useEffect, useCallback, useState } from 'react'
import type { Cue } from '../types/subtitle'
import { PlaybackEngine } from '../playback/PlaybackEngine'
import type { PlaybackSession } from '../playback/session'
import {
  createSession,
  pauseSession,
  resumeSession,
  updateSessionOffset,
  sessionElapsedMs,
} from '../playback/session'

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
 * Identity of the movie a session belongs to (Phase 5, PLAY-08).
 *
 * Phase-6 fallback semantics: App supplies `subtitleId` from the saved-record
 * id when a filename match exists in the saved list, otherwise the raw
 * fileName itself — identity is ambiguous-but-stable on saved-list misses
 * and duplicate filenames (best-effort string match; fine under the v1
 * single-session model). Phase 6's resume card MUST treat a
 * fileName-fallback subtitleId as a SOFT link, not a hard IndexedDB
 * foreign key.
 */
export interface SessionIdentity {
  subtitleId: string
  fileName: string
}

/**
 * React hook wrapping PlaybackEngine.
 *
 * Uses useReducer for state that affects rendering (status, currentIndex, activeCue)
 * and useRef for mutable values that don't (rAF ID, startTime, cues).
 *
 * Phase 5 (PLAY-08): the hook also owns an in-memory wall-clock
 * PlaybackSession (05-01 module) across play/pause/stop transitions, and
 * exposes resyncToSession for the banner-resume wall-clock re-anchor
 * (PLAY-08 #4 screen-sleep robustness). Session math delegates to the pure,
 * clock-free session module; every wall-clock value enters via Date.now()
 * at the call site.
 *
 * Returns { state, play, pause, stop, session, resyncToSession }.
 */
export function usePlaybackEngine(
  cues: Cue[],
  offsetMs: number = 0,
  identity: SessionIdentity | null = null
): {
  state: PlaybackState
  play: () => void
  pause: () => void
  stop: () => void
  session: PlaybackSession | null
  resyncToSession: () => void
} {
  const [state, dispatch] = useReducer(playbackReducer, INITIAL_STATE)
  const [session, setSession] = useState<PlaybackSession | null>(null)

  // Mutable values that don't trigger re-renders
  const engineRef = useRef<PlaybackEngine | null>(null)
  const cuesRef = useRef<Cue[]>(cues)

  // Live-value refs keeping the useCallback([]) discipline on play/pause/
  // stop/resyncToSession while reading the freshest session/identity/status.
  const identityRef = useRef<SessionIdentity | null>(identity)
  const sessionRef = useRef<PlaybackSession | null>(session)
  const statusRef = useRef<PlaybackStatus>(state.status)
  const offsetMsRef = useRef<number>(offsetMs)

  // Imperative readers: mirror session and status every render.
  sessionRef.current = session
  statusRef.current = state.status

  // Keep identity ref in sync with the prop
  useEffect(() => {
    identityRef.current = identity
  }, [identity])

  // Keep cues ref in sync with cues prop
  useEffect(() => {
    cuesRef.current = cues
    engineRef.current?.setCues(cues)
  }, [cues])

  // Wire offset from settings to engine (real-time updates without restart);
  // the same effect keeps any live session's offset snapshot in sync.
  useEffect(() => {
    offsetMsRef.current = offsetMs
    engineRef.current?.setOffset(offsetMs)
    setSession((prev) => (prev ? updateSessionOffset(prev, offsetMs) : prev))
  }, [offsetMs])

  // Create engine instance once. The onEnded closure converges React state
  // to idle and clears the session when the engine self-stops (natural
  // exhaustion — the agent's discretion #4).
  useEffect(() => {
    engineRef.current = new PlaybackEngine(
      cuesRef.current,
      (index) => {
        dispatch({ type: 'TICK', activeIndex: index, cues: cuesRef.current })
      },
      () => {
        dispatch({ type: 'STOP' })
        setSession(null)
      }
    )

    return () => {
      engineRef.current?.stop()
    }
  }, [])

  const play = useCallback(() => {
    dispatch({ type: 'PLAY' })
    engineRef.current?.play()
    setSession((prev) =>
      prev
        ? resumeSession(prev, Date.now())
        : identityRef.current
          ? createSession({
              subtitleId: identityRef.current.subtitleId,
              fileName: identityRef.current.fileName,
              offsetMs: offsetMsRef.current,
              now: Date.now(),
            })
          : null
    )
  }, [])

  const pause = useCallback(() => {
    dispatch({ type: 'PAUSE' })
    engineRef.current?.pause()
    setSession((prev) => (prev ? pauseSession(prev, Date.now()) : prev))
  }, [])

  const stop = useCallback(() => {
    dispatch({ type: 'STOP' })
    engineRef.current?.stop()
    setSession(null)
  }, [])

  /**
   * Re-anchor the engine from the wall-clock session (PLAY-08 #4
   * screen-sleep robustness): an Android suspend may freeze the engine's
   * monotonic clock while Date.now() keeps advancing, so the banner-resume
   * path calls this BEFORE play() to snap the engine onto the session's
   * real-time position. No-op unless playing with a live session — paused
   * resume re-anchors by construction inside play(); fresh starts have no
   * session.
   */
  const resyncToSession = useCallback(() => {
    if (statusRef.current !== 'playing' || sessionRef.current === null) return
    engineRef.current?.seekTo(sessionElapsedMs(sessionRef.current, Date.now()))
  }, [])

  return { state, play, pause, stop, session, resyncToSession }
}
