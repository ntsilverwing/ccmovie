import type { PlaybackStatus } from '../hooks/usePlaybackEngine'
import { useLanguage } from '../i18n/LanguageContext'

interface PlaybackControlsProps {
  status: PlaybackStatus
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  fontSize: number
  isDimmed: boolean
  onFontSizeChange: (size: number) => void
  onDimToggle: () => void
  offsetMs: number
  isHighContrast: boolean
  onOffsetChange: (offsetMs: number) => void
  onHighContrastToggle: () => void
  controlsVisible: boolean
  isFullscreen: boolean
  onToggleFullscreen: () => void
  wakeLockActive: boolean
  onBack?: () => void
}

/**
 * Playback controls overlay — Start/Stop/Pause + font slider + dim toggle.
 *
 * Positioned fixed at bottom center. All buttons have large touch targets
 * for dark theater use (min 48x48px).
 */
export function PlaybackControls({
  status,
  onPlay,
  onPause,
  onStop,
  fontSize,
  isDimmed,
  onFontSizeChange,
  onDimToggle,
  offsetMs,
  isHighContrast,
  onOffsetChange,
  onHighContrastToggle,
  controlsVisible,
  isFullscreen,
  onToggleFullscreen,
  wakeLockActive,
  onBack,
}: PlaybackControlsProps) {
  const { t } = useLanguage()

  return (
    <div className={`playback-controls${controlsVisible ? '' : ' hidden'}`}>
      {status === 'idle' && (
        <button className="start-button" onClick={onPlay}>
          {t('start')}
        </button>
      )}

      {(status === 'playing' || status === 'paused') && (
        <>
          <button className="control-button" onClick={() => onOffsetChange(offsetMs - 500)}>
            −0.5s
          </button>
          <span className="offset-display" aria-live="polite" aria-atomic="true">
            {offsetMs > 0 ? '+' : ''}{(offsetMs / 1000).toFixed(1)}s
          </span>
          <button className="control-button" onClick={() => onOffsetChange(offsetMs + 500)}>
            +0.5s
          </button>
          <button className="control-button" onClick={() => onOffsetChange(0)}>
            {t('reset')}
          </button>
          <button className="control-button" onClick={onStop}>
            {t('stop')}
          </button>
          <button className="control-button" onClick={status === 'paused' ? onPlay : onPause}>
            {status === 'paused' ? t('resume') : t('pause')}
          </button>
          <div className="font-size-control">
            <span className="font-size-label" aria-hidden="true">{t('fontSizeLabel')}</span>
            <input
              type="range"
              min="36"
              max="72"
              value={fontSize}
              onChange={(e) => onFontSizeChange(Number(e.target.value))}
              className="font-size-slider"
              aria-label={t('fontSizeLabel')}
              aria-valuetext={`${fontSize} pixels`}
            />
          </div>
          <button className="control-button" onClick={onDimToggle}>
            {isDimmed ? t('bright') : t('dim')}
          </button>
          <button className="control-button" onClick={onHighContrastToggle}>
            {isHighContrast ? t('normal') : t('contrast')}
          </button>
          <button className="control-button" onClick={onToggleFullscreen}>
            {isFullscreen ? t('exitFullscreen') : t('fullscreen')}
          </button>
          {/* Truthful wake-lock indicator: rendered ONLY when an actual screen
             wake lock is held (NoSleep.enabled propagated via useWakeLock).
             Shown immediately after the fullscreen toggle so the user can see
             at-a-glance why the screen stays awake. Skipped entirely (not lied
             about) when the browser/secure-context denies the lock — see
             useWakeLock.ts enable()/sync() for the truth source. */}
          {wakeLockActive && (
            <span className="wake-lock-indicator" aria-live="polite">
              {t('wakeLockOn')}
            </span>
          )}
          {/* Back control placement: user decision (2026-07-31) overrides
              UI-SPEC/D-09 — sits AFTER the fullscreen toggle and the wake-lock
              indicator, as the last item of the playing/paused branch. */}
          {onBack && (
            <button
              className="playback-back"
              type="button"
              onClick={onBack}
              aria-label={t('back')}
            >
              ‹ {t('back')}
            </button>
          )}
        </>
      )}
    </div>
  )
}
