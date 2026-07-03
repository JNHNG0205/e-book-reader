import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Book, BookFormat } from '@shared/types'
import {
  listBooks, uploadBook, renameBook, deleteBook, getCoverUrl, getBookFileUrl, saveCover,
} from '@backend/data/books'
import { extractCoverBlob } from '@frontend/library/coverExtract'
import { BookCard } from '@frontend/components/BookCard'
import { UploadButton } from '@frontend/components/UploadButton'

export function LibraryPage() {
  const navigate = useNavigate()
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [covers, setCovers] = useState<Record<string, string>>({})
  const processedCoverIds = useRef(new Set<string>())

  const refresh = useCallback(async () => {
    try {
      setError(null)
      setBooks(await listBooks())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    const pending = books.filter((b) => !processedCoverIds.current.has(b.id))
    if (pending.length === 0) return
    for (const b of pending) processedCoverIds.current.add(b.id)

    void Promise.all(pending.map(async (b) => {
      try {
        let path = b.cover_path
        if (!path) {
          const url = await getBookFileUrl(b.storage_path)
          const buf = await (await fetch(url)).arrayBuffer()
          const blob = await extractCoverBlob(buf, b.format)
          if (!blob) return
          path = await saveCover(b.id, blob)
        }
        const signed = await getCoverUrl(path)
        setCovers((prev) => ({ ...prev, [b.id]: signed }))
      } catch {
        // leave placeholder on failure
      }
    }))
  }, [books])

  async function handleUpload(file: File, meta: { title: string; format: BookFormat }) {
    try {
      await uploadBook(file, meta)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  async function handleRename(id: string, title: string) {
    try {
      await renameBook(id, title)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  async function handleDelete(id: string) {
    try {
      await deleteBook(id)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">My library</h2>
        <UploadButton onUpload={handleUpload} />
      </div>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : books.length === 0 ? (
        <p className="text-gray-500">No books yet — add your first PDF or EPUB.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {books.map((b) => (
            <BookCard
              key={b.id}
              book={b}
              coverUrl={covers[b.id] ?? null}
              onOpen={(id) => navigate('/read/' + id)}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
