import { useRef, useState, useEffect, useCallback, type UIEvent } from 'react'
import type { ParsedSubtitle } from '../types/subtitle'
import type { StoredSubtitle } from '../db/database'
import { useLanguage } from '../i18n/LanguageContext'

interface CuePreviewProps {
  subtitle: ParsedSubtitle | null
  error: string | null
  savedSubtitles?: StoredSubtitle[]
  onSelectSaved?: (stored: StoredSubtitle) => void
}

const ROW_HEIGHT = 37
const OVERSCAN = 5
const LIST_MAX_HEIGHT = 60 * 100 // 60vh in px approximation

function formatTimecode(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function VirtualizedCueList({ cues }: { cues: ParsedSubtitle['cues'] }) {
  const listRef = useRef<HTMLDivElement>(null)
  const scrollTopRef = useRef(0)
  const [containerHeight, setContainerHeight] = useState(LIST_MAX_HEIGHT)
  const [, forceRender] = useState(0)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    scrollTopRef.current = e.currentTarget.scrollTop
    forceRender((n) => n + 1)
  }, [])

  const scrollTop = scrollTopRef.current
  const totalHeight = cues.length * ROW_HEIGHT
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const endIdx = Math.min(cues.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN)
  const visibleCues = cues.slice(startIdx, endIdx)
  const offsetY = startIdx * ROW_HEIGHT

  return (
    <div
      ref={listRef}
      className="cue-list"
      onScroll={handleScroll}
      style={{ height: containerHeight, overflowY: 'auto' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleCues.map((cue) => (
            <div key={cue.id} className="cue-row" style={{ height: ROW_HEIGHT }}>
              <span className="cue-time">{formatTimecode(cue.start)}</span>
              <span className="cue-text">{cue.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Display parsed subtitle cues as a readable list with metadata and error/warning banners.
 * All text rendered via React text nodes — never dangerouslySetInnerHTML.
 */
export const CuePreview: React.FC<CuePreviewProps> = ({ subtitle, error, savedSubtitles, onSelectSaved }) => {
  const { t } = useLanguage()

  if (error) {
    return (
      <div className="error-banner">
        <p>{error}</p>
      </div>
    )
  }

  if (!subtitle) {
    return (
      <div className="empty-state">
        <p>{t('importToGetStarted')}</p>
      </div>
    )
  }

  return (
    <div className="cue-preview">
      {subtitle.errors.length > 0 && (
        <div className="warning-banner">
          <p>{t('parsedWithWarnings', { count: subtitle.errors.length })}</p>
        </div>
      )}

      <div className="metadata">
        <p className="metadata-item">
          <span className="metadata-label">{t('fileLabel')}</span> {subtitle.metadata.fileName}
        </p>
        <p className="metadata-item">
          <span className="metadata-label">{t('encodingLabel')}</span> {subtitle.metadata.encoding}
        </p>
        <p className="metadata-item">
          <span className="metadata-label">{t('cuesLabel')}</span> {subtitle.cues.length}
        </p>
      </div>

      {subtitle.cues.length > 50 ? (
        <VirtualizedCueList cues={subtitle.cues} />
      ) : (
        <div className="cue-list">
          {subtitle.cues.map((cue) => (
            <div key={cue.id} className="cue-row">
              <span className="cue-time">{formatTimecode(cue.start)}</span>
              <span className="cue-text">{cue.text}</span>
            </div>
          ))}
        </div>
      )}

      {savedSubtitles && savedSubtitles.length > 0 && onSelectSaved && (
        <div className="saved-movies">
          <h2 className="saved-movies-title">{t('savedMovies')}</h2>
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
