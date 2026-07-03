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
  global.fetch = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => buf })

  const url = await loadBookObjectUrl('b1', 'u1/b1.pdf', 'pdf')

  expect(getBookFileUrl).toHaveBeenCalledWith('u1/b1.pdf')
  expect(global.fetch).toHaveBeenCalledWith('https://signed/b1.pdf')
  expect(putCachedBook).toHaveBeenCalledWith('b1', buf)
  expect(url).toBe('blob:x')
})

test('a cache-read failure (IndexedDB unavailable) still falls through to the network', async () => {
  getCachedBook.mockRejectedValue(new Error('IndexedDB blocked'))
  getBookFileUrl.mockResolvedValue('https://signed/b1.pdf')
  const buf = bytes('fetched-bytes')
  global.fetch = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => buf })

  const url = await loadBookObjectUrl('b1', 'u1/b1.pdf', 'pdf')

  expect(getBookFileUrl).toHaveBeenCalledWith('u1/b1.pdf')
  expect(url).toBe('blob:x')
})

test('a non-ok download throws and does not cache the error body', async () => {
  getCachedBook.mockResolvedValue(null)
  getBookFileUrl.mockResolvedValue('https://signed/b1.pdf')
  global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403, arrayBuffer: async () => bytes('err') })

  await expect(loadBookObjectUrl('b1', 'u1/b1.pdf', 'pdf')).rejects.toThrow(/403/)
  expect(putCachedBook).not.toHaveBeenCalled()
})
