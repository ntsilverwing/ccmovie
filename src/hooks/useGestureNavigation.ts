import { useRef, useCallback } from 'react'
import { detectGesture, isGestureThrottled } from '../playback/cueNavigation'

export interface GestureNavigationOptions {
  onSwipeUp: () => void
  onSwipeDown: () => void
  enabled?: boolean
}

export interface GestureContainerProps {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void
}

export interface UseGestureNavigationReturn {
  containerProps: GestureContainerProps
}

/**
 * Touch and pointer gesture navigation hook for theater blind navigation.
 *
 * Captures vertical swipe gestures (>=40px delta, vertical-dominant) on the subtitle container,
 * with 300ms throttling and pointer capture for reliable touch tracking.
 */
export function useGestureNavigation({
  onSwipeUp,
  onSwipeDown,
  enabled = true,
}: GestureNavigationOptions): UseGestureNavigationReturn {
  const lastTriggeredRef = useRef<number>(0)
  const startCoordRef = useRef<{ x: number; y: number } | null>(null)
  const isPointerDownRef = useRef<boolean>(false)
  const activePointerIdRef = useRef<number | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!enabled || e.button !== 0) {
        return
      }

      startCoordRef.current = { x: e.clientX, y: e.clientY }
      isPointerDownRef.current = true
      activePointerIdRef.current = e.pointerId

      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // Pointer capture may fail on unsupported devices or detached elements
      }
    },
    [enabled]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!isPointerDownRef.current || activePointerIdRef.current !== e.pointerId) {
        return
      }
      // Movement tracking is active; touch-action: none in CSS blocks scrolling
    },
    []
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!isPointerDownRef.current || activePointerIdRef.current !== e.pointerId) {
        return
      }

      const start = startCoordRef.current
      isPointerDownRef.current = false
      activePointerIdRef.current = null
      startCoordRef.current = null

      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId)
        }
      } catch {
        // Ignore pointer capture release failures
      }

      if (!start) {
        return
      }

      const gesture = detectGesture(start.x, start.y, e.clientX, e.clientY)
      if (gesture) {
        const now = Date.now()
        if (!isGestureThrottled(now, lastTriggeredRef.current)) {
          lastTriggeredRef.current = now
          if (gesture === 'up') {
            onSwipeUp()
          } else {
            onSwipeDown()
          }
        }
      }
    },
    [onSwipeUp, onSwipeDown]
  )

  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLElement>) => {
    isPointerDownRef.current = false
    activePointerIdRef.current = null
    startCoordRef.current = null

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // Ignore
    }
  }, [])

  return {
    containerProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  }
}
