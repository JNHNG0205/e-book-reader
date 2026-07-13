import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Book, Bookmark, Highlight } from '@shared/types'
import { getBook } from '@backend/data/books'
import { loadBookObjectUrl } from '@frontend/offline/loadBook'
import {
  getProgress, saveProgress,
  listBookmarks, saveBookmark, deleteBookmark,
  listHighlights, saveHighlight, updateHighlight, deleteHighlight,
} from '@frontend/offline/offlineData'
import { PdfViewer, type PdfViewerHandle } from '@frontend/reader/PdfViewer'
import { ReaderToolbar } from '@frontend/reader/ReaderToolbar'
import { EpubReader } from '@frontend/reader/EpubReader'
import { ReaderSidebar } from '@frontend/reader/ReaderSidebar'
import { BookmarksPanel } from '@frontend/reader/BookmarksPanel'
import { HighlightsPanel } from '@frontend/reader/HighlightsPanel'
import { HighlightPopover } from '@frontend/reader/HighlightPopover'
import { BookmarkStar } from '@frontend/reader/BookmarkStar'
import { SearchPanel } from '@frontend/reader/SearchPanel'
import { searchPdf } from '@frontend/reader/searchPdf'
import { PanelIcon, BookmarkIcon, HighlightIcon, SearchIcon } from '@frontend/reader/icons'
import type { NormRect } from '@frontend/reader/pdfHighlightGeometry'

const MIN_SCALE = 0.5
const MAX_SCALE = 3

