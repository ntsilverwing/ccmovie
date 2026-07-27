import type { ParsedSubtitle } from '../types/subtitle'
import type { StoredSubtitle } from '../db/database'

interface CuePreviewProps {
  subtitle: ParsedSubtitle | null
  error: string | null
  savedSubtitles?: StoredSubtitle[]
  onSelectSaved?: (stored: StoredSubtitle) => void
}

/**
 * Convert milliseconds to HH:MM:SS timecode string.
 */
function formatTimecode(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Display parsed subtitle cues as a readable list with metadata and error/warning banners.
 * All text rendered via React text nodes — never dangerouslySetInnerHTML.
 */
export const CuePreview: React.FC<CuePreviewProps> = ({ subtitle, error, savedSubtitles, onSelectSaved }) => {
  // Error banner
  if (error) {
    return (
      <div className="error-banner">
        <p>{error}</p>
      </div>
    )
  }

  // Empty state
  if (!subtitle) {
    return (
      <div className="empty-state">
        <p>Import an SRT file to get started</p>
      </div>
    )
  }

  return (
    <div className="cue-preview">
      {/* Warning banner for partial parse errors */}
      {subtitle.errors.length > 0 && (
        <div className="warning-banner">
          <p>Parsed with {subtitle.errors.length} warnings</p>
        </div>
      )}

      {/* Metadata section */}
      <div className="metadata">
        <p className="metadata-item">
          <span className="metadata-label">File:</span> {subtitle.metadata.fileName}
        </p>
        <p className="metadata-item">
          <span className="metadata-label">Encoding:</span> {subtitle.metadata.encoding}
        </p>
        <p className="metadata-item">
          <span className="metadata-label">Cues:</span> {subtitle.cues.length}
        </p>
      </div>

      {/* Cue list */}
      <div className="cue-list">
        {subtitle.cues.map((cue) => (
          <div key={cue.id} className="cue-row">
            <span className="cue-time">{formatTimecode(cue.start)}</span>
            <span className="cue-text">{cue.text}</span>
          </div>
        ))}
      </div>

      {/* Saved movies section */}
      {savedSubtitles && savedSubtitles.length > 0 && onSelectSaved && (
        <div className="saved-movies">
          <h2 className="saved-movies-title">Saved Movies</h2>
          {savedSubtitles.map((stored) => (
            <div key={stored.id} className="saved-movie-item">
              <button
                className="saved-movie-button"
                onClick={() => onSelectSaved(stored)}
              >
                <span className="saved-movie-name">{stored.fileName}</span>
                <span className="saved-movie-meta">
                  {stored.cueCount} cues · {new Date(stored.importedAt).toLocaleDateString()}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
