import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { EpubToolbar } from './EpubToolbar'

const props = {
  fontSize: 100, theme: 'light' as const, current: 0, total: 0,
  onPrev: vi.fn(), onNext: vi.fn(), onGoToPage: vi.fn(), onFontSmaller: vi.fn(), onFontLarger: vi.fn(),
  onCycleTheme: vi.fn(), onBack: vi.fn(),
}

test('shows the current page (editable) and total when known', () => {
  render(<EpubToolbar {...props} current={12} total={340} />)
  expect(screen.getByLabelText('Go to page')).toHaveValue('12')
  expect(screen.getByText('/ 340')).toBeInTheDocument()
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

test('fires nav + back callbacks', async () => {
  const onNext = vi.fn(); const onBack = vi.fn()
  render(<EpubToolbar {...props} onNext={onNext} onBack={onBack} />)
  await userEvent.click(screen.getByRole('button', { name: /next/i }))
  await userEvent.click(screen.getByRole('button', { name: /library/i }))
  expect(onNext).toHaveBeenCalled()
  expect(onBack).toHaveBeenCalled()
})
