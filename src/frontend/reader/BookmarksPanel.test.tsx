import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { BookmarksPanel } from './BookmarksPanel'

const bookmarks = [
  { id: 'bm1', user_id: 'u1', book_id: 'b1', location: '7', label: 'Page 7', created_at: '', updated_at: '' },
]

test('lists bookmarks and jumps on click', async () => {
  const onJump = vi.fn()
  render(<BookmarksPanel bookmarks={bookmarks} onJump={onJump} onDelete={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: 'Page 7' }))
  expect(onJump).toHaveBeenCalledWith('7')
})

test('deletes on the delete control', async () => {
  const onDelete = vi.fn()
  render(<BookmarksPanel bookmarks={bookmarks} onJump={() => {}} onDelete={onDelete} />)
  await userEvent.click(screen.getByRole('button', { name: /delete bookmark/i }))
  expect(onDelete).toHaveBeenCalledWith('bm1')
})

test('shows an empty note when there are none', () => {
  render(<BookmarksPanel bookmarks={[]} onJump={() => {}} onDelete={() => {}} />)
  expect(screen.getByText(/no bookmarks/i)).toBeInTheDocument()
})
