import { useState, useEffect } from 'react'
import type { PlaybackSession } from '../playback/session'
import { sessionElapsedMs, formatElapsedHMS } from '../playback/session'
import { useLanguage } from '../i18n/LanguageContext'

interface ResumeCardProps {
  session: PlaybackSession | null
  onResume: () => void
  onDismiss: () => void
}

/**
 * ResumeCard — persisted-session resume card atop the selection page
 * (Phase 6, FILE-03).
 *
 * Sibling of SessionBanner (Phase-5-tested component stays untouched);
 * same DOM order (FINAL per D-07 Phase-6 continuity lock):
 * [text block][resume][dismiss], same .session-banner* classes, same i18n
 * keys — byte-identical presentation riding on provenance difference: this
 * card is fed by App-level persistedSession state read from IndexedDB at
 * boot, NOT by the hook's live session (the hook is idle post-relaunch).
 * Mutual exclusivity (I-6) is enforced by App mounting this card only when
 * the hook session is null.
 *
 * Paused presentation is derived from the record itself
 * (session.pausedElapsedMs !== null) — the card consumes NO hook status
 * prop.
 *
 * Ticking (I-7): a 1000ms interval re-reads Date.now() only while the
 * persisted record is un-paused (pausedElapsedMs === null), so the meta
 * line live-updates; paused records render the frozen value with no
 * interval armed.
 *
 * Renders nothing without a persisted session (byte-identical v1.0
 * selection page).
 */
export function ResumeCard({ session, onResume, onDismiss }: ResumeCardProps) {
  const [now, setNow] = useState(Date.now())
  const { t } = useLanguage()

  useEffect(() => {
    if (session === null || session.pausedElapsedMs !== null) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [session])

  if (session === null) return null

  const time = formatElapsedHMS(sessionElapsedMs(session, now))

  return (
    <div className="session-banner">
      <div className="session-banner-text">
        <div className="session-banner-title">{session.fileName}</div>
        <div className="session-banner-meta">
          {session.pausedElapsedMs !== null
            ? t('sessionPausedAt', { time })
            : t('sessionElapsed', { time })}
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
