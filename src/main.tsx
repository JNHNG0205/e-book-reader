import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@frontend/App'
import { SessionProvider } from '@frontend/auth/SessionProvider'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
)
