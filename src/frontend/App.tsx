import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@frontend/components/ProtectedRoute'
import { AppHeader } from '@frontend/components/AppHeader'
import { LibraryPage } from '@frontend/pages/LibraryPage'

export default function App() {
  return (
    <BrowserRouter>
      <ProtectedRoute>
        <AppHeader />
        <Routes>
          <Route path="/" element={<LibraryPage />} />
        </Routes>
      </ProtectedRoute>
    </BrowserRouter>
  )
}
