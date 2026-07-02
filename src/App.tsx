import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppHeader } from './components/AppHeader'
import { LibraryPage } from './pages/LibraryPage'

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
