import { useState } from 'react'
import { FilePicker } from './components/FilePicker'
import { CuePreview } from './components/CuePreview'
import { usePlaybackEngine } from './hooks/usePlaybackEngine'
import { usePersistedSettings } from './hooks/usePersistedSettings'
import type { ParsedSubtitle } from './types/subtitle'
import type { ImportError } from './utils/errors'

function App() {
  const [subtitle, setSubtitle] = useState<ParsedSubtitle | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { state: playbackState, play, pause, stop } = usePlaybackEngine(subtitle?.cues ?? [])
  const { settings, updateSettings } = usePersistedSettings()

  const handleImport = (result: ParsedSubtitle) => {
    // Stop current playback when a new file is imported during playback
    stop()
    setSubtitle(result)
    setError(null)
  }

  const handleError = (err: ImportError) => {
    setError(err.message)
    setSubtitle(null)
  }

  // Playback view: status is 'playing' or 'paused'
  if (playbackState.status === 'playing' || playbackState.status === 'paused') {
    return (
      <div className="app">
        <div className="playback-view">
          <p
            className="subtitle-text"
            style={{
              fontSize: settings.fontSize + 'px',
              color: settings.isDimmed ? '#888888' : '#E0E0E0',
            }}
          >
            {playbackState.activeCue?.text ?? ''}
          </p>
        </div>
        <div className="playback-controls">
          <button className="control-button" onClick={stop}>
            Stop
          </button>
          <button className="control-button" onClick={playbackState.status === 'paused' ? play : pause}>
            {playbackState.status === 'paused' ? 'Resume' : 'Pause'}
          </button>
          <input
            type="range"
            min="36"
            max="72"
            value={settings.fontSize}
            onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
            className="font-size-slider"
          />
          <button className="control-button" onClick={() => updateSettings({ isDimmed: !settings.isDimmed })}>
            {settings.isDimmed ? 'Bright' : 'Dim'}
          </button>
        </div>
      </div>
    )
  }

  // Import view: no subtitle loaded
  if (!subtitle) {
    return (
      <div className="app">
        <FilePicker onImport={handleImport} onError={handleError} />
      </div>
    )
  }

  // Ready view: subtitle loaded, playback idle
  return (
    <div className="app">
      <CuePreview subtitle={subtitle} error={error} />
      <div className="ready-controls">
        <button className="start-button" onClick={play}>
          Start
        </button>
      </div>
    </div>
  )
}

export default App
