import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Book } from '@shared/types'
import { getBook, getBookFileUrl } from '@backend/data/books'
import { PdfViewer } from '@frontend/reader/PdfViewer'
import { ReaderToolbar } from '@frontend/reader/ReaderToolbar'

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

  useEffect(() => {
    if (!bookId) return
    let active = true
    ;(async () => {
      try {
        const b = await getBook(bookId)
        if (!active) return
        setBook(b)
        if (b.format === 'pdf') setFileUrl(await getBookFileUrl(b.storage_path))
      } catch (e) {
        if (active) setError((e as Error).message)
      }
    })()
    return () => { active = false }
  }, [bookId])

  const goBack = useCallback(() => navigate('/'), [navigate])
  const prev = () => setPage((p) => Math.max(1, p - 1))
  const next = () => setPage((p) => (numPages ? Math.min(numPages, p + 1) : p + 1))
  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, Math.round((s + 0.25) * 100) / 100))
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, Math.round((s - 0.25) * 100) / 100))

  if (error) return <div className="p-6 text-red-600" role="alert">{error}</div>
  if (!book) return <div className="p-6">Loading…</div>

  return (
    <div className="flex h-[calc(100vh-49px)] flex-col">
      <ReaderToolbar
        page={page} numPages={numPages} scale={scale}
        onPrev={prev} onNext={next} onZoomIn={zoomIn} onZoomOut={zoomOut} onBack={goBack}
      />
      <div className="flex flex-1 justify-center overflow-auto bg-gray-100 p-4">
        {book.format === 'pdf' && fileUrl ? (
          <PdfViewer fileUrl={fileUrl} pageNumber={page} scale={scale} onNumPages={setNumPages} />
        ) : book.format === 'pdf' ? (
          <div className="p-8 text-gray-500">Loading PDF…</div>
        ) : (
          <div className="p-8 text-gray-500">
            This format is not supported yet — EPUB reading arrives in a later update.
          </div>
        )}
      </div>
    </div>
  )
}
