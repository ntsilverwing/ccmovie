import { useState, useEffect } from 'react'
import type { PlaybackSession } from '../playback/session'
import { sessionElapsedMs, formatElapsedHMS } from '../playback/session'
import type { PlaybackStatus } from '../hooks/usePlaybackEngine'
import { useLanguage } from '../i18n/LanguageContext'

interface SessionBannerProps {
  session: PlaybackSession | null
  status: PlaybackStatus
  onResume: () => void
  onDismiss: () => void
}

/**
 * SessionBanner — persistent "subtitle kept" banner atop the selection page
 * (PLAY-08, D-06).
 *
 * Mounted above the .saved-movies region. DOM order is FINAL (D-07
 * Phase-6 continuity lock): [text block][resume][dismiss]. Purely passive
 * presentation — session data and behavior props arrive from App.tsx wiring
 * (Plan 05-04). Session math comes from Plan 05-01's pure session module.
 *
 * Ticking (I-7): a 1000ms interval re-reads Date.now() only while status is
 * 'playing', so the meta line live-updates; while paused the frozen value is
 * rendered from session.pausedElapsedMs and no interval is armed.
 *
 * Renders nothing without a session (byte-identical v1.0 selection page).
 */
export function SessionBanner({ session, status, onResume, onDismiss }: SessionBannerProps) {
  const [now, setNow] = useState(Date.now())
  const { t } = useLanguage()

  useEffect(() => {
    if (status !== 'playing') return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [status])

  if (session === null || status === 'idle') return null

  const time = formatElapsedHMS(sessionElapsedMs(session, now))

  return (
    <div className="session-banner">
      <div className="session-banner-text">
        <div className="session-banner-title">{session.fileName}</div>
        <div className="session-banner-meta">
          {status === 'paused' ? t('sessionPausedAt', { time }) : t('sessionElapsed', { time })}
        </div>
      </div>
      <button
        className="session-banner-resume"
        type="button"
        onClick={onResume}
        aria-label={t('resumePlayingAria', { fileName: session.fileName })}
      >
        {t('resumePlaying')}
      </button>
      <button
        className="session-banner-dismiss"
        type="button"
        onClick={onDismiss}
        aria-label={t('dismissSession')}
      >
        ×
      </button>
    </div>
  )
}
