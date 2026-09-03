import { useState } from 'react'
import type { PlaybackStatus } from '../hooks/usePlaybackEngine'
import type { PlaybackSession } from '../playback/session'
import type { Cue } from '../types/subtitle'
import { useLanguage } from '../i18n/LanguageContext'
import { Timeline } from './Timeline'

interface PlaybackControlsProps {
  status: PlaybackStatus
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  fontSize: number
  onFontSizeChange: (size: number) => void
  offsetMs: number
  onOffsetChange: (offsetMs: number) => void
  onResetAll?: () => void
  controlsVisible: boolean
  isFullscreen: boolean
  onToggleFullscreen: () => void
  session: PlaybackSession | null
  cues: Cue[]
  totalDurationMs: number
  onSeek: (targetMs: number) => void
  onPreviewSeek: (targetMs: number) => void
  isSettingsOpen?: boolean
  onToggleSettings?: () => void
  onCloseSettings?: () => void
}

/**
 * Playback controls overlay with layered hierarchy (Phase 10, UI-06/UI-07).
 * - Main bar: Timeline + Play/Pause/Start + Settings toggle button.
 * - Settings drawer: Bottom Sheet for low-frequency actions (offset, discrete font size,
 *   fullscreen, stop, global reset).
 *
 * Back button and Wake Lock status have been lifted to PlaybackTopBar (D-08).
 * High Contrast and Dim toggles removed per cinema dark etiquette (D-04, D-05).
 */
export function PlaybackControls({
  status,
  onPlay,
  onPause,
  onStop,
  fontSize,
  onFontSizeChange,
  offsetMs,
  onOffsetChange,
  onResetAll,
  controlsVisible,
  isFullscreen,
  onToggleFullscreen,
  session,
  cues,
  totalDurationMs,
  onSeek,
  onPreviewSeek,
  isSettingsOpen: controlledSettingsOpen,
  onToggleSettings,
  onCloseSettings,
}: PlaybackControlsProps) {
  const { t } = useLanguage()
  const [internalOpen, setInternalOpen] = useState(false)

  const isSettingsOpen = controlledSettingsOpen !== undefined ? controlledSettingsOpen : internalOpen
  const toggleSettings = onToggleSettings ?? (() => setInternalOpen((prev) => !prev))
  const closeSettings = onCloseSettings ?? (() => setInternalOpen(false))

  if (status === 'idle') {
    return (
      <div className={`playback-controls${controlsVisible ? '' : ' hidden'}`}>
        <button className="start-button" onClick={onPlay}>
          {t('start')}
        </button>
      </div>
    )
  }

  return (
    <div className={`playback-controls${controlsVisible ? '' : ' hidden'}`}>
      {/* 1. Timeline navigation bar (full width) */}
      <Timeline
        session={session}
        status={status}
        cues={cues}
        totalDurationMs={totalDurationMs}
        onSeek={onSeek}
        onPreviewSeek={onPreviewSeek}
      />

      {/* 2. Main control row: Play/Pause and Settings button (UI-06) */}
      <div className="main-controls-row">
        <button
          type="button"
          className="control-button play-pause-button"
          onClick={status === 'paused' ? onPlay : onPause}
          aria-label={status === 'paused' ? t('resume') : t('pause')}
        >
          {status === 'paused' ? t('resume') : t('pause')}
        </button>

        <button
          type="button"
          className={`control-button settings-button${isSettingsOpen ? ' active' : ''}`}
          onClick={toggleSettings}
          aria-label={t('settings')}
          aria-expanded={isSettingsOpen}
        >
          ⚙️ {t('settings')}
        </button>
      </div>

      {/* 3. Settings Drawer / Bottom Sheet (UI-07, D-01) */}
      {isSettingsOpen && (
        <div className="settings-drawer-wrapper">
          <div
            className="settings-backdrop"
            onClick={closeSettings}
            aria-hidden="true"
          />
          <div
            className="settings-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t('settings')}
          >
            <div className="settings-drawer-header">
              <span className="settings-drawer-title">{t('settings')}</span>
              <button
                type="button"
                className="settings-close-button"
                onClick={closeSettings}
                aria-label={t('close')}
              >
                ✕
              </button>
            </div>

            <div className="settings-drawer-body">
              {/* Subtitle offset group */}
              <div className="settings-group">
                <span className="settings-group-label">{t('offsetLabel')}</span>
                <div className="settings-group-controls">
                  <button
                    type="button"
                    className="control-button"
                    onClick={() => onOffsetChange(offsetMs - 500)}
                    aria-label="Decrease offset 0.5s"
                  >
                    −0.5s
                  </button>
                  <span className="offset-display" aria-live="polite" aria-atomic="true">
                    {offsetMs > 0 ? '+' : ''}{(offsetMs / 1000).toFixed(1)}s
                  </span>
                  <button
                    type="button"
                    className="control-button"
                    onClick={() => onOffsetChange(offsetMs + 500)}
                    aria-label="Increase offset 0.5s"
                  >
                    +0.5s
                  </button>
                </div>
              </div>

              {/* Discrete font size group (D-06) */}
              <div className="settings-group">
                <span className="settings-group-label">{t('fontSize')}</span>
                <div className="settings-group-controls font-size-controls">
                  <button
                    type="button"
                    className="control-button"
                    onClick={() => onFontSizeChange(Math.max(36, fontSize - 4))}
                    disabled={fontSize <= 36}
                    aria-label="Decrease font size"
                  >
                    {t('fontSmaller')}
                  </button>
                  <span className="font-size-display" aria-live="polite">
                    {fontSize}px
                  </span>
                  <button
                    type="button"
                    className="control-button"
                    onClick={() => onFontSizeChange(Math.min(72, fontSize + 4))}
                    disabled={fontSize >= 72}
                    aria-label="Increase font size"
                  >
                    {t('fontLarger')}
                  </button>
                </div>
              </div>

              {/* Utility buttons: Fullscreen, Stop, Global Reset (D-09) */}
              <div className="settings-group actions-group">
                <div className="settings-group-controls">
                  <button
                    type="button"
                    className="control-button"
                    onClick={onToggleFullscreen}
                  >
                    {isFullscreen ? t('exitFullscreen') : t('fullscreen')}
                  </button>
                  <button
                    type="button"
                    className="control-button stop-button"
                    onClick={onStop}
                  >
                    {t('stop')}
                  </button>
                  {onResetAll && (
                    <button
                      type="button"
                      className="control-button reset-all-button"
                      onClick={onResetAll}
                    >
                      {t('resetAll')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
