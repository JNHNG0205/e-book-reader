import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { SearchPanel } from './SearchPanel'
import type { SearchResult } from './searchTypes'

const results: SearchResult[] = [
  { id: '1', location: 'epubcfi(/6/4!/4/2)', excerpt: '…the whale surfaced…', label: 'Ch. 1' },
  { id: '2', location: 'epubcfi(/6/8!/4/2)', excerpt: '…a second whale…', label: 'Ch. 2' },
]

test('searches on submit and lists results', async () => {
  const onSearch = vi.fn().mockResolvedValue(results)
  render(<SearchPanel onSearch={onSearch} onJump={() => {}} />)
  await userEvent.type(screen.getByRole('textbox'), 'whale')
  await userEvent.click(screen.getByRole('button', { name: /search/i }))
  expect(onSearch).toHaveBeenCalledWith('whale')
  expect(await screen.findByText(/the whale surfaced/)).toBeInTheDocument()
  expect(screen.getByText(/a second whale/)).toBeInTheDocument()
})

test('clicking a result jumps to it', async () => {
  const onJump = vi.fn()
  render(<SearchPanel onSearch={vi.fn().mockResolvedValue(results)} onJump={onJump} />)
  await userEvent.type(screen.getByRole('textbox'), 'whale')
  await userEvent.click(screen.getByRole('button', { name: /search/i }))
  await userEvent.click(await screen.findByText(/the whale surfaced/))
  expect(onJump).toHaveBeenCalledWith(results[0])
})

test('shows an empty state when nothing matches', async () => {
  render(<SearchPanel onSearch={vi.fn().mockResolvedValue([])} onJump={() => {}} />)
  await userEvent.type(screen.getByRole('textbox'), 'zzz')
  await userEvent.click(screen.getByRole('button', { name: /search/i }))
  expect(await screen.findByText(/no results/i)).toBeInTheDocument()
})

test('does not search a blank query', async () => {
  const onSearch = vi.fn()
  render(<SearchPanel onSearch={onSearch} onJump={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /search/i }))
  expect(onSearch).not.toHaveBeenCalled()
})
