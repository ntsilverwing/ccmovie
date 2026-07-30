import { describe, it, expect } from 'vitest'
import {
  type HistoryLike,
  PLAYBACK_ENTRY,
  isPlaybackEntry,
  enterPlaybackHistory,
  exitPlaybackHistory,
} from '../../src/playback/playbackHistory'

/**
 * In-memory stack simulator for the browser History API.
 *
 * Maintains an internal entries array so depth is assertable, tracks
 * push/replace/back call counts, and pops on back(). Initialized with a
 * null base entry, mirroring a freshly opened tab with no app state.
 */
class FakeHistory implements HistoryLike {
  private entries: unknown[] = [null]
  pushCount = 0
  replaceCount = 0
  backCount = 0

  get state(): unknown {
    return this.entries[this.entries.length - 1]
  }

  get depth(): number {
    return this.entries.length
  }

  pushState(state: unknown, _unused: string): void {
    this.pushCount++
    this.entries.push(state)
  }

  replaceState(state: unknown, _unused: string): void {
    this.replaceCount++
    this.entries[this.entries.length - 1] = state
  }

  back(): void {
    this.backCount++
    if (this.entries.length > 1) {
      this.entries.pop()
    }
  }
}

describe('playbackHistory', () => {
  describe('isPlaybackEntry', () => {
    it('matches the shared PLAYBACK_ENTRY marker', () => {
      expect(isPlaybackEntry(PLAYBACK_ENTRY)).toBe(true)
    })

    it('matches a structured clone of the marker (popstate never returns the same reference)', () => {
      const clone = JSON.parse(JSON.stringify(PLAYBACK_ENTRY))
      expect(isPlaybackEntry(clone)).toBe(true)
    })

    it('matches objects carrying extra fields alongside view (field check, not shape check)', () => {
      expect(isPlaybackEntry({ view: 'playback', extra: 1 })).toBe(true)
    })

    it('rejects null', () => {
      expect(isPlaybackEntry(null)).toBe(false)
    })

    it('rejects undefined', () => {
      expect(isPlaybackEntry(undefined)).toBe(false)
    })

    it('rejects primitives', () => {
      expect(isPlaybackEntry(0)).toBe(false)
      expect(isPlaybackEntry(1)).toBe(false)
    })

    it("rejects the string 'playback' itself", () => {
      expect(isPlaybackEntry('playback')).toBe(false)
    })

    it('rejects arrays', () => {
      expect(isPlaybackEntry([])).toBe(false)
      expect(isPlaybackEntry(['playback'])).toBe(false)
    })

    it('rejects empty objects', () => {
      expect(isPlaybackEntry({})).toBe(false)
    })

    it('rejects other view values', () => {
      expect(isPlaybackEntry({ view: 'selection' })).toBe(false)
    })
  })

  describe('enterPlaybackHistory (D-01: one marker entry per visit)', () => {
    it('pushes a marker over the base null state, growing depth 1 → 2', () => {
      const h = new FakeHistory()
      enterPlaybackHistory(h)
      expect(h.depth).toBe(2)
      expect(h.pushCount).toBe(1)
      expect(h.replaceCount).toBe(0)
      expect(isPlaybackEntry(h.state)).toBe(true)
    })

    it('replaces instead of pushing when the marker is already on top (D-02 anti-stacking)', () => {
      const h = new FakeHistory()
      enterPlaybackHistory(h)
      enterPlaybackHistory(h)
      expect(h.depth).toBe(2)
      expect(h.pushCount).toBe(1)
      expect(h.replaceCount).toBe(1)
      expect(isPlaybackEntry(h.state)).toBe(true)
    })

    it('double-enter in a row grows depth by exactly ONE total', () => {
      const h = new FakeHistory()
      const baseline = h.depth
      enterPlaybackHistory(h)
      enterPlaybackHistory(h)
      expect(h.depth).toBe(baseline + 1)
    })

    it('pushes over a foreign top state, leaving the foreign entry intact underneath', () => {
      const h = new FakeHistory()
      const foreign = { custom: 'x' }
      h.pushState(foreign, '')
      const depthBefore = h.depth
      enterPlaybackHistory(h)
      expect(h.pushCount).toBe(2)
      expect(h.replaceCount).toBe(0)
      expect(h.depth).toBe(depthBefore + 1)
      expect(isPlaybackEntry(h.state)).toBe(true)
      // Pop our marker: the foreign entry must still be there, unchanged
      h.back()
      expect(h.state).toBe(foreign)
    })

    it('pushes over arbitrary foreign states ({view:"selection"} counts as foreign)', () => {
      const h = new FakeHistory()
      h.pushState({ view: 'selection' }, '')
      const pushesBeforeEnter = h.pushCount
      enterPlaybackHistory(h)
      expect(h.pushCount).toBe(pushesBeforeEnter + 1)
      expect(h.replaceCount).toBe(0)
      expect(isPlaybackEntry(h.state)).toBe(true)
    })
  })

  describe('exitPlaybackHistory (D-03: pop only entries we created)', () => {
    it('consumes exactly one back() when our marker is on top', () => {
      const h = new FakeHistory()
      enterPlaybackHistory(h)
      exitPlaybackHistory(h)
      expect(h.backCount).toBe(1)
      expect(h.depth).toBe(1)
      expect(h.state).toBeNull()
    })

    it('restores the pre-playback entry as the new top', () => {
      const h = new FakeHistory()
      const foreign = { custom: 'x' }
      h.pushState(foreign, '')
      enterPlaybackHistory(h)
      exitPlaybackHistory(h)
      expect(h.backCount).toBe(1)
      expect(h.state).toBe(foreign)
    })

    it('is a no-op over the base null state (selection-page back stays a natural app exit)', () => {
      const h = new FakeHistory()
      exitPlaybackHistory(h)
      expect(h.backCount).toBe(0)
      expect(h.depth).toBe(1)
      expect(h.state).toBeNull()
    })

    it('is a no-op over a foreign top state — foreign entry untouched', () => {
      const h = new FakeHistory()
      const foreign = { custom: 'x' }
      h.pushState(foreign, '')
      exitPlaybackHistory(h)
      expect(h.backCount).toBe(0)
      expect(h.depth).toBe(2)
      expect(h.state).toBe(foreign)
    })

    it('is a no-op after our marker was already consumed (idempotent exit)', () => {
      const h = new FakeHistory()
      enterPlaybackHistory(h)
      exitPlaybackHistory(h)
      exitPlaybackHistory(h)
      expect(h.backCount).toBe(1)
      expect(h.depth).toBe(1)
    })

    it('does not treat {view:"selection"} as ours even at top', () => {
      const h = new FakeHistory()
      h.pushState({ view: 'selection' }, '')
      exitPlaybackHistory(h)
      expect(h.backCount).toBe(0)
      expect(h.state).toEqual({ view: 'selection' })
    })
  })
})
