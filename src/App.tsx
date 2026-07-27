import { useState } from 'react'
import { FilePicker } from './components/FilePicker'
import { CuePreview } from './components/CuePreview'
import type { ParsedSubtitle } from './types/subtitle'
import type { ImportError } from './utils/errors'

function App() {
  const [subtitle, setSubtitle] = useState<ParsedSubtitle | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImport = (result: ParsedSubtitle) => {
    setSubtitle(result)
    setError(null)
  }

  const handleError = (err: ImportError) => {
    setError(err.message)
    setSubtitle(null)
  }

  return (
    <div className="app">
      <FilePicker onImport={handleImport} onError={handleError} />
      <CuePreview subtitle={subtitle} error={error} />
    </div>
  )
}

export default App
