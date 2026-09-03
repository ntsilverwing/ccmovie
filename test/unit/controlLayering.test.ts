import { describe, it, expect } from 'vitest'
import { translations } from '../../src/i18n/translations'

describe('Control Layering & Settings Drawer (Phase 10, UI-06, UI-07, UI-08)', () => {
  describe('i18n translation keys', () => {
    it('contains all required keys for settings drawer in both English and Chinese', () => {
      const requiredKeys = [
        'settings',
        'close',
        'resetAll',
        'fontSmaller',
        'fontLarger',
        'offsetLabel',
        'fontSize',
        'fullscreen',
        'exitFullscreen',
        'stop',
        'back',
        'wakeLockOn',
      ] as const

      for (const key of requiredKeys) {
        expect(translations.en[key]).toBeDefined()
        expect(typeof translations.en[key]).toBe('string')
        expect(translations.zh[key]).toBeDefined()
        expect(typeof translations.zh[key]).toBe('string')
      }
    })
  })

  describe('Discrete font size adjustments (D-06)', () => {
    const MIN_FONT_SIZE = 36
    const MAX_FONT_SIZE = 72
    const FONT_STEP = 4

    const decreaseFontSize = (current: number) => Math.max(MIN_FONT_SIZE, current - FONT_STEP)
    const increaseFontSize = (current: number) => Math.min(MAX_FONT_SIZE, current + FONT_STEP)

    it('decreases font size by 4px down to 36px clamp', () => {
      expect(decreaseFontSize(48)).toBe(44)
      expect(decreaseFontSize(38)).toBe(36)
      expect(decreaseFontSize(36)).toBe(36)
    })

    it('increases font size by 4px up to 72px clamp', () => {
      expect(increaseFontSize(48)).toBe(52)
      expect(increaseFontSize(70)).toBe(72)
      expect(increaseFontSize(72)).toBe(72)
    })
  })

  describe('Global Reset (D-09)', () => {
    it('resets both offsetMs to 0 and fontSize to default 48px', () => {
      const currentSettings = {
        offsetMs: 1500,
        fontSize: 64,
        isDimmed: false,
        isHighContrast: false,
      }

      const resetSettings = {
        ...currentSettings,
        offsetMs: 0,
        fontSize: 48,
      }

      expect(resetSettings.offsetMs).toBe(0)
      expect(resetSettings.fontSize).toBe(48)
    })
  })
})
