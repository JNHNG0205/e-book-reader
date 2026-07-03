import { beforeEach, expect, test, vi } from 'vitest'

const { getBookFileUrl } = vi.hoisted(() => ({ getBookFileUrl: vi.fn() }))
vi.mock('@backend/data/books', () => ({ getBookFileUrl }))

const { getCachedBook, putCachedBook } = vi.hoisted(() => ({
  getCachedBook: vi.fn(), putCachedBook: vi.fn(),
}))
vi.mock('./bookCache', () => ({ getCachedBook, putCachedBook }))

import { loadBookObjectUrl } from './loadBook'

function bytes(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer
}

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn().mockReturnValue('blob:x')
  putCachedBook.mockResolvedValue(undefined)
})

test('cache hit returns an object URL without calling getBookFileUrl', async () => {
  getCachedBook.mockResolvedValue(bytes('cached-bytes'))
  const url = await loadBookObjectUrl('b1', 'u1/b1.pdf', 'pdf')
  expect(url).toBe('blob:x')
  expect(getBookFileUrl).not.toHaveBeenCalled()
  expect(putCachedBook).not.toHaveBeenCalled()
})

test('cache miss fetches, caches the bytes, and returns an object URL', async () => {
  getCachedBook.mockResolvedValue(null)
  getBookFileUrl.mockResolvedValue('https://signed/b1.pdf')
  const buf = bytes('fetched-bytes')
  global.fetch = vi.fn().mockResolvedValue({ arrayBuffer: async () => buf })

  const url = await loadBookObjectUrl('b1', 'u1/b1.pdf', 'pdf')

  expect(getBookFileUrl).toHaveBeenCalledWith('u1/b1.pdf')
  expect(global.fetch).toHaveBeenCalledWith('https://signed/b1.pdf')
  expect(putCachedBook).toHaveBeenCalledWith('b1', buf)
  expect(url).toBe('blob:x')
})
