import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { HighlightsPanel } from './HighlightsPanel'
import type { Highlight } from '@shared/types'

function h(id: string, color: string, text: string, note: string | null = null): Highlight {
  return { id, user_id: 'u1', book_id: 'b1', color, note, anchor: { text }, created_at: '', updated_at: '' }
}

const items = [h('h1', 'yellow', 'first bit'), h('h2', 'green', 'second bit', 'a note')]

test('lists highlights with text and note, and jumps on click', async () => {
  const onJump = vi.fn()
  render(<HighlightsPanel highlights={items} onJump={onJump} onDelete={() => {}} />)
  expect(screen.getByText(/first bit/)).toBeInTheDocument()
  expect(screen.getByText(/a note/)).toBeInTheDocument()
  await userEvent.click(screen.getByText(/first bit/))
  expect(onJump).toHaveBeenCalledWith(items[0])
})

test('filters by color', async () => {
  render(<HighlightsPanel highlights={items} onJump={() => {}} onDelete={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /^green$/i }))
  expect(screen.queryByText(/first bit/)).not.toBeInTheDocument()
  expect(screen.getByText(/second bit/)).toBeInTheDocument()
})

test('deletes on the delete control', async () => {
  const onDelete = vi.fn()
  render(<HighlightsPanel highlights={items} onJump={() => {}} onDelete={onDelete} />)
  await userEvent.click(screen.getAllByRole('button', { name: /delete highlight/i })[0])
  expect(onDelete).toHaveBeenCalledWith('h1')
})

test('shows empty state', () => {
  render(<HighlightsPanel highlights={[]} onJump={() => {}} onDelete={() => {}} />)
  expect(screen.getByText(/no highlights/i)).toBeInTheDocument()
})
