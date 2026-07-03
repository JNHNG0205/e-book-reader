import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@frontend/components/ProtectedRoute'
import { AppHeader } from '@frontend/components/AppHeader'
import { LibraryPage } from '@frontend/pages/LibraryPage'
import { ReaderPage } from '@frontend/pages/ReaderPage'

export default function App() {
  return (
    <BrowserRouter>
      <ProtectedRoute>
        <AppHeader />
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/read/:bookId" element={<ReaderPage />} />
        </Routes>
      </ProtectedRoute>
    </BrowserRouter>
  )
}
