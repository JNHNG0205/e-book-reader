import {
  forwardRef, useEffect, useImperativeHandle, useRef,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import { colorValue } from './highlightColors'
import { clientRectsToNormalized, type NormRect } from './pdfHighlightGeometry'

// Configure the PDF.js worker (Vite resolves this URL at build time).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export interface PdfViewerHighlight {
  id: string
  color: string
  rects: NormRect[]
}

export interface PdfViewerHandle {
  scrollToPage: (page: number) => void
}

export interface PdfViewerProps {
  fileUrl: string
  numPages: number
  scale: number
  initialPage?: number
  onNumPages: (n: number) => void
  // Saved highlights grouped by page number.
  highlightsByPage?: Record<number, PdfViewerHighlight[]>
  onSelect?: (sel: { page: number; rects: NormRect[]; text: string; x: number; y: number }) => void
  onHighlightClick?: (id: string, x: number, y: number) => void
  // Fired as the reader scrolls, with the page that fills most of the viewport.
  onVisiblePage?: (page: number) => void
}

export const PdfViewer = forwardRef<PdfViewerHandle, PdfViewerProps>(function PdfViewer({
  fileUrl, numPages, scale, initialPage, onNumPages, highlightsByPage, onSelect, onHighlightClick, onVisiblePage,
}, ref) {
  const pageEls = useRef(new Map<number, HTMLDivElement>())
  const visibleRef = useRef(0)
  const scrolledToInitial = useRef(false)

  const onVisibleRef = useRef(onVisiblePage)
  useEffect(() => { onVisibleRef.current = onVisiblePage }, [onVisiblePage])

  useImperativeHandle(ref, () => ({
    scrollToPage: (page: number) => {
      pageEls.current.get(page)?.scrollIntoView({ block: 'start' })
    },
  }), [])

  // Track which page occupies most of the viewport (drives the counter / progress /
  // bookmark state as the reader scrolls) and jump to the resume page once pages mount.
  useEffect(() => {
    if (!numPages) return
    const area = new Map<number, number>()
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const p = Number((e.target as HTMLElement).dataset.page)
        area.set(p, e.isIntersecting ? e.intersectionRect.height : 0)
      }
      let best = 0
      let bestArea = -1
      for (const [p, a] of area) if (a > bestArea) { bestArea = a; best = p }
      if (best && best !== visibleRef.current) {
        visibleRef.current = best
        onVisibleRef.current?.(best)
      }
    }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] })
    pageEls.current.forEach((el) => io.observe(el))

    if (!scrolledToInitial.current && initialPage && initialPage > 1) {
      scrolledToInitial.current = true
      pageEls.current.get(initialPage)?.scrollIntoView({ block: 'start' })
    }
    return () => io.disconnect()
  }, [numPages, initialPage])

  function handleMouseUp(page: number) {
    if (!onSelect) return
    const wrapper = pageEls.current.get(page)
    if (!wrapper) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString().trim()
    if (!text) return
    const clientRects = Array.from(sel.getRangeAt(0).getClientRects())
    if (clientRects.length === 0) return
    const rects = clientRectsToNormalized(clientRects, wrapper.getBoundingClientRect())
    const last = clientRects[clientRects.length - 1]
    onSelect({ page, rects, text, x: last.left + last.width / 2, y: last.top })
  }

  // Overlays are pointer-events:none (never block selection); react-pdf's text layer sits
  // above them and swallows clicks, so hit-test the click point against this page's rects.
  function handleClick(e: ReactMouseEvent, page: number) {
    const hls = highlightsByPage?.[page]
    if (!onHighlightClick || !hls?.length) return
    if (!window.getSelection()?.isCollapsed) return
    const wrapper = pageEls.current.get(page)
    if (!wrapper) return
    const rect = wrapper.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.height
    for (const h of hls) {
      if (h.rects.some((r) => nx >= r.x && nx <= r.x + r.w && ny >= r.y && ny <= r.y + r.h)) {
        onHighlightClick(h.id, e.clientX, e.clientY)
        return
      }
    }
  }

  return (
    <Document
      file={fileUrl}
      onLoadSuccess={({ numPages: n }) => onNumPages(n)}
      loading={<div className="p-8 text-ink-soft">Loading PDF…</div>}
      error={<div className="p-8 text-red-600">Failed to load PDF.</div>}
      className="flex flex-col items-center gap-4 py-4"
    >
      {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
        <div
          key={p}
          data-page={p}
          data-pdf-page-wrapper
          ref={(el) => { if (el) pageEls.current.set(p, el); else pageEls.current.delete(p) }}
          className="relative shadow-[0_4px_16px_-8px_rgba(27,26,23,0.5)]"
          onMouseUp={() => handleMouseUp(p)}
          onClick={(e) => handleClick(e, p)}
        >
          <Page pageNumber={p} scale={scale} renderAnnotationLayer={false} />
          {(highlightsByPage?.[p] ?? []).flatMap((h) =>
            h.rects.map((r, i) => (
              <div
                key={`${h.id}-${i}`}
                data-highlight-id={h.id}
                style={{
                  position: 'absolute',
                  left: `${r.x * 100}%`,
                  top: `${r.y * 100}%`,
                  width: `${r.w * 100}%`,
                  height: `${r.h * 100}%`,
                  backgroundColor: colorValue(h.color),
                  opacity: 0.35,
                  mixBlendMode: 'multiply',
                  pointerEvents: 'none',
                }}
              />
            )),
          )}
        </div>
      ))}
    </Document>
  )
})
