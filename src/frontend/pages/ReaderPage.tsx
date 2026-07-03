import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Book, Bookmark } from '@shared/types'
import { getBook, getBookFileUrl } from '@backend/data/books'
import { getProgress, saveProgress } from '@backend/data/progress'
import { listBookmarks, saveBookmark, deleteBookmark } from '@backend/data/bookmarks'
import { PdfViewer } from '@frontend/reader/PdfViewer'
import { ReaderToolbar } from '@frontend/reader/ReaderToolbar'
import { EpubReader } from '@frontend/reader/EpubReader'
import { ReaderSidebar } from '@frontend/reader/ReaderSidebar'
import { BookmarksPanel } from '@frontend/reader/BookmarksPanel'

const MIN_SCALE = 0.5
const MAX_SCALE = 3

export function ReaderPage() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const [book, setBook] = useState<Book | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])

  useEffect(() => {
    if (!bookId) return
    let active = true
    ;(async () => {
      try {
        const b = await getBook(bookId)
        if (!active) return
        setBook(b)
        setFileUrl(await getBookFileUrl(b.storage_path))
        if (b.format === 'pdf') {
          const saved = await getProgress(bookId)
          if (active && saved) setPage(Math.max(1, parseInt(saved, 10) || 1))
        }
      } catch (e) {
        if (active) setError((e as Error).message)
      }
    })()
    return () => { active = false }
  }, [bookId])

  const didMount = useRef(false)
  useEffect(() => {
    if (!bookId || book?.format !== 'pdf') return
    if (!didMount.current) { didMount.current = true; return }
    const t = setTimeout(() => { void saveProgress(bookId, String(page)) }, 500)
    return () => clearTimeout(t)
  }, [bookId, page, book])

  useEffect(() => {
    if (book?.format === 'pdf' && numPages && page > numPages) setPage(numPages)
  }, [book, numPages, page])

  useEffect(() => {
    if (!bookId || book?.format !== 'pdf') return
    listBookmarks(bookId).then(setBookmarks).catch(() => {})
  }, [bookId, book?.format])

  const goBack = useCallback(() => navigate('/'), [navigate])
  const prev = () => setPage((p) => Math.max(1, p - 1))
  const next = () => setPage((p) => (numPages ? Math.min(numPages, p + 1) : p + 1))
  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, Math.round((s + 0.25) * 100) / 100))
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, Math.round((s - 0.25) * 100) / 100))

  async function addBookmark() {
    const bm = await saveBookmark(book!.id, { location: String(page), label: `Page ${page}` })
    setBookmarks((prev) => [...prev, bm])
  }
  async function removeBookmark(id: string) {
    await deleteBookmark(id)
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
  }
  function jumpToBookmark(location: string) {
    const p = parseInt(location, 10)
    if (p) setPage(p)
  }

  if (error) return <div className="p-6 text-red-600" role="alert">{error}</div>
  if (!book) return <div className="p-6">Loading…</div>

  return (
    <div className="flex h-[calc(100vh-49px)] flex-col">
      {book.format === 'pdf' && (
        <ReaderToolbar
          page={page} numPages={numPages} scale={scale}
          onPrev={prev} onNext={next} onZoomIn={zoomIn} onZoomOut={zoomOut} onBack={goBack}
          onAddBookmark={() => { void addBookmark() }}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
      )}
      <div className="flex flex-1 justify-center overflow-auto bg-gray-100">
        {book.format === 'pdf' && fileUrl ? (
          <>
            {sidebarOpen && (
              <ReaderSidebar
                onClose={() => setSidebarOpen(false)}
                tabs={[{ key: 'bookmarks', label: 'Bookmarks', render: () => (
                  <BookmarksPanel bookmarks={bookmarks} onJump={jumpToBookmark} onDelete={removeBookmark} />
                ) }]}
              />
            )}
            <div className="p-4">
              <PdfViewer fileUrl={fileUrl} pageNumber={page} scale={scale} onNumPages={setNumPages} />
            </div>
          </>
        ) : book.format === 'epub' && fileUrl ? (
          <EpubReader bookId={book.id} fileUrl={fileUrl} onBack={goBack} />
        ) : (
          <div className="p-8 text-gray-500">Loading…</div>
        )}
      </div>
    </div>
  )
}
