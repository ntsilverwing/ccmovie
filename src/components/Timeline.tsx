import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ChangeEvent, KeyboardEvent } from 'react'
import type { PlaybackSession } from '../playback/session'
import { sessionElapsedMs, formatElapsedHMS } from '../playback/session'
import type { PlaybackStatus } from '../hooks/usePlaybackEngine'
import type { Cue } from '../types/subtitle'
import { useLanguage } from '../i18n/LanguageContext'
import {
  computeCueDensityBuckets,
  clampToDuration,
  clampPreviewTarget,
  computeKeyboardStepTarget,
} from '../playback/timelineDensity'

/** Fixed bucket count (Phase 8, D-07): fixed once, never derived from input size. */
const BUCKET_COUNT = 100

interface TimelineProps {
  session: PlaybackSession | null
  status: PlaybackStatus
  cues: Cue[]
  totalDurationMs: number
  onSeek: (targetMs: number) => void
  onPreviewSeek: (targetMs: number) => void
}

/**
 * Timeline — progress bar with cue density markers (Phase 8, UI-01/UI-02/UI-03).
 *
 * Layout contract (08-UI-SPEC): first child of the playing/paused branch,
 * flex-basis 100% → its own row atop the control cluster. Row structure is
 * [current time][track flex:1][total duration], both labels h:mm:ss via
 * formatElapsedHMS (UI-01, D-04).
 *
 * Ticking (SessionBanner 250ms variant): a 250ms interval re-reads Date.now()
 * only while status is 'playing'. Dual-clock rule — display reads ONLY the
 * session wall-clock via sessionElapsedMs(session, now); the engine's
 * internal clock is never read for display (Anti-Pattern 6).
 *
 * Drag state machine (D-01/D-02, RESEARCH Pattern 2): while dragging, the
 * controlled value comes from dragValue (gesture sovereignty — the position
 * ticker never pulls the thumb back) and every change routes through
 * onPreviewSeek (engine-only, zero IndexedDB writes). pointerup / blur /
 * pointerleave commit once via onSeek (persist effect fires once, D-02).
 * The preview target is clamped strictly before the end (clampPreviewTarget,
 * Pitfall 2) while the commit path keeps the exact-end semantics (07-D-03).
 *
 * Keyboard (D-12): ←/→ are intercepted and commit a ±5s clamped step;
 * Home/End/PageUp/PageDown fall through to native behavior, whose change
 * events land in the non-dragging commit branch (Pitfall 5).
 *
 * The native <input type="range"> is the ONLY interaction and accessibility
 * surface (D-10): the density marker layer and track visuals are
 * non-interactive paint layers beneath it. ARIA exposes "播放进度 /
 * Playback progress" + "h:mm:ss / h:mm:ss" (D-13); subtitle text is never
 * placed in aria attributes.
 */
export function Timeline({
  session,
  status,
  cues,
  totalDurationMs,
  onSeek,
  onPreviewSeek,
}: TimelineProps) {
  const [now, setNow] = useState(Date.now())
  const [isDragging, setIsDragging] = useState(false)
  const [dragValue, setDragValue] = useState(0)
  const { t } = useLanguage()

  useEffect(() => {
    if (status !== 'playing') return
    const interval = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [status])

  // Density buckets (UI-03, D-07/D-08/D-09): fixed 100 buckets, tier 0
  // buckets render no DOM (empty gaps stay visually clean).
  const buckets = useMemo(
    () => computeCueDensityBuckets(cues, totalDurationMs, BUCKET_COUNT),
    [cues, totalDurationMs]
  )

  // Display value: drag value while dragging (no clock back-feed), otherwise
  // the session wall-clock position clamped to [0, totalDurationMs]
  // (T-08-03: tampered records cannot push the display out of range).
  const displayValue = isDragging
    ? dragValue
    : clampToDuration(session === null ? 0 : sessionElapsedMs(session, now), totalDurationMs)

  // Disabled when there is no valid duration (Pitfall 6 divide-by-zero guard,
  // 07-D-07): native disabled semantics, no markers, --pos-percent forced 0.
  const disabled = totalDurationMs <= 0

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = clampToDuration(Number(e.target.value), totalDurationMs)
    if (isDragging) {
      setDragValue(v)
      // Preview path: engine-only, clamped strictly before the end so the
      // tick auto-stop cannot unmount the Timeline mid-drag (Pitfall 2, D-01).
      onPreviewSeek(clampPreviewTarget(v, totalDurationMs))
    } else {
      // No pointerdown (Home/End/PageUp/PageDown native changes): commit
      // directly — otherwise the value would preview forever (Pitfall 5).
      onSeek(v)
    }
  }

  const handlePointerDown = () => {
    setIsDragging(true)
    setDragValue(displayValue)
  }

  // Single commit for pointerup + blur + pointerleave (A2 fallback: some
  // browsers never dispatch pointerup during touch drags, UI-SPEC contract).
  // Idempotent: only the first call after a drag commits.
  const handleDragCommit = () => {
    if (!isDragging) return
    setIsDragging(false)
    // Commit path is NOT end-clamped — hitting the exact totalDurationMs is
    // the legal immediate-stop semantics (07-D-03).
    onSeek(dragValue)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // Intercept native stepping: with a string-any step the native
      // increment is unpredictable, and a fixed step attribute would snap
      // drags too (Pitfall 3, MDN). ±5s clamped commit (D-12).
      e.preventDefault()
      onSeek(
        computeKeyboardStepTarget(displayValue, e.key === 'ArrowLeft' ? -1 : 1, totalDurationMs)
      )
    }
    // Home/End/PageUp/PageDown: native behavior → onChange → commit branch.
  }

  const posPercent = totalDurationMs > 0 ? `${(displayValue / totalDurationMs) * 100}%` : '0%'

  return (
    <div className="timeline">
      <span className="timeline-time timeline-time-current">{formatElapsedHMS(displayValue)}</span>
      <div className="timeline-track-wrap">
        {!disabled && (
          <div className="timeline-markers" aria-hidden="true">
            {buckets
              .filter((bucket) => bucket.tier > 0)
              .map((bucket) => (
                <span
                  key={bucket.startMs}
                  className={`timeline-marker tier-${bucket.tier}`}
                  style={{
                    left: `${(bucket.startMs / totalDurationMs) * 100}%`,
                    width: `${100 / BUCKET_COUNT}%`,
                  }}
                />
              ))}
          </div>
        )}
        <input
          type="range"
          min={0}
          max={totalDurationMs}
          step="any"
          value={displayValue}
          disabled={disabled}
          className={`timeline-slider${isDragging ? ' dragging' : ''}`}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerUp={handleDragCommit}
          onBlur={handleDragCommit}
          onPointerLeave={handleDragCommit}
          aria-label={t('timelineLabel')}
          aria-valuetext={`${formatElapsedHMS(displayValue)} / ${formatElapsedHMS(totalDurationMs)}`}
          style={{ '--pos-percent': posPercent } as CSSProperties}
        />
      </div>
      <span className="timeline-time timeline-time-total">{formatElapsedHMS(totalDurationMs)}</span>
    </div>
  )
}
