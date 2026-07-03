import {
  forwardRef, useEffect, useImperativeHandle, useRef, useState,
} from 'react'
import ePub, { type Rendition } from 'epubjs'
import { flattenToc, type TocItem } from './epubToc'

export type EpubTheme = 'light' | 'dark' | 'sepia'

export interface EpubViewerHandle {
  next: () => void
  prev: () => void
  goTo: (target: string) => void
}

export interface EpubViewerProps {
  fileUrl: string
  bookId?: string
  initialCfi?: string | null
  fontSize: number
  theme: EpubTheme
  onRelocated: (cfi: string) => void
  onToc: (toc: TocItem[]) => void
  onProgress?: (p: { current: number; total: number }) => void
}

// Generating epub.js "locations" (the index behind the "X / Y" progress count) is slow
// on first open — a few seconds for a full book. We persist the generated index per book
// so every later open loads it instantly instead of recomputing.
// Size each epub.js "location" to roughly one on-screen page of text, so page numbers
// advance by ~1 per turn. (Reflowable text has no true fixed pages, so the count is
// approximate and shifts a little with font size.)
const LOCATION_CHARS = 3000

function locationsCacheKey(bookId: string): string {
  // Include the granularity so changing LOCATION_CHARS invalidates stale caches.
  return `epub.locations.${LOCATION_CHARS}.${bookId}`
}
function readLocationsCache(bookId: string): string | null {
  try { return localStorage.getItem(locationsCacheKey(bookId)) } catch { return null }
}
function writeLocationsCache(bookId: string, json: string): void {
  try { localStorage.setItem(locationsCacheKey(bookId), json) } catch { /* ignore quota */ }
}

const THEME_STYLES: Record<EpubTheme, Record<string, Record<string, string>>> = {
  light: { body: { background: '#ffffff', color: '#111111' } },
  dark: { body: { background: '#111111', color: '#e5e5e5' } },
  sepia: { body: { background: '#f4ecd8', color: '#5b4636' } },
}

// epub.js's registerRules/select theme path injects empty CSS for some books (the
// background never changes). `themes.override` instead sets the property directly on
// each rendered section's <body> with !important, applies immediately to current
// sections, and re-applies to new ones — so theme switches actually change the page.
function applyEpubTheme(rendition: Rendition, theme: EpubTheme): void {
  const body = THEME_STYLES[theme].body
  const themes = rendition.themes as unknown as {
    override: (name: string, value: string, priority?: boolean) => void
  }
  themes.override('color', body.color, true)
  themes.override('background', body.background, true)
}

const XLINK_NS = 'http://www.w3.org/1999/xlink'

// epub.js substitutes most in-archive resource URLs (e.g. stylesheet <link>s become
// blob: URLs), but for some calibre-generated books it leaves plain
// <img src="images/00013.jpg"> as a relative path, which then resolves against the
// section's http(s) <base> and 404s (broken image). This per-section hook repairs those:
// it matches each image to its manifest entry (by filename) and swaps in the blob URL
// epub.js already created for that resource via `resources.get` — reusing epub.js's own
// resolution rather than guessing archive paths.
// Any image we can't resolve (or that later fails to load) is replaced with a small
// centered divider bar rather than the browser's broken-image icon — most of these are
// decorative section-break ornaments, so a divider reads as intentional. `currentColor`
// keeps it visible across the light/dark/sepia themes.
function makeDivider(doc: Document): HTMLElement {
  const div = doc.createElement('div')
  div.setAttribute('data-broken-image', 'true')
  div.style.cssText =
    'width:48px;height:4px;margin:1.5em auto;background:currentColor;opacity:0.55;border-radius:2px;'
  return div
}

function replaceWithDivider(el: Element): void {
  // For an SVG <image>, swap out the whole <svg> wrapper (a bare div inside SVG won't render).
  const target = el.tagName.toLowerCase() === 'image' ? el.closest('svg') ?? el : el
  const doc = target.ownerDocument
  if (!doc || !target.parentNode) return
  target.replaceWith(makeDivider(doc))
}

