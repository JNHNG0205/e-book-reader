import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

// vi.mock is hoisted; create mock fns via vi.hoisted() so the factory can use them.
const {
  listBooks, uploadBook, deleteBook, renameBook, getCoverUrl, getBookFileUrl, saveCover,
  updateBookMetadata,
} = vi.hoisted(() => ({
  listBooks: vi.fn(),
  uploadBook: vi.fn(),
  deleteBook: vi.fn(),
  renameBook: vi.fn(),
  getCoverUrl: vi.fn(),
  getBookFileUrl: vi.fn(),
  saveCover: vi.fn(),
  updateBookMetadata: vi.fn(),
}))
vi.mock('@backend/data/books', () => ({
  listBooks, uploadBook, deleteBook, renameBook, getCoverUrl, getBookFileUrl, saveCover,
  updateBookMetadata,
}))

const { extractCoverBlob } = vi.hoisted(() => ({ extractCoverBlob: vi.fn() }))
vi.mock('@frontend/library/coverExtract', () => ({ extractCoverBlob }))

const { extractBookMetadata } = vi.hoisted(() => ({ extractBookMetadata: vi.fn() }))
vi.mock('@frontend/library/bookMetadata', () => ({ extractBookMetadata }))

const { cachedBookIds } = vi.hoisted(() => ({ cachedBookIds: vi.fn() }))
vi.mock('@frontend/offline/bookCache', () => ({ cachedBookIds }))

const { getAllProgress } = vi.hoisted(() => ({ getAllProgress: vi.fn() }))
vi.mock('@frontend/offline/offlineData', () => ({ getAllProgress }))

import { LibraryPage } from './LibraryPage'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  cachedBookIds.mockResolvedValue([])
  getAllProgress.mockResolvedValue([])
  listBooks.mockResolvedValue([
    { id: 'b1', title: 'Dune', author: 'Herbert', format: 'pdf', cover_path: null, storage_path: 'books/b1.pdf' },
  ])
  getBookFileUrl.mockResolvedValue('https://example.com/b1.pdf')
  getCoverUrl.mockResolvedValue('https://example.com/signed-cover.png')
  saveCover.mockResolvedValue('covers/b1.png')
  extractCoverBlob.mockResolvedValue(null)
  extractBookMetadata.mockResolvedValue({ title: null, author: null })
  updateBookMetadata.mockResolvedValue(undefined)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  }))
})

test('renders books from the repository', async () => {
  render(<MemoryRouter><LibraryPage /></MemoryRouter>)
  expect(await screen.findByText('Dune')).toBeInTheDocument()
  expect(screen.getByText('Herbert')).toBeInTheDocument()
})

test('uploads a selected pdf file with format inferred from extension', async () => {
  uploadBook.mockResolvedValue({ id: 'b2', title: 'book', author: null, format: 'pdf' })
  render(<MemoryRouter><LibraryPage /></MemoryRouter>)
  await screen.findByText('Dune')
  const file = new File(['%PDF'], 'My Book.pdf', { type: 'application/pdf' })
  const input = screen.getByLabelText(/add book/i)
  await userEvent.upload(input, file)
  await waitFor(() =>
    expect(uploadBook).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ title: 'My Book', format: 'pdf' }),
    ),
  )
})

test('uploads with embedded metadata title/author when extraction succeeds', async () => {
  uploadBook.mockResolvedValue({ id: 'b2', title: 'Embedded Title', author: 'A', format: 'pdf' })
  extractBookMetadata.mockResolvedValue({ title: 'Embedded Title', author: 'A' })
  render(<MemoryRouter><LibraryPage /></MemoryRouter>)
  await screen.findByText('Dune')
  const file = new File(['%PDF'], 'My Book.pdf', { type: 'application/pdf' })
  const input = screen.getByLabelText(/add book/i)
  await userEvent.upload(input, file)
  await waitFor(() =>
    expect(uploadBook).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ title: 'Embedded Title', author: 'A', format: 'pdf' }),
    ),
  )
})

test('clicking a book navigates to its reader route', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/read/:bookId" element={<div>reader for book</div>} />
      </Routes>
    </MemoryRouter>,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Dune' }))
  expect(await screen.findByText('reader for book')).toBeInTheDocument()
})

