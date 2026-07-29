import type { PlaybackStatus } from '../hooks/usePlaybackEngine'

interface PlaybackControlsProps {
  status: PlaybackStatus
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  fontSize: number
  isDimmed: boolean
  onFontSizeChange: (size: number) => void
  onDimToggle: () => void
  offsetMs: number
  isHighContrast: boolean
  onOffsetChange: (offsetMs: number) => void
  onHighContrastToggle: () => void
}

/**
 * Playback controls overlay — Start/Stop/Pause + font slider + dim toggle.
 *
 * Positioned fixed at bottom center. All buttons have large touch targets
 * for dark theater use (min 48x48px).
 */
export function PlaybackControls({
  status,
  onPlay,
  onPause,
  onStop,
  fontSize,
  isDimmed,
  onFontSizeChange,
  onDimToggle,
  offsetMs,
  isHighContrast,
  onOffsetChange,
  onHighContrastToggle,
}: PlaybackControlsProps) {
  return (
    <div className="playback-controls">
      {status === 'idle' && (
        <button className="start-button" onClick={onPlay}>
          Start
        </button>
      )}

      {(status === 'playing' || status === 'paused') && (
        <>
          <button className="control-button" onClick={() => onOffsetChange(offsetMs - 500)}>
            −0.5s
          </button>
          <span className="offset-display">
            {offsetMs > 0 ? '+' : ''}{(offsetMs / 1000).toFixed(1)}s
          </span>
          <button className="control-button" onClick={() => onOffsetChange(offsetMs + 500)}>
            +0.5s
          </button>
          <button className="control-button" onClick={() => onOffsetChange(0)}>
            Reset
          </button>
          <button className="control-button" onClick={onStop}>
            Stop
          </button>
          <button className="control-button" onClick={status === 'paused' ? onPlay : onPause}>
            {status === 'paused' ? 'Resume' : 'Pause'}
          </button>
          <input
            type="range"
            min="36"
            max="72"
            value={fontSize}
            onChange={(e) => onFontSizeChange(Number(e.target.value))}
            className="font-size-slider"
            aria-label="Font size"
            aria-valuetext={`${fontSize} pixels`}
          />
          <button className="control-button" onClick={onDimToggle}>
            {isDimmed ? 'Bright' : 'Dim'}
          </button>
          <button className="control-button" onClick={onHighContrastToggle}>
            {isHighContrast ? 'Normal' : 'Contrast'}
          </button>
        </>
      )}
    </div>
  )
}
