import { useState, useEffect } from 'react'
import { useLanguage } from '../i18n/LanguageContext'

/**
 * RotateOverlay — full-screen overlay shown when device is in portrait mode.
 *
 * iOS ignores manifest orientation: landscape, so we detect portrait mode
 * and prompt the user to rotate their device. On Android, the manifest
 * orientation field works, but this overlay is a safety net.
 *
 * The overlay is present in all views (import, ready, playback) to catch
 * portrait mode at any time.
 */
export function RotateOverlay() {
  const [isPortrait, setIsPortrait] = useState(
    window.matchMedia('(orientation: portrait)').matches
  )
  const { t } = useLanguage()

  useEffect(() => {
    const mql = window.matchMedia('(orientation: portrait)')
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  if (!isPortrait) return null

  return (
    <div className="rotate-overlay">
      <div className="rotate-content">
        <span className="rotate-icon">🔄</span>
        <p>{t('rotateToLandscape')}</p>
      </div>
    </div>
  )
}
