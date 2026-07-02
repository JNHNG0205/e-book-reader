import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

// vi.mock is hoisted; create mock fns via vi.hoisted() so the factory can use them.
const { listBooks, uploadBook, deleteBook, renameBook } = vi.hoisted(() => ({
  listBooks: vi.fn(),
  uploadBook: vi.fn(),
  deleteBook: vi.fn(),
  renameBook: vi.fn(),
}))
vi.mock('../data/books', () => ({ listBooks, uploadBook, deleteBook, renameBook }))

import { LibraryPage } from './LibraryPage'

beforeEach(() => {
  vi.clearAllMocks()
  listBooks.mockResolvedValue([
    { id: 'b1', title: 'Dune', author: 'Herbert', format: 'pdf', cover_path: null },
  ])
})

test('renders books from the repository', async () => {
  render(<LibraryPage />)
  expect(await screen.findByText('Dune')).toBeInTheDocument()
  expect(screen.getByText('Herbert')).toBeInTheDocument()
})

test('uploads a selected pdf file with format inferred from extension', async () => {
  uploadBook.mockResolvedValue({ id: 'b2', title: 'book', author: null, format: 'pdf' })
  render(<LibraryPage />)
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
