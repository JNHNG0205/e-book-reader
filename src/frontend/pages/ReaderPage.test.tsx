import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

const { getBook, getBookFileUrl } = vi.hoisted(() => ({
  getBook: vi.fn(), getBookFileUrl: vi.fn(),
}))
vi.mock('@backend/data/books', () => ({ getBook, getBookFileUrl }))
vi.mock('@backend/data/progress', () => ({
  getProgress: vi.fn().mockResolvedValue(null),
  saveProgress: vi.fn().mockResolvedValue(undefined),
}))
// Mock the PDF viewer so we don't need a real canvas; report 5 pages.
vi.mock('@frontend/reader/PdfViewer', () => ({
  PdfViewer: ({ pageNumber, onNumPages }: { pageNumber: number; onNumPages: (n: number) => void }) => {
    onNumPages(5)
    return <div data-testid="pdf-page">page {pageNumber}</div>
  },
}))

import { ReaderPage } from './ReaderPage'

function renderAt(bookId: string) {
  return render(
    <MemoryRouter initialEntries={[`/read/${bookId}`]}>
      <Routes>
        <Route path="/read/:bookId" element={<ReaderPage />} />
        <Route path="/" element={<div>library</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getBook.mockResolvedValue({ id: 'b1', title: 'Dune', format: 'pdf', storage_path: 'u1/b1.pdf' })
  getBookFileUrl.mockResolvedValue('https://signed/b1.pdf')
})

test('loads the book and renders the first page', async () => {
  renderAt('b1')
  expect(await screen.findByTestId('pdf-page')).toHaveTextContent('page 1')
})

test('next page advances the rendered page', async () => {
  renderAt('b1')
  await screen.findByTestId('pdf-page')
  await userEvent.click(screen.getByRole('button', { name: /next page/i }))
  expect(screen.getByTestId('pdf-page')).toHaveTextContent('page 2')
})

test('shows a placeholder for EPUB (not supported this milestone)', async () => {
  getBook.mockResolvedValue({ id: 'b2', title: 'Novel', format: 'epub', storage_path: 'u1/b2.epub' })
  renderAt('b2')
  expect(await screen.findByText(/not.*supported/i)).toBeInTheDocument()
})
