import { useState } from 'react'
import { FilePicker } from './components/FilePicker'
import { CuePreview } from './components/CuePreview'
import { SubtitleDisplay } from './components/SubtitleDisplay'
import { PlaybackControls } from './components/PlaybackControls'
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
        <SubtitleDisplay
          cue={playbackState.activeCue}
          fontSize={settings.fontSize}
          isDimmed={settings.isDimmed}
        />
        <PlaybackControls
          status={playbackState.status}
          onPlay={play}
          onPause={pause}
          onStop={stop}
          fontSize={settings.fontSize}
          isDimmed={settings.isDimmed}
          onFontSizeChange={(size) => updateSettings({ fontSize: size })}
          onDimToggle={() => updateSettings({ isDimmed: !settings.isDimmed })}
        />
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
      <PlaybackControls
        status={playbackState.status}
        onPlay={play}
        onPause={pause}
        onStop={stop}
        fontSize={settings.fontSize}
        isDimmed={settings.isDimmed}
        onFontSizeChange={(size) => updateSettings({ fontSize: size })}
        onDimToggle={() => updateSettings({ isDimmed: !settings.isDimmed })}
      />
    </div>
  )
}

export default App
