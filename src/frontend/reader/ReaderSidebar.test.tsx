import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ReaderSidebar } from './ReaderSidebar'

const tabs = [
  { key: 'contents', label: 'Contents', render: () => <div>toc body</div> },
  { key: 'bookmarks', label: 'Bookmarks', render: () => <div>bm body</div> },
]

test('shows the first tab by default', () => {
  render(<ReaderSidebar tabs={tabs} onClose={() => {}} />)
  expect(screen.getByText('toc body')).toBeInTheDocument()
  expect(screen.queryByText('bm body')).not.toBeInTheDocument()
})

test('switches tabs on click', async () => {
  render(<ReaderSidebar tabs={tabs} onClose={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: 'Bookmarks' }))
  expect(screen.getByText('bm body')).toBeInTheDocument()
})

test('close button fires onClose', async () => {
  const onClose = vi.fn()
  render(<ReaderSidebar tabs={tabs} onClose={onClose} />)
  await userEvent.click(screen.getByRole('button', { name: /close panel/i }))
  expect(onClose).toHaveBeenCalled()
})
