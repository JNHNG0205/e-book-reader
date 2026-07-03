import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

const { getBook } = vi.hoisted(() => ({ getBook: vi.fn() }))
vi.mock('@backend/data/books', () => ({ getBook }))
const { loadBookObjectUrl } = vi.hoisted(() => ({ loadBookObjectUrl: vi.fn() }))
vi.mock('@frontend/offline/loadBook', () => ({ loadBookObjectUrl }))
const { getProgress, saveProgress } = vi.hoisted(() => ({
  getProgress: vi.fn(), saveProgress: vi.fn(),
}))
vi.mock('@backend/data/progress', () => ({ getProgress, saveProgress }))
const { listBookmarks, saveBookmark, deleteBookmark } = vi.hoisted(() => ({
  listBookmarks: vi.fn(), saveBookmark: vi.fn(), deleteBookmark: vi.fn(),
}))
vi.mock('@backend/data/bookmarks', () => ({ listBookmarks, saveBookmark, deleteBookmark }))
const { listHighlights, saveHighlight, updateHighlight, deleteHighlight } = vi.hoisted(() => ({
  listHighlights: vi.fn(), saveHighlight: vi.fn(), updateHighlight: vi.fn(), deleteHighlight: vi.fn(),
}))
vi.mock('@backend/data/highlights', () => ({ listHighlights, saveHighlight, updateHighlight, deleteHighlight }))
// Capture the props ReaderPage passes to the (mocked) PdfViewer, and expose a way to
// drive its callbacks, mirroring how EpubReader.test exposes viewerProps.
const { pdfProps } = vi.hoisted(() => ({ pdfProps: { current: null as Record<string, unknown> | null } }))
// Mock the PDF viewer so we don't need a real canvas; report 5 pages.
vi.mock('@frontend/reader/PdfViewer', () => ({
  PdfViewer: (props: Record<string, unknown> & { pageNumber: number; onNumPages: (n: number) => void }) => {
    pdfProps.current = props
    props.onNumPages(5)
    return <div data-testid="pdf-page">page {props.pageNumber}</div>
  },
}))
vi.mock('@frontend/reader/EpubReader', () => ({
  EpubReader: ({ bookId, fileUrl }: { bookId: string; fileUrl: string; onBack?: () => void }) => (
    <div data-testid="epub-reader">{bookId}:{fileUrl}</div>
  ),
}))
const { searchPdf } = vi.hoisted(() => ({ searchPdf: vi.fn() }))
vi.mock('@frontend/reader/searchPdf', () => ({ searchPdf }))

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
  loadBookObjectUrl.mockResolvedValue('https://signed/b1.pdf')
  URL.revokeObjectURL = vi.fn()
  getProgress.mockResolvedValue(null)
  saveProgress.mockResolvedValue(undefined)
  listBookmarks.mockResolvedValue([])
  saveBookmark.mockResolvedValue({ id: 'bm1', user_id: 'u1', book_id: 'b1', location: '1', label: 'Page 1', created_at: '', updated_at: '' })
  deleteBookmark.mockResolvedValue(undefined)
  listHighlights.mockResolvedValue([])
  saveHighlight.mockResolvedValue(undefined)
  updateHighlight.mockResolvedValue(undefined)
  deleteHighlight.mockResolvedValue(undefined)
  searchPdf.mockResolvedValue([])
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
  loadBookObjectUrl.mockResolvedValue('https://signed/b2.epub')
  renderAt('b2')
  const reader = await screen.findByTestId('epub-reader')
  expect(reader).toHaveTextContent('b2:https://signed/b2.epub')
})

test('resumes to the saved page', async () => {
  getProgress.mockResolvedValue('3')
  renderAt('b1')
  expect(await screen.findByTestId('pdf-page')).toHaveTextContent('page 3')
})

