import { render } from '@testing-library/react'
import { createRef } from 'react'
import {
  afterEach, beforeEach, expect, test, vi,
} from 'vitest'

// Shared fake rendition/book captured per test.
const { rendition, book: _book, ePub, relocatedHandlers } = vi.hoisted(() => {
  const relocatedHandlers: Array<(loc: { start: { cfi: string } }) => void> = []
  const rendition = {
    display: vi.fn().mockResolvedValue(undefined),
    next: vi.fn(),
    prev: vi.fn(),
    on: vi.fn((event: string, cb: (loc: { start: { cfi: string } }) => void) => {
      if (event === 'relocated') relocatedHandlers.push(cb)
    }),
    themes: { fontSize: vi.fn(), register: vi.fn(), select: vi.fn() },
    destroy: vi.fn(),
    currentLocation: vi.fn(() => ({ start: { cfi: 'epubcfi(x)' } })),
  }
  const book = {
    renderTo: vi.fn(() => rendition),
    loaded: { navigation: Promise.resolve({ toc: [{ label: 'Ch 1', href: 'c1.xhtml', subitems: [] }] }) },
    destroy: vi.fn(),
    ready: Promise.resolve(undefined),
    locations: {
      generate: vi.fn().mockResolvedValue([]),
      length: vi.fn(() => 100),
      locationFromCfi: vi.fn(() => 11),
    },
  }
  const ePub = vi.fn(() => book)
  return { rendition, book, ePub, relocatedHandlers }
})
vi.mock('epubjs', () => ({ default: ePub }))

import { EpubViewer, type EpubViewerHandle } from './EpubViewer'

beforeEach(() => {
  vi.clearAllMocks()
  relocatedHandlers.length = 0
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('creates a book from the fetched bytes and displays the initial cfi', async () => {
  render(
    <EpubViewer
      fileUrl="https://x/y.epub" initialCfi="epubcfi(/6/4!/2)"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}}
    />,
  )
  expect(fetch).toHaveBeenCalledWith('https://x/y.epub')
  await vi.waitFor(() => {
    expect(ePub).toHaveBeenCalledWith(expect.any(ArrayBuffer))
    expect(rendition.display).toHaveBeenCalledWith('epubcfi(/6/4!/2)')
  })
})

test('exposes next/prev via the ref', async () => {
  const ref = createRef<EpubViewerHandle>()
  render(
    <EpubViewer ref={ref} fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}} />,
  )
  await vi.waitFor(() => {
    expect(rendition.display).toHaveBeenCalled()
  })
  ref.current!.next()
  ref.current!.prev()
  expect(rendition.next).toHaveBeenCalled()
  expect(rendition.prev).toHaveBeenCalled()
})

test('reports relocation as a cfi', async () => {
  const onRelocated = vi.fn()
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={onRelocated} onToc={() => {}} />,
  )
  await vi.waitFor(() => {
    expect(relocatedHandlers.length).toBeGreaterThan(0)
  })
  relocatedHandlers[0]?.({ start: { cfi: 'epubcfi(/6/8!/4)' } })
  expect(onRelocated).toHaveBeenCalledWith('epubcfi(/6/8!/4)')
})

test('applies font size to the rendition themes', async () => {
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      fontSize={140} theme="light" onRelocated={() => {}} onToc={() => {}} />,
  )
  await vi.waitFor(() => {
    expect(rendition.themes.fontSize).toHaveBeenCalledWith('140%')
  })
})

test('reports the flattened toc once navigation loads', async () => {
  const onToc = vi.fn()
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={onToc} />,
  )
  await vi.waitFor(() => {
    expect(onToc).toHaveBeenCalledWith([{ label: 'Ch 1', href: 'c1.xhtml', level: 0 }])
  })
})

test('reports progress once locations generate', async () => {
  const onProgress = vi.fn()
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}} onProgress={onProgress} />,
  )
  await vi.waitFor(() => {
    expect(onProgress).toHaveBeenCalledWith({ current: 12, total: 100 })
  })
})

test('shows an error when the file fails to fetch', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
  const { findByRole } = render(
    <EpubViewer fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}} />,
  )
  const alert = await findByRole('alert')
  expect(alert.textContent).toMatch(/failed to load/i)
})
