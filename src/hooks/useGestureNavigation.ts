import { useRef, useCallback } from 'react'
import { detectGesture, isGestureThrottled } from '../playback/cueNavigation'

export interface GestureNavigationOptions {
  onSwipeUp: () => void
  onSwipeDown: () => void
  enabled?: boolean
  /** Called when a vertical swipe is in progress (dy dominant, >10px) — used to suppress controls auto-show */
  onSwipeActiveChange?: (active: boolean) => void
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
  onSwipeActiveChange,
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
      // Detect early vertical swipe to allow App to suppress controls auto-show
      if (onSwipeActiveChange && startCoordRef.current) {
        const dx = e.clientX - startCoordRef.current.x
        const dy = e.clientY - startCoordRef.current.y
        const isVerticalDominant = Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10
        if (isVerticalDominant) {
          onSwipeActiveChange(true)
        }
      }
    },
    [onSwipeActiveChange]
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
          // Keep active flag for a short window to suppress the synthetic click
          onSwipeActiveChange?.(true)
          setTimeout(() => onSwipeActiveChange?.(false), 400)
          if (gesture === 'up') {
            onSwipeUp()
          } else {
            onSwipeDown()
          }
        } else {
          onSwipeActiveChange?.(false)
        }
      } else {
        onSwipeActiveChange?.(false)
      }
    },
    [onSwipeUp, onSwipeDown, onSwipeActiveChange]
  )

  const onPointerCancel = useCallback((e: React.PointerEvent<HTMLElement>) => {
    isPointerDownRef.current = false
    activePointerIdRef.current = null
    startCoordRef.current = null
    onSwipeActiveChange?.(false)

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    } catch {
      // Ignore
    }
  }, [onSwipeActiveChange])

  return {
    containerProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  }
}
