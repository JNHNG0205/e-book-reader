import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { TocPanel } from './TocPanel'

const items = [
  { label: 'Chapter 1', href: 'c1.xhtml', level: 0 },
  { label: 'Section 1.1', href: 'c1.xhtml#s1', level: 1 },
]

test('lists all toc entries', () => {
  render(<TocPanel items={items} onNavigate={() => {}} />)
  expect(screen.getByText('Chapter 1')).toBeInTheDocument()
  expect(screen.getByText('Section 1.1')).toBeInTheDocument()
})

test('navigates on click with the href', async () => {
  const onNavigate = vi.fn()
  render(<TocPanel items={items} onNavigate={onNavigate} />)
  await userEvent.click(screen.getByRole('button', { name: 'Section 1.1' }))
  expect(onNavigate).toHaveBeenCalledWith('c1.xhtml#s1')
})

test('shows an empty note when there are no items', () => {
  render(<TocPanel items={[]} onNavigate={() => {}} />)
  expect(screen.getByText(/no contents/i)).toBeInTheDocument()
})

test('highlights the item matching activeHref', () => {
  render(<TocPanel items={items} onNavigate={() => {}} activeHref="c1.xhtml#s1" />)
  const active = screen.getByRole('button', { name: 'Section 1.1' })
  const inactive = screen.getByRole('button', { name: 'Chapter 1' })
  expect(active.className).toMatch(/bg-accent-tint/)
  expect(inactive.className).not.toMatch(/bg-accent-tint/)
})
