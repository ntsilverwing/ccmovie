import { useState, useRef, DragEvent, ChangeEvent } from 'react'
import type { ParsedSubtitle } from '../types/subtitle'
import { importSRT } from '../imports/fileImport'
import { ImportError } from '../utils/errors'
import { useLanguage } from '../i18n/LanguageContext'

interface FilePickerProps {
  onImport: (result: ParsedSubtitle) => void
  onError: (error: ImportError) => void
}

/**
 * File picker with drag-drop support for SRT/TXT subtitle files.
 * Calls importSRT orchestrator and delegates results to parent via callbacks.
 */
export const FilePicker: React.FC<FilePickerProps> = ({ onImport, onError }) => {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { t } = useLanguage()

  const handleFile = async (file: File) => {
    try {
      const result = await importSRT(file)
      onImport(result)
    } catch (err) {
      if (err instanceof ImportError) {
        onError(err)
      } else {
        onError(new ImportError('UNKNOWN', 'An unexpected error occurred during import.'))
      }
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div
      className={isDragging ? 'drop-zone active' : 'drop-zone'}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".srt,.txt"
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />
      <p className="drop-text">{t('dropSRT')}</p>
    </div>
  )
}
