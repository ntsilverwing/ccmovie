import { useRef, useCallback, useEffect } from 'react'
import NoSleep from '@zakj/no-sleep'

/**
 * Wake Lock hook — keeps screen awake during playback.
 *
 * Uses @zakj/no-sleep which auto-selects between native Wake Lock API
 * (iOS 18.4+, modern Android) and hidden video fallback (older iOS).
 *
 * CRITICAL: enable() must be called within a user gesture (click/touch handler).
 * The "Start" button click in PlaybackControls satisfies this requirement.
 */
export function useWakeLock() {
  const noSleepRef = useRef<InstanceType<typeof NoSleep> | null>(null)

  // Lazy init — NoSleep requires DOM, create on first use
  const getNoSleep = useCallback(() => {
    if (!noSleepRef.current) {
      noSleepRef.current = new NoSleep()
    }
    return noSleepRef.current
  }, [])

  // Must be called within a user gesture (click/touch handler)
  const enable = useCallback(async () => {
    try {
      // enable() returns a Promise per runtime implementation; type def says void
      await (getNoSleep().enable() as unknown as Promise<void>)
    } catch (err) {
      // Wake Lock failed — log but don't crash playback
      console.warn('Wake Lock enable failed:', err)
    }
  }, [getNoSleep])

  const disable = useCallback(() => {
    getNoSleep().disable()
  }, [getNoSleep])

  // NOTE: Wake Lock re-acquisition on visibilitychange is intentionally NOT
  // implemented here. The native Wake Lock API requires a user gesture
  // (click/touch) to re-acquire — visibilitychange is NOT a user gesture,
  // so the browser rejects the request with a SecurityError. Instead, the
  // app should call the exposed `enable()` from a user gesture handler
  // (e.g., Resume button) when the user returns to the app.

  // Cleanup: release Wake Lock when the component unmounts
  useEffect(() => {
    return () => {
      noSleepRef.current?.disable()
    }
  }, [])

  return { enable, disable }
}
