import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/game/modules'
import App from '@/App'
import '@/resources/scss/theme.scss'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
