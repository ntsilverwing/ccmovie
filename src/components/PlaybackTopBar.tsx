import { useLanguage } from '../i18n/LanguageContext'

interface PlaybackTopBarProps {
  controlsVisible: boolean
  onBack?: () => void
  isWakeLockActive?: boolean
}

/**
 * Top Bar for playback view (Phase 10, D-08).
 * Houses non-control buttons (Back) and status indicators (Screen ON)
 * at the screen top, keeping bottom controls clean and minimal.
 * Synchronized with controlsVisible for auto-hide.
 */
export function PlaybackTopBar({
  controlsVisible,
  onBack,
  isWakeLockActive,
}: PlaybackTopBarProps) {
  const { t } = useLanguage()

  return (
    <header
      className={`playback-top-bar${controlsVisible ? '' : ' hidden'}`}
      aria-label="Playback top bar"
    >
      <div className="playback-top-bar-left">
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
      </div>
      <div className="playback-top-bar-right">
        {isWakeLockActive && (
          <span className="wake-lock-indicator" aria-live="polite">
            {t('wakeLockOn')}
          </span>
        )}
      </div>
    </header>
  )
}
