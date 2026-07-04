import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { BookmarkStar } from './BookmarkStar'

test('renders an unpressed "Add bookmark" toggle when inactive', () => {
  render(<BookmarkStar active={false} onToggle={() => {}} />)
  const button = screen.getByRole('button', { name: 'Add bookmark' })
  expect(button).toHaveAttribute('aria-pressed', 'false')
  expect(button.className).not.toMatch(/text-accent/)
})

test('renders a pressed, accented "Remove bookmark" toggle when active', () => {
  render(<BookmarkStar active={true} onToggle={() => {}} />)
  const button = screen.getByRole('button', { name: 'Remove bookmark' })
  expect(button).toHaveAttribute('aria-pressed', 'true')
  expect(button.className).toMatch(/text-accent/)
})

test('calls onToggle when clicked', async () => {
  const onToggle = vi.fn()
  render(<BookmarkStar active={false} onToggle={onToggle} />)
  await userEvent.click(screen.getByRole('button', { name: 'Add bookmark' }))
  expect(onToggle).toHaveBeenCalled()
})
