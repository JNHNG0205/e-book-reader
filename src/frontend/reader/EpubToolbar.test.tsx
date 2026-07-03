import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { EpubToolbar } from './EpubToolbar'

const props = {
  fontSize: 100, theme: 'light' as const, current: 0, total: 0,
  onPrev: vi.fn(), onNext: vi.fn(), onFontSmaller: vi.fn(), onFontLarger: vi.fn(),
  onCycleTheme: vi.fn(), onToggleToc: vi.fn(), onBack: vi.fn(), onAddBookmark: vi.fn(),
}

test('shows the page numbers when known', () => {
  render(<EpubToolbar {...props} current={12} total={340} />)
  expect(screen.getByText('12 / 340')).toBeInTheDocument()
})

test('shows the current font size', () => {
  render(<EpubToolbar {...props} fontSize={120} />)
  expect(screen.getByText(/120%/)).toBeInTheDocument()
})

test('fires font + theme callbacks', async () => {
  const onFontLarger = vi.fn(); const onCycleTheme = vi.fn()
  render(<EpubToolbar {...props} onFontLarger={onFontLarger} onCycleTheme={onCycleTheme} />)
  await userEvent.click(screen.getByRole('button', { name: /larger font/i }))
  await userEvent.click(screen.getByRole('button', { name: /change theme/i }))
  expect(onFontLarger).toHaveBeenCalled()
  expect(onCycleTheme).toHaveBeenCalled()
})

test('fires nav + toc + back callbacks', async () => {
  const onNext = vi.fn(); const onToggleToc = vi.fn(); const onBack = vi.fn()
  render(<EpubToolbar {...props} onNext={onNext} onToggleToc={onToggleToc} onBack={onBack} />)
  await userEvent.click(screen.getByRole('button', { name: /next/i }))
  await userEvent.click(screen.getByRole('button', { name: /toggle contents/i }))
  await userEvent.click(screen.getByRole('button', { name: /library/i }))
  expect(onNext).toHaveBeenCalled()
  expect(onToggleToc).toHaveBeenCalled()
  expect(onBack).toHaveBeenCalled()
})

test('fires add-bookmark', async () => {
  const onAddBookmark = vi.fn()
  render(<EpubToolbar {...props} onAddBookmark={onAddBookmark} />)
  await userEvent.click(screen.getByRole('button', { name: /bookmark/i }))
  expect(onAddBookmark).toHaveBeenCalled()
})
