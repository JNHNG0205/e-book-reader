import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

const { getBook, getBookFileUrl } = vi.hoisted(() => ({
  getBook: vi.fn(), getBookFileUrl: vi.fn(),
}))
vi.mock('@backend/data/books', () => ({ getBook, getBookFileUrl }))
const { getProgress, saveProgress } = vi.hoisted(() => ({
  getProgress: vi.fn(), saveProgress: vi.fn(),
}))
vi.mock('@backend/data/progress', () => ({ getProgress, saveProgress }))
// Mock the PDF viewer so we don't need a real canvas; report 5 pages.
vi.mock('@frontend/reader/PdfViewer', () => ({
  PdfViewer: ({ pageNumber, onNumPages }: { pageNumber: number; onNumPages: (n: number) => void }) => {
    onNumPages(5)
    return <div data-testid="pdf-page">page {pageNumber}</div>
  },
}))
vi.mock('@frontend/reader/EpubReader', () => ({
  EpubReader: ({ bookId, fileUrl }: { bookId: string; fileUrl: string; onBack?: () => void }) => (
    <div data-testid="epub-reader">{bookId}:{fileUrl}</div>
  ),
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
  getProgress.mockResolvedValue(null)
  saveProgress.mockResolvedValue(undefined)
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

test('renders the EpubReader for an EPUB with its file url', async () => {
  getBook.mockResolvedValue({ id: 'b2', title: 'Novel', format: 'epub', storage_path: 'u1/b2.epub' })
  getBookFileUrl.mockResolvedValue('https://signed/b2.epub')
  renderAt('b2')
  const reader = await screen.findByTestId('epub-reader')
  expect(reader).toHaveTextContent('b2:https://signed/b2.epub')
})

test('resumes to the saved page', async () => {
  getProgress.mockResolvedValue('3')
  renderAt('b1')
  expect(await screen.findByTestId('pdf-page')).toHaveTextContent('page 3')
})

test('saves the location when the page changes (debounced)', async () => {
  vi.useFakeTimers()
  try {
    await act(async () => {
      renderAt('b1')
      await vi.runOnlyPendingTimersAsync()
    })
    const next = screen.getByRole('button', { name: /next page/i })
    next.click()
    await vi.advanceTimersByTimeAsync(600)
    expect(saveProgress).toHaveBeenCalledWith('b1', '2')
  } finally {
    vi.useRealTimers()
  }
})
