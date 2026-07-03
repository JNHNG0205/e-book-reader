import { render } from '@testing-library/react'
import { createRef } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

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
  }
  const book = {
    renderTo: vi.fn(() => rendition),
    loaded: { navigation: Promise.resolve({ toc: [{ label: 'Ch 1', href: 'c1.xhtml', subitems: [] }] }) },
    destroy: vi.fn(),
  }
  const ePub = vi.fn(() => book)
  return { rendition, book, ePub, relocatedHandlers }
})
vi.mock('epubjs', () => ({ default: ePub }))

import { EpubViewer, type EpubViewerHandle } from './EpubViewer'

beforeEach(() => {
  vi.clearAllMocks()
  relocatedHandlers.length = 0
})

test('creates a book from the file url and displays the initial cfi', () => {
  render(
    <EpubViewer
      fileUrl="https://x/y.epub" initialCfi="epubcfi(/6/4!/2)"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}}
    />,
  )
  expect(ePub).toHaveBeenCalledWith('https://x/y.epub')
  expect(rendition.display).toHaveBeenCalledWith('epubcfi(/6/4!/2)')
})

test('exposes next/prev via the ref', () => {
  const ref = createRef<EpubViewerHandle>()
  render(
    <EpubViewer ref={ref} fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}} />,
  )
  ref.current!.next()
  ref.current!.prev()
  expect(rendition.next).toHaveBeenCalled()
  expect(rendition.prev).toHaveBeenCalled()
})

test('reports relocation as a cfi', () => {
  const onRelocated = vi.fn()
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={onRelocated} onToc={() => {}} />,
  )
  relocatedHandlers[0]?.({ start: { cfi: 'epubcfi(/6/8!/4)' } })
  expect(onRelocated).toHaveBeenCalledWith('epubcfi(/6/8!/4)')
})

test('applies font size to the rendition themes', () => {
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      fontSize={140} theme="light" onRelocated={() => {}} onToc={() => {}} />,
  )
  expect(rendition.themes.fontSize).toHaveBeenCalledWith('140%')
})

test('reports the flattened toc once navigation loads', async () => {
  const onToc = vi.fn()
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={onToc} />,
  )
  await Promise.resolve()
  await Promise.resolve()
  expect(onToc).toHaveBeenCalledWith([{ label: 'Ch 1', href: 'c1.xhtml', level: 0 }])
})
