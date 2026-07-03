import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ReaderToolbar } from './ReaderToolbar'

const baseProps = {
  page: 2, numPages: 10, scale: 1,
  onPrev: vi.fn(), onNext: vi.fn(), onZoomIn: vi.fn(), onZoomOut: vi.fn(), onBack: vi.fn(),
  onToggleSidebar: vi.fn(),
}

test('shows the current page and total', () => {
  render(<ReaderToolbar {...baseProps} />)
  expect(screen.getByText(/2\s*\/\s*10/)).toBeInTheDocument()
})

test('prev is disabled on the first page', () => {
  render(<ReaderToolbar {...baseProps} page={1} />)
  expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled()
})

test('next is disabled on the last page', () => {
  render(<ReaderToolbar {...baseProps} page={10} numPages={10} />)
  expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled()
})

test('fires callbacks on click', async () => {
  const onNext = vi.fn()
  render(<ReaderToolbar {...baseProps} onNext={onNext} />)
  await userEvent.click(screen.getByRole('button', { name: /next page/i }))
  expect(onNext).toHaveBeenCalled()
})

test('fires onToggleSidebar when the bookmarks sidebar toggle is clicked', async () => {
  const onToggleSidebar = vi.fn()
  render(<ReaderToolbar {...baseProps} onToggleSidebar={onToggleSidebar} />)
  await userEvent.click(screen.getByRole('button', { name: /menu/i }))
  expect(onToggleSidebar).toHaveBeenCalled()
})
