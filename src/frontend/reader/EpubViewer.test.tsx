import { render } from '@testing-library/react'
import { createRef } from 'react'
import {
  afterEach, beforeEach, expect, test, vi,
} from 'vitest'

// Shared fake rendition/book captured per test.
const {
  rendition, book: _book, ePub, relocatedHandlers, contentHandlers, selectedHandlers,
} = vi.hoisted(() => {
  const relocatedHandlers: Array<(loc: { start: { cfi: string; href?: string } }) => void> = []
  const contentHandlers: Array<(contents: { document: Document }) => void> = []
  const selectedHandlers: Array<(cfiRange: string, contents: unknown) => void> = []
  const rendition = {
    display: vi.fn().mockResolvedValue(undefined),
    next: vi.fn(),
    prev: vi.fn(),
    on: vi.fn((event: string, cb: (...args: never[]) => void) => {
      if (event === 'relocated') relocatedHandlers.push(cb as never)
      if (event === 'selected') selectedHandlers.push(cb as never)
    }),
    hooks: {
      content: {
        register: vi.fn((cb: (contents: { document: Document }) => void) => { contentHandlers.push(cb) }),
      },
    },
    themes: { fontSize: vi.fn(), register: vi.fn(), select: vi.fn(), override: vi.fn() },
    annotations: { add: vi.fn(), remove: vi.fn() },
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
      percentageFromCfi: vi.fn(() => 0.42),
      save: vi.fn(() => '["loc1","loc2"]'),
      load: vi.fn(),
    },
    resources: {
      urls: ['images/00013.jpg', 'style.css'],
      get: vi.fn().mockResolvedValue('blob:fake-image'),
    },
    spine: {
      // 'chapter1.xhtml' resolves directly; anything else does not (simulating a
      // path-prefix mismatch), forcing the filename fallback.
      get: vi.fn((t: string) => (t.split('#')[0] === 'chapter1.xhtml' ? {} : null)),
      each: (cb: (item: { href?: string }) => void) => {
        [{ href: 'text/chapter1.xhtml' }, { href: 'text/chapter2.xhtml' }].forEach(cb)
      },
    },
  }
  const ePub = vi.fn(() => book)
  return {
    rendition, book, ePub, relocatedHandlers, contentHandlers, selectedHandlers,
  }
})
vi.mock('epubjs', () => ({ default: ePub }))

import { EpubViewer, type EpubViewerHandle } from './EpubViewer'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  relocatedHandlers.length = 0
  contentHandlers.length = 0
  selectedHandlers.length = 0
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

test('goTo navigates directly when the href resolves in the spine', async () => {
  const ref = createRef<EpubViewerHandle>()
  render(
    <EpubViewer ref={ref} fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}} />,
  )
  await vi.waitFor(() => expect(rendition.display).toHaveBeenCalled())
  ref.current!.goTo('chapter1.xhtml')
  expect(rendition.display).toHaveBeenLastCalledWith('chapter1.xhtml')
})

test('goTo falls back to the spine item with the same filename when the href does not resolve', async () => {
  const ref = createRef<EpubViewerHandle>()
  render(
    <EpubViewer ref={ref} fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}} />,
  )
  await vi.waitFor(() => expect(rendition.display).toHaveBeenCalled())
  // TOC href with a mismatched path + fragment → resolves to 'text/chapter1.xhtml'.
  ref.current!.goTo('OEBPS/chapter1.xhtml#section2')
  expect(rendition.display).toHaveBeenLastCalledWith('text/chapter1.xhtml')
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

test('reports the current section href on relocation', async () => {
  const onSection = vi.fn()
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}} onSection={onSection} />,
  )
  await vi.waitFor(() => expect(relocatedHandlers.length).toBeGreaterThan(0))
  relocatedHandlers[0]?.({ start: { cfi: 'epubcfi(/6/8!/4)', href: 'text/chapter2.xhtml' } })
  expect(onSection).toHaveBeenCalledWith('text/chapter2.xhtml')
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

test('applies the theme background + color to the section body via override', async () => {
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      fontSize={100} theme="dark" onRelocated={() => {}} onToc={() => {}} />,
  )
  await vi.waitFor(() => {
    expect(rendition.themes.override).toHaveBeenCalledWith('background', '#111111', true)
    expect(rendition.themes.override).toHaveBeenCalledWith('color', '#e5e5e5', true)
  })
})

