import { beforeEach, expect, test, vi } from 'vitest'

const { metadata, destroy } = vi.hoisted(() => ({
  metadata: vi.fn(),
  destroy: vi.fn(),
}))
vi.mock('epubjs', () => ({
  default: vi.fn(() => ({ loaded: { metadata: metadata() }, destroy })),
}))

const { getDocument } = vi.hoisted(() => ({
  getDocument: vi.fn(),
}))
vi.mock('react-pdf', () => ({
  pdfjs: {
    GlobalWorkerOptions: {},
    getDocument,
  },
}))

import { extractBookMetadata } from './bookMetadata'

beforeEach(() => {
  vi.clearAllMocks()
})

test('extracts trimmed title/author from an EPUB', async () => {
  metadata.mockResolvedValue({ title: '  Real Title  ', creator: '  Real Author  ' })

  const result = await extractBookMetadata(new ArrayBuffer(8), 'epub')

  expect(result).toEqual({ title: 'Real Title', author: 'Real Author' })
  expect(destroy).toHaveBeenCalled()
})

test('extracts title/author from a PDF', async () => {
  getDocument.mockReturnValue({
    promise: Promise.resolve({
      getMetadata: () => Promise.resolve({ info: { Title: 'PDF Title', Author: 'PDF Author' } }),
    }),
  })

  const result = await extractBookMetadata(new ArrayBuffer(8), 'pdf')

  expect(result).toEqual({ title: 'PDF Title', author: 'PDF Author' })
})

test('passes a COPY of the buffer to pdfjs (does not detach the shared buffer)', async () => {
  let passedBuffer: ArrayBufferLike | null = null
  getDocument.mockImplementation((params: { data: Uint8Array }) => {
    passedBuffer = params.data.buffer
    return {
      promise: Promise.resolve({
        getMetadata: () => Promise.resolve({ info: {} }),
      }),
    }
  })

  const input = new ArrayBuffer(8)
  await extractBookMetadata(input, 'pdf')

  expect(passedBuffer).not.toBeNull()
  expect(passedBuffer).not.toBe(input) // a copy, so the original stays usable for cover extraction
})

test('returns nulls when extraction throws', async () => {
  metadata.mockRejectedValue(new Error('boom'))

  const result = await extractBookMetadata(new ArrayBuffer(8), 'epub')

  expect(result).toEqual({ title: null, author: null })
})

test('returns nulls for blank strings', async () => {
  metadata.mockResolvedValue({ title: '   ', creator: undefined })

  const result = await extractBookMetadata(new ArrayBuffer(8), 'epub')

  expect(result).toEqual({ title: null, author: null })
})

test('returns nulls for an unknown format', async () => {
  const result = await extractBookMetadata(new ArrayBuffer(8), 'unknown' as never)

  expect(result).toEqual({ title: null, author: null })
})
