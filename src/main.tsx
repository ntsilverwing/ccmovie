import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { RegisterSW } from './pwa/RegisterSW'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <RegisterSW />
  </StrictMode>,
)
