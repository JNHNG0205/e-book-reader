import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from '@frontend/App'
import { SessionProvider } from '@frontend/auth/SessionProvider'
import { startAutoSync } from '@frontend/offline/syncEngine'
import './index.css'

registerSW({ immediate: true })

// Flush any queued offline writes now, and again on every reconnect, app-wide.
startAutoSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
)
