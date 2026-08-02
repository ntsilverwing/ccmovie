import { useState, useEffect, useCallback, useRef } from 'react'
import { FilePicker } from './components/FilePicker'
import { CuePreview } from './components/CuePreview'
import { SubtitleDisplay } from './components/SubtitleDisplay'
import { PlaybackControls } from './components/PlaybackControls'
import { SessionBanner } from './components/SessionBanner'
import { ResumeCard } from './components/ResumeCard'
import { SessionToast } from './components/SessionToast'
import { usePlaybackEngine } from './hooks/usePlaybackEngine'
import { usePersistedSettings } from './hooks/usePersistedSettings'
import { useWakeLock } from './hooks/useWakeLock'
import { RotateOverlay } from './pwa/RotateOverlay'
import { useLanguage } from './i18n/LanguageContext'
import { enterPlaybackHistory, exitPlaybackHistory, isPlaybackEntry } from './playback/playbackHistory'
import type { ParsedSubtitle } from './types/subtitle'
import type { ImportError } from './utils/errors'
import type { StoredSubtitle } from './db/database'
import { getAllSubtitles, getSubtitle, deleteSubtitle } from './db/subtitles'
import { loadSession, clearSessionRecord } from './db/sessions'
import type { PlaybackSession } from './playback/session'
import { SESSION_EXPIRY_MS, isSessionExpired } from './playback/session'

