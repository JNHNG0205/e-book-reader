import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { BookmarkStar } from './BookmarkStar'

test('renders an outline bookmark and "Add bookmark" label when inactive', () => {
  const { container } = render(<BookmarkStar active={false} onToggle={() => {}} />)
  const button = screen.getByRole('button', { name: 'Add bookmark' })
  expect(button).toHaveAttribute('aria-pressed', 'false')
  // Outline: the icon is not filled.
  expect(container.querySelector('svg')).toHaveAttribute('fill', 'none')
})

test('renders a filled bookmark and "Remove bookmark" label when active', () => {
  const { container } = render(<BookmarkStar active={true} onToggle={() => {}} />)
  const button = screen.getByRole('button', { name: 'Remove bookmark' })
  expect(button).toHaveAttribute('aria-pressed', 'true')
  // Active: the icon is filled with currentColor.
  expect(container.querySelector('svg')).toHaveAttribute('fill', 'currentColor')
})

test('calls onToggle when clicked', async () => {
  const onToggle = vi.fn()
  render(<BookmarkStar active={false} onToggle={onToggle} />)
  await userEvent.click(screen.getByRole('button', { name: 'Add bookmark' }))
  expect(onToggle).toHaveBeenCalled()
})
