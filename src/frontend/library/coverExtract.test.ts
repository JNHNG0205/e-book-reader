import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const { coverUrl, destroy } = vi.hoisted(() => ({
  coverUrl: vi.fn(),
  destroy: vi.fn(),
}))
vi.mock('epubjs', () => ({
  default: vi.fn(() => ({ coverUrl, destroy })),
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

import { extractCoverBlob } from './coverExtract'

const originalFetch = global.fetch

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  global.fetch = originalFetch
})

test('extractCoverBlob returns a Blob for an EPUB with a cover and destroys the book', async () => {
  coverUrl.mockResolvedValue('blob:cover')
  global.fetch = vi.fn().mockResolvedValue({
    blob: () => Promise.resolve(new Blob(['x'], { type: 'image/jpeg' })),
  }) as unknown as typeof fetch

  const result = await extractCoverBlob(new ArrayBuffer(8), 'epub')

  expect(result).toBeInstanceOf(Blob)
  expect(destroy).toHaveBeenCalled()
})

test('extractCoverBlob returns null for an EPUB with no cover', async () => {
  coverUrl.mockResolvedValue(null)

  const result = await extractCoverBlob(new ArrayBuffer(8), 'epub')

  expect(result).toBeNull()
  expect(destroy).toHaveBeenCalled()
})

test('extractCoverBlob returns a Blob for a PDF', async () => {
  getDocument.mockReturnValue({
    promise: Promise.resolve({
      getPage: () =>
        Promise.resolve({
          getViewport: () => ({ width: 400, height: 600 }),
          render: () => ({ promise: Promise.resolve() }),
        }),
    }),
  })
  const fakeBlob = new Blob(['x'], { type: 'image/jpeg' })
  // jsdom's canvas has no real 2d context without the optional `canvas` package.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as unknown as CanvasRenderingContext2D,
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => {
    cb(fakeBlob)
  })

  const result = await extractCoverBlob(new ArrayBuffer(8), 'pdf')

  expect(result).toBe(fakeBlob)
})

test('extractCoverBlob passes a COPY of the buffer to pdfjs (does not detach the shared buffer)', async () => {
  let passedBuffer: ArrayBufferLike | null = null
  getDocument.mockImplementation((params: { data: Uint8Array }) => {
    passedBuffer = params.data.buffer
    return {
      promise: Promise.resolve({
        getPage: () => Promise.resolve({
          getViewport: () => ({ width: 400, height: 600 }),
          render: () => ({ promise: Promise.resolve() }),
        }),
      }),
    }
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(new Blob(['x'])))

  const input = new ArrayBuffer(8)
  await extractCoverBlob(input, 'pdf')

  expect(passedBuffer).not.toBeNull()
  expect(passedBuffer).not.toBe(input) // a copy, so the original stays usable
})

test('extractCoverBlob returns null when extraction throws', async () => {
  coverUrl.mockRejectedValue(new Error('boom'))

  const result = await extractCoverBlob(new ArrayBuffer(8), 'epub')

  expect(result).toBeNull()
})