test('resolves a signed cover url for a book that already has a cover_path', async () => {
  listBooks.mockResolvedValue([
    { id: 'b1', title: 'Dune', author: 'Herbert', format: 'pdf', cover_path: 'covers/b1.png', storage_path: 'books/b1.pdf' },
  ])
  const { container } = render(<MemoryRouter><LibraryPage /></MemoryRouter>)
  await screen.findByText('Dune')
  await waitFor(() => expect(getCoverUrl).toHaveBeenCalledWith('covers/b1.png'))
  expect(getBookFileUrl).not.toHaveBeenCalled()
  await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/signed-cover.png'))
})

test('backfills a cover for a book without cover_path by extracting one from its file', async () => {
  extractCoverBlob.mockResolvedValue(new Blob(['fake']))
  const { container } = render(<MemoryRouter><LibraryPage /></MemoryRouter>)
  await screen.findByText('Dune')
  await waitFor(() => expect(saveCover).toHaveBeenCalledWith('b1', expect.any(Blob)))
  expect(getBookFileUrl).toHaveBeenCalledWith('books/b1.pdf')
  expect(extractCoverBlob).toHaveBeenCalled()
  expect(getCoverUrl).toHaveBeenCalledWith('covers/b1.png')
  await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/signed-cover.png'))
})

test('caches the book list in localStorage on a successful load', async () => {
  render(<MemoryRouter><LibraryPage /></MemoryRouter>)
  await screen.findByText('Dune')
  await waitFor(() => {
    const raw = localStorage.getItem('library.books')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string)).toEqual([
      { id: 'b1', title: 'Dune', author: 'Herbert', format: 'pdf', cover_path: null, storage_path: 'books/b1.pdf' },
    ])
  })
})

test('falls back to the cached list and shows an offline note when listBooks rejects', async () => {
  const cachedBooks = [
    { id: 'b1', title: 'Dune', author: 'Herbert', format: 'pdf', cover_path: null, storage_path: 'books/b1.pdf' },
  ]
  localStorage.setItem('library.books', JSON.stringify(cachedBooks))
  cachedBookIds.mockResolvedValue(['b1'])
  listBooks.mockRejectedValue(new Error('network error'))

  render(<MemoryRouter><LibraryPage /></MemoryRouter>)

  expect(await screen.findByText('Dune')).toBeInTheDocument()
  expect(screen.getByText('Offline — showing your saved library')).toBeInTheDocument()
})

test('marks books as offline-available based on cachedBookIds', async () => {
  cachedBookIds.mockResolvedValue(['b1'])
  render(<MemoryRouter><LibraryPage /></MemoryRouter>)
  await screen.findByText('Dune')
  await waitFor(() => expect(screen.getByText('Offline')).toBeInTheDocument())
})

test('does not mark a book offline-available when its id is not cached', async () => {
  cachedBookIds.mockResolvedValue([])
  render(<MemoryRouter><LibraryPage /></MemoryRouter>)
  await screen.findByText('Dune')
  expect(screen.queryByText('Offline')).not.toBeInTheDocument()
})

test('shows each book’s completion percent from listProgress', async () => {
  getAllProgress.mockResolvedValue([{ book_id: 'b1', percent: 73 }])
  render(<MemoryRouter><LibraryPage /></MemoryRouter>)
  await screen.findByText('Dune')
  await waitFor(() => expect(screen.getByText('73%')).toBeInTheDocument())
})

test('when listBooks rejects with no cached list, shows the error instead of a fallback', async () => {
  listBooks.mockRejectedValue(new Error('network error'))
  render(<MemoryRouter><LibraryPage /></MemoryRouter>)
  expect(await screen.findByText('network error')).toBeInTheDocument()
  expect(screen.queryByText('Dune')).not.toBeInTheDocument()
})

test('ignores a corrupt cached list value', async () => {
  localStorage.setItem('library.books', 'not-json{')
  listBooks.mockRejectedValue(new Error('network error'))
  render(<MemoryRouter><LibraryPage /></MemoryRouter>)
  expect(await screen.findByText('network error')).toBeInTheDocument()
})
