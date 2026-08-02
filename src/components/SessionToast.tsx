import { useState, useEffect } from 'react'
import { useLanguage } from '../i18n/LanguageContext'

/**
 * SessionToast — passive "subtitle kept" notification (PLAY-08, UI-SPEC I-4).
 *
 * Shown once per playback→selection transition; the caller passes a
 * monotonically increasing trigger counter. Auto-fades after a short dwell
 * within the locked 3–4s band, using the same 0.3s opacity transition idiom
 * as .playback-controls.
 *
 * Purely passive: ARIA status role + pointer-events: none — no pointer
 * interaction exists at any layer (I-4). Renders nothing until the first
 * trigger arrives, keeping the pre-session selection page byte-identical
 * to v1.0 (UI-consideration [empty]).
 */
export function SessionToast({ trigger }: { trigger: number | null }) {
  const [visible, setVisible] = useState(false)
  const { t } = useLanguage()

  useEffect(() => {
    if (trigger === null) return
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), 3500)
    return () => clearTimeout(timer)
  }, [trigger])

  if (trigger === null) return null

  return (
    <div className={`session-toast${visible ? '' : ' hidden'}`} role="status">
      {t('sessionKeptToast')}
    </div>
  )
}
