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

        book = ePub(buffer)
        const rendition = book.renderTo(containerRef.current, {
          width: '100%', height: '100%', flow: 'paginated', spread: 'none',
        })
        renditionRef.current = rendition
        for (const [name, styles] of Object.entries(THEME_STYLES)) {
          rendition.themes.register(name, styles)
        }
        rendition.themes.select(theme)
        rendition.themes.fontSize(`${fontSize}%`)
        void rendition.display(initialCfi ?? undefined)
        const currentBook = book
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
