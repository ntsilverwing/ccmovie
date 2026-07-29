import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { RegisterSW } from './pwa/RegisterSW'
import { LanguageProvider } from './i18n/LanguageContext'
import { loadSettings } from './hooks/usePersistedSettings'

// Read persisted language (synchronous — settings load from localStorage)
const initialLang = loadSettings().lang

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider initialLang={initialLang}>
      <App />
      <RegisterSW />
    </LanguageProvider>
  </StrictMode>,
)
