import { expect, test, vi } from 'vitest'

const { destroy, getDocument } = vi.hoisted(() => {
  const destroy = vi.fn()
  const getPage = vi.fn((n: number) => {
    const pages: Record<number, string> = {
      1: 'Once upon a time in a land far away.',
      2: 'The quick brown fox jumps over the lazy dog.',
      3: 'Nothing interesting is here.',
    }
    return Promise.resolve({
      getTextContent: () => Promise.resolve({ items: [{ str: pages[n] ?? '' }] }),
    })
  })
  const getDocument = vi.fn(() => ({
    promise: Promise.resolve({ numPages: 3, getPage, destroy }),
  }))
  return { destroy, getPage, getDocument }
})

vi.mock('react-pdf', () => ({ pdfjs: { getDocument } }))

import { searchPdf } from './searchPdf'

test('finds matches on the right page with location and label', async () => {
  const results = await searchPdf('https://example.com/book.pdf', 'fox')
  expect(results).toHaveLength(1)
  expect(results[0]).toMatchObject({ location: '2', label: 'Page 2' })
  expect(results[0].excerpt).toContain('fox')
  expect(getDocument).toHaveBeenCalledWith('https://example.com/book.pdf')
})

test('is case-insensitive and returns an excerpt with context', async () => {
  const results = await searchPdf('https://example.com/book.pdf', 'ONCE')
  expect(results).toHaveLength(1)
  expect(results[0].location).toBe('1')
  expect(results[0].excerpt.toLowerCase()).toContain('once')
})

test('blank query returns no results', async () => {
  const results = await searchPdf('https://example.com/book.pdf', '   ')
  expect(results).toEqual([])
})

test('destroys the document even on success', async () => {
  await searchPdf('https://example.com/book.pdf', 'dog')
  expect(destroy).toHaveBeenCalled()
})

test('returns no results and still destroys when nothing matches', async () => {
  destroy.mockClear()
  const results = await searchPdf('https://example.com/book.pdf', 'zzzznotfound')
  expect(results).toEqual([])
  expect(destroy).toHaveBeenCalled()
})
