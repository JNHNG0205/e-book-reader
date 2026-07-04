import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import App from './App'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))
vi.mock('@frontend/auth/useSession', () => ({ useSession: () => useSession() }))
vi.mock('@frontend/reader/PdfViewer', () => ({
  PdfViewer: () => <div data-testid="pdf-viewer" />,
}))
vi.mock('@frontend/reader/searchPdf', () => ({
  searchPdf: vi.fn().mockResolvedValue([]),
}))
vi.mock('@frontend/library/coverExtract', () => ({
  extractCoverBlob: vi.fn().mockResolvedValue(null),
}))
vi.mock('@frontend/library/bookMetadata', () => ({
  extractBookMetadata: vi.fn().mockResolvedValue({ title: null, author: null }),
}))
vi.mock('@frontend/offline/offlineData', () => ({
  getAllProgress: vi.fn().mockResolvedValue([]),
}))

test('renders the app title', () => {
  useSession.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false })
  render(<App />)
  expect(screen.getByRole('heading', { name: /e-book reader/i })).toBeInTheDocument()
})