async function fixArchivedImages(book: ReturnType<typeof ePub>, doc: Document): Promise<void> {
  const resources = book.resources as unknown as {
    urls?: string[]
    get?: (href: string) => Promise<string>
  } | undefined
  const urls = resources?.urls
  const get = resources?.get?.bind(resources)

  const basename = (p: string): string => p.split(/[?#]/)[0].split('/').pop() ?? p

  const images: Array<{ el: Element; isSvg: boolean }> = []
  doc.querySelectorAll('img[src]').forEach((el) => images.push({ el, isSvg: false }))
  doc.querySelectorAll('image').forEach((el) => images.push({ el, isSvg: true }))

  for (const { el, isSvg } of images) {
    try {
      const current = isSvg
        ? el.getAttributeNS(XLINK_NS, 'href') || el.getAttribute('href')
        : el.getAttribute('src')
      if (!current) continue

      // Already resolved to an inline/blob URL — just guard against a failed load.
      if (current.startsWith('blob:') || current.startsWith('data:')) {
        if (!isSvg) el.addEventListener('error', () => replaceWithDivider(el), { once: true })
        continue
      }

      // Try to resolve against the archive manifest by filename.
      let blobUrl: string | null = null
      if (urls && get) {
        const wanted = basename(current)
        const href = urls.find((u) => basename(u) === wanted)
        if (href) blobUrl = await get(href)
      }

      if (blobUrl) {
        if (isSvg) {
          el.setAttribute('href', blobUrl)
          el.setAttributeNS(XLINK_NS, 'xlink:href', blobUrl)
        } else {
          el.setAttribute('src', blobUrl)
          el.addEventListener('error', () => replaceWithDivider(el), { once: true })
        }
      } else {
        // Couldn't resolve → show a divider instead of a broken-image icon.
        replaceWithDivider(el)
      }
    } catch {
      replaceWithDivider(el)
    }
  }
}

// epub.js's published types claim `locationFromCfi` returns a `Location` object, but at
// runtime it returns a 0-based location index (number). We report it as a 1-based
// "page" number so it reads naturally as "current / total".
// A TOC href sometimes doesn't match the spine's stored href (path-prefix differences),
// so epub.js's spine.get() returns null and display() silently no-ops — the clicked
// entry does nothing. When the exact href doesn't resolve, fall back to the spine item
// with the same filename so the entry still navigates (to that chapter).
function resolveTocTarget(book: ReturnType<typeof ePub> | null, href: string): string {
  if (!book) return href
  try {
    const spine = book.spine as unknown as {
      get: (t: string) => unknown
      each: (cb: (item: { href?: string }) => void) => void
    }
    if (spine.get(href)) return href
    const wanted = href.split('#')[0].split('/').pop()
    let match: string | null = null
    spine.each((item) => {
      if (!match && item.href && item.href.split('/').pop() === wanted) match = item.href
    })
    return match ?? href
  } catch {
    return href
  }
}

// With screen-sized locations (LOCATION_CHARS), the location index reads as a page
// number: current = index + 1, total = number of locations.
function reportProgressForCfi(
  book: ReturnType<typeof ePub>,
  cfi: string,
  onProgressRef: { current?: (p: { current: number; total: number }) => void },
) {
  if (!onProgressRef.current) return
  const total = book.locations.length()
  if (!total) return
  const index = book.locations.locationFromCfi(cfi) as unknown as number
  if (typeof index !== 'number' || Number.isNaN(index)) return
  onProgressRef.current({ current: index + 1, total })
}

export const EpubViewer = forwardRef<EpubViewerHandle, EpubViewerProps>(function EpubViewer(
  { fileUrl, bookId, initialCfi, fontSize, theme, onRelocated, onToc, onProgress },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const bookRef = useRef<ReturnType<typeof ePub> | null>(null)
  const onRelocatedRef = useRef(onRelocated)
  const onTocRef = useRef(onToc)
  const onProgressRef = useRef(onProgress)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { onRelocatedRef.current = onRelocated }, [onRelocated])
  useEffect(() => { onTocRef.current = onToc }, [onToc])
  useEffect(() => { onProgressRef.current = onProgress }, [onProgress])

  useImperativeHandle(ref, () => ({
    next: () => renditionRef.current?.next(),
    prev: () => renditionRef.current?.prev(),
    goTo: (target: string) => {
      const r = renditionRef.current
      if (!r) return
      void r.display(resolveTocTarget(bookRef.current, target)).catch(() => { /* target unresolved */ })
    },
  }), [])

  // Create the book + rendition once per file.
  useEffect(() => {
    let cancelled = false
    let book: ReturnType<typeof ePub> | null = null
    setError(null)

    void (async () => {
      try {
        const res = await fetch(fileUrl)
        if (!res.ok) {
          setError('Failed to load this book.')
          return
        }
        const buffer = await res.arrayBuffer()
        if (cancelled || !containerRef.current) return

        book = ePub(buffer)
        const rendition = book.renderTo(containerRef.current, {
          width: '100%', height: '100%', flow: 'paginated', spread: 'none',
        })
        renditionRef.current = rendition
        bookRef.current = book
        applyEpubTheme(rendition, theme)
        rendition.themes.fontSize(`${fontSize}%`)
        const currentBook = book
        // Repair archived <img> references epub.js leaves unresolved. Registered before
        // display() so it also runs for the first rendered section.
        rendition.hooks.content.register((contents: { document: Document }) => {
          void fixArchivedImages(currentBook, contents.document)
        })
        void rendition.display(initialCfi ?? undefined)
        rendition.on('relocated', (loc: { start: { cfi: string } }) => {
          onRelocatedRef.current(loc.start.cfi)
          reportProgressForCfi(currentBook, loc.start.cfi, onProgressRef)
        })
        void book.loaded.navigation
          .then((nav: { toc: Parameters<typeof flattenToc>[0] }) => { onTocRef.current(flattenToc(nav.toc)) })
          .catch(() => { /* navigation failed to load; leave toc empty */ })

        // Generate locations (an even, page-like pagination index) so we can report
        // reading progress as "current / total". This can be slow/unsupported for
        // some books, so failures are swallowed and progress is simply not reported.
        try {
          await book.ready
          const locations = book.locations as unknown as {
            generate: (chars: number) => Promise<unknown>
            load: (json: string) => void
            save: () => string
          }
          const cached = bookId ? readLocationsCache(bookId) : null
          if (cached) {
            locations.load(cached) // instant on re-open
          } else {
            await locations.generate(LOCATION_CHARS)
            if (bookId) writeLocationsCache(bookId, locations.save())
          }
          if (cancelled) return
          const loc = rendition.currentLocation() as unknown as { start: { cfi: string } } | undefined
          if (loc?.start?.cfi) reportProgressForCfi(book, loc.start.cfi, onProgressRef)
        } catch {
          // Locations unavailable; skip progress reporting.
        }
      } catch {
        setError('Failed to load this book.')
      }
    })()

    return () => { cancelled = true; book?.destroy() }
    // Intentionally only re-create when the file changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl])

  // Apply font size when it changes.
  useEffect(() => { renditionRef.current?.themes.fontSize(`${fontSize}%`) }, [fontSize])
  // Apply theme when it changes.
  useEffect(() => {
    const r = renditionRef.current
    if (r) applyEpubTheme(r, theme)
  }, [theme])

  if (error) {
    return <div className="p-8 text-red-600" role="alert">{error}</div>
  }

  return <div ref={containerRef} className="h-full w-full" data-testid="epub-container" />
})
