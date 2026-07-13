import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { EpubToolbar } from './EpubToolbar'

const props = {
  fontSize: 100, lineHeight: 1.5, margin: 6, theme: 'light' as const, current: 0, total: 0,
  chapter: null as string | null,
  onPrev: vi.fn(), onNext: vi.fn(), onGoToPage: vi.fn(), onSeek: vi.fn(),
  onFontSize: vi.fn(), onLineHeight: vi.fn(), onMargin: vi.fn(), onSetTheme: vi.fn(), onBack: vi.fn(),
}

test('shows the current page (editable) and total when known', () => {
  render(<EpubToolbar {...props} current={12} total={340} />)
  expect(screen.getByLabelText('Go to page')).toHaveValue('12')
  expect(screen.getByText('/ 340')).toBeInTheDocument()
})

test('shows the current chapter and a seekable progress bar', () => {
  render(<EpubToolbar {...props} current={50} total={200} chapter="Chapter 3 — The Voyage" />)
  expect(screen.getByText('Chapter 3 — The Voyage')).toBeInTheDocument()
  const bar = screen.getByLabelText('Reading progress')
  expect(bar).toHaveValue('50')
  expect(bar).toHaveAttribute('max', '200')
})

test('seeking the progress bar previews while dragging and commits on release', () => {
  const onSeek = vi.fn()
  render(<EpubToolbar {...props} current={10} total={100} onSeek={onSeek} />)
  const bar = screen.getByLabelText('Reading progress')
  fireEvent.change(bar, { target: { value: '75' } }) // dragging: preview only, no jump yet
  expect(onSeek).not.toHaveBeenCalled()
  expect(bar).toHaveValue('75')
  fireEvent.blur(bar) // release: commit the jump
  expect(onSeek).toHaveBeenCalledWith(75)
})

test('the type panel is hidden until the Aa button is clicked', async () => {
  const onFontSize = vi.fn()
  render(<EpubToolbar {...props} fontSize={100} onFontSize={onFontSize} />)
  expect(screen.queryByRole('dialog', { name: 'Text settings' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Text settings' }))
  expect(screen.getByRole('dialog', { name: 'Text settings' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Larger font' }))
  expect(onFontSize).toHaveBeenCalledWith(110)
})

test('type panel adjusts line spacing, margins and theme', async () => {
  const onLineHeight = vi.fn(); const onMargin = vi.fn(); const onSetTheme = vi.fn()
  render(<EpubToolbar {...props} lineHeight={1.5} margin={6}
    onLineHeight={onLineHeight} onMargin={onMargin} onSetTheme={onSetTheme} />)
  await userEvent.click(screen.getByRole('button', { name: 'Text settings' }))
  await userEvent.click(screen.getByRole('button', { name: 'More line spacing' }))
  await userEvent.click(screen.getByRole('button', { name: 'Wider margins' }))
  await userEvent.click(screen.getByRole('button', { name: 'Dark theme' }))
  expect(onLineHeight).toHaveBeenCalledWith(1.6)
  expect(onMargin).toHaveBeenCalledWith(8)
  expect(onSetTheme).toHaveBeenCalledWith('dark')
})

test('fires nav + back callbacks', async () => {
  const onNext = vi.fn(); const onBack = vi.fn()
  render(<EpubToolbar {...props} onNext={onNext} onBack={onBack} />)
  await userEvent.click(screen.getByRole('button', { name: /next/i }))
  await userEvent.click(screen.getByRole('button', { name: /library/i }))
  expect(onNext).toHaveBeenCalled()
  expect(onBack).toHaveBeenCalled()
})
