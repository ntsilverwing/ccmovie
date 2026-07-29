import { useState, useCallback } from 'react'

/**
 * User settings that persist across sessions via localStorage.
 */
export interface Settings {
  /** Font size in pixels, range 36-72 */
  fontSize: number
  /** Dim mode — gray text for ultra-dark environments */
  isDimmed: boolean
  /** Timing offset in milliseconds, range -5000 to 5000 */
  offsetMs: number
  /** High contrast mode — yellow text on black */
  isHighContrast: boolean
  /** UI language — 'en' or 'zh' */
  lang: 'en' | 'zh'
}

/** localStorage key for settings */
const SETTINGS_KEY = 'cinemasyncsubs-settings'

/** Default settings used when no stored settings exist */
const DEFAULT_SETTINGS: Settings = {
  fontSize: 36,
  isDimmed: false,
  offsetMs: 0,
  isHighContrast: false,
  lang: 'zh',
}

/**
 * Load settings from localStorage with validation.
 *
 * - fontSize must be a number within 36-72 range (clamped if out of range)
 * - isDimmed must be a boolean
 * - Falls back to DEFAULT_SETTINGS on any parse error or missing data
 */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    const fontSize = typeof parsed.fontSize === 'number'
      ? Math.max(36, Math.min(72, parsed.fontSize))
      : DEFAULT_SETTINGS.fontSize
    const isDimmed = typeof parsed.isDimmed === 'boolean'
      ? parsed.isDimmed
      : DEFAULT_SETTINGS.isDimmed
    const offsetMs = typeof parsed.offsetMs === 'number'
      ? Math.max(-5000, Math.min(5000, parsed.offsetMs))
      : DEFAULT_SETTINGS.offsetMs
    const isHighContrast = typeof parsed.isHighContrast === 'boolean'
      ? parsed.isHighContrast
      : DEFAULT_SETTINGS.isHighContrast
    const lang = parsed.lang === 'en' || parsed.lang === 'zh'
      ? parsed.lang
      : DEFAULT_SETTINGS.lang
    return { fontSize, isDimmed, offsetMs, isHighContrast, lang }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/**
 * Hook that provides settings state with localStorage persistence.
 *
 * Settings are read synchronously on mount and written on every update.
 * Returns { settings, updateSettings }.
 */
export function usePersistedSettings(): {
  settings: Settings
  updateSettings: (partial: Partial<Settings>) => void
} {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  const updateSettings = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial }
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch {
        // Storage full or unavailable — fail silently, keep in-memory
      }
      return next
    })
  }, [])

  return { settings, updateSettings }
}
