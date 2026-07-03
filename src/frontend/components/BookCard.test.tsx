import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { Book } from '@shared/types'
import { BookCard } from './BookCard'

const book: Book = {
  id: 'b1',
  user_id: 'u1',
  title: 'Dune',
  author: 'Herbert',
  format: 'pdf',
  storage_path: 'books/b1.pdf',
  cover_path: null,
  total_pages: null,
  created_at: '',
  updated_at: '',
}

test('renders the cover image when coverUrl is set', () => {
  const { container } = render(
    <BookCard
      book={book}
      coverUrl="https://example.com/cover.png"
      onOpen={vi.fn()}
      onRename={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  const img = container.querySelector('img')
  expect(img).toHaveAttribute('src', 'https://example.com/cover.png')
})

test('renders the format placeholder when coverUrl is null', () => {
  const { container } = render(
    <BookCard book={book} coverUrl={null} onOpen={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} />,
  )
  expect(container.querySelector('img')).not.toBeInTheDocument()
  expect(screen.getByText('PDF')).toBeInTheDocument()
})

test('clicking the cover still calls onOpen', async () => {
  const onOpen = vi.fn()
  const { container } = render(
    <BookCard
      book={book}
      coverUrl="https://example.com/cover.png"
      onOpen={onOpen}
      onRename={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  const img = container.querySelector('img')
  expect(img).not.toBeNull()
  await userEvent.click(img as Element)
  expect(onOpen).toHaveBeenCalledWith('b1')
})

test('clicking Rename opens the rename dialog and Save calls onRename', async () => {
  const onRename = vi.fn()
  render(
    <BookCard book={book} coverUrl={null} onOpen={vi.fn()} onRename={onRename} onDelete={vi.fn()} />,
  )
  await userEvent.click(screen.getByText('Rename'))
  const input = screen.getByRole('textbox')
  expect(input).toHaveValue('Dune')
  await userEvent.clear(input)
  await userEvent.type(input, 'Dune (revised)')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(onRename).toHaveBeenCalledWith('b1', 'Dune (revised)')
})

test('clicking Delete opens the confirm dialog and Confirm calls onDelete', async () => {
  const onDelete = vi.fn()
  render(
    <BookCard book={book} coverUrl={null} onOpen={vi.fn()} onRename={vi.fn()} onDelete={onDelete} />,
  )
  await userEvent.click(screen.getByText('Delete'))
  const dialog = screen.getByRole('dialog')
  expect(dialog).toBeInTheDocument()
  const { getByRole } = within(dialog)
  await userEvent.click(getByRole('button', { name: 'Delete' }))
  expect(onDelete).toHaveBeenCalledWith('b1')
})
