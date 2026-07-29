import { useRef, useEffect } from 'react'
import type { Cue } from '../types/subtitle'

interface SubtitleDisplayProps {
  cue: Cue | null
  fontSize: number
  isDimmed: boolean
  isHighContrast: boolean
}

/**
 * OLED-optimized subtitle display component.
 *
 * Renders the active cue as plain text (never dangerouslySetInnerHTML).
 * Font size and dim mode are driven by CSS custom properties for instant
 * visual updates without React re-renders.
 */
export function SubtitleDisplay({ cue, fontSize, isDimmed, isHighContrast }: SubtitleDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Update font size via CSS custom property (no re-render needed for visual change)
  useEffect(() => {
    containerRef.current?.style.setProperty('--subtitle-font-size', `${fontSize}px`)
  }, [fontSize])

  // Toggle dim mode via body class
  useEffect(() => {
    document.body.classList.toggle('dimmed', isDimmed)
    return () => document.body.classList.remove('dimmed')
  }, [isDimmed])

  // Toggle high-contrast mode via body class
  useEffect(() => {
    document.body.classList.toggle('high-contrast', isHighContrast)
    return () => document.body.classList.remove('high-contrast')
  }, [isHighContrast])

  return (
    <div ref={containerRef} className="subtitle-container" role="status" aria-live="polite" aria-atomic="true">
      <p className="subtitle-text">{cue?.text ?? ''}</p>
    </div>
  )
}
