import { useRef, type MouseEvent as ReactMouseEvent } from 'react'
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

export interface PdfViewerProps {
  fileUrl: string
  pageNumber: number
  scale: number
  onNumPages: (n: number) => void
  highlights?: PdfViewerHighlight[]
  onSelect?: (sel: { rects: NormRect[]; text: string; x: number; y: number }) => void
  onHighlightClick?: (id: string, x: number, y: number) => void
}

export function PdfViewer({
  fileUrl, pageNumber, scale, onNumPages, highlights, onSelect, onHighlightClick,
}: PdfViewerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)

  function handleMouseUp() {
    if (!onSelect || !wrapperRef.current) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString().trim()
    if (!text) return
    const clientRects = Array.from(sel.getRangeAt(0).getClientRects())
    if (clientRects.length === 0) return
    const pageRect = wrapperRef.current.getBoundingClientRect()
    const rects = clientRectsToNormalized(clientRects, pageRect)
    const last = clientRects[clientRects.length - 1]
    onSelect({ rects, text, x: last.left + last.width / 2, y: last.top })
  }

  // The overlays are pointer-events:none (so they never block text selection), and
  // react-pdf's text layer sits above them (z-index 2) and swallows clicks — so we detect
  // a highlight click by hit-testing the click point against the highlights' rects.
  function handleClick(e: ReactMouseEvent) {
    if (!onHighlightClick || !highlights?.length || !wrapperRef.current) return
    if (!window.getSelection()?.isCollapsed) return // a drag-select, not a click
    const pageRect = wrapperRef.current.getBoundingClientRect()
    if (pageRect.width === 0 || pageRect.height === 0) return
    const nx = (e.clientX - pageRect.left) / pageRect.width
    const ny = (e.clientY - pageRect.top) / pageRect.height
    for (const h of highlights) {
      if (h.rects.some((r) => nx >= r.x && nx <= r.x + r.w && ny >= r.y && ny <= r.y + r.h)) {
        onHighlightClick(h.id, e.clientX, e.clientY)
        return
      }
    }
  }

  return (
    <Document
      file={fileUrl}
      onLoadSuccess={({ numPages }) => onNumPages(numPages)}
      loading={<div className="p-8 text-gray-500">Loading PDF…</div>}
      error={<div className="p-8 text-red-600">Failed to load PDF.</div>}
    >
      <div
        ref={wrapperRef}
        data-pdf-page-wrapper
        className="relative inline-block"
        onMouseUp={handleMouseUp}
        onClick={handleClick}
      >
        <Page pageNumber={pageNumber} scale={scale} renderAnnotationLayer={false} />
        {highlights?.flatMap((h) =>
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
    </Document>
  )
}
