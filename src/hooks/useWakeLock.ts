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

  // Re-acquire Wake Lock when returning to app during active playback
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Re-enable if the NoSleep instance exists and was previously enabled
        // The native Wake Lock API auto-releases on visibility change
        if (noSleepRef.current) {
          // enable() returns a Promise per runtime implementation; type def says void
          void (noSleepRef.current.enable() as unknown as Promise<void>).catch(() => {
            // Silently fail — may not be in a user gesture context
          })
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return { enable, disable }
}
