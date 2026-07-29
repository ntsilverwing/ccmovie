import { useState, useEffect, useCallback, useRef } from 'react'
import { FilePicker } from './components/FilePicker'
import { CuePreview } from './components/CuePreview'
import { SubtitleDisplay } from './components/SubtitleDisplay'
import { PlaybackControls } from './components/PlaybackControls'
import { usePlaybackEngine } from './hooks/usePlaybackEngine'
import { usePersistedSettings } from './hooks/usePersistedSettings'
import { useWakeLock } from './hooks/useWakeLock'
import { RotateOverlay } from './pwa/RotateOverlay'
import { useLanguage } from './i18n/LanguageContext'
import type { ParsedSubtitle } from './types/subtitle'
import type { ImportError } from './utils/errors'
import type { StoredSubtitle } from './db/database'
import { getAllSubtitles, deleteSubtitle } from './db/subtitles'

function App() {
  const [subtitle, setSubtitle] = useState<ParsedSubtitle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedSubtitles, setSavedSubtitles] = useState<StoredSubtitle[]>([])

  const { t, lang, setLang } = useLanguage()
  const { settings, updateSettings } = usePersistedSettings()
  const { state: playbackState, play, pause, stop } = usePlaybackEngine(subtitle?.cues ?? [], settings.offsetMs)
  const { enable: enableWakeLock, disable: disableWakeLock, isEnabled: wakeLockActive } = useWakeLock()
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
    play()
  }, [enableWakeLock, play])

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
  }, [disableWakeLock, stop])

  const handleToggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {})
    }
  }, [])

  // Auto-hide controls after 3s of inactivity during playback
  useEffect(() => {
    // Only auto-hide during active playback (not paused)
    if (playbackState.status !== 'playing') {
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
  }, [playbackState.status])

  // Playback view: status is 'playing' or 'paused'
  if (playbackState.status === 'playing' || playbackState.status === 'paused') {
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
          wakeLockActive={wakeLockActive}
        />
      </div>
    )
  }

  // Import view: no subtitle loaded
  if (!subtitle) {
    return (
      <div className="app">
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
      <button
        className="back-button"
        onClick={() => { setSubtitle(null); setError(null) }}
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
        wakeLockActive={wakeLockActive}
      />
    </div>
  )
}

export default App
