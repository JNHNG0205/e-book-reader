import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { BookmarkStar } from './BookmarkStar'

test('renders an outline star and "Add bookmark" label when inactive', () => {
  render(<BookmarkStar active={false} onToggle={() => {}} />)
  const button = screen.getByRole('button', { name: 'Add bookmark' })
  expect(button).toHaveTextContent('☆')
  expect(button).toHaveAttribute('aria-pressed', 'false')
})

test('renders a filled star and "Remove bookmark" label when active', () => {
  render(<BookmarkStar active={true} onToggle={() => {}} />)
  const button = screen.getByRole('button', { name: 'Remove bookmark' })
  expect(button).toHaveTextContent('★')
  expect(button).toHaveAttribute('aria-pressed', 'true')
})

test('calls onToggle when clicked', async () => {
  const onToggle = vi.fn()
  render(<BookmarkStar active={false} onToggle={onToggle} />)
  await userEvent.click(screen.getByRole('button', { name: 'Add bookmark' }))
  expect(onToggle).toHaveBeenCalled()
})