function App() {
  const [subtitle, setSubtitle] = useState<ParsedSubtitle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedSubtitles, setSavedSubtitles] = useState<StoredSubtitle[]>([])

  const { t, lang, setLang } = useLanguage()
  const { settings, updateSettings } = usePersistedSettings()

  // Phase 5 (PLAY-08): view decoupled from playback status — the engine may
  // keep clocking in the background while the user is on the selection view.
  const [view, setView] = useState<'selection' | 'playback'>('selection')
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])
  // Kept-session toast trigger (I-1/I-2): bumped by every leave transition.
  const [lastLeftAt, setLastLeftAt] = useState<number | null>(null)

  // Session identity: saved-record id when a filename match exists, raw
  // fileName otherwise (soft-link fallback documented on SessionIdentity).
  const activeIdentity = subtitle
    ? {
        subtitleId:
          savedSubtitles.find((s) => s.fileName === subtitle.metadata.fileName)?.id ??
          subtitle.metadata.fileName,
        fileName: subtitle.metadata.fileName,
      }
    : null

  const { state: playbackState, play, pause, stop, session, resyncToSession, restoreSession } = usePlaybackEngine(
    subtitle?.cues ?? [],
    settings.offsetMs,
    activeIdentity
  )
  const { enable: enableWakeLock, disable: disableWakeLock, sync: syncWakeLock } = useWakeLock()
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const [controlsVisible, setControlsVisible] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement)

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // Hydrate saved subtitles from IndexedDB on mount
  useEffect(() => {
    getAllSubtitles()
      .then(setSavedSubtitles)
      .catch((err) => {
        console.warn('Failed to load saved subtitles:', err)
      })
  }, [])

  // Hydrate the persisted playback session on mount (FILE-03, I-1). Expiry
  // is evaluated EXACTLY ONCE per app launch here — never from a timer,
  // interval, or visibilitychange re-check. Expired records are cleared and
  // the selection page renders byte-identical to v1.0; valid records drive
  // the ResumeCard (the IndexedDB read is sub-100ms, so no spinner — the
  // card simply appears on resolve).
  const [persistedSession, setPersistedSession] = useState<PlaybackSession | null>(null)
  useEffect(() => {
    loadSession()
      .then((record) => {
        if (!record) return
        if (isSessionExpired(record, Date.now(), SESSION_EXPIRY_MS)) {
          void clearSessionRecord()
          return
        }
        setPersistedSession(record)
      })
      .catch((err) => {
        console.warn('Failed to load persisted session:', err)
      })
  }, [])

  const refreshSavedSubtitles = useCallback(() => {
    getAllSubtitles()
      .then(setSavedSubtitles)
      .catch((err) => {
        console.warn('Failed to refresh saved subtitles:', err)
      })
  }, [])

  const handleImport = (result: ParsedSubtitle) => {
    // Stop current playback when a new file is imported during playback
    stop()
    // I-5: a new import replaces any persisted session (replacement
    // sequence stop → clear → create → save); a restored card can never
    // survive a new import. The stop()-triggered hook effect deletes only
    // records THIS hook instance persisted, so the explicit clear is
    // required post-relaunch.
    void clearSessionRecord()
    setPersistedSession(null)
    setSubtitle(result)
    setError(null)
    // Refresh saved list after import saves to IndexedDB
    refreshSavedSubtitles()
  }

  const handleError = (err: ImportError) => {
    setError(err.message)
    setSubtitle(null)
  }

  const handleDeleteSubtitle = useCallback((id: string) => {
    deleteSubtitle(id)
      .then(() => {
        setSavedSubtitles((prev) => prev.filter((s) => s.id !== id))
      })
      .catch((err) => {
        console.warn('Failed to delete subtitle:', err)
      })
  }, [])

  const handleSelectSaved = useCallback((stored: StoredSubtitle) => {
    // Reconstruct ParsedSubtitle from StoredSubtitle
    const result: ParsedSubtitle = {
      cues: stored.cues,
      metadata: {
        fileName: stored.fileName,
        encoding: stored.encoding,
        cueCount: stored.cueCount,
        parsedAt: stored.importedAt,
      },
      errors: [],
    }
    handleImport(result)
  }, [handleImport])

  // Wake Lock wrappers — must be called inside user gesture chain (click handler)
  // enableWakeLock() is called without await to preserve the user gesture context
  const handlePlay = useCallback(() => {
    enableWakeLock() // synchronous call within gesture chain — satisfies iOS requirement
    // Request fullscreen within user gesture to satisfy browser security
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {
        // Fullscreen not supported or denied — fail silently, playback continues
      })
    }
    // Register the playback history marker BEFORE any engine/react update
    // (D-01; push-vs-replace policy owned by the 05-02-tested module — D-02)
    enterPlaybackHistory(window.history)
    // Screen-sleep re-anchor (PLAY-08 #4): snap the engine onto the wall-clock
    // session before play(); no-op on fresh starts and paused resume
    resyncToSession()
    play()
    setView('playback')
  }, [enableWakeLock, play, resyncToSession])

  // One-tap resume from the persisted-session card (FILE-03 #2, I-2/I-3).
  // Gesture chain mirrors handlePlay: enableWakeLock() fires synchronously
  // FIRST, before any await/.then (iOS requirement). The cue lookup runs id
  // → fileName fallback (soft link per SessionIdentity contract; the
  // in-memory savedSubtitles fallback is safe because the card can only
  // render after boot mount hydration has settled). On total miss the
  // record is cleared and the card removed silently — no toast, no dialog,
  // and NO fullscreen/history calls (the D-01 marker belongs ONLY to the
  // hit path: a playback marker pushed with no playback view breaks D-03
  // natural-exit; a fullscreened selection page is a dark-theater failure).
  const handleResumeFromSession = useCallback(() => {
    const record = persistedSession
    if (!record) return
    enableWakeLock() // synchronous call within gesture chain — satisfies iOS requirement
    getSubtitle(record.subtitleId)
      .then((stored) => {
        const hit = stored ?? savedSubtitles.find((s) => s.fileName === record.fileName)
        if (!hit) {
          // Dead soft-link (I-3): silent clear + card removal.
          void clearSessionRecord()
          setPersistedSession(null)
          return
        }
        // Transient activation post-async is best-effort (RESEARCH A2);
        // denial degrades gracefully, playback continues.
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {})
        }
        // Register the playback history marker ONLY on the hit path (D-01/D-03).
        enterPlaybackHistory(window.history)
        // Reconstruct ParsedSubtitle exactly as handleSelectSaved does —
        // WITHOUT routing through handleImport, whose stop() would tear
        // down the session being restored.
        const result: ParsedSubtitle = {
          cues: hit.cues,
          metadata: {
            fileName: hit.fileName,
            encoding: hit.encoding,
            cueCount: hit.cueCount,
            parsedAt: hit.importedAt,
          },
          errors: [],
        }
        setSubtitle(result)
        restoreSession(result.cues, record)
        setView('playback')
        // Four-way offset agreement (PA-5): engine/session/banner/controls.
        updateSettings({ offsetMs: record.offsetMs })
        setPersistedSession(null)
      })
      .catch((err) => {
        console.warn('Failed to resume persisted session:', err)
      })
  }, [persistedSession, enableWakeLock, restoreSession, savedSubtitles, updateSettings])

  // Card dismiss (I-4, D-08): clear the IndexedDB record and remove the
  // card in a single tap — no confirmation, no engine/view interaction
  // (the engine is idle post-relaunch).
  const handleDismissCard = useCallback(() => {
    void clearSessionRecord()
    setPersistedSession(null)
  }, [])

  // D-04: leave playback with the double release ONLY — Wake Lock +
  // fullscreen. The engine is deliberately left untouched so the subtitle
  // clock keeps pace with real time while away (sessionElapsed continuity).
  const leavePlayback = useCallback(() => {
    disableWakeLock()
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    }
    setView('selection')
    setLastLeftAt(Date.now())
  }, [disableWakeLock])

  // D-01: Android system back during playback lands on the selection view
  // instead of exiting the PWA. The viewRef guard makes the handler
  // idempotent against crafted back/forward churn (T-05-04-01).
  useEffect(() => {
    const onPopState = () => {
      if (viewRef.current !== 'playback') return
      leavePlayback()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [leavePlayback])

  // D-01/I-2: back control and system back converge on ONE leave path.
  // The 05-02-tested policy consumes our marker so a single popstate runs
  // the identical leave flow; the marker-missing edge leaves directly.
  const handleBackControl = useCallback(() => {
    if (viewRef.current !== 'playback') return
    if (isPlaybackEntry(window.history.state)) {
      exitPlaybackHistory(window.history)
    } else {
      leavePlayback()
    }
  }, [leavePlayback])

  const handlePause = useCallback(() => {
    disableWakeLock() // screen can sleep when paused
    pause()
  }, [disableWakeLock, pause])

  const handleStop = useCallback(() => {
    disableWakeLock()
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    }
    stop()
    // View no longer follows status implicitly; D-03 retire the marker in
    // the same synchronous batch so the next selection-page system back
    // exits naturally and the idle-convergence effect no-ops. lastLeftAt
    // stays untouched: deliberate abandon (Dismiss ×) shows no toast (I-1/I-2).
    setView('selection')
    exitPlaybackHistory(window.history)
  }, [disableWakeLock, stop])

  // Session invariant: a session never outlives its loaded movie — run the
  // hook stop FIRST (clears session + engine) before dropping the subtitle.
  const handleDeselectMovie = useCallback(() => {
    stop()
    setSubtitle(null)
    setError(null)
  }, [stop])

  const handleToggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {})
    }
  }, [])

  // Wake-lock indicator truth sync: refresh from the library's actual state
  // on every playback-view entry (enable() is fire-and-forget in the gesture
  // chain; system releases / NoSleep re-acquires can drift while away).
  useEffect(() => {
    if (view === 'playback') syncWakeLock()
  }, [view, syncWakeLock])

  // Auto-hide controls after 3s of inactivity during playback.
  // I-8/discretion #3: view is in the deps so re-entering playback re-arms
  // the timer; selection views keep controls visible even while a session
  // plays in the background.
  useEffect(() => {
    // Only auto-hide during active playback (not paused) in playback view
    if (playbackState.status !== 'playing' || view !== 'playback') {
      setControlsVisible(true)
      return
    }
    setControlsVisible(true)
    const resetTimer = () => {
      setControlsVisible(true)
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000)
    }
    resetTimer()
    window.addEventListener('pointermove', resetTimer)
    window.addEventListener('touchstart', resetTimer)
    return () => {
      clearTimeout(hideTimerRef.current)
      window.removeEventListener('pointermove', resetTimer)
      window.removeEventListener('touchstart', resetTimer)
    }
  }, [playbackState.status, view])

  // Auto-end convergence (discretion #4): engine natural exhaustion fires
  // onEnded → status idle → converge the view to selection (no stuck black
  // screen) and retire the D-03 marker. Away-from-playback auto-end no-ops
  // through the view guard (marker already retired by the leave path;
  // exitPlaybackHistory is marker-guarded, so any redundant call is safe).
  // Ordering: setView is queued BEFORE exitPlaybackHistory's back()
  // dispatches popstate (separate task per HTML spec), so the popstate
  // guard observes viewRef.current === 'selection' and no-ops; even in a
  // pathological race leavePlayback is idempotent (worst case: duplicate
  // kept-session toast).
  useEffect(() => {
    if (view === 'playback' && playbackState.status === 'idle') {
      setView('selection')
      exitPlaybackHistory(window.history)
    }
  }, [playbackState.status, view])

  // Playback view: decoupled from status — rendering branches on view only.
  if (view === 'playback' && subtitle) {
    return (
      <div className="app">
        <RotateOverlay />
        <SubtitleDisplay
          cue={playbackState.activeCue}
          fontSize={settings.fontSize}
          isDimmed={settings.isDimmed}
          isHighContrast={settings.isHighContrast}
        />
        <PlaybackControls
          status={playbackState.status}
          onPlay={handlePlay}
          onPause={handlePause}
          onStop={handleStop}
          onBack={handleBackControl}
          fontSize={settings.fontSize}
          isDimmed={settings.isDimmed}
          onFontSizeChange={(size) => updateSettings({ fontSize: size })}
          onDimToggle={() => updateSettings({ isDimmed: !settings.isDimmed, isHighContrast: false })}
          offsetMs={settings.offsetMs}
          isHighContrast={settings.isHighContrast}
          onOffsetChange={(offsetMs) => updateSettings({ offsetMs })}
          onHighContrastToggle={() => updateSettings({ isHighContrast: !settings.isHighContrast, isDimmed: false })}
          controlsVisible={controlsVisible}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
        />
      </div>
    )
  }

  // Import view: no subtitle loaded
  if (!subtitle) {
    return (
      <div className="app">
        {persistedSession !== null && session === null ? (
          <ResumeCard
            session={persistedSession}
            onResume={handleResumeFromSession}
            onDismiss={handleDismissCard}
          />
        ) : (
          <SessionBanner
            session={session}
            status={playbackState.status}
            onResume={handlePlay}
            onDismiss={handleStop}
          />
        )}
        <SessionToast trigger={lastLeftAt} />
        <button
          className="language-toggle"
          onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
          aria-label="Toggle language"
        >
          {lang === 'en' ? '中文' : 'EN'}
        </button>
        <RotateOverlay />
        {savedSubtitles.length > 0 && (
          <div className="saved-movies">
            <h2 className="saved-movies-title">{t('continueWithSaved')}</h2>
            {savedSubtitles.map((stored) => (
              <div key={stored.id} className="saved-movie-item">
                <button
                  className="saved-movie-button"
                  onClick={() => handleSelectSaved(stored)}
                >
                  <span className="saved-movie-name">{stored.fileName}</span>
                  <span className="saved-movie-meta">
                    {stored.cueCount} cues · {new Date(stored.importedAt).toLocaleDateString()}
                  </span>
                </button>
                <button
                  className="saved-movie-delete"
                  onClick={() => handleDeleteSubtitle(stored.id)}
                  aria-label={t('deleteMovie', { fileName: stored.fileName })}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <FilePicker onImport={handleImport} onError={handleError} />
      </div>
    )
  }

  // Ready view: subtitle loaded, playback idle
  return (
    <div className="app">
      {persistedSession !== null && session === null ? (
        <ResumeCard
          session={persistedSession}
          onResume={handleResumeFromSession}
          onDismiss={handleDismissCard}
        />
      ) : (
        <SessionBanner
          session={session}
          status={playbackState.status}
          onResume={handlePlay}
          onDismiss={handleStop}
        />
      )}
      <SessionToast trigger={lastLeftAt} />
      <button
        className="back-button"
        onClick={handleDeselectMovie}
        aria-label={t('back')}
      >
        ‹ {t('back')}
      </button>
      <button
        className="language-toggle"
        onClick={() => setLang(lang === 'en' ? 'zh' : 'en')}
        aria-label="Toggle language"
      >
        {lang === 'en' ? '中文' : 'EN'}
      </button>
      <RotateOverlay />
      <CuePreview
        subtitle={subtitle}
        error={error}
        savedSubtitles={savedSubtitles}
        onSelectSaved={handleSelectSaved}
      />
      {/* Selection view: the playing/paused toolbar belongs to the playback
          view ONLY. With a live session (interrupted state) the banner is the
          sole authority; the idle Start button keeps v1.0 behavior. */}
      {playbackState.status === 'idle' && (
        <PlaybackControls
          status={playbackState.status}
          onPlay={handlePlay}
          onPause={handlePause}
          onStop={handleStop}
          fontSize={settings.fontSize}
          isDimmed={settings.isDimmed}
          onFontSizeChange={(size) => updateSettings({ fontSize: size })}
          onDimToggle={() => updateSettings({ isDimmed: !settings.isDimmed, isHighContrast: false })}
          offsetMs={settings.offsetMs}
          isHighContrast={settings.isHighContrast}
          onOffsetChange={(offsetMs) => updateSettings({ offsetMs })}
          onHighContrastToggle={() => updateSettings({ isHighContrast: !settings.isHighContrast, isDimmed: false })}
          controlsVisible={controlsVisible}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
        />
      )}
    </div>
  )
}

export default App