test('adds a bookmark at the current page via the star toggle', async () => {
  renderAt('b1')
  await screen.findByTestId('pdf-page')
  await userEvent.click(screen.getByRole('button', { name: 'Add bookmark' }))
  await waitFor(() => expect(saveBookmark).toHaveBeenCalledWith('b1', expect.objectContaining({ location: '1', label: 'Page 1' })))
})

test('opens the sidebar and jumps to a bookmarked page', async () => {
  listBookmarks.mockResolvedValue([
    { id: 'bm1', user_id: 'u1', book_id: 'b1', location: '3', label: 'Page 3', created_at: '', updated_at: '' },
  ])
  renderAt('b1')
  await screen.findByTestId('pdf-page')
  await userEvent.click(screen.getByRole('button', { name: /menu/i }))
  await userEvent.click(await screen.findByRole('button', { name: 'Page 3' }))
  expect(screen.getByTestId('pdf-page')).toHaveTextContent('page 3')
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

test('creates a PDF highlight from a selection on the current page', async () => {
  saveHighlight.mockResolvedValue({ id: 'h1', color: 'yellow', note: null,
    anchor: { page: 1, rects: [{ x: 0, y: 0, w: 0.5, h: 0.05 }], text: 'hi' },
    user_id: 'u1', book_id: 'b1', created_at: '', updated_at: '' })
  renderAt('b1')
  await screen.findByTestId('pdf-page')
  act(() => { (pdfProps.current?.onSelect as (s: unknown) => void)(
    { rects: [{ x: 0, y: 0, w: 0.5, h: 0.05 }], text: 'hi', x: 20, y: 20 }) })
  await userEvent.click(await screen.findByRole('button', { name: /yellow/i }))
  await waitFor(() => expect(saveHighlight).toHaveBeenCalledWith('b1', expect.objectContaining({
    color: 'yellow',
    anchor: expect.objectContaining({ page: 1, text: 'hi' }),
  })))
})

test('shows PDF highlights in the Highlights tab and jumps to the page', async () => {
  listHighlights.mockResolvedValue([
    { id: 'h1', color: 'green', note: null,
      anchor: { page: 4, rects: [{ x: 0, y: 0, w: 0.4, h: 0.05 }], text: 'later bit' },
      user_id: 'u1', book_id: 'b1', created_at: '', updated_at: '' },
  ])
  renderAt('b1')
  await screen.findByTestId('pdf-page')
  await userEvent.click(screen.getByRole('button', { name: /menu/i })) // opens the sidebar
  await userEvent.click(await screen.findByRole('button', { name: 'Highlights' }))
  await userEvent.click(await screen.findByText(/later bit/))
  expect(screen.getByTestId('pdf-page')).toHaveTextContent('page 4')
})

test('searches the PDF from the Search tab and jumps to the result', async () => {
  searchPdf.mockResolvedValue([
    { id: '2-0', location: '2', excerpt: '…quick brown fox…', label: 'Page 2' },
  ])
  renderAt('b1')
  await screen.findByTestId('pdf-page')
  await userEvent.click(screen.getByRole('button', { name: /menu/i })) // opens the sidebar
  await userEvent.click(await screen.findByRole('button', { name: 'Search' }))
  await userEvent.type(screen.getByPlaceholderText(/search this book/i), 'fox')
  const searchButtons = screen.getAllByRole('button', { name: 'Search' })
  await userEvent.click(searchButtons[searchButtons.length - 1])
  await waitFor(() => expect(searchPdf).toHaveBeenCalledWith('https://signed/b1.pdf', 'fox'))
  await userEvent.click(await screen.findByText(/quick brown fox/))
  expect(screen.getByTestId('pdf-page')).toHaveTextContent('page 2')
})

test('shows an offline-unavailable error when loadBookObjectUrl rejects', async () => {
  loadBookObjectUrl.mockRejectedValue(new Error('offline'))
  renderAt('b1')
  expect(await screen.findByRole('alert')).toHaveTextContent(/offline|reconnect/i)
  expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
})