export function ReaderPage() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const [book, setBook] = useState<Book | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [initialPage, setInitialPage] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [popover, setPopover] = useState<null | {
    mode: 'create' | 'edit'; x: number; y: number; page?: number; rects?: NormRect[]; text?: string
    id?: string; color?: string; note?: string | null
  }>(null)

  const objectUrlRef = useRef<string | null>(null)
  const viewerRef = useRef<PdfViewerHandle>(null)

  useEffect(() => {
    if (!bookId) return
    let active = true
    ;(async () => {
      try {
        const b = await getBook(bookId)
        if (!active) return
        setBook(b)
        let objectUrl: string
        try {
          objectUrl = await loadBookObjectUrl(b.id, b.storage_path, b.format)
        } catch {
          if (active) setError('This book isn’t available offline. Reconnect to open it the first time.')
          return
        }
        if (!active) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        objectUrlRef.current = objectUrl
        setFileUrl(objectUrl)
        if (b.format === 'pdf') {
          const saved = await getProgress(bookId)
          const p = saved ? Math.max(1, parseInt(saved, 10) || 1) : 1
          if (active && p > 1) { setPage(p); setInitialPage(p) }
        }
      } catch (e) {
        if (active) setError((e as Error).message)
      }
    })()
    return () => {
      active = false
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [bookId])

  const didMount = useRef(false)
  useEffect(() => {
    if (!bookId || book?.format !== 'pdf') return
    if (!didMount.current) { didMount.current = true; return }
    const percent = numPages ? Math.round((page / numPages) * 100) : null
    const t = setTimeout(() => { void saveProgress(bookId, String(page), percent) }, 500)
    return () => clearTimeout(t)
  }, [bookId, page, numPages, book])

  useEffect(() => {
    if (book?.format === 'pdf' && numPages && page > numPages) setPage(numPages)
  }, [book, numPages, page])

  useEffect(() => {
    if (!bookId || book?.format !== 'pdf') return
    listBookmarks(bookId).then(setBookmarks).catch(() => {})
  }, [bookId, book?.format])

  useEffect(() => {
    if (!bookId || book?.format !== 'pdf') return
    listHighlights(bookId).then(setHighlights).catch(() => {})
  }, [bookId, book?.format])

  const goBack = useCallback(() => navigate('/'), [navigate])
  // Jumps scroll the page into view; the viewer reports the visible page back via
  // onVisiblePage, which keeps the counter/progress in sync as the reader also scrolls.
  const goToPage = (p: number) => {
    const target = Math.max(1, numPages ? Math.min(numPages, p) : p)
    setPage(target)
    viewerRef.current?.scrollToPage(target)
  }
  const prev = () => goToPage(page - 1)
  const next = () => goToPage(page + 1)
  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, Math.round((s + 0.25) * 100) / 100))
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, Math.round((s - 0.25) * 100) / 100))

  const activeLocation = String(page)
  const isBookmarked = bookmarks.some((b) => b.location === activeLocation)

  async function toggleBookmark() {
    const existing = bookmarks.find((b) => b.location === activeLocation)
    if (existing) {
      await deleteBookmark(book!.id, existing.id)
      setBookmarks((prev) => prev.filter((b) => b.id !== existing.id))
    } else {
      const bm = await saveBookmark(book!.id, { location: activeLocation, label: `Page ${page}` })
      setBookmarks((prev) => [...prev, bm])
    }
  }
  async function removeBookmark(id: string) {
    await deleteBookmark(book!.id, id)
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
  }
  function jumpToBookmark(location: string) {
    const p = parseInt(location, 10)
    if (p) goToPage(p)
  }

  // Saved highlights grouped by page, so the continuous viewer can overlay each page's own.
  const highlightsByPage: Record<number, { id: string; color: string; rects: NormRect[] }[]> = {}
  for (const h of highlights) {
    const pg = (h.anchor as { page?: number }).page
    if (!pg) continue
    ;(highlightsByPage[pg] ??= []).push({
      id: h.id, color: h.color, rects: ((h.anchor as { rects?: NormRect[] }).rects) ?? [],
    })
  }

  // Close the popover and clear the browser's lingering text selection (the PDF page +
  // overlays live in the host document, so a plain removeAllRanges works — no iframe).
  function closePopover() {
    window.getSelection()?.removeAllRanges()
    setPopover(null)
  }
  async function createHighlight(color: string) {
    if (!popover?.rects) return
    const saved = await saveHighlight(book!.id, {
      color, anchor: { page: popover.page ?? page, rects: popover.rects, text: popover.text ?? '' },
    })
    setHighlights((prev) => [...prev, saved])
    closePopover()
  }
  async function changeColor(color: string) {
    if (!popover?.id) return
    await updateHighlight(book!.id, popover.id, { color })
    setHighlights((prev) => prev.map((h) => (h.id === popover.id ? { ...h, color } : h)))
    closePopover()
  }
  async function saveNote(note: string) {
    if (!popover?.id) return
    await updateHighlight(book!.id, popover.id, { note })
    setHighlights((prev) => prev.map((h) => (h.id === popover.id ? { ...h, note } : h)))
    closePopover()
  }
  async function removeHighlight(id: string) {
    await deleteHighlight(book!.id, id)
    setHighlights((prev) => prev.filter((h) => h.id !== id))
    closePopover()
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center" role="alert">
        <p className="font-serif text-lg text-ink">Can’t open this book</p>
        <p className="mt-1 text-sm text-ink-soft">{error}</p>
        <button
          type="button"
          onClick={goBack}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-deep"
        >
          Back to library
        </button>
      </div>
    )
  }
  if (!book) return <div className="p-6 text-ink-soft">Loading…</div>

  return (
    <div className="flex h-[calc(100vh-49px)] flex-col">
      {book.format === 'pdf' && (
        <ReaderToolbar
          page={page} numPages={numPages} scale={scale}
          onPrev={prev} onNext={next} onZoomIn={zoomIn} onZoomOut={zoomOut}
          onGoToPage={goToPage}
          onBack={goBack}
        />
      )}
      <div className="flex min-h-0 flex-1">
        {book.format === 'pdf' && fileUrl ? (
          <>
            {sidebarOpen && (
              <ReaderSidebar
                onClose={() => setSidebarOpen(false)}
                tabs={[
                  { key: 'bookmarks', label: 'Bookmarks', icon: <BookmarkIcon />, render: () => (
                    <BookmarksPanel bookmarks={bookmarks} onJump={jumpToBookmark} onDelete={removeBookmark} />
                  ) },
                  { key: 'highlights', label: 'Highlights', icon: <HighlightIcon />, render: () => (
                    <HighlightsPanel
                      highlights={highlights}
                      onJump={(h) => { const p = (h.anchor as { page?: number }).page; if (p) goToPage(p) }}
                      onDelete={removeHighlight}
                    />
                  ) },
                  { key: 'search', label: 'Search', icon: <SearchIcon />, render: () => (
                    <SearchPanel onSearch={(q) => searchPdf(fileUrl, q)} onJump={(r) => goToPage(Number(r.location))} />
                  ) },
                ]}
              />
            )}
            {/* Reading region is non-scrolling (relative) so the menu/bookmark controls stay
                pinned while the pages scroll inside the inner container. */}
            <div className="relative min-h-0 flex-1">
              {!sidebarOpen && (
                <button
                  type="button"
                  aria-label="Menu"
                  onClick={() => setSidebarOpen(true)}
                  className="absolute left-3 top-3 z-10 rounded-md border border-line bg-paper-raised/90 p-1.5 text-ink-soft shadow-sm backdrop-blur-sm hover:bg-paper-raised"
                >
                  <PanelIcon className="h-5 w-5" />
                </button>
              )}
              <div className="absolute right-3 top-3 z-10">
                <BookmarkStar active={isBookmarked} onToggle={() => { void toggleBookmark() }} />
              </div>
              <div className="h-full overflow-auto bg-[#efece4]">
                <div className="flex justify-center px-4">
                  <PdfViewer
                    ref={viewerRef}
                    fileUrl={fileUrl} numPages={numPages} scale={scale} initialPage={initialPage}
                    onNumPages={setNumPages}
                    highlightsByPage={highlightsByPage}
                    onVisiblePage={setPage}
                    onSelect={(s) => setPopover({ mode: 'create', x: s.x, y: s.y, page: s.page, rects: s.rects, text: s.text })}
                    onHighlightClick={(id, x, y) => {
                      const h = highlights.find((v) => v.id === id)
                      if (h) setPopover({ mode: 'edit', x, y, id, color: h.color, note: h.note })
                    }}
                  />
                </div>
              </div>
              {popover && (
                <HighlightPopover
                  key={popover.id ?? 'create'}
                  x={popover.x} y={popover.y} mode={popover.mode}
                  color={popover.color} note={popover.note}
                  onPickColor={(c) => { void (popover.mode === 'create' ? createHighlight(c) : changeColor(c)) }}
                  onSaveNote={(n) => { void saveNote(n) }}
                  onDelete={() => { if (popover.id) void removeHighlight(popover.id) }}
                  onClose={closePopover}
                />
              )}
            </div>
          </>
        ) : book.format === 'epub' && fileUrl ? (
          <EpubReader bookId={book.id} fileUrl={fileUrl} onBack={goBack} />
        ) : (
          <div className="p-8 text-ink-soft">Loading…</div>
        )}
      </div>
    </div>
  )
}
