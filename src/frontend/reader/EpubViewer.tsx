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
  initialCfi?: string | null
  fontSize: number
  theme: EpubTheme
  onRelocated: (cfi: string) => void
  onToc: (toc: TocItem[]) => void
  onProgress?: (p: { current: number; total: number }) => void
}

const THEME_STYLES: Record<EpubTheme, Record<string, Record<string, string>>> = {
  light: { body: { background: '#ffffff', color: '#111111' } },
  dark: { body: { background: '#111111', color: '#e5e5e5' } },
  sepia: { body: { background: '#f4ecd8', color: '#5b4636' } },
}

const XLINK_NS = 'http://www.w3.org/1999/xlink'

// epub.js resolves in-archive resource references (blob/base64 URLs) for most `<img src>`
// usages via its own substitution pass, but that pass matches against the manifest's
// relative-href spelling and commonly misses images referenced as SVG `<image>` elements
// (a common way books embed chapter-opener graphics) via `href`/`xlink:href`. This hook
// runs per rendered section and repairs any image reference that's still pointing at an
// in-archive path (i.e. not already a blob:/data: URL) by resolving it against the
// section's own <base> and asking the archive for a blob URL directly.
async function fixUnresolvedArchivedImages(
  book: ReturnType<typeof ePub>,
  doc: Document,
): Promise<void> {
  const archive = book.archive
  if (!archive) return

  const baseHref = doc.querySelector('base')?.getAttribute('href') ?? doc.baseURI

  type Candidate = { el: Element; isSvgImage: boolean }
  const candidates: Candidate[] = []
  doc.querySelectorAll('img[src]').forEach((el) => { candidates.push({ el, isSvgImage: false }) })
  doc.querySelectorAll('image').forEach((el) => { candidates.push({ el, isSvgImage: true }) })

  for (const { el, isSvgImage } of candidates) {
    try {
      const current = isSvgImage
        ? (el.getAttributeNS(XLINK_NS, 'href') || el.getAttribute('href'))
        : el.getAttribute('src')
      if (!current || current.startsWith('blob:') || current.startsWith('data:')) continue

      const archivePath = new URL(current, baseHref).pathname
      const url = await archive.createUrl(archivePath, { base64: false })

      if (isSvgImage) {
        el.setAttribute('href', url)
        el.setAttributeNS(XLINK_NS, 'xlink:href', url)
      } else {
        el.setAttribute('src', url)
      }
    } catch {
      // One bad/unresolvable image shouldn't break the rest of the page.
    }
  }
}

// epub.js's published types claim `locationFromCfi` returns a `Location` object, but at
// runtime it returns a 0-based location index (number). We report it as a 1-based
// "page" number so it reads naturally as "current / total".
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
  { fileUrl, initialCfi, fontSize, theme, onRelocated, onToc, onProgress },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<Rendition | null>(null)
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
    goTo: (target: string) => { void renditionRef.current?.display(target) },
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

        // Archived (in-memory ArrayBuffer/zip) books already default to "blobUrl"
        // replacements internally, but we set it explicitly so behavior doesn't
        // depend on that internal default across epubjs versions.
        book = ePub(buffer, { replacements: 'blobUrl' })
        const rendition = book.renderTo(containerRef.current, {
          width: '100%', height: '100%', flow: 'paginated', spread: 'none',
        })
        renditionRef.current = rendition
        for (const [name, styles] of Object.entries(THEME_STYLES)) {
          rendition.themes.register(name, styles)
        }
        rendition.themes.select(theme)
        rendition.themes.fontSize(`${fontSize}%`)
        const currentBook = book
        // Belt-and-suspenders fix for archived-image resolution (see
        // fixUnresolvedArchivedImages doc comment). Registered before display() so it
        // also applies to the first rendered section.
        rendition.hooks.content.register((contents: { document: Document }) => {
          void fixUnresolvedArchivedImages(currentBook, contents.document)
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
          await book.locations.generate(1000)
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
  useEffect(() => { renditionRef.current?.themes.select(theme) }, [theme])

  if (error) {
    return <div className="p-8 text-red-600" role="alert">{error}</div>
  }

  return <div ref={containerRef} className="h-full w-full" data-testid="epub-container" />
})
