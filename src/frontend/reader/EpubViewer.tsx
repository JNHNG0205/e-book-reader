import {
  forwardRef, useEffect, useImperativeHandle, useRef,
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
}

const THEME_STYLES: Record<EpubTheme, Record<string, Record<string, string>>> = {
  light: { body: { background: '#ffffff', color: '#111111' } },
  dark: { body: { background: '#111111', color: '#e5e5e5' } },
  sepia: { body: { background: '#f4ecd8', color: '#5b4636' } },
}

export const EpubViewer = forwardRef<EpubViewerHandle, EpubViewerProps>(function EpubViewer(
  { fileUrl, initialCfi, fontSize, theme, onRelocated, onToc },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<Rendition | null>(null)

  useImperativeHandle(ref, () => ({
    next: () => renditionRef.current?.next(),
    prev: () => renditionRef.current?.prev(),
    goTo: (target: string) => { void renditionRef.current?.display(target) },
  }), [])

  // Create the book + rendition once per file.
  useEffect(() => {
    if (!containerRef.current) return
    const book = ePub(fileUrl)
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
    rendition.on('relocated', (loc: { start: { cfi: string } }) => onRelocated(loc.start.cfi))
    void book.loaded.navigation.then((nav: { toc: Parameters<typeof flattenToc>[0] }) => {
      onToc(flattenToc(nav.toc))
    })
    return () => { book.destroy() }
    // Intentionally only re-create when the file changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl])

  // Apply font size when it changes.
  useEffect(() => { renditionRef.current?.themes.fontSize(`${fontSize}%`) }, [fontSize])
  // Apply theme when it changes.
  useEffect(() => { renditionRef.current?.themes.select(theme) }, [theme])

  return <div ref={containerRef} className="h-full w-full" data-testid="epub-container" />
})