test('resolves an archived <img> to its blob url on content render', async () => {
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}} />,
  )
  // The content hook is registered during async setup.
  await vi.waitFor(() => expect(contentHandlers.length).toBeGreaterThan(0))

  // A section document whose image epub.js left as a relative in-archive path.
  const doc = document.implementation.createHTMLDocument('section')
  doc.body.innerHTML = '<p><img src="images/00013.jpg" class="calibre_3"></p>'
  contentHandlers[0]({ document: doc })

  await vi.waitFor(() => {
    expect(doc.querySelector('img')?.getAttribute('src')).toBe('blob:fake-image')
  })
})

test('replaces an unresolvable image with a divider (no broken-image icon)', async () => {
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}} />,
  )
  await vi.waitFor(() => expect(contentHandlers.length).toBeGreaterThan(0))

  // 99999.jpg is not in the manifest (urls), so it can't be resolved.
  const doc = document.implementation.createHTMLDocument('section')
  doc.body.innerHTML = '<p><img src="images/99999.jpg"></p>'
  contentHandlers[0]({ document: doc })

  await vi.waitFor(() => {
    expect(doc.querySelector('img')).toBeNull()
    expect(doc.querySelector('[data-broken-image]')).not.toBeNull()
  })
})

test('leaves already-resolved (blob:) images untouched', async () => {
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}} />,
  )
  await vi.waitFor(() => expect(contentHandlers.length).toBeGreaterThan(0))

  const doc = document.implementation.createHTMLDocument('section')
  doc.body.innerHTML = '<img src="blob:already-resolved">'
  contentHandlers[0]({ document: doc })

  // Give any (unexpected) async work a tick, then confirm it was not rewritten.
  await Promise.resolve()
  expect(doc.querySelector('img')?.getAttribute('src')).toBe('blob:already-resolved')
})

test('generates and caches locations on first open (no cache)', async () => {
  render(
    <EpubViewer fileUrl="https://x/y.epub" bookId="b1"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}} />,
  )
  await vi.waitFor(() => expect(_book.locations.generate).toHaveBeenCalledWith(3000))
  await vi.waitFor(() => {
    expect(localStorage.getItem('epub.locations.3000.b1')).toBe('["loc1","loc2"]')
  })
  expect(_book.locations.load).not.toHaveBeenCalled()
})

test('loads cached locations instantly on re-open (skips generate)', async () => {
  localStorage.setItem('epub.locations.3000.b1', '["cached"]')
  render(
    <EpubViewer fileUrl="https://x/y.epub" bookId="b1"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}} />,
  )
  await vi.waitFor(() => expect(_book.locations.load).toHaveBeenCalledWith('["cached"]'))
  expect(_book.locations.generate).not.toHaveBeenCalled()
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

test('applies saved highlights as annotations', async () => {
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      highlights={[{ id: 'h1', cfiRange: 'epubcfi(range1)', color: 'yellow' }]}
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}} />,
  )
  await vi.waitFor(() =>
    expect(rendition.annotations.add).toHaveBeenCalledWith(
      'highlight', 'epubcfi(range1)', expect.any(Object), expect.any(Function),
      'hl-h1', expect.objectContaining({ fill: expect.any(String) }),
    ),
  )
})

test('reports a text selection on mouseup via onSelect', async () => {
  const onSelect = vi.fn()
  // A real jsdom document (so addEventListener/dispatchEvent work) + a fake window
  // selection and cfiFromRange, matching what epub.js passes a content hook.
  const doc = document.implementation.createHTMLDocument('section')
  const fakeContents = {
    document: doc,
    window: {
      getSelection: () => ({
        rangeCount: 1,
        toString: () => 'selected words',
        getRangeAt: () => ({ collapsed: false, getBoundingClientRect: () => ({ left: 100, top: 50, width: 40, height: 12 }) }),
        removeAllRanges: () => {},
      }),
      frameElement: { getBoundingClientRect: () => ({ left: 10, top: 20 }) },
    },
    cfiFromRange: () => 'epubcfi(sel)',
  }
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}} onSelect={onSelect} />,
  )
  await vi.waitFor(() => expect(contentHandlers.length).toBeGreaterThan(0))
  contentHandlers[0](fakeContents as unknown as { document: Document })
  doc.dispatchEvent(new Event('mouseup'))
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
    cfiRange: 'epubcfi(sel)', text: 'selected words',
  }))
})
