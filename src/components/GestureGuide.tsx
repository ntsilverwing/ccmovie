import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '../i18n/LanguageContext'
import { hasSeenGestureGuide, markGestureGuideSeen } from '../playback/cueNavigation'

/**
 * First-time gesture navigation hint overlay (Phase 9, UI-05).
 *
 * Implements:
 * - D-13: Low-brightness centered scrim (rgba(0, 0, 0, 0.75)) for dark theater
 * - D-14: Delayed appearance (1s after entering playback view), 3s auto-dismiss or tap to dismiss
 * - D-15: One-time appearance stored in localStorage (cinemasyncsubs-gesture-guide-seen)
 * - D-16: No re-display trigger
 */
export function GestureGuide() {
  const { t } = useLanguage()
  const [shouldRender, setShouldRender] = useState(() => !hasSeenGestureGuide())
  const [isVisible, setIsVisible] = useState(false)
  const dismissedRef = useRef(false)

  const dismiss = () => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    markGestureGuideSeen()
    setIsVisible(false)
    setTimeout(() => {
      setShouldRender(false)
    }, 200) // matches 0.2s fade-out transition
  }

  useEffect(() => {
    if (!shouldRender) return

    // 1000ms delay before showing (D-14)
    const showTimer = setTimeout(() => {
      if (!dismissedRef.current) {
        setIsVisible(true)
      }
    }, 1000)

    // 1000ms delay + 3000ms auto-dismiss = 4000ms (D-14)
    const autoDismissTimer = setTimeout(() => {
      dismiss()
    }, 4000)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(autoDismissTimer)
    }
  }, [shouldRender])

  if (!shouldRender) return null

  return (
    <div
      className={`gesture-guide-overlay ${isVisible ? 'visible' : ''}`}
      onClick={dismiss}
      onPointerDown={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label={t('gestureGuideTitle')}
    >
      <div className="gesture-guide-card">
        <div className="gesture-guide-title">{t('gestureGuideTitle')}</div>
        <div className="gesture-guide-item">
          <span className="gesture-guide-icon" aria-hidden="true">↑</span>
          <span>{t('gestureGuideSwipeUp')}</span>
        </div>
        <div className="gesture-guide-item">
          <span className="gesture-guide-icon" aria-hidden="true">↓</span>
          <span>{t('gestureGuideSwipeDown')}</span>
        </div>
        <div className="gesture-guide-dismiss">{t('gestureGuideDismiss')}</div>
      </div>
    </div>
  )
}
